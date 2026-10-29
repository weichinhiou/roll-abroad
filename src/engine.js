// 大赴翁 Roll Abroad — 遊戲引擎（純函式，不碰 DOM）
// 相同 seed + 相同選擇 = 相同結果。所有隨機都從 state.rng 推。

const DICE = [1, 1, 2, 2, 3, 3];
export const MILESTONES = [6, 12, 18, 24];
export const RES_KEYS = ["time", "money", "energy"];
export const RES_LIMIT = 10;

// xorshift32：小而夠用，整數狀態方便存檔
function nextUint32(rngState) {
  let x = rngState >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return x;
}

// 回傳 [0, n) 的整數與新的 rng 狀態
function randInt(rngState, n) {
  const next = nextUint32(rngState);
  return [(next % n + n) % n, next];
}

export function seedFromString(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

const clone = (state) => structuredClone(state);

export function initialState({ seed, route }) {
  const rng = typeof seed === "number" ? seed >>> 0 || 1 : seedFromString(String(seed || "roll-abroad"));
  return {
    seed,
    rng,
    route: route || null,
    pos: 0,
    rolls: 0,
    res: { time: 8, money: 8, energy: 8, knowledge: 0 },
    items: { plan: 1, consult: 1, door: 1, usb: route === "poster" ? 1 : 0, badge: route === "oral" ? 1 : 0 },
    flags: {},
    drawn: [],
    pending: [], // 連鎖排程：下一次抽牌優先從這裡拿
    log: [],
    keyChoices: [],
    status: "ready", // ready | event | checkpoint | done
    pendingEvent: null,
    pendingCheckpoint: null,
    ending: null,
    over: null, // 強制結束原因
  };
}

// ── 擲骰與移動（防跳關）────────────────────────────────────
export function rollDie(state) {
  const [i, rng] = randInt(state.rng, DICE.length);
  const next = clone(state);
  next.rng = rng;
  return { ...next, dice: DICE[i] };
}

export function forcedRoll(state, face) {
  if (!DICE.includes(face) || state.items.plan <= 0) return null;
  const next = clone(state);
  next.items.plan -= 1;
  return { ...next, dice: face, usedPlan: true };
}

// 擲出骰子後執行移動；跨越里程碑時強制停在里程碑
export function applyMove(state, board) {
  const steps = state.dice;
  if (!steps) return state;
  const next = clone(state);
  const from = next.pos;
  let to = from + steps;
  const blocked = MILESTONES.filter((m) => m > from && m < to).sort((a, b) => a - b)[0];
  let stopped = false;
  if (blocked) {
    to = blocked;
    stopped = true;
  }
  if (to > 24) to = 24;
  next.pos = to;
  next.rolls += 1;
  next.dice = null;
  const square = board.squares.find((s) => s.n === to);
  next.log.push({
    kind: "move",
    text: `擲出 ${steps}，走到第 ${to} 格〈${square.label}〉${stopped ? "（里程碑強制停下）" : ""}`,
  });
  return next;
}

// ── 抽牌 ────────────────────────────────────────────────
export function isEligible(card, state) {
  if (state.drawn.includes(card.id)) return false;
  if (card.route && card.route !== "both" && card.route !== state.route) return false;
  if (card.chapters && !card.chapters.includes(card.chapterNow)) return false;
  if (card.requires && !state.flags[card.requires]) return false;
  return true;
}

function pick(state, pool) {
  if (!pool.length) return [null, state];
  const [i, rng] = randInt(state.rng, pool.length);
  const next = clone(state);
  next.rng = rng;
  return [pool[i], next];
}

// 抽一張牌：連鎖優先，其次依格子屬性
export function drawCard(state, board, events, square) {
  if (state.pending.length) {
    const id = state.pending.shift();
    const card = events.cards.find((c) => c.id === id && isEligible(c, { ...state, chapterNow: square.chapter }));
    if (card) {
      const next = clone(state);
      next.pending = state.pending;
      return enterEvent(next, card);
    }
  }
  const ctx = { ...state, chapterNow: square.chapter };
  const deckKind = square.kind === "route" ? (state.route === "oral" ? "fate" : "chance") : square.kind;
  const pool = events.cards.filter((c) => c.deck === deckKind && isEligible(c, ctx));
  const [card, after] = pick(state, pool);
  if (!card) {
    const next = clone(state);
    next.log.push({ kind: "quiet", text: `第 ${square.n} 格這局沒有觸發事件。` });
    return advanceReady(next);
  }
  return enterEvent(after, card);
}

function enterEvent(state, card) {
  const next = clone(state);
  next.drawn.push(card.id);
  next.status = "event";
  next.pendingEvent = {
    id: card.id,
    title: card.title,
    text: card.text,
    tone: card.tone,
    social: card.social || false,
    trueStory: card.trueStory || null,
    choices: card.choices,
  };
  next.log.push({ kind: "card", text: `【${card.deck === "fate" ? "命運" : "機會"}】${card.title}` });
  return next;
}

// 沒有事件可抽時，往前補一格直到有牌可抽或抵達終點
function advanceReady(state) {
  if (state.pos >= 24) return { ...state, status: "done" };
  return { ...state, status: "ready" };
}

// ── 結算效果 ─────────────────────────────────────────────
function clampRes(res) {
  const out = { ...res };
  for (const k of RES_KEYS) out[k] = Math.max(0, Math.min(RES_LIMIT, out[k]));
  out.knowledge = Math.max(0, out.knowledge);
  return out;
}

export function applyChoice(state, card, choice, data) {
  const next = clone(state);
  const idx = card.choices.indexOf(choice);
  let eff = { ...(choice.effects || {}) };
  const notes = [];

  if (eff.penalty) {
    const p = eff.penalty;
    delete eff.penalty;
    if (next.items.consult > 0) {
      next.items.consult -= 1;
      notes.push("使用「承辦人諮詢」：免去這次行政懲罰。");
    } else {
      // 懲罰的數值加進效果裡（原本整包塞回 eff，扣分從未生效）
      for (const [k, v] of Object.entries(p)) eff[k] = (eff[k] || 0) + v;
    }
  }
  if (eff.flagLoss && next.items.usb > 0 && card.id === "F-usb") {
    next.items.usb -= 1;
    delete eff.flagLoss;
    notes.push("使用「備份隨身碟」：檔案補得上來。");
  }
  // social 標在選項上（例如咖啡卡「邊等邊聊」）；名片是一次性道具，用掉要扣
  if (eff.knowledge > 0 && (choice.social || card.social) && next.items.badge > 0) {
    next.items.badge -= 1;
    eff.knowledge *= 2;
    notes.push("使用「名片」：交流收穫加倍。");
  }

  for (const k of ["time", "money", "energy", "knowledge"]) {
    if (eff[k]) next.res[k] += eff[k];
  }
  next.res = clampRes(next.res);

  // 資源歸零：不判死，勉強撐過但學術收穫扣分（保證 0 死局）
  for (const k of RES_KEYS) {
    if (next.res[k] === 0) {
      next.res[k] = 1;
      next.res.knowledge = Math.max(0, next.res.knowledge - 2);
      notes.push(`${resName(k)}耗盡，勉強撐過去（學術收穫 −2）。`);
    }
  }

  if (choice.route) {
    next.route = choice.route;
    if (choice.route === "poster") next.items.usb += 1;
    if (choice.route === "oral") next.items.badge += 1;
    notes.push(choice.route === "poster" ? "取得「備份隨身碟」。" : "取得「名片」。");
  }
  if (choice.flags) Object.assign(next.flags, choice.flags);
  if (choice.chain) {
    next.pending.push(choice.chain);
    notes.push(`（後續：這件事還沒結束……）`);
  }

  const delta = Math.abs(choice.effects?.knowledge || 0) + Math.abs(choice.effects?.time || 0) + Math.abs(choice.effects?.energy || 0);
  if (delta >= 2) next.keyChoices.push({ card: card.title, choice: choice.label, note: choice.note || "" });

  next.log.push({ kind: "choice", text: `選擇「${choice.label}」— ${choice.note || "（效果已結算）"}` });
  if (card.trueStory) next.log.push({ kind: "true", text: `📌 真實改編｜${card.trueStory}` });
  for (const n of notes) next.log.push({ kind: "note", text: n });
  next.pendingEvent = null;
  next.pendingCheckpoint = null;
  return finishTurn(next, data);
}

function finishTurn(state) {
  if (state.pos >= 24) return settle(state);
  return { ...state, status: "ready" };
}

// ── 里程碑 ───────────────────────────────────────────────
export function checkpointAt(state, board, data) {
  const square = board.squares.find((s) => s.n === state.pos);
  if (!square || square.kind !== "milestone") return state;
  const cp = data.checkpoints[square.milestone];
  if (!cp) return state;
  const next = clone(state);
  next.status = "checkpoint";
  next.pendingCheckpoint = { id: square.milestone, title: cp.title, text: cp.text, choices: cp.choices };
  return next;
}

// ── 結局 ────────────────────────────────────────────────
export function settle(state) {
  const next = clone(state);
  const k = next.res.knowledge;
  const low = RES_KEYS.filter((r) => next.res[r] <= 2).length;
  let ending;
  if (k >= 12 && low === 0) ending = "stage";
  else if (k >= 8) ending = "steady";
  else if (k <= 3) ending = "safe";
  else ending = "wild";
  next.ending = { id: ending, ...data_endings[ending] };
  next.keyChoices = next.keyChoices.slice(-3);
  next.status = "done";
  return next;
}

const data_endings = {
  stage: { title: "國際舞台新面孔", text: "收穫滿行囊，資源也留得住。下次可以直接排兩場。" },
  steady: { title: "穩健的學術旅人", text: "該拿的都拿到了，過程沒有太狼狽。" },
  wild: { title: "高張力完成者", text: "幾度差點走不下去，但你還是把旅程走完了。" },
  safe: { title: "平安就是福", text: "人回來了、單核銷了，收穫就留在路上吧。" },
};

export function resName(k) {
  return { time: "時間", money: "經費", energy: "精力", knowledge: "學術收穫" }[k] || k;
}
