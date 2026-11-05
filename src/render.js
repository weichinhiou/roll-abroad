// 渲染層：把 state 畫到 DOM。不做判斷、不碰規則。
// 3D 棋盤是畫面的「棋盤那一層」；WebGL 不可用或「減少動態效果」時退回 2D。
// 骰子：3D 播動畫；2D 或減少動態效果只在面板顯一行「擲出 X」。
import { MILESTONES, resName, settlement } from "./engine.js";
import { initBoard3d, updateBoard3d, rollDice, teleportPawn, onDieClick } from "./board3d.js";
import { ART, CHAPTER_BANNERS } from "./art.js";

const CH_NAMES = { 1: "投稿", 2: "出國準備", 3: "國際會議", 4: "返國", 5: "回院之後" };
const CH_ORD = ["一", "二", "三", "四", "五"];
const REDUCED_MQ = "(prefers-reduced-motion: reduce)";
const NARROW_MQ = "(max-width: 759px)";
const $ = (sel) => document.querySelector(sel);
const BANNER = Object.fromEntries(CHAPTER_BANNERS.map((b) => [b.n, b]));

// 上方掛牌：換章時一起換桌機／手機兩張圖與 alt（圖已預載，不會閃白）。
// 實際顯示哪張由 CSS 的 media query 決定，這裡只是讓預留尺寸跟當前版型一致。
function renderChapterBanner(chapter) {
  const b = BANNER[chapter] || BANNER[1];
  const box = $("#chapter");
  if (!box) return;
  const img = box.querySelector("img"), source = box.querySelector("source");
  const compact = typeof matchMedia === "function" && matchMedia(NARROW_MQ).matches;
  box.dataset.chapter = String(chapter);
  img.src = b.full;
  img.alt = `第${CH_ORD[chapter - 1]}章・${CH_NAMES[chapter]}`;
  img.width = compact ? b.sw : b.w;
  img.height = compact ? b.sh : b.h;
  if (source) source.srcset = b.compact;
}

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
      document.body.classList.add("mode-3d");
      const hint = document.createElement("p");
      hint.id = "die-hint";
      hint.className = "die-hint";
      hint.textContent = "點骰子擲骰";
      wrap3d.appendChild(hint);
      return;
    }
  } catch {
    // 3D 建不起來，退回 2D。
  }
  mode = "2d";
  wrap3d.hidden = true;
}

export function setDieClick(fn) {
  if (mode === "3d") onDieClick(fn);
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
  const dialog = $("#modal");
  const panel = dialog?.open ? dialog : $("#panel");
  if (!panel) return;
  for (const old of document.querySelectorAll(".dice-badge")) old.remove();
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
  renderJourney(state, board);
  renderItems(state, items);
  renderPanel(state, lastResult);
  renderDialog(state, board, lastResult);
  renderSettlement(state, lastResult);
  renderLog(state);
  renderDiceBadge();
}

function renderBoard2d(state, board) {
  const wrap = $("#board");
  wrap.innerHTML = "";
  for (const sq of board.squares) {
    // 格子只有資訊展示，避免鍵盤玩家每次先跳過 24 個無作用按鈕。
    const cell = document.createElement("div");
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
  const iconIndex = {time:0,money:1,energy:2,knowledge:3};
  const colors = {time:"#2e9ce4",money:"#eba72b",energy:"#32b878",knowledge:"#9b6be1"};
  const box = $("#res");
  box.innerHTML = "";
  for (const k of ["time", "money", "energy", "knowledge"]) {
    const v = state.res[k];
    const row = document.createElement("div");
    row.className = `res${k !== "knowledge" && v <= 2 ? " low" : ""}`;
    row.style.setProperty("--resource-color", colors[k]);
    const max = k === "knowledge" ? 20 : 10;
    row.innerHTML = `<span class="res-icon hud-icon hud-${iconIndex[k]}" aria-hidden="true"></span><span class="rk">${resName(k)}</span><span class="rv">${v}</span>
      <span class="bar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></span>`;
    box.appendChild(row);
  }
}

function renderJourney(state, board) {
  const square = board.squares.find((s) => s.n === state.pos);
  const chapter = square?.chapter || 1;
  renderChapterBanner(chapter);
  $("#rollinfo").textContent = `${state.pos === 0 ? "起點・準備出發" : `第 ${state.pos}/${board.squares.length} 格・${square.label}`}　｜　擲骰 ${state.rolls} 次`;
  const note = $("#companion-note");
  // 開局（擲過骰前）由黑貓輪流說兩句：操作提示↔催擲骰。擲過骰就改講行程相關。
  const hintMode = mode === "3d" && state.rolls === 0 && state.status === "ready";
  document.body.classList.toggle("companion-hint", hintMode);
  if (hintMode) {
    startCompanionHint(note);
    return;
  }
  stopCompanionHint();
  note.textContent = state.status === "done" ? "旅程完成！這些收穫，帶回去分享吧。" :
    state.status === "checkpoint" ? "重要的一站！做個好決定，再出發。" :
    state.status === "event" ? "旅途總有新發現，你會怎麼選？" :
    mode === "3d" ? "點中央骰子，看看下一站！" : "準備好了，就按擲骰出發！";
}

// 黑貓開場雙句輪播：第一句多停一下，之後每 5 秒換一句；換句時輕淡入。
const COMPANION_FIRST_MS = 7000;
const COMPANION_SWAP_MS = 5000;
let companionTimer = 0;
let companionAlt = false;

function companionLines() {
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return [`這盤能拖曳轉視角、${touch ? "雙指" : "滾輪"}縮放；點棋格看名稱。`, "點中央骰子，看看下一站！"];
}

function startCompanionHint(note) {
  const lines = companionLines();
  if (companionTimer) return; // 已经在轮播，别叠定时器
  note.textContent = lines[0];
  const step = (delay) => {
    companionTimer = setTimeout(() => {
      companionTimer = 0;
      if (!document.body.classList.contains("companion-hint")) return;
      companionAlt = !companionAlt;
      note.textContent = lines[companionAlt ? 1 : 0];
      note.classList.remove("swap");
      void note.offsetWidth; // 強制重排，讓動畫可以重複觸發
      note.classList.add("swap");
      step(COMPANION_SWAP_MS);
    }, delay);
  };
  step(COMPANION_FIRST_MS);
}

function stopCompanionHint() {
  if (companionTimer) {
    clearTimeout(companionTimer);
    companionTimer = 0;
  }
  companionAlt = false;
}

function renderItems(state, items) {
  const iconIndex = {plan:4,consult:5,door:6,usb:7,badge:8};
  const box = $("#items");
  box.innerHTML = "";
  for (const it of items.items) {
    const n = state.items[it.id] || 0;
    if (n <= 0 && it.once) continue;
    const active = it.kind === "dice" && n > 0;
    const b = document.createElement(active ? "button" : "div");
    if (active) b.type = "button";
    b.className = `item${active ? "" : it.kind === "link" ? " unavailable" : " passive"}`;
    b.dataset.item = it.id;
    b.title = it.desc;
    const label = active ? "指定步數" : it.kind === "link" ? "查詢尚未開放" : "自動生效";
    b.innerHTML = `<span class="item-icon hud-icon hud-${iconIndex[it.id]}" aria-hidden="true"></span><b>${it.name}</b>${it.once ? `<span class="item-count">${n}</span>` : ""}<small>${label}</small>`;
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

// 3D 時玩家點骰子就擲，這顆只給鍵盤使用（取得焦點才看得到）；2D 沒有骰子可點，正常顯示
function renderPanel(state, lastResult) {
  const panel = $("#panel");
  panel.innerHTML = "";
  if (state.status === "ready" && !lastResult) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "roll";
    b.textContent = "擲骰";
    panel.appendChild(b);
  }
  if (state.status === "done") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "roll";
    b.dataset.action = "settlement";
    b.textContent = "旅程結算";
    panel.appendChild(b);
  }
  const hint = $("#die-hint");
  if (hint) hint.hidden = state.status !== "ready" || !!lastResult;
}

// 事件、結果、結局都放在畫面正中間的跳出視窗，不用上下捲動找
function renderDialog(state, board, lastResult) {
  const dialog = $("#modal");
  dialog.innerHTML = "";
  const block = state.pendingEvent || state.pendingCheckpoint;
  if (state.status === "done") {
    // 結局內容交給「旅程結算」畫面；這裡只留最後一張卡的結果當過場
    if (lastResult) {
      dialog.appendChild(resultBox(lastResult));
      dialog.appendChild(actionButton("看旅程結算", "settlement"));
    } else {
      if (dialog.open) dialog.close();
      return;
    }
  } else if (block) {
    const sq = board.squares.find((s) => s.n === state.pos);
    fillEvent(dialog, block, sq?.chapter || 1);
  } else if (lastResult) {
    dialog.appendChild(resultBox(lastResult));
    dialog.appendChild(actionButton("繼續", "continue"));
  } else {
    if (dialog.open) dialog.close();
    return;
  }
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  // 焦點放在視窗本身，避免按 Enter 誤選第一個選項
  if (block) dialog.focus();
  else dialog.querySelector("button")?.focus();
}

function actionButton(text, action) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "roll";
  b.dataset.action = action;
  b.textContent = text;
  return b;
}

// ── 旅程結算畫面（全螢幕）────────────────────────────────
// 純資料來自 engine.settlement()，這裡只負責組 DOM。每局自動開一次，
// 關掉後靠面板的「旅程結算」按鈕重開；設定裡的示範鈕走 showSettlementDemo()。
let settlementSeen = false;
let demoOpen = false;
let lastSettlement = null;

export function settlementData() {
  return lastSettlement;
}

export function openSettlement(data) {
  const dialog = $("#settlement");
  if (!dialog || !data) return;
  lastSettlement = data;
  fillSettlement(data);
  settlementSeen = true;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector("button")?.focus();
}

// 展示用：還沒玩完也能叫出結算畫面（設定的示範鈕、?settle=demo）
export function showSettlementDemo(data) {
  demoOpen = true;
  openSettlement({ ...data, demo: true });
  const dialog = $("#settlement");
  dialog.addEventListener("close", () => { demoOpen = false; }, { once: true });
}

export function closeSettlement() {
  demoOpen = false;
  $("#settlement")?.close();
}

function renderSettlement(state, lastResult) {
  const dialog = $("#settlement");
  if (!dialog) return;
  if (state.status !== "done") {
    settlementSeen = false;
    if (dialog.open && !demoOpen) dialog.close();
    return;
  }
  const data = settlement(state);
  fillSettlement(data);
  // 還有最後一張卡的結果沒看完時先讓它出完，玩家按「看旅程結算」再開
  if (!settlementSeen && !lastResult) openSettlement(data);
}

function fillSettlement(d) {
  const dialog = $("#settlement");
  const stamp = (p) => `
    <li class="promise${p.kept ? " kept" : p.brought ? " brought" : " none"}">
      <span class="stamp" aria-hidden="true">${p.kept ? "已兌現" : p.brought ? "待追蹤" : "未帶回"}</span>
      <span class="plabel">${p.label}</span>
    </li>`;
  const bar = (r) => `
    <li class="setres">
      <span class="sname">${r.name}</span>
      <span class="sbar"><i style="width:${Math.min(100, (r.value / 10) * 100)}%"></i></span>
      <span class="sval">${r.value}</span>
      <span class="sdiff">${r.delta > 0 ? "+" : ""}${r.delta}</span>
    </li>`;
  dialog.innerHTML = `
    <div class="set-hero">
      <p class="set-eyebrow">旅程結算${d.route ? `・${d.route}` : ""}${d.demo ? "・示範" : ""}</p>
      <h2 class="set-title">${d.ending.title}</h2>
      <p class="set-text">${d.ending.text}</p>
      <img class="set-cat" src="${ART.cat}" alt="黑貓旅伴陪你完成旅程" width="106" height="106" />
    </div>
    <div class="set-body">
      <section class="set-block set-promises">
        <h3>承諾・回院之後的兌現清單</h3>
        <ol class="promises">${d.promises.map(stamp).join("")}</ol>
      </section>
      <section class="set-block set-res">
        <h3>四項資源結算</h3>
        <ul class="setres-list">${d.res.map(bar).join("")}</ul>
      </section>
      <section class="set-block set-stats">
        <h3>這一趟</h3>
        <ul>${d.stats.map((s) => `<li><b>${s.value}</b><span>${s.label}</span></li>`).join("")}</ul>
      </section>
      <section class="set-block set-recap">
        <h3>關鍵抉擇</h3>
        <p class="hint">${d.keyChoices.map((k) => `${k.card}→${k.choice}`).join("、") || "尚無"}</p>
      </section>
    </div>
    <div class="set-actions">
      ${d.demo ? `<p class="set-demo-note">示範資料・玩到第 32 格會看到你自己這一趟</p>` : `<button type="button" class="roll" data-action="restart">再玩一次</button>`}
      <button type="button" class="ghost" data-action="report-card">下載成績單</button>
      <button type="button" class="ghost" data-action="close-settlement">關閉</button>
    </div>`;
}

function fillEvent(dialog, block, currentChapter) {
  const tag = document.createElement("div");
  tag.className = "modal-eyebrow";
  tag.textContent = block.deck === "chance" ? "✦ 機會・旅途的新發現" : block.deck === "fate" ? "✦ 命運・迎接挑戰" : "✦ 旅程里程碑";
  dialog.appendChild(tag);
  // 只使用四章共用圖像；本輪不製作個別機會／命運事件圖。
  if (!block.deck) {
    const emblem = document.createElement("span");
    emblem.className = "chapter-emblem";
    // 2×2 圖集只有四枚章徽；第五章先沿用返國章
    const chapter = Math.max(0, Math.min(3, currentChapter - 1));
    emblem.style.backgroundPosition = `${chapter % 2 ? "100%" : "0%"} ${chapter > 1 ? "100%" : "0%"}`;
    emblem.setAttribute("role", "img");
    emblem.setAttribute("aria-label", `${CH_NAMES[currentChapter] || CH_NAMES[chapter+1]}章節徽章`);
    dialog.appendChild(emblem);
  }
  const h = document.createElement("h2");
  h.textContent = block.title;
  dialog.appendChild(h);
  const p = document.createElement("p");
  p.textContent = block.text;
  dialog.appendChild(p);
  // 真實改編：和虛構劇本分開，讓玩家知道「這麼戲劇，竟然是真的」
  if (block.trueStory) {
    const t = document.createElement("p");
    t.className = "truestory";
    t.innerHTML = `<b>📌 真實改編</b>${block.trueStory}`;
    dialog.appendChild(t);
  }
  if (block.tone === "fantasy") {
    const f = document.createElement("p");
    f.className = "fantasy";
    f.textContent = "純屬虛構";
    dialog.appendChild(f);
  }
  block.choices.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.dataset.choice = i;
    b.textContent = c.label;
    dialog.appendChild(b);
  });
}

function renderLog(state) {
  const box = $("#log");
  box.innerHTML = state.log
    .slice(-14)
    .map((l) => `<li class="lg-${l.kind}">${l.text}</li>`)
    .join("");
  box.scrollTop = box.scrollHeight;
}
