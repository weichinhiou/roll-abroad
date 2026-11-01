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

// 玩完一局，回傳最終 state。choose(n) 回傳 [0, n) 的選項索引。
export function playGame(data, seed, choose = seededChooser(seed), maxSteps = 200) {
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
    s = E.applyChoice(s, block, block.choices[choose(block.choices.length)], data);
  }
  throw new Error(`seed ${seed} 在 ${maxSteps} 步內沒有結束（死局）`);
}

export function simulate(n = 1000, data = loadData()) {
  const endings = {};
  const drawn = {};
  const rolls = [];
  const knowledge = [];
  for (let i = 0; i < n; i++) {
    const s = playGame(data, `sim-${i}`);
    endings[s.ending.id] = (endings[s.ending.id] || 0) + 1;
    for (const id of s.drawn) drawn[id] = (drawn[id] || 0) + 1;
    rolls.push(s.rolls);
    knowledge.push(s.res.knowledge);
  }
  return { n, endings, drawn, rolls, knowledge };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = Number(process.argv[2]) || 1000;
  const r = simulate(n);
  const sorted = [...r.rolls].sort((a, b) => a - b);
  const mean = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log(`局數 ${n}`);
  console.log("結局", r.endings);
  console.log(`擲骰 最少 ${sorted[0]}、中位數 ${sorted[n >> 1]}、最多 ${sorted.at(-1)}、平均 ${mean(r.rolls)}`);
  const ks = [...r.knowledge].sort((a, b) => a - b);
  console.log(`學術收穫 最少 ${ks[0]}、中位數 ${ks[n >> 1]}、最多 ${ks.at(-1)}、平均 ${mean(r.knowledge)}`);
  console.log(`抽到過的卡 ${Object.keys(r.drawn).length} 張`, r.drawn);
}
