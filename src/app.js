// 狀態流程：intro → ready →(擲骰)→ moving → event/checkpoint → result
// 只負責接 engine 與 render，不寫規則。
// 3D 棋盤：擲骰 → 骰子動畫（演出 engine 已擲好的點數）→ 棋子一格一格跳過去 → 動畫結束才顯示事件卡。
import * as E from "./engine.js";
import {
  render,
  initBoard,
  movePiece,
  relocatePiece,
  showDice,
  clearDiceBadge,
  setDieClick,
  openSettlement,
  showSettlementDemo,
  closeSettlement,
  settlementData,
} from "./render.js";
import { downloadReportCard } from "./share-card.js";
import { save, load, clearSave } from "./storage.js";
import { ART, loadBoardArt, preloadChapterBanners } from "./art.js";

let DATA = null;
let S = null;
let rolling = false;
let lastResult = null; // 剛選完的結果，只給畫面用，不進存檔

// 設定的「示範」鈕與 ?settle=demo：假的已完成一局，走同一條 settlement() 產線，
// 讓結算畫面與成績單不用玩到第 32 格也能看。
const DEMO_STATE = {
  seed: "demo-settlement",
  rng: 1,
  route: "oral",
  pos: 32,
  rolls: 17,
  res: { time: 5, money: 8, energy: 3, knowledge: 12 },
  items: {},
  flags: { pub_pending: true, network: true, oral_qa: true, mentor: true },
  kept: ["mentor"],
  drawn: new Array(16).fill({ id: "demo" }),
  log: [],
  keyChoices: [
    { card: "審查意見", choice: "補實驗也補人馬", note: "" },
    { card: "海報現場", choice: "把被問倒的那題記下來", note: "" },
  ],
  strain: 1,
  status: "done",
  pendingEvent: null,
  pendingCheckpoint: null,
  ending: { id: "stage", title: "國際舞台新面孔", text: "收穫滿行囊，資源也留得住。下次可以直接排兩場。" },
  over: null,
};

async function boot() {
  const [board, events, items, cps] = await Promise.all(
    ["board", "events", "items", "checkpoints"].map((f) => fetch(`data/${f}.json`).then((r) => r.json()))
  );
  DATA = { board, events, items, checkpoints: cps.checkpoints };
  await loadBoardArt();
  preloadChapterBanners();
  initBoard(DATA.board);
  const saved = load();
  const firstRun = !saved;
  if (saved) {
    S = saved;
  } else {
    startGame(document.getElementById("seed").value || "demo-1109");
  }
  wire();
  setDieClick(() => roll(null));
  draw();
  // 讀到存檔時，棋子直接出現在存下來的那一格（不播動畫）
  relocatePiece(S.pos);
  // 開場介紹：只有第一次玩（沒有存檔）自動擋一次；?intro=1 讓展示時一定能叫出來
  if (firstRun || new URLSearchParams(location.search).get("intro") === "1") openIntro();
  // ?settle=demo：展示用，開場直接叫出結算畫面（設定的示範鈕同一條路）
  if (new URLSearchParams(location.search).get("settle") === "demo") {
    showSettlementDemo(E.settlement(DEMO_STATE));
  }
}

// 開場介紹面板（內容寫在 index.html，這裡只管開合）
function openIntro() {
  const d = document.getElementById("intro");
  if (!d) return;
  if (!d.open) d.showModal();
  d.scrollTop = 0;
  d.querySelector(".set-actions button")?.focus();
}

function startGame(seed) {
  S = E.initialState({ seed });
  S.log = [{ kind: "info", text: "旅程開始：從第 0 格出發，目標是走完 32 格。" }];
  save(S);
}

function draw() {
  render(S, DATA.board, DATA.items, lastResult);
  document.getElementById("forced").hidden = true;
  save(S);
}

// 動畫播放時防止連按
function setBusy(on) {
  document.body.classList.toggle("busy", on);
  for (const b of document.querySelectorAll(".roll, .choice, .item, .forced button")) {
    if (on) b.dataset.wasDisabled = b.disabled ? "1" : "0";
    b.disabled = on ? true : b.dataset.wasDisabled === "1";
    if (!on) delete b.dataset.wasDisabled;
  }
}

async function roll(face) {
  if (S.status !== "ready" || rolling || lastResult) return;
  rolling = true;
  setBusy(true);
  lastResult = null;
  clearDiceBadge();
  try {
    let s = face ? E.forcedRoll(S, face) : E.rollDie(S);
    if (!s) return;
    const diceValue = s.dice;                 // engine 已決定，這裡只是顯示
    s = E.applyMove(s, DATA.board);
    S = s;
    // 1) 骰子演出（3D 有動畫，2D 只顯「擲出 X」）
    await showDice(diceValue);
    // 2) 棋子一格一格跳完，才抽卡、顯示事件
    await movePiece(s);
    const sq = DATA.board.squares.find((x) => x.n === s.pos);
    if (sq.kind === "milestone") s = E.checkpointAt(s, DATA.board, DATA);
    else s = E.drawCard(s, DATA.board, DATA.events, sq);
    S = s;
  } finally {
    rolling = false;
    setBusy(false);
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
    if (!t || rolling) return;
    if (t.dataset.action === "continue") {
      lastResult = null;
      clearDiceBadge();
      return draw();
    }
    if (t.dataset.action === "settlement") {
      document.getElementById("modal")?.close();
      return openSettlement(E.settlement(S));
    }
    if (t.dataset.action === "rules") {
      return openIntro();
    }
    if (t.dataset.action === "close-intro") {
      return document.getElementById("intro")?.close();
    }
    if (t.dataset.action === "demo-settlement") {
      return showSettlementDemo(E.settlement(DEMO_STATE));
    }
    if (t.dataset.action === "close-settlement") {
      return closeSettlement();
    }
    if (t.dataset.action === "report-card") {
      const data = settlementData();
      if (!data) return;
      t.disabled = true;
      return downloadReportCard(data, { catSrc: ART.cat, bgSrc: ART.reportCardBg }).then(() => {
        t.disabled = false;
      });
    }
    if (t.id === "restart" || t.dataset.action === "restart") {
      closeSettlement();
      clearSave();
      lastResult = null;
      clearDiceBadge();
      startGame(document.getElementById("seed").value || "demo-1109");
      relocatePiece(S.pos);
      return draw();
    }
    if (t.classList.contains("roll")) return roll(null);
    if (t.dataset.choice !== undefined) return choose(Number(t.dataset.choice));
    if (t.dataset.item === "plan") return (document.getElementById("forced").hidden = false);
    if (t.dataset.face) {
      document.getElementById("forced").hidden = true;
      return roll(Number(t.dataset.face));
    }
  });
  // 事件要做選擇才能往下，Esc 不關閉視窗
  document.getElementById("modal").addEventListener("cancel", (ev) => ev.preventDefault());
}

boot();
