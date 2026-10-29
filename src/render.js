// 渲染層：把 state 畫到 DOM。不做判斷、不碰規則。
import { MILESTONES, resName } from "./engine.js";

const CH_NAMES = { 1: "投稿", 2: "出國準備", 3: "國際會議", 4: "返國" };
const $ = (sel) => document.querySelector(sel);

export function render(state, board, items) {
  renderBoard(state, board);
  renderResources(state);
  renderItems(state, items);
  renderPanel(state);
  renderLog(state);
}

function renderBoard(state, board) {
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

function renderPanel(state) {
  const panel = $("#panel");
  panel.innerHTML = "";
  if (state.status === "done") {
    panel.innerHTML = `<h2>${state.ending.title}</h2><p>${state.ending.text}</p>
      <p class="hint">本局關鍵抉擇：${state.keyChoices.map((k) => `${k.card}→${k.choice}`).join("、") || "尚無"}</p>`;
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
