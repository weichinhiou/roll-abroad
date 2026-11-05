// 無頭模擬：用引擎從頭玩到尾，給測試與平衡調整用。
// 直接執行會印出分布：node scripts/simulate.mjs [局數]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as E from "../src/engine.js";

const root = new URL("../data/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, root), "utf8"));

export function loadData() {
  return {
    board: read("board.json"),
    events: read("events.json"),
    items: read("items.json"),
    checkpoints: read("checkpoints.json").checkpoints,
  };
}

// 模擬玩家的選擇用另一條 seed，跟遊戲本身的 rng 分開
export function seededChooser(seed) {
  let x = E.seedFromString(`chooser:${seed}`);
  return (n) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % n;
  };
}

// 「會挑的玩家」：看選項的資源變化打分（學術收穫算兩倍，扣分一併計入），分高的勝出。
// 這是粗略的人類代理，不是最佳解；skill 是挑最高分的機率，其餘時候隨機選（0 = 完全隨機，1 = 一律挑最高分）。
// 給了 res（目前資源）就會「看資源條」：選完會讓某項歸零的選項大扣分，剩 2 以下小扣分——
// 這是人會做的事，不看資源條的玩家（沒給 res）會一路選收穫最高的，容易把資源耗盡。
export function scoreChoice(choice, res = null) {
  const e = choice.effects || {};
  let score = 0;
  for (const k of ["time", "money", "energy"]) score += e[k] || 0;
  score += 2 * (e.knowledge || 0);
  for (const v of Object.values(e.penalty || {})) score += v;
  if (e.flagLoss) score -= 1;
  score += 0.5 * Object.keys(choice.flags || {}).length;
  if (res) {
    for (const k of ["time", "money", "energy"]) {
      const after = res[k] + (e[k] || 0) + ((e.penalty || {})[k] || 0);
      if (after <= 0) score -= 6;
      else if (after <= 2) score -= 1.5;
    }
  }
  return score;
}

export function skilledPicker(skill, seed, watchBars = false) {
  const roll = seededChooser(`skill:${seed}`);
  return (block, choose, state) => {
    const cs = block.choices;
    if (roll(1000) >= skill * 1000) return cs[choose(cs.length)];
    const res = watchBars ? state.res : null;
    let best = cs[0];
    for (const c of cs) if (scoreChoice(c, res) > scoreChoice(best, res)) best = c;
    return best;
  };
}

// 玩完一局，回傳最終 state。choose(n) 回傳 [0, n) 的選項索引；
// pick(block, choose) 給了就用它挑選項（例如 skilledPicker），沒給就照 choose 隨機。
export function playGame(data, seed, choose = seededChooser(seed), maxSteps = 200, pick = null) {
  let s = E.initialState({ seed });
  for (let step = 0; step < maxSteps; step++) {
    if (s.status === "done") return s;
    if (s.status === "ready") {
      s = E.applyMove(E.rollDie(s), data.board);
      const sq = data.board.squares.find((x) => x.n === s.pos);
      s = sq.kind === "milestone" ? E.checkpointAt(s, data.board, data) : E.drawCard(s, data.board, data.events, sq);
      continue;
    }
    const block = s.pendingEvent || s.pendingCheckpoint;
    const choice = pick ? pick(block, choose, s) : block.choices[choose(block.choices.length)];
    s = E.applyChoice(s, block, choice, data);
  }
  throw new Error(`seed ${seed} 在 ${maxSteps} 步內沒有結束（死局）`);
}

export function simulate(n = 1000, data = loadData(), skill = null, watchBars = false) {
  const endings = {};
  const drawn = {};
  const rolls = [];
  const knowledge = [];
  for (let i = 0; i < n; i++) {
    const seed = `sim-${i}`;
    const s = playGame(data, seed, undefined, 200, skill == null ? null : skilledPicker(skill, seed, watchBars));
    endings[s.ending.id] = (endings[s.ending.id] || 0) + 1;
    for (const id of s.drawn) drawn[id] = (drawn[id] || 0) + 1;
    rolls.push(s.rolls);
    knowledge.push(s.res.knowledge);
  }
  return { n, endings, drawn, rolls, knowledge };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = Number(process.argv[2]) || 1000;
  // 可選：--skill=0.8 讓模擬玩家有 80% 機率挑「分數最高」的選項（預設完全隨機）
  const skillArg = process.argv.find((a) => a.startsWith("--skill="));
  const skill = skillArg ? Number(skillArg.slice("--skill=".length)) : null;
  // 再加 --watch：模擬玩家會看資源條，避免讓資源歸零
  const r = simulate(n, loadData(), skill, process.argv.includes("--watch"));
  const sorted = [...r.rolls].sort((a, b) => a - b);
  const mean = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log(`局數 ${n}`);
  console.log("結局", r.endings);
  console.log(`擲骰 最少 ${sorted[0]}、中位數 ${sorted[n >> 1]}、最多 ${sorted.at(-1)}、平均 ${mean(r.rolls)}`);
  const ks = [...r.knowledge].sort((a, b) => a - b);
  console.log(`學術收穫 最少 ${ks[0]}、中位數 ${ks[n >> 1]}、最多 ${ks.at(-1)}、平均 ${mean(r.knowledge)}`);
  console.log(`抽到過的卡 ${Object.keys(r.drawn).length} 張`, r.drawn);
}
