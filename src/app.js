// 狀態流程：intro → ready →(擲骰)→ moving → event/checkpoint → result
// 只負責接 engine 與 render，不寫規則。
// 3D 棋盤：擲骰後棋子一格一格跳過去，動畫結束才顯示事件卡。
import * as E from "./engine.js";
import { render, initBoard, movePiece } from "./render.js";
import { save, load, clearSave } from "./storage.js";

let DATA = null;
let S = null;
let rolling = false;
let lastResult = null; // 剛選完的結果，只給畫面用，不進存檔

async function boot() {
  const [board, events, items, cps] = await Promise.all(
    ["board", "events", "items", "checkpoints"].map((f) => fetch(`data/${f}.json`).then((r) => r.json()))
  );
  DATA = { board, events, items, checkpoints: cps.checkpoints };
  initBoard(DATA.board);
  const saved = load();
  if (saved) {
    S = saved;
  } else {
    startGame(document.getElementById("seed").value || "demo-1109");
  }
  wire();
  draw();
  // 讀到存檔時，棋子要直接出現在存下來的那一格
  await movePiece(S);
}

function startGame(seed) {
  S = E.initialState({ seed });
  S.log = [{ kind: "info", text: "旅程開始：從第 0 格出發，目標是走完 24 格。" }];
  save(S);
}

function draw() {
  render(S, DATA.board, DATA.items, lastResult);
  document.getElementById("forced").hidden = !S.items.plan;
  save(S);
}

async function roll(face) {
  if (S.status !== "ready" || rolling) return;
  rolling = true;
  lastResult = null;
  try {
    let s = face ? E.forcedRoll(S, face) : E.rollDie(S);
    if (!s) return;
    s = E.applyMove(s, DATA.board);
    S = s;
    // 先把棋子一格一格跳完，才抽卡、顯示事件
    await movePiece(s);
    const sq = DATA.board.squares.find((x) => x.n === s.pos);
    if (sq.kind === "milestone") s = E.checkpointAt(s, DATA.board, DATA);
    else s = E.drawCard(s, DATA.board, DATA.events, sq);
    S = s;
  } finally {
    rolling = false;
    draw();
  }
}

function choose(i) {
  const block = S.pendingEvent || S.pendingCheckpoint;
  if (!block) return;
  const before = S;
  const choice = block.choices[i];
  S = E.applyChoice(S, block, choice, DATA);
  const delta = {};
  for (const k of ["time", "money", "energy", "knowledge"]) delta[k] = S.res[k] - before.res[k];
  lastResult = {
    title: block.title,
    label: choice.label,
    note: choice.note || "",
    delta,
    notes: S.log.slice(before.log.length).filter((l) => l.kind === "note").map((l) => l.text),
  };
  if (S.status === "done") clearSave();
  draw();
}

function wire() {
  document.body.addEventListener("click", (ev) => {
    const t = ev.target.closest("button");
    if (!t) return;
    if (t.classList.contains("roll")) return roll(null);
    if (t.dataset.choice !== undefined) return choose(Number(t.dataset.choice));
    if (t.dataset.item === "plan") return (document.getElementById("forced").hidden = false);
    if (t.dataset.face) {
      document.getElementById("forced").hidden = true;
      return roll(Number(t.dataset.face));
    }
    if (t.id === "restart") {
      clearSave();
      lastResult = null;
      startGame(document.getElementById("seed").value || "demo-1109");
      draw();
    }
  });
}

boot();