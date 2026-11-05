// 大赴翁 Roll Abroad — 遊戲引擎（純函式，不碰 DOM）
// 相同 seed + 相同選擇 = 相同結果。所有隨機都從 state.rng 推。

const DICE = [1, 1, 2, 2, 3, 3];
// 五個角落＝五個里程碑；最後一格（終點）就是最後一個里程碑
export const MILESTONES = [6, 12, 18, 24, 32];
const END = MILESTONES[MILESTONES.length - 1];
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
    strain: 0, // 資源耗盡過幾次，結局會看
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
  if (to > END) to = END;
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
  // chapterNow 為 null 表示「不限章節」（抽牌池空時的保險用）
  if (card.chapters && state.chapterNow != null && !card.chapters.includes(state.chapterNow)) return false;
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
    // 先複製再取出，不改到傳入的 state
    const [id, ...rest] = state.pending;
    state = { ...state, pending: rest };
    // 連鎖是劇情的延續，不受章節門檻影響
    const card = events.cards.find((c) => c.id === id && isEligible(c, { ...state, chapterNow: null }));
    if (card) return enterEvent(state, card);
  }
  const ctx = { ...state, chapterNow: square.chapter };
  const deckKind = square.kind === "route" ? (state.route === "oral" ? "fate" : "chance") : square.kind;
  let pool = events.cards.filter((c) => c.deck === deckKind && isEligible(c, ctx));
  if (!pool.length) {
    // 這一章的牌都抽完了就退回不限章節，避免格子變成空轉
    pool = events.cards.filter((c) => c.deck === deckKind && isEligible(c, { ...ctx, chapterNow: null }));
  }
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
    deck: card.deck,
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
  if (state.pos >= END) return { ...state, status: "done" };
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
      next.strain = (next.strain || 0) + 1;
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
  // 「滿載而歸」兌現承諾：記下玩家用哪個承諾收尾，結算畫面蓋「已兌現」章
  if (card.id === "final" && choice.requires) {
    next.kept = [...(next.kept || []), choice.requires];
  }
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
  if (state.pos >= END) return settle(state);
  return { ...state, status: "ready" };
}

// ── 里程碑 ───────────────────────────────────────────────
export function checkpointAt(state, board, data) {
  const square = board.squares.find((s) => s.n === state.pos);
  if (!square || square.kind !== "milestone") return state;
  const cp = data.checkpoints[square.milestone];
  if (!cp) return state;
  const next = clone(state);
  // 選項可以掛 requires：只顯示玩家立過旗標的選項（例如最後一關的承諾兌現選項）。
  // 全被濾掉時退回完整清單，避免死局。
  const choices = cp.choices.filter((c) => !c.requires || next.flags[c.requires]);
  next.status = "checkpoint";
  next.pendingCheckpoint = { id: square.milestone, title: cp.title, text: cp.text, choices: choices.length ? choices : cp.choices };
  return next;
}

// ── 結局 ────────────────────────────────────────────────
export function settle(state) {
  const next = clone(state);
  const k = next.res.knowledge;
  const minRes = Math.min(...RES_KEYS.map((r) => next.res[r]));
  // 多面向計分：收穫＋資源狀況，稱號才對得上結局文字
  let ending;
  if (k >= 13 && minRes >= 3) ending = "stage";
  else if ((next.strain || 0) >= 2) ending = "wild";
  else if (k <= 9) ending = "safe";
  else ending = "steady";
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

// ── 風格稱號（第二維度）─────────────────────────────────
// 結局（上面四個）看的是分數與資源，風格稱號看的是「這一趟走的是哪種路」，
// 由既有旗標推出來，不影響結局。行政模範：N42/43/45/46/48 的好選項各記一面 admin_ 旗標，累積三面才算。
export const STYLES = Object.freeze({
  admin: { title: "行政模範生", text: "公假、登錄、佐證一次到位，承辦人都記得你。" },
  research: { title: "研究實踐派", text: "稿子與問題都帶回來，這趟不只是旅行。" },
  network: { title: "人脈收藏家", text: "名片換了一疊，那封信也真的回了。" },
  mentor: { title: "接棒傳承者", text: "當年有人帶你，現在換你帶人。" },
});
const STYLE_FALLBACK = Object.freeze({
  poster: { id: "poster", title: "壁報耕耘者", text: "站在自己的海報前，把路過的人聊成同行。" },
  oral: { id: "oral", title: "上台挑戰者", text: "八分鐘站上去，問題也都接下來了。" },
  none: { id: "none", title: "一路探索的旅人", text: "還沒定下風格，下一趟換條路走走看。" },
});
const STYLE_ORDER = ["admin", "research", "network", "mentor"]; // 同分時的優先順序

export function styleOf(state) {
  const f = state.flags || {};
  const kept = state.kept || [];
  const has = (k) => (f[k] ? 1 : 0) + (kept.includes(k) ? 1 : 0); // 立過旗標 +1，到「滿載而歸」真的兌現再 +1
  const adminCount = Object.keys(f).filter((k) => k.startsWith("admin_") && f[k]).length;
  const score = {
    admin: adminCount >= 3 ? adminCount : 0,
    research: has("pub_pending") + has("oral_qa"),
    network: has("network"),
    mentor: has("mentor"),
  };
  let best = null;
  for (const id of STYLE_ORDER) if (score[id] > 0 && (best === null || score[id] > score[best])) best = id;
  if (best) return { id: best, ...STYLES[best] };
  return STYLE_FALLBACK[state.route] || STYLE_FALLBACK.none;
}

export function resName(k) {
  return { time: "時間", money: "經費", energy: "精力", knowledge: "學術收穫" }[k] || k;
}

// ── 旅程結算（結算畫面吃的純資料）───────────────────────
// 承諾清單＝「滿載而歸」那一關 requires 掛的旗標，跟 data/checkpoints.json 對得上。
export const PROMISES = Object.freeze([
  { key: "pub_pending", label: "三年內把稿子真的送出去" },
  { key: "network", label: "回覆那封說「有興趣繼續合作」的信" },
  { key: "oral_qa", label: "把被問倒的問題查個水落石出" },
  { key: "mentor", label: "把出國前幫你的那位，回饋回去" },
]);

const RES_START = { time: 8, money: 8, energy: 8, knowledge: 0 };
const SET_RES = ["time", "money", "energy", "knowledge"];

// 純函式：把一局 state 壓成結算畫面要顯示的資料，不碰 DOM。
export function settlement(state) {
  const s = state.status === "done" ? state : settle(state);
  const kept = s.kept || [];
  return {
    ending: s.ending,
    style: styleOf(s),
    seed: s.seed ?? "未命名",
    route: s.route ? { poster: "壁報路線", oral: "口報路線" }[s.route] : null,
    res: SET_RES.map((k) => ({
      key: k,
      name: resName(k),
      start: RES_START[k],
      value: s.res[k],
      delta: s.res[k] - RES_START[k],
    })),
    // brought＝路上把承諾帶回來（立過旗標）；kept＝到「滿載而歸」真的兌現了
    promises: PROMISES.map((p) => ({
      ...p,
      brought: !!s.flags[p.key],
      kept: kept.includes(p.key),
    })),
    stats: [
      { label: "擲骰次數", value: s.rolls },
      { label: "走過格數", value: `${s.pos}/32` },
      { label: "抽過的卡", value: (s.drawn || []).length },
      { label: "資源耗盡", value: `${s.strain || 0} 次` },
    ],
    keyChoices: (s.keyChoices || []).slice(-3),
  };
}
