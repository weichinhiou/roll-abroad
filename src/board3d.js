// 3D 環形棋盤 + 骰子畫面（plan D10 + 美術與骰子）。
// three.js 固定版本放 vendor/，執行時不連 CDN、不下載圖片／字型。
// 共用插圖由本機 assets/art 載入；文字、骰子與場景仍是真正可互動的渲染。
//
// 對外函式：
//   initBoard3d(container, board)  建立場景與環形棋盤，回 true（WebGL 失敗或減少動態效果回 false）
//   onDieClick(fn)                 玩家點到桌上的骰子時呼叫 fn（拖曳轉鏡頭不算）
//   rollDice(value)                骰子演出：落到棋盤中央、彈跳約 1 秒停在 value 面，之後留在桌上。回 Promise。
//                                  value 只是「演出」，engine 早就擲好了，這裡不會再擲一次隨機數。
//   updateBoard3d(state)           棋子一格一格跳過去。回 Promise，跳完才 resolve。
//
// 規則（格子順序、位置、里程碑、骰子點數）由 engine / data/board.json 決定，這裡不寫規則。
import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { CHAPTER_COLORS, tileArt, buildTravelTable } from "./scene-art.js";

// ── 顏色與版面 ─────────────────────────────────────────────────────
// 四章色系比 2D 版稍微沉一點，一起用在格子、中央標題、章節旗上，視覺才一致。
const CH_COLOR = CHAPTER_COLORS;
const CH_SIGIL = { 1: "稿", 2: "行", 3: "會", 4: "結" };
const CH_NAME = { 1: "投稿", 2: "出國準備", 3: "國際會議", 4: "返國結案" };
const MILESTONE_GOLD = 0xe1b56a;
const MILESTONE_FILL = 0x35302a;

// 桌遊式方形棋盤：四個角是里程碑（6／12／18／24），每邊中間 5 格長方形卡片格
const TILE_W = 1.2;              // 一般格沿著邊的寬度
const TILE_D = 1.8;              // 一般格往內的深度（也是角落格的邊長）
const INNER = 2.5 * TILE_W;      // 內圈半邊長（5 格寬的一半）
const SIDE = INNER + TILE_D / 2; // 每一邊格子中心線的位置
const OUTER = INNER + TILE_D;    // 棋盤外緣半邊長
const CELL_H = 0.2;    // 一般格高度
const CELL_H_MS = 0.34; // 里程碑（角落）格高度
const REDUCED_MQ = "(prefers-reduced-motion: reduce)";

const DIE_SIZE = 0.95;
export const DIE_HALF = (DIE_SIZE / 2) * (1 - 0.12 * 0.06); // 扣掉 buildDie 的倒角縮放
export const BOARD_TOP_Y = 0.22;        // 中央標題板的高度，骰子落在這個平面上
// 六個面分配到 1/1/2/2/3/3（共用一個骰子不是公平骰，規則骰面由 engine 決定）
// 相對面配 (1,3)、(2,2)、(1,3)：任意兩面不會貼著同值，看起來比較自然。
const DIE_FACES = [
  { value: 3, normal: new THREE.Vector3(1, 0, 0) },
  { value: 1, normal: new THREE.Vector3(-1, 0, 0) },
  { value: 1, normal: new THREE.Vector3(0, 1, 0) },
  { value: 3, normal: new THREE.Vector3(0, -1, 0) },
  { value: 2, normal: new THREE.Vector3(0, 0, 1) },
  { value: 2, normal: new THREE.Vector3(0, 0, -1) },
];

// ── 模組狀態 ─────────────────────────────────────────────────────
let ready = false;
let wrap = null;
let renderer, scene, camera, clock;
let pawn, pawnGroup, suitcase, pawnHead;
// 行李箱基準位置（相對於棋子）。GLB 載入後會改讀節點自己的 position，這組是 box 備援用的預設值。
const CASE_HOME = new THREE.Vector3(0.36, 0.16, 0.08);
let ringGroup, tableGroup;
const tileMeshes = [];
let tileHint = null;
let inspectedTile = null;
let die, dieTexList;
let dieClickHandler = null;
let keyLight;
let yawCounter = 0;               // 每次擲骰的偏航角，用單調計數做，不碰隨機
let pos = 0;                      // 棋子目前顯示的格子編號（0 = 出發）
let data = null;
let running = false;              // rAF 是否跑著
let frameId = 0;
let visible = true;
let lastT = 0;

// 鏡頭固定在棋盤正前上方，距離依畫面比例自動算，整個棋盤一定框得進來、不會歪
const CAM_TILT = (56 * Math.PI) / 180; // 仰角：越大越像從正上方看
const CAM_FIT = 1.1;                   // 斜角視圖保留邊界，前排與角落不裁切
const camPos = new THREE.Vector3(0, 11, 8);
const camLook = new THREE.Vector3(0, 0, 0.35);
// 玩家拖曳轉動的視角：左右轉（yaw）、上下仰角（tilt）、遠近（zoom）。fitDist 是自動算出的基準距離
const TILT_MIN = (28 * Math.PI) / 180;
const TILT_MAX = (86 * Math.PI) / 180;
const view = { yaw: 0.24, tilt: CAM_TILT, zoom: 1, fitDist: 14 };
let layoutMobile = null;

function applyCamera() {
  if (!camera) return;
  const d = view.fitDist * view.zoom;
  camPos.set(
    camLook.x + d * Math.cos(view.tilt) * Math.sin(view.yaw),
    camLook.y + d * Math.sin(view.tilt),
    camLook.z + d * Math.cos(view.tilt) * Math.cos(view.yaw)
  );
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

export function resetView() {
  clearTileHint();
  view.yaw = isMobile() ? 0 : 0.24;
  view.tilt = isMobile() ? Math.PI * 0.38 : CAM_TILT;
  view.zoom = 1;
  applyCamera();
}

// 螢幕座標是否點中骰子；用球形判定放寬範圍，手機上比較好點
const DIE_PICK_RADIUS = 1.1;
const pickRay = new THREE.Raycaster();
const pickNdc = new THREE.Vector2();
function hitsDie(canvas, e) {
  if (!die || !die.visible) return false;
  const r = canvas.getBoundingClientRect();
  pickNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pickRay.setFromCamera(pickNdc, camera);
  return pickRay.ray.distanceToPoint(die.position) < DIE_PICK_RADIUS;
}

export function onDieClick(fn) {
  dieClickHandler = fn;
}

function clearTileHint() {
  inspectedTile = null;
  if (tileHint) tileHint.hidden = true;
}

// 螢幕大字不隨 3D 透視縮小；指向或輕點格子即可閱讀。
function inspectTile(canvas, e) {
  if (!tileHint || !camera) return;
  const r = canvas.getBoundingClientRect();
  pickNdc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  pickRay.setFromCamera(pickNdc,camera);
  const sq = pickRay.intersectObjects(tileMeshes, false)[0]?.object.userData.square;
  if (!sq) { clearTileHint(); return; }
  if (inspectedTile === sq.n) return;
  inspectedTile = sq.n;
  const type = sq.kind === "milestone" ? "里程碑・必停" : sq.kind === "fate" ? "命運" : sq.kind === "route" ? "路線" : "機會";
  tileHint.querySelector("strong").textContent = sq.label;
  tileHint.querySelector("span").textContent = `第 ${sq.n} 格・${CH_NAME[sq.chapter]}・${type}`;
  tileHint.hidden = false;
}

// 滑鼠拖曳／單指拖曳：轉動；滾輪／雙指捏合：縮放；雙擊：回正；點骰子：擲骰
function bindOrbit(canvas) {
  const pts = new Map();
  let pinch = 0;
  let press = null; // 這次按下的起點；移動太多就當成拖曳，不算點擊
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    press = pts.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) {
      canvas.style.cursor = hitsDie(canvas, e) ? "pointer" : "";
      inspectTile(canvas, e);
      return;
    }
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) press = null;
    clearTileHint();
    const cur = { x: e.clientX, y: e.clientY };
    pts.set(e.pointerId, cur);
    if (pts.size === 1) {
      view.yaw -= (cur.x - prev.x) * 0.008;
      view.tilt = Math.min(TILT_MAX, Math.max(TILT_MIN, view.tilt + (cur.y - prev.y) * 0.006));
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) view.zoom = Math.min(1.5, Math.max(0.55, view.zoom * (pinch / dist)));
      pinch = dist;
    }
    applyCamera();
  });
  const end = (e) => {
    if (e.type === "pointerup" && press && pts.size === 1) {
      if (hitsDie(canvas, e)) { clearTileHint(); dieClickHandler?.(); }
      else inspectTile(canvas, e);
    }
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (pts.size === 0) canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "touch") clearTileHint();
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    clearTileHint();
    view.zoom = Math.min(1.5, Math.max(0.55, view.zoom * (e.deltaY > 0 ? 1.08 : 0.93)));
    applyCamera();
  }, { passive: false });
  canvas.addEventListener("dblclick", resetView);
}
const tmpV = new THREE.Vector3();

// ── 純工具（Canvas 貼圖） ─────────────────────────────────────────
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function hexCSS(hex) {
  return "#" + hex.toString(16).padStart(6, "0");
}

function hexLerp(hex, target, k) {
  const a = new THREE.Color(hex);
  const b = new THREE.Color(target);
  a.lerp(b, k);
  return a.getHex();
}

// 格子卡面（桌遊卡片風格）：米白卡底＋上方章節色帶＋號碼＋短標籤＋格子類型標籤。
// 角落里程碑：深色底、金框、大圖示、「必停」。
// shape 決定畫布比例，和格子頂面一樣，字才不會被拉扁。
const CH_ICON = { 1: "📝", 2: "🧳", 3: "🎤", 4: "🏠" };
const MS_ICON = { route: "🧭", gate: "✈️", session: "🏆", final: "🏁" };
const KIND_TAG = {
  chance: { text: "機會", color: "#2f7d4f" },
  fate: { text: "命運", color: "#b4432a" },
  route: { text: "路線", color: "#2f5d9a" },
};
const FONT = '"Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

function cellTexture(sq, milestone, shape) { return tileArt(sq, milestone, shape); }

// 骰子點數：畫黑圓點在白底上。回傳貼圖與該面的 value。
function dieFaceTexture(pips) {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");
  // 白底
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#d9f2ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // 內框
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(120,95,60,0.22)";
  roundedRect(ctx, 8, 8, S - 16, S - 16, 28);
  ctx.stroke();

  // 點數佈局
  const layouts = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  const pts = layouts[pips] || layouts[1];
  const pad = 78;
  const cellW = (S - pad * 2) / 2;
  for (const [gx, gy] of pts) {
    const x = S / 2 + gx * cellW;
    const y = S / 2 + gy * cellW;
    const grad = ctx.createRadialGradient(x - 8, y - 8, 2, x, y, 34);
    grad.addColorStop(0, "#3382c7");
    grad.addColorStop(1, "#163c74");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 32, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.ellipse(x - 10, y - 12, 10, 6, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c);
}

// ── 環形格子佈局 ───────────────────────────────────────────────
// n = 0..23（第 n+1 格）。每邊前 5 格是卡片格，第 6 格是角落（里程碑）。
// 下邊由左往右 1–5、右下角 6；右邊往上 7–11、右上角 12；上邊往左 13–17、左上角 18；左邊往下 19–23、左下角 24。
// shape：corner 是正方形；h 是上下兩邊的直立卡（寬 TILE_W、深 TILE_D）；v 是左右兩邊的橫卡。
function ringPos(n) {
  const side = Math.floor(n / 6);
  const k = n % 6;
  const off = INNER - TILE_W * (k + 0.5);
  if (k === 5) {
    const corners = [[SIDE, SIDE], [SIDE, -SIDE], [-SIDE, -SIDE], [-SIDE, SIDE]];
    return { x: corners[side][0], z: corners[side][1], shape: "corner" };
  }
  if (side === 0) return { x: -off, z: SIDE, shape: "h" };
  if (side === 1) return { x: SIDE, z: off, shape: "v" };
  if (side === 2) return { x: off, z: -SIDE, shape: "h" };
  return { x: -SIDE, z: -off, shape: "v" };
}

function cellHeight(sq) {
  return sq && sq.kind === "milestone" ? CELL_H_MS : CELL_H;
}

// 讓棋子／骰子停在格子的頂面上
function ringFloorY(sq) {
  return 0.28 + cellHeight(sq);
}

// ── WebGL 能力 ─────────────────────────────────────────────────
function hasWebGL() {
  try {
    const c = makeCanvas(4, 4);
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function reduced() {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MQ).matches;
}

// ── 場景建立 ─────────────────────────────────────────────────────
function buildLights() {
  // 暖色環境：上方天光 + 側前方主光 + 一點補光
  const hemi = new THREE.HemisphereLight(0xe8f7ff, 0x70a7aa, 1.65);
  hemi.position.set(0, 18, 0);
  scene.add(hemi);

  keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(-7, 14, 8);
  keyLight.castShadow = true;
  const shadowSize = isMobile() ? 512 : 1024;
  keyLight.shadow.mapSize.set(shadowSize, shadowSize);
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -12;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 40;
  keyLight.shadow.bias = -0.0015;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const fill = new THREE.DirectionalLight(0xffe4bd, 0.32);
  fill.position.set(9, 6, -10);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xb8cdf0, 0.22);
  rim.position.set(8, 4, 12);
  scene.add(rim);

  // 保持背景透明，讓本機旅行世界圖與 3D 棋盤整合。
}

function buildTable() { tableGroup = buildTravelTable(scene, OUTER, INNER, BOARD_TOP_Y); }

function buildRing(board) {
  ringGroup = new THREE.Group();
  const GAP = 0.06; // 格子之間留一條細縫，看起來像一張張卡片
  const dims = {
    corner: [TILE_D - GAP, TILE_D - GAP],
    h: [TILE_W - GAP, TILE_D - GAP],
    v: [TILE_D - GAP, TILE_W - GAP],
  };

  board.squares.forEach((sq) => {
    const p = ringPos(sq.n - 1);
    const ms = sq.kind === "milestone";
    const h = cellHeight(sq);
    const [w, d] = dims[p.shape];

    // 只有頂面貼卡面，側面用章節色的深色邊，避免字重複出現在側面
    const sideMat = new THREE.MeshStandardMaterial({
      color: hexLerp(CH_COLOR[sq.chapter], 0x164a82, 0.18),
      roughness: 0.8,
    });
    // 印刷面維持原色，避免強光與色調映射把深色字漂白。
    const topMat = new THREE.MeshBasicMaterial({
      map: cellTexture(sq, ms, p.shape),
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]
    );
    mesh.position.set(p.x, 0.22 + h / 2, p.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.square = sq;
    tileMeshes.push(mesh);
    ringGroup.add(mesh);

    if (ms) {
      // 里程碑小旗：插在角落格的外角，不擋到格子上的字
      const sx = Math.sign(p.x), sz = Math.sign(p.z);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.0, 12),
        new THREE.MeshStandardMaterial({ color: 0xefe0bd, roughness: 0.7, metalness: 0.15 })
      );
      p.x += sx * 0.62;
      p.z += sz * 0.62;
      pole.position.set(p.x - 0.32, 0.22 + h + 0.5, p.z);
      pole.castShadow = true;
      ringGroup.add(pole);

      const flagCanvas = makeCanvas(128, 128);
      const fc = flagCanvas.getContext("2d");
      fc.fillStyle = hexCSS(CH_COLOR[sq.chapter]);
      fc.beginPath();
      fc.moveTo(4, 4);
      fc.lineTo(120, 28);
      fc.lineTo(4, 64);
      fc.closePath();
      fc.fill();
      fc.lineWidth = 5;
      fc.strokeStyle = "rgba(0,0,0,0.18)";
      fc.stroke();
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.35),
        new THREE.MeshStandardMaterial({ map: toTexture(flagCanvas), transparent: true, side: THREE.DoubleSide, roughness: 0.85 })
      );
      flag.position.set(p.x - 0.06, 0.22 + h + 0.86, p.z);
      flag.castShadow = true;
      ringGroup.add(flag);
    }
  });

  scene.add(ringGroup);
}

function buildPawn() {
  pawnGroup = new THREE.Group();
  pawn = new THREE.Group();

  // 底座
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 0.12, 20),
    new THREE.MeshStandardMaterial({ color: 0x2e2419, roughness: 0.55, metalness: 0.25 })
  );
  base.position.y = 0.06;

  // 身體：稍微內收的梯形
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.28, 0.56, 20),
    new THREE.MeshStandardMaterial({ color: 0x13a8b5, roughness: 0.5, metalness: 0.05 })
  );
  body.position.y = 0.38;

  // 圍巾／領口
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.045, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0xe6c081, roughness: 0.6, metalness: 0.15 })
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.64;

  // 頭
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xf1c99d, roughness: 0.55 })
  );
  head.position.y = 0.86;
  head.castShadow = true;
  pawnHead = head;

  // 髮：只蓋住頭頂，讓臉看得出來，棋子才不像一顆黑球
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ color: 0x43301f, roughness: 0.7 })
  );
  hair.position.y = 0.945;

  // 手（兩根棍子）
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.28, 4, 8);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x13a8b5, roughness: 0.5 });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.24, 0.42, 0);
  armL.rotation.z = 0.35;
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.24, 0.42, 0);
  armR.rotation.z = -0.35;

  pawn.add(base, body, collar, head, hair, armL, armR);
  // 與共用旅人頭像一致：青色外套、黃色背包與有表情的臉。
  for (const x of [-0.085, 0.085]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), new THREE.MeshStandardMaterial({color:0x26364b}));
    eye.position.set(x, 0.88, 0.22);
    pawn.add(eye);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.35, 0.035), new THREE.MeshStandardMaterial({color:0xffcc43}));
    strap.position.set(x, 0.43, 0.2);
    pawn.add(strap);
  }
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.18), new THREE.MeshStandardMaterial({color:0xffc743}));
  backpack.position.set(0, 0.4, -0.21);
  pawn.add(backpack);
  pawn.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // 棋子本體改用 Blender 建模匯出的旅人（tools/blender/build-traveler.py）。
  // 載入成功就拆掉上面那組 box 備援件。GLB 三個節點：RA_TravelerBody / RA_TravelerHead（idle 左右看）
  // / RA_TravelerCase（跳格時拖後、落地回正）。行李箱拉到 pawnGroup 層級，跟 box 版一樣不吃 squash。
  new GLTFLoader().load(new URL("../assets/art/traveler.glb", import.meta.url).href, (gltf) => {
    for (const ob of [...pawn.children]) pawn.remove(ob);
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    pawn.add(model);
    const head = model.getObjectByName("RA_TravelerHead");
    if (head) pawnHead = head;
    const caseNode = model.getObjectByName("RA_TravelerCase");
    if (caseNode) {
      const oldCase = suitcase;
      pawnGroup.add(caseNode);
      suitcase = caseNode;
      CASE_HOME.copy(caseNode.position);        // 跳格動畫以模型自己的擺位為基準
      if (oldCase) pawnGroup.remove(oldCase);
    }
    if (typeof window !== "undefined") window.__pawnModel = "glb";   // 給測試／除錯用
  }, undefined, () => {});            // 載入失敗留上面那組 box 棋子，不影響遊戲

  // 行李箱：一顆小箱在棋子側邊（GLB 載入成功時會被模型的 RA_TravelerCase 取代）
  suitcase = new THREE.Group();
  const caseBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.22, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xff8851, roughness: 0.6, metalness: 0.1 })
  );
  const caseHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.018, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8c4a3, roughness: 0.65, metalness: 0.2 })
  );
  caseHandle.rotation.x = Math.PI / 2;
  caseHandle.position.set(0, 0.15, 0);
  const caseSticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xffe29a, roughness: 0.8 })
  );
  caseSticker.position.set(0, 0.02, 0.071);
  suitcase.add(caseBody, caseHandle, caseSticker);
  suitcase.position.copy(CASE_HOME);
  suitcase.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  pawnGroup.add(pawn, suitcase);
  scene.add(pawnGroup);

  resetPawnGroup();
}

function resetPawnGroup() {
  if (!pawnGroup) return;
  // 第 0 格（出發）就站在第 24 格「起點／終點」那個角落
  const target = ringPos(pos <= 0 ? 23 : Math.min(23, pos - 1));
  const sq = data ? data.board.squares[pos <= 0 ? 23 : Math.min(23, pos - 1)] : null;
  const y = 0.30 + (sq ? cellHeight(sq) : 0);
  pawnGroup.position.set(target.x, y, target.z);
  if (suitcase) suitcase.position.copy(CASE_HOME);
}

function buildDie() {
  // 六面貼圖一次做好
  dieTexList = DIE_FACES.map((f) => dieFaceTexture(f.value));
  // three.js 的 BoxGeometry 面順序是 [+X, -X, +Y, -Y, +Z, -Z]
  const materials = dieTexList.map((tex) => new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.42, metalness: 0.05,
  }));
  const geo = new THREE.BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE);
  // 倒角感：把頂點稍微往中心縮，讓邊緣變軟
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    const r = 0.12;
    posAttr.setXYZ(i, x * (1 - r * 0.06), y * (1 - r * 0.06), z * (1 - r * 0.06));
  }
  geo.computeVertexNormals();

  die = new THREE.Mesh(geo, materials);
  die.castShadow = true;
  die.receiveShadow = true;
  die.position.set(0, dieRestY(die.quaternion), 0);
  die.visible = true; // 平常就放在桌布中間，點它就擲
  scene.add(die);
}

function isMobile() {
  return typeof window !== "undefined" && window.innerWidth < 760;
}

// ── 每 frame ─────────────────────────────────────────────────────
function tick(t) {
  frameId = requestAnimationFrame(tick);
  if (!visible || !running || !renderer || !scene || !camera) return;
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;

  // 棋子輕輕呼吸
  if (pawn) {
    const s = 1 + Math.sin(t * 0.0022) * 0.02;
    pawn.scale.setScalar(s);
    if (pawnHead) pawnHead.rotation.y = Math.sin(t * 0.0016) * 0.16;
    if (suitcase) suitcase.rotation.z = Math.sin(t * 0.0013 + 0.7) * 0.04;
  }

  renderer.render(scene, camera);
}

function startLoop() {
  if (running) return;
  running = true;
  lastT = performance.now();
  frameId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (!running) return;
  running = false;
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
}

// ── 对外（API） ───────────────────────────────────────────────

export function initBoard3d(container_, board) {
  if (ready) return true;
  wrap = container_;
  data = { board };
  if (!wrap) return false;
  // WebGL 不可用 → 退回 2D，不讓 three.js 在 console 上噴字
  if (!hasWebGL()) return false;
  // 減少動態效果 → 也退回 2D
  if (reduced()) return false;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile(), alpha: true });
    if (!renderer) return false;
    const gl = renderer.getContext();
    if (!gl) return false;
  } catch {
    return false;
  }

  // 效能：像素比上限、陰影解析度上限，手機不追極致
  const maxPixelRatio = isMobile() ? 1.6 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  renderer.setClearColor(0x000000, 0);
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  clock = new THREE.Clock();

  buildLights();
  buildTable();
  buildRing(board);
  buildPawn();
  buildDie();

  const fit = () => {
    if (!wrap || !renderer || !camera) return;
    const w = wrap.clientWidth || 1;
    const h = wrap.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (layoutMobile !== isMobile()) {
      layoutMobile = isMobile();
      view.yaw = layoutMobile ? 0 : 0.24;
      view.tilt = layoutMobile ? Math.PI * 0.38 : CAM_TILT;
      view.zoom = 1;
    }
    // 依水平／垂直視角較窄的那一邊，算出能框住整個棋盤的距離
    const halfV = (camera.fov * Math.PI) / 360;
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
    const r = OUTER + 0.65;
    // 左右用 1.12 倍保險：靠近鏡頭的下排因透視會比較寬
    const dist = Math.max(((r * Math.sin(view.tilt) * 1.08) / Math.tan(halfV)) * CAM_FIT, (r * (layoutMobile ? 1.08 : 1.26)) / Math.tan(halfH));
    view.fitDist = dist;
    applyCamera();
    camera.updateProjectionMatrix();
  };
  wrap.innerHTML = "";
  const canvas = renderer.domElement;
  canvas.classList.add("board3d-canvas");
  canvas.setAttribute("aria-label", "3D 環形棋盤：拖曳可轉動，滾輪可縮放，雙擊回正");
  wrap.appendChild(canvas);
  tileHint = document.createElement("div");
  tileHint.className = "tile-inspect";
  tileHint.hidden = true;
  tileHint.setAttribute("role", "status");
  tileHint.innerHTML = "<strong></strong><span></span>";
  wrap.appendChild(tileHint);
  bindOrbit(canvas);
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "view-reset";
  resetBtn.textContent = "回正視角";
  resetBtn.addEventListener("click", resetView);
  wrap.appendChild(resetBtn);
  const hint = document.createElement("p");
  hint.className = "view-hint";
  hint.textContent = "指向或輕點棋格看名稱・拖曳轉動・滾輪縮放";
  wrap.appendChild(hint);
  fit();

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(fit).observe(wrap);
  } else if (typeof addEventListener === "function") {
    addEventListener("resize", fit);
  }

  // 畫面不顯示時暫停 render
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) startLoop();
      else stopLoop();
    }, { threshold: 0.02 });
    io.observe(wrap);
  } else {
    visible = true;
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopLoop();
      else if (visible) startLoop();
    });
  }

  startLoop();
  resetPawnGroup();
  ready = true;
  return true;
}

// 計算要把 value 面轉到上方的 quaternion
export function orientationFor(value, yawBias) {
  // 從 DIE_FACES 裡找到第一個 value 對應的面法線
  const face = DIE_FACES.find((f) => f.value === value) || DIE_FACES[2];
  const q = new THREE.Quaternion();
  // 偏航（繞 Y）不改變哪一面朝上，只是讓骰子每次外觀不同
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawBias);
  // 把該面的法線旋到 +Y：用 setFromUnitVectors
  const toUp = new THREE.Quaternion().setFromUnitVectors(face.normal, new THREE.Vector3(0, 1, 0));
  // 順序：先把該面翻到上方，再繞世界 Y 偏航（反過來的話，偏航會把骰面轉開，翻不到正上方）
  q.multiply(toUp);
  return q;
}

// 從骰子實際朝向算出朝上的點數，驗證畫面和 engine 的點數一致
export function topFaceValue(quaternion) {
  const up = new THREE.Vector3(0, 1, 0);
  let best = DIE_FACES[0];
  let bestDot = -Infinity;
  for (const f of DIE_FACES) {
    const dot = f.normal.clone().applyQuaternion(quaternion).dot(up);
    if (dot > bestDot) {
      bestDot = dot;
      best = f;
    }
  }
  return best.value;
}

// 骰子貼著桌板時的中心高度：依目前朝向算最低的角，翻滾中也不會穿進桌板
export function dieRestY(quaternion, scale = 1) {
  const e = new THREE.Matrix4().makeRotationFromQuaternion(quaternion).elements;
  const extent = DIE_HALF * scale * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9]));
  return BOARD_TOP_Y + extent;
}

// 落下加兩次彈跳，回傳離桌板的高度；t 是 0–1，超過 0.86 之後貼在桌板上
function dieHopHeight(t) {
  if (t < 0.5) {
    const k = t / 0.5;
    return 4.2 * (1 - k * k);
  }
  if (t < 0.72) {
    const k = (t - 0.5) / 0.22;
    return 0.9 * 4 * k * (1 - k);
  }
  if (t < 0.86) {
    const k = (t - 0.72) / 0.14;
    return 0.25 * 4 * k * (1 - k);
  }
  return 0;
}

// 骰子演出：擲骰只是演出，value 是 engine 已經算好的結果
export function rollDice(value) {
  return new Promise((resolve) => {
    if (!ready || !die || reduced()) {
      resolve();
      return;
    }
    // 不要自己擲隨機：只以 value 決定最終面
    yawCounter += 1;
    const yawBias = yawCounter * 0.83 + (value % 2) * 0.45;
    const finalQ = orientationFor(value, yawBias);

    die.visible = true;
    die.scale.setScalar(1);
    if (typeof window !== "undefined") window.__dieTargetValue = value;
    window.__dieSettledValue = null;
    // 翻滾軸與起點都由 yawBias 派生（不進 RNG，只是看的）
    const spinAxis = new THREE.Vector3(
      Math.sin(yawBias * 1.3),
      0.5,
      Math.cos(yawBias * 1.1)
    ).normalize();
    const spinTurns = 3 + (value % 3) * 0.5;
    const startX = Math.sin(yawBias) * 1.6;
    const startZ = Math.cos(yawBias) * 1.6;
    const spinQ = new THREE.Quaternion();

    const DUR = 1000;
    const SPIN_END = 0.8;   // 第二次彈跳前翻完，之後朝上的面就不變了
    const t0 = performance.now();

    const frame = (now) => {
      const raw = Math.min(1, (now - t0) / DUR);
      const k = Math.min(1, raw / SPIN_END);
      const remain = Math.pow(1 - k, 2);
      spinQ.setFromAxisAngle(spinAxis, remain * spinTurns * Math.PI * 2);
      die.quaternion.copy(spinQ).multiply(finalQ);
      const slide = Math.pow(1 - k, 2);
      die.position.set(startX * slide, dieRestY(die.quaternion) + dieHopHeight(raw), startZ * slide);

      if (raw < 1) {
        requestAnimationFrame(frame);
        return;
      }
      // 落定在桌板上，停一下讓玩家看清楚；之後骰子留在原地，等下一次點擊
      die.quaternion.copy(finalQ);
      die.position.set(0, dieRestY(finalQ), 0);
      if (typeof window !== "undefined") window.__dieSettledValue = topFaceValue(die.quaternion);
      setTimeout(resolve, 800);
    };
    requestAnimationFrame(frame);
  });
}

// 棋子一格一格跳過去；動畫結束 Promise 才 resolve
export function updateBoard3d(state) {
  return new Promise((resolve) => {
    if (!ready || !pawnGroup) {
      resolve();
      return;
    }
    const target = Number(state && state.pos) || 0;
    const from = pos;
    pos = target;

    if (reduced() || target === from || target <= from) {
      // reduce 或重新開一局：直接搬到定位
      resetPawnGroup();
      resolve();
      return;
    }
    hop(from, target, resolve);
  });
}

function hop(fromN, toN, done) {
  let cur = fromN;
  const step = () => {
    if (cur >= toN) {
      done();
      return;
    }
    cur += 1;
    const target = ringPos(cur - 1);
    const endY = 0.30 + cellHeight(data.board.squares[cur - 1]);
    const startX = pawnGroup.position.x;
    const startY = pawnGroup.position.y;
    const startZ = pawnGroup.position.z;
    const DUR = 260;
    const BREAK = 60; // 之間停頓
    const t0 = performance.now();

    const frame = (now) => {
      const raw = Math.min(1, (now - t0) / DUR);
      const k = raw * raw * (3 - 2 * raw);
      pawnGroup.position.x = startX + (target.x - startX) * k;
      pawnGroup.position.z = startZ + (target.z - startZ) * k;
      // 拋物線：中段抬頭
      pawnGroup.position.y = startY + (endY - startY) * k + Math.sin(k * Math.PI) * 1.18;

      // 起跳時箱子稍微拖後、落地時回正
      if (suitcase) {
        suitcase.position.x = CASE_HOME.x - Math.sin(k * Math.PI) * 0.22;
        suitcase.position.z = CASE_HOME.z - Math.sin(k * Math.PI) * 0.18;
      }
      if (pawn) {
        const squish = 1 + Math.sin(k * Math.PI) * 0.12;
        pawn.scale.set(squish, 1 / squish, squish);
      }

      if (raw < 1) requestAnimationFrame(frame);
      else {
        // 落地：squash & stretch
        const landStart = performance.now();
        const land = () => {
          const lk = Math.min(1, (performance.now() - landStart) / 180);
          const bounce = 1 - Math.sin(lk * Math.PI) * 0.14;
          if (pawn) pawn.scale.set(2 - bounce, bounce, 2 - bounce);
          if (suitcase) {
            suitcase.position.x += (CASE_HOME.x - suitcase.position.x) * 0.25;
            suitcase.position.z += (CASE_HOME.z - suitcase.position.z) * 0.25;
            suitcase.rotation.z = Math.sin(lk * Math.PI * 2) * 0.12;
          }
          pawnGroup.position.y = endY + Math.sin(lk * Math.PI) * 0.12;
          if (lk < 1) requestAnimationFrame(land);
          else {
            if (pawn) pawn.scale.set(1, 1, 1);
            if (suitcase) {
              suitcase.position.copy(CASE_HOME);
              suitcase.rotation.z = 0;
            }
            pawnGroup.position.y = endY;
            setTimeout(step, BREAK);
          }
        };
        land();
      }
    };
    requestAnimationFrame(frame);
  };
  step();
}

// 讀存檔或重開：直接搬到指定格
export function teleportPawn(n) {
  if (!ready || !pawnGroup) return;
  pos = Number(n) || 0;
  resetPawnGroup();
}

export function isBoard3dReady() {
  return ready;
}
