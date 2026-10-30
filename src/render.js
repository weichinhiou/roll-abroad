// 渲染層：把 state 畫到 DOM。不做判斷、不碰規則。
// 3D 棋盤是畫面的「棋盤那一層」；WebGL 不可用或「減少動態效果」時退回 2D。
// 骰子：3D 播動畫；2D 或減少動態效果只在面板顯一行「擲出 X」。
import { MILESTONES, resName } from "./engine.js";
import { initBoard3d, updateBoard3d, rollDice, teleportPawn } from "./board3d.js";

const CH_NAMES = { 1: "投稿", 2: "出國準備", 3: "國際會議", 4: "返國" };
const REDUCED_MQ = "(prefers-reduced-motion: reduce)";
const $ = (sel) => document.querySelector(sel);

let mode = null; // "3d" | "2d"

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MQ).matches;
}

export function initBoard(board) {
  const wrap3d = $("#board3d");
  const wrap2d = $("#board");
  if (!wrap3d || !wrap2d) {
    mode = "2d";
    return;
  }
  if (prefersReducedMotion()) {
    mode = "2d";
    wrap3d.hidden = true;
    return;
  }
  try {
    const ok = initBoard3d(wrap3d, board);
    if (ok) {
      mode = "3d";
      wrap2d.hidden = true;
      return;
    }
  } catch {
    // 3D 建不起來，退回 2D。
  }
  mode = "2d";
  wrap3d.hidden = true;
}

export function getMode() {
  return mode;
}

// 擲骰：3D 播骰子動畫；2D 前端只在面板上補一行「擲出 X」（不動機制）。
export function showDice(value) {
  if (mode === "3d") return rollDice(value);
  // 2D 路徑不播動畫，把點數寫到一個暫存 div 供 renderPanel 顯示
  pendingDice = value;
  renderDiceBadge();
  return Promise.resolve();
}

// 擲骰後，棋子一格一格跳過去；動畫結束 Promise 才 resolve，
// app.js 接著才會顯示事件卡。
export function movePiece(state) {
  if (mode !== "3d") return Promise.resolve();
  return updateBoard3d(state);
}

export function relocatePiece(n) {
  if (mode !== "3d") return;
  teleportPawn(n);
}

// 2D 的「擲出 X」視覺補丁
let pendingDice = null;
function renderDiceBadge() {
  const panel = $("#panel");
  if (!panel) return;
  const old = panel.querySelector(".dice-badge");
  if (old) old.remove();
  if (pendingDice == null) return;
  const b = document.createElement("div");
  b.className = "dice-badge";
  b.setAttribute("role", "status");
  b.textContent = `擲出 ${pendingDice}`;
  panel.prepend(b);
}

export function clearDiceBadge() {
  pendingDice = null;
  renderDiceBadge();
}

export function render(state, board, items, lastResult = null) {
  if (mode !== "3d") renderBoard2d(state, board);
  renderResources(state);
  renderItems(state, items);
  renderPanel(state, lastResult);
  renderLog(state);
  renderDiceBadge();
}

function renderBoard2d(state, board) {
  const wrap = $("#board");
  wrap.innerHTML = "";
  for (const sq of board.squares) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = [
      "cell",
      `ch${sq.chapter}`,
      `kind-${sq.kind}`,
      MILESTONES.includes(sq.n) ? "milestone" : "",
      state.pos === sq.n ? "here" : "",
    ].join(" ");
    cell.innerHTML = `<span class="n">${sq.n}</span><span class="lb">${sq.label}</span>`;
    cell.title = `第 ${sq.n} 格・${CH_NAMES[sq.chapter]}`;
    wrap.appendChild(cell);
  }
}

function renderResources(state) {
  const box = $("#res");
  box.innerHTML = "";
  for (const k of ["time", "money", "energy", "knowledge"]) {
    const v = state.res[k];
    const row = document.createElement("div");
    row.className = "res";
    const max = k === "knowledge" ? 20 : 10;
    row.innerHTML = `<span class="rk">${resName(k)}</span><span class="rv">${v}</span>
      <span class="bar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></span>`;
    box.appendChild(row);
  }
  $("#rollinfo").textContent = `擲骰 ${state.rolls} 次｜位置 ${state.pos}/24｜seed ${state.seed}`;
}

function renderItems(state, items) {
  const box = $("#items");
  box.innerHTML = "";
  for (const it of items.items) {
    const n = state.items[it.id] || 0;
    if (n <= 0 && it.once) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "item";
    b.disabled = it.kind !== "dice" || n <= 0;
    b.dataset.item = it.id;
    b.innerHTML = `<b>${it.name}</b>${it.once ? ` ×${n}` : ""}<small>${it.desc}</small>`;
    box.appendChild(b);
  }
}

function resultBox(r) {
  const box = document.createElement("div");
  box.className = "result";
  const chips = Object.entries(r.delta)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="chip ${v > 0 ? "up" : "down"}">${resName(k)} ${v > 0 ? "+" : "−"}${Math.abs(v)}</span>`)
    .join("");
  box.innerHTML = `<p class="rt">${r.title}</p>
    <p class="rc">你選了「${r.label}」</p>
    ${r.note ? `<p class="rn">${r.note}</p>` : ""}
    <div class="chips">${chips || '<span class="chip">資源沒有變化</span>'}</div>
    ${r.notes.map((n) => `<p class="rx">${n}</p>`).join("")}`;
  return box;
}

function renderPanel(state, lastResult) {
  const panel = $("#panel");
  panel.innerHTML = "";
  if (state.status === "done") {
    panel.innerHTML = `<h2>${state.ending.title}</h2><p>${state.ending.text}</p>
      <p class="hint">本局關鍵抉擇：${state.keyChoices.map((k) => `${k.card}→${k.choice}`).join("、") || "尚無"}</p>`;
    if (lastResult) panel.prepend(resultBox(lastResult));
    return;
  }
  const block = state.pendingEvent || state.pendingCheckpoint;
  if (block) {
    const h = document.createElement("h2");
    h.textContent = block.title;
    panel.appendChild(h);
    const p = document.createElement("p");
    p.textContent = block.text;
    panel.appendChild(p);
    // 真實改編：和虛構劇本分開，讓玩家知道「這麼戲劇，竟然是真的」
    if (block.trueStory) {
      const t = document.createElement("p");
      t.className = "truestory";
      t.innerHTML = `<b>📌 真實改編</b>${block.trueStory}`;
      panel.appendChild(t);
    }
    if (block.tone === "fantasy") {
      const f = document.createElement("p");
      f.className = "fantasy";
      f.textContent = "純屬虛構";
      panel.appendChild(f);
    }
    block.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice";
      b.dataset.choice = i;
      b.textContent = c.label;
      panel.appendChild(b);
    });
    return;
  }
  if (state.status === "ready") {
    if (lastResult) panel.appendChild(resultBox(lastResult));
    const b = document.createElement("button");
    b.type = "button";
    b.className = "roll";
    b.textContent = "擲骰";
    $("#panel").appendChild(b);
  }
}

function renderLog(state) {
  const box = $("#log");
  box.innerHTML = state.log
    .slice(-14)
    .map((l) => `<li class="lg-${l.kind}">${l.text}</li>`)
    .join("");
  box.scrollTop = box.scrollHeight;
}