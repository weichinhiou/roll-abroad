// 引擎測試：node --test（npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import { loadData, playGame, simulate } from "../scripts/simulate.mjs";

const data = loadData();
const card = (id) => data.events.cards.find((c) => c.id === id);
const square = (n) => data.board.squares.find((s) => s.n === n);
const choice = (c, label) => c.choices.find((x) => x.label === label);

// 指定位置、骰子、路線的測試用 state
function at(pos, extra = {}) {
  const s = E.initialState({ seed: "unit", route: extra.route });
  return { ...s, pos, ...extra };
}

// ── 防跳關 ─────────────────────────────────────────────
test("防跳關：在第 5 格擲 3，停在里程碑第 6 格", () => {
  const s = E.applyMove(at(5, { dice: 3 }), data.board);
  assert.equal(s.pos, 6);
  assert.match(s.log.at(-1).text, /里程碑強制停下/);
});

test("防跳關：每個里程碑前擲 3 都會被擋下", () => {
  for (const m of E.MILESTONES) {
    for (const from of [m - 2, m - 1]) {
      const s = E.applyMove(at(from, { dice: 3 }), data.board);
      assert.equal(s.pos, m, `從 ${from} 擲 3 應停在 ${m}`);
    }
  }
});

test("防跳關：從里程碑出發不會被自己擋住，也不會超過第 32 格", () => {
  assert.equal(E.applyMove(at(6, { dice: 3 }), data.board).pos, 9);
  assert.equal(E.applyMove(at(23, { dice: 3 }), data.board).pos, 24);
  assert.equal(E.applyMove(at(31, { dice: 3 }), data.board).pos, 32);
  assert.equal(E.applyMove(at(30, { dice: 3 }), data.board).pos, 32);
  assert.equal(E.applyMove(at(32, { dice: 3 }), data.board).pos, 32);
});

test("提前規劃：指定點數並扣道具，沒道具或點數不合法時回 null", () => {
  const s = E.forcedRoll(at(0), 3);
  assert.equal(s.dice, 3);
  assert.equal(s.items.plan, 0);
  assert.equal(E.forcedRoll(s, 2), null);
  assert.equal(E.forcedRoll(at(0), 6), null);
});

// ── 資源上下限 ─────────────────────────────────────────
test("資源上限 10：增加超過上限會被截掉", () => {
  const c = { id: "x", title: "x", choices: [{ label: "x", effects: { time: 5, energy: 9 } }] };
  const s = E.applyChoice(at(3), c, c.choices[0], data);
  assert.equal(s.res.time, 10);
  assert.equal(s.res.energy, 10);
});

test("資源歸零不判死：補回 1，學術收穫 −2 且不低於 0", () => {
  const c = { id: "x", title: "x", choices: [{ label: "x", effects: { money: -20 } }] };
  const s0 = at(3);
  s0.res.knowledge = 1;
  const s = E.applyChoice(s0, c, c.choices[0], data);
  assert.equal(s.res.money, 1);
  assert.equal(s.res.knowledge, 0);
  assert.equal(s.status, "ready");
});

// ── 路線專屬卡 ─────────────────────────────────────────
test("口報線不抽 S03／S03b／T01，壁報線不抽 S04／T02（單張判斷）", () => {
  const oral = { ...at(14, { route: "oral" }), flags: { mentor: true } };
  const poster = { ...at(14, { route: "poster" }) };
  for (const id of ["S03", "S03b", "T01"]) assert.equal(E.isEligible(card(id), oral), false, id);
  for (const id of ["S04", "T02"]) assert.equal(E.isEligible(card(id), poster), false, id);
  assert.equal(E.isEligible(card("S04"), oral), true);
  assert.equal(E.isEligible(card("T01"), poster), true);
});

test("還沒選路線（第一章）不會抽到任何路線專屬卡", () => {
  const s = at(2);
  for (const c of data.events.cards.filter((c) => c.route === "poster" || c.route === "oral")) {
    assert.equal(E.isEligible(c, s), false, c.id);
  }
});

test("選路線的里程碑：壁報送備份隨身碟、口報送名片", () => {
  const cp = data.checkpoints.route;
  const p = E.applyChoice(at(6), cp, choice(cp, "走壁報路線"), data);
  const o = E.applyChoice(at(6), cp, choice(cp, "改申請口頭報告"), data);
  assert.equal(p.route, "poster");
  assert.equal(p.items.usb, 1);
  assert.equal(o.route, "oral");
  assert.equal(o.items.badge, 1);
});

// ── 連鎖 ───────────────────────────────────────────────
test("連鎖：S03 選完排入 S03b；有 mentor 時下一張一定是 S03b", () => {
  const s0 = { ...at(15, { route: "poster" }), flags: { mentor: true } };
  const s1 = E.applyChoice(s0, card("S03"), card("S03").choices[0], data);
  assert.deepEqual(s1.pending, ["S03b"]);
  // 第 16 格是命運格，S03b 是機會卡，但連鎖優先
  const s2 = E.drawCard(s1, data.board, data.events, square(16));
  assert.equal(s2.pendingEvent.id, "S03b");
  assert.deepEqual(s2.pending, []);
});

test("連鎖：沒有 mentor 時 S03b 不觸發，改抽一般卡", () => {
  const s1 = E.applyChoice(at(15, { route: "poster" }), card("S03"), card("S03").choices[1], data);
  const s2 = E.drawCard(s1, data.board, data.events, square(16));
  assert.notEqual(s2.pendingEvent?.id, "S03b");
  assert.deepEqual(s2.pending, []);
});

test("連鎖：S02 合作種子要先在咖啡卡交流（network）才抽得到", () => {
  const s0 = at(15, { route: "poster" });
  assert.equal(E.isEligible(card("S02"), s0), false);
  const s1 = E.applyChoice(s0, card("C07"), choice(card("C07"), "邊等邊聊自己的題目"), data);
  assert.equal(s1.flags.network, true);
  assert.equal(E.isEligible(card("S02"), s1), true);
});

test("連鎖指向的卡都存在", () => {
  const ids = new Set(data.events.cards.map((c) => c.id));
  for (const c of data.events.cards) {
    for (const ch of c.choices) if (ch.chain) assert.ok(ids.has(ch.chain), `${c.id} 指向不存在的 ${ch.chain}`);
  }
});

test("drawCard 不會改到傳入的 state（純函式）", () => {
  const s = { ...at(16, { route: "poster" }), pending: ["S03b"] };
  E.drawCard(s, data.board, data.events, square(16));
  assert.deepEqual(s.pending, ["S03b"]);
});

// ── 行政懲罰與承辦人諮詢 ───────────────────────────────
test("行政懲罰：有承辦人諮詢就免罰並扣道具", () => {
  const c = card("C11");
  const s = E.applyChoice({ ...at(21), res: { time: 8, money: 8, energy: 8, knowledge: 5 } }, c, choice(c, "拖到最後一天"), data);
  assert.equal(s.items.consult, 0);
  assert.equal(s.res.knowledge, 5);
  assert.equal(s.res.energy, 6);
});

test("行政懲罰：沒有承辦人諮詢就照扣", () => {
  const c = card("T04");
  const s0 = { ...at(10), res: { time: 8, money: 8, energy: 8, knowledge: 5 } };
  s0.items.consult = 0;
  const s = E.applyChoice(s0, c, choice(c, "應該沒問題吧"), data);
  assert.equal(s.res.money, 6);
  assert.equal(s.res.knowledge, 4);
});

// ── 名片與備份隨身碟 ───────────────────────────────────
test("名片：交流選項的學術收穫加倍，用一次就扣掉", () => {
  const c = card("C07");
  const ch = choice(c, "邊等邊聊自己的題目");
  const s1 = E.applyChoice(at(15, { route: "oral" }), c, ch, data);
  assert.equal(s1.res.knowledge, 4);
  assert.equal(s1.items.badge, 0);
  const s2 = E.applyChoice(s1, c, ch, data);
  assert.equal(s2.res.knowledge, 6);
});

test("名片：不是交流的選項不會消耗名片", () => {
  const c = card("C01");
  const s = E.applyChoice(at(2, { route: "oral" }), c, c.choices[0], data);
  assert.equal(s.items.badge, 1);
});

test("備份隨身碟：只在 F-usb 用掉並免除檔案損失", () => {
  const c = card("F-usb");
  const s = E.applyChoice(at(16, { route: "poster" }), c, choice(c, "用口頭講完全部"), data);
  assert.equal(s.items.usb, 0);
  assert.ok(s.log.some((l) => l.text.includes("備份隨身碟")));
});

test("真實改編卡選完會在行程紀錄記一行", () => {
  const c = card("T03");
  const s = E.applyChoice(at(13), c, c.choices[0], data);
  assert.ok(s.log.some((l) => l.kind === "true" && l.text.startsWith("📌 真實改編")));
});

// ── 結局 ───────────────────────────────────────────────
test("結局：看學術收穫，也看中途耗盡過幾次", () => {
  const end = (knowledge, min, strain = 0) => E.settle({ ...at(32), strain, res: { time: min, money: 8, energy: 8, knowledge } }).ending.id;
  assert.equal(end(13, 3), "stage");
  assert.equal(end(13, 2), "steady");
  assert.equal(end(13, 3, 2), "stage"); // 中途見底但收穫滿行囊、資源也留得住，還是國際舞台
  assert.equal(end(12, 5, 2), "wild");  // 幾度差點走不下去
  assert.equal(end(12, 5, 1), "steady");
  assert.equal(end(8, 1), "safe");
  assert.equal(end(9, 5), "safe");
  assert.equal(end(10, 5), "steady");
});

test("資源耗盡會記一次 strain；舊存檔沒有這個欄位也能結算", () => {
  const c = { id: "x", title: "x", choices: [{ label: "x", effects: { money: -20 } }] };
  assert.equal(E.applyChoice(at(3), c, c.choices[0], data).strain, 1);
  const old = at(32);
  delete old.strain;
  assert.ok(E.settle(old).ending.id);
});

// ── 章節門檻 ───────────────────────────────────────────
test("章節門檻：只在標示的章節抽得到，chapterNow 為 null 表示不限章節", () => {
  const card = { id: "ch5only", deck: "chance", route: "both", chapters: [5] };
  const s = at(3, { route: "oral" });
  assert.equal(E.isEligible(card, { ...s, chapterNow: 5 }), true);
  assert.equal(E.isEligible(card, { ...s, chapterNow: 4 }), false);
  assert.equal(E.isEligible(card, { ...s, chapterNow: null }), true);
});

test("章節門檻：某章牌被抽完就退回不限章節，格子不會空轉", () => {
  const card = { id: "ch5only", deck: "chance", route: "both", chapters: [5],
    title: "t", choices: [{ label: "a", effects: {} }, { label: "b", effects: {} }] };
  const events = { cards: [card], items: data.items };
  const sq = { n: 3, chapter: 1, kind: "chance", label: "x" };
  const out = E.drawCard(at(3), data.board, events, sq);
  assert.equal(out.pendingEvent.id, "ch5only");
});

test("章節門檻：連鎖卡不受章節限制，跨章仍接得上", () => {
  const chain = { id: "chainB", deck: "chance", route: "both", chapters: [5],
    title: "t", choices: [{ label: "a", effects: {} }, { label: "b", effects: {} }] };
  const events = { cards: [chain], items: data.items };
  const sq = { n: 3, chapter: 1, kind: "chance", label: "x" };
  const out = E.drawCard(at(3, { pending: ["chainB"] }), data.board, events, sq);
  assert.equal(out.pendingEvent.id, "chainB");
});

// ── seed 重現 ──────────────────────────────────────────
test("相同 seed 加上相同選擇，整局結果一模一樣", () => {
  for (const seed of ["demo-1109", "jean-test", 42]) {
    assert.deepEqual(playGame(data, seed), playGame(data, seed));
  }
});

test("不同 seed 會走出不同的局", () => {
  const runs = new Set(["a", "b", "c", "d", "e"].map((seed) => JSON.stringify(playGame(data, seed).drawn)));
  assert.ok(runs.size > 1);
});

// ── 1,000 局模擬 ───────────────────────────────────────
test("1,000 局模擬：死局 0、每張卡都抽得到、擲骰平均 10–25 次、四種結局都會出現", () => {
  const r = simulate(1000, data); // 任何一局卡住都會 throw
  for (const c of data.events.cards) assert.ok(r.drawn[c.id] > 0, `${c.id} 一次都沒抽到`);
  const mean = r.rolls.reduce((a, b) => a + b, 0) / r.n;
  assert.ok(mean >= 10 && mean <= 25, `平均擲骰 ${mean}`);
  for (const id of ["stage", "steady", "wild", "safe"]) {
    assert.ok((r.endings[id] || 0) >= 50, `結局 ${id} 只出現 ${r.endings[id] || 0} 次`);
  }
});
