// 3D 環形棋盤 + 骰子畫面（plan D10 + 美術與骰子）。
// three.js 固定版本放 vendor/，執行時不連 CDN、不下載圖片／字型。
// 所有貼圖都用 canvas 現畫（格子號碼／短標籤、木紋桌布、骰子點數、中央標題）。
//
// 對外三支函式：
//   initBoard3d(container, board)  建立場景與環形棋盤，回 true（WebGL 失敗或減少動態效果回 false）
//   rollDice(value)                骰子演出：在棋盤中央滾 ~1 秒停在 value 面。回 Promise。
//                                  value 只是「演出」，engine 早就擲好了，這裡不會再擲一次隨機數。
//   updateBoard3d(state)           棋子一格一格跳過去。回 Promise，跳完才 resolve。
//
// 規則（格子順序、位置、里程碑、骰子點數）由 engine / data/board.json 決定，這裡不寫規則。
import * as THREE from "../vendor/three.module.js";

// ── 顏色與版面 ─────────────────────────────────────────────────────
// 四章色系比 2D 版稍微沉一點，一起用在格子、中央標題、章節旗上，視覺才一致。
const CH_COLOR = { 1: 0x8fb891, 2: 0x8fa9d4, 3: 0xd5a875, 4: 0xb391bd };
const CH_SIGIL = { 1: "稿", 2: "行", 3: "會", 4: "結" };
const CH_NAME = { 1: "投稿", 2: "出國準備", 3: "國際會議", 4: "返國結案" };
const MILESTONE_GOLD = 0xe1b56a;
const MILESTONE_FILL = 0x35302a;

const HALF = 4.0;      // 環形半邊長
const CELL = 1.35;     // 每格寬
const CELL_H = 0.3;    // 一般格高度
const CELL_H_MS = 0.8; // 里程碑格高度
const REDUCED_MQ = "(prefers-reduced-motion: reduce)";

const DIE_SIZE = 0.95;
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
let ringGroup, tableGroup;
let die, dieTexList;
let keyLight;
let yawCounter = 0;               // 每次擲骰的偏航角，用單調計數做，不碰隨機
let pos = 0;                      // 棋子目前顯示的格子編號（0 = 出發）
let data = null;
let running = false;              // rAF 是否跑著
let frameId = 0;
let visible = true;
let lastT = 0;

// 把棋子／骰子跟鏡頭關係存起來，讓每 frame 更新
const CAM_Y = 11.5;
const CAM_Z = 9; // 鏡頭離棋盤的距離：越小越近、字越大
let camScale = 1; // 畫面越窄，鏡頭退得越遠，避免棋盤被切掉
const camPos = new THREE.Vector3(0, CAM_Y, CAM_Z);
const camLook = new THREE.Vector3(0, 0.8, 0);
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

// 木紋桌布：用 canvas 走一種斜向年輪 + 雜訊點的樣子，比純色有質感。
function woodTexture(baseHex, size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");
  const base = new THREE.Color(baseHex);

  ctx.fillStyle = base.getStyle();
  ctx.fillRect(0, 0, size, size);

  // 大量淡曲線做出「木紋流向」
  ctx.lineCap = "round";
  for (let i = 0; i < 140; i++) {
    const t = i / 140;
    const y0 = (t * size * 1.6) - size * 0.3;
    const stroke = base.clone().lerp(new THREE.Color(t % 2 ? 0x2e2216 : 0xd1b38a), 0.18 + (i % 5) * 0.02);
    ctx.strokeStyle = stroke.getStyle();
    ctx.globalAlpha = 0.36 - (i % 4) * 0.04;
    ctx.lineWidth = 1.4 + (i % 3) * 0.8;
    ctx.beginPath();
    for (let x = -20; x <= size + 20; x += 20) {
      const wob = Math.sin((x * 0.010) + i * 0.62) * 18 + Math.sin(x * 0.029 + i * 1.7) * 8;
      const yy = y0 + wob + (x * 0.06);
      if (x === -20) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // 亮部與暗部微光
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "rgba(255,241,215,0.22)");
  g.addColorStop(0.45, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // 一些年輪節眼
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 12 + Math.random() * 22;
    for (let j = 5; j >= 1; j--) {
      ctx.beginPath();
      ctx.arc(x, y, rad * j / 5, 0, Math.PI * 2);
      ctx.strokeStyle = base.clone().lerp(new THREE.Color(0x2b2119), 0.18).getStyle();
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  const tex = toTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function fabricTexture(baseHex, size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = hexCSS(baseHex);
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.18;
  for (let y = 0; y < size; y += 3) {
    ctx.strokeStyle = y % 6 === 0 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let x = 0; x < size; x += 3) {
    ctx.strokeStyle = x % 6 === 0 ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = toTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 格子貼圖：號碼 + 短標籤 + 章節底色。里程碑特別金邊＋章節印記。
function cellTexture(sq, milestone) {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");

  const fill = milestone ? MILESTONE_FILL : CH_COLOR[sq.chapter];
  const ink = milestone ? 0xf6efe0 : 0x211c17;
  ctx.fillStyle = hexCSS(fill);
  ctx.fillRect(0, 0, S, S);

  if (milestone) {
    // 金屬環
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.72);
    g.addColorStop(0, "rgba(255,228,174,0.28)");
    g.addColorStop(0.6, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, "rgba(255,255,255,0.16)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  // 外框
  ctx.lineWidth = 6;
  ctx.strokeStyle = milestone ? hexCSS(MILESTONE_GOLD) : "rgba(27,21,15,0.22)";
  roundedRect(ctx, 5, 5, S - 10, S - 10, 18);
  ctx.stroke();

  // 號碼
  ctx.fillStyle = hexCSS(milestone ? MILESTONE_GOLD : ink);
  ctx.font = "bold 84px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(sq.n), S / 2, S * 0.32);

  // 短標籤
  const label = String(sq.label || "");
  const fontSize = label.length > 6 ? 30 : 36;
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = hexCSS(milestone ? 0xf2e7cf : ink);
  // 如果標籤太長，切成兩段
  if (label.length > 6) {
    const cut = Math.ceil(label.length / 2);
    ctx.fillText(label.slice(0, cut), S / 2, S * 0.62);
    ctx.fillText(label.slice(cut), S / 2, S * 0.62 + fontSize * 1.15);
  } else {
    ctx.fillText(label, S / 2, S * 0.64);
  }

  // 底部章節印記
  const sigil = milestone ? "◆" : CH_SIGIL[sq.chapter];
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillStyle = milestone ? hexCSS(MILESTONE_GOLD) : "rgba(33,28,23,0.55)";
  ctx.fillText(sigil, S / 2, S * 0.88);

  return toTexture(c);
}

// 中央標題板：遊戲名 + 四章名
function centerTexture() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");

  const bg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.72);
  bg.addColorStop(0, "#efe2c1");
  bg.addColorStop(1, "#d6c69b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // 外框 + 內框
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#8f6b3a";
  roundedRect(ctx, 24, 24, S - 48, S - 48, 28);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(143,107,58,0.55)";
  roundedRect(ctx, 52, 52, S - 104, S - 104, 22);
  ctx.stroke();

  // 遊戲名
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#3b2512";
  ctx.font = "bold 132px system-ui, sans-serif";
  ctx.fillText("大赴翁", S / 2, S * 0.34);
  ctx.font = "600 58px system-ui, sans-serif";
  ctx.fillStyle = "#7c562b";
  ctx.fillText("ROLL ABROAD", S / 2, S * 0.48);

  // 分隔線
  ctx.beginPath();
  ctx.moveTo(S * 0.28, S * 0.56);
  ctx.lineTo(S * 0.72, S * 0.56);
  ctx.strokeStyle = "rgba(143,107,58,0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // 四章名依序排
  const order = [1, 2, 3, 4];
  order.forEach((ch, i) => {
    const x = S * (0.24 + (i % 2) * 0.34);
    const y = S * (0.68 + Math.floor(i / 2) * 0.14);
    const dot = document.createElement("canvas");
    // 用章節色畫小方章
    ctx.fillStyle = hexCSS(CH_COLOR[ch]);
    roundedRect(ctx, x - 82, y - 34, 64, 68, 10);
    ctx.fill();
    ctx.fillStyle = "#2a2116";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(CH_SIGIL[ch], x - 70, y);
    ctx.font = "600 42px system-ui, sans-serif";
    ctx.fillStyle = "#3b2512";
    ctx.textAlign = "left";
    ctx.fillText(CH_NAME[ch], x - 4, y);
  });

  return toTexture(c);
}

// 骰子點數：畫黑圓點在白底上。回傳貼圖與該面的 value。
function dieFaceTexture(pips) {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");
  // 白底
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#ece2cd");
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
    grad.addColorStop(0, "#3a332b");
    grad.addColorStop(1, "#171310");
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
function ringPos(n) {
  const side = Math.floor(n / 6);
  const t = ((n % 6) + 0.5) / 6;
  if (side === 0) return { x: -HALF + 2 * HALF * t, z: HALF };
  if (side === 1) return { x: HALF, z: HALF - 2 * HALF * t };
  if (side === 2) return { x: HALF - 2 * HALF * t, z: -HALF };
  return { x: -HALF, z: -HALF + 2 * HALF * t };
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
  const hemi = new THREE.HemisphereLight(0xfff5e2, 0x8a765a, 1.05);
  hemi.position.set(0, 18, 0);
  scene.add(hemi);

  keyLight = new THREE.DirectionalLight(0xfff2df, 1.2);
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

  scene.fog = new THREE.Fog(0xd9cba7, 26, 70);
}

function buildTable() {
  tableGroup = new THREE.Group();

  // 圓桌底
  const tableTex = woodTexture(0x8a5a33, 512);
  tableTex.repeat.set(2, 2);
  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 15.2, 0.7, 96),
    new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.85, metalness: 0.02, color: 0xb5824f })
  );
  table.position.y = -0.55;
  table.receiveShadow = true;
  table.castShadow = true;
  tableGroup.add(table);

  // 一層「桌布」墊在棋盤底下（細織紋，比桌板細，一眼看出是鋪在上面的一塊墊）
  const clothTex = fabricTexture(0xefe2c0, 256);
  clothTex.repeat.set(4, 4);
  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(2 * HALF + CELL + 1.6, 0.12, 2 * HALF + CELL + 1.6),
    new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.98 })
  );
  cloth.position.y = -0.18;
  cloth.receiveShadow = true;
  tableGroup.add(cloth);

  // 棋盤本體：外框木框 + 內層麻布
  const boardTex = woodTexture(0x8c562c, 256);
  boardTex.repeat.set(2, 2);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2 * HALF + CELL + 0.6, 0.22, 2 * HALF + CELL + 0.6),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.8, color: 0x9a6234 })
  );
  frame.position.y = 0;
  frame.receiveShadow = true;
  frame.castShadow = true;
  tableGroup.add(frame);

  const innerCloth = new THREE.Mesh(
    new THREE.BoxGeometry(2 * HALF - CELL - 0.25, 0.16, 2 * HALF - CELL - 0.25),
    new THREE.MeshStandardMaterial({ map: fabricTexture(0xeadfc2, 256), roughness: 1 })
  );
  innerCloth.position.y = 0.12;
  innerCloth.receiveShadow = true;
  tableGroup.add(innerCloth);

  // 中央標題板
  const centerPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * HALF - CELL - 0.75, 2 * HALF - CELL - 0.75),
    new THREE.MeshStandardMaterial({ map: centerTexture(), roughness: 0.75, transparent: true, opacity: 0.97 })
  );
  centerPlane.rotation.x = -Math.PI / 2;
  centerPlane.position.set(0, 0.22, 0);
  centerPlane.receiveShadow = true;
  tableGroup.add(centerPlane);

  scene.add(tableGroup);
}

function buildRing(board) {
  ringGroup = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(CELL, 1, CELL);
  const edgeGeo = new THREE.BoxGeometry(CELL + 0.05, 1, CELL + 0.05);

  board.squares.forEach((sq) => {
    const p = ringPos(sq.n - 1);
    const ms = sq.kind === "milestone";
    const h = cellHeight(sq);

    // 主體格
    const mesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
      map: cellTexture(sq, ms),
      roughness: ms ? 0.6 : 0.82,
      metalness: ms ? 0.15 : 0.0,
    }));
    mesh.position.set(p.x, 0.22 + h / 2, p.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ringGroup.add(mesh);

    if (ms) {
      // 里程碑：加一層發光金邊（用略放大的透明盒疊上去）
      const glow = new THREE.Mesh(edgeGeo, new THREE.MeshStandardMaterial({
        color: MILESTONE_GOLD,
        emissive: MILESTONE_GOLD,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.32,
        roughness: 0.4,
      }));
      glow.position.set(p.x, 0.32 + h / 2, p.z);
      ringGroup.add(glow);

      // 里程碑小旗
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 1.55, 12),
        new THREE.MeshStandardMaterial({ color: 0xefe0bd, roughness: 0.7, metalness: 0.15 })
      );
      pole.position.set(p.x - 0.32, 0.48 + h + 0.6, p.z);
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
        new THREE.PlaneGeometry(0.6, 0.42),
        new THREE.MeshStandardMaterial({ map: toTexture(flagCanvas), transparent: true, side: THREE.DoubleSide, roughness: 0.85 })
      );
      flag.position.set(p.x + 0.06, 0.48 + h + 1.12, p.z);
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
    new THREE.MeshStandardMaterial({ color: 0xc74f34, roughness: 0.5, metalness: 0.05 })
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
  const armMat = new THREE.MeshStandardMaterial({ color: 0xc74f34, roughness: 0.5 });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.24, 0.42, 0);
  armL.rotation.z = 0.35;
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.24, 0.42, 0);
  armR.rotation.z = -0.35;

  pawn.add(base, body, collar, head, hair, armL, armR);
  pawn.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // 行李箱：一顆小箱在棋子側邊
  suitcase = new THREE.Group();
  const caseBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.22, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x2c4a68, roughness: 0.6, metalness: 0.1 })
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
  suitcase.position.set(0.36, 0.16, 0.08);
  suitcase.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  pawnGroup.add(pawn, suitcase);
  scene.add(pawnGroup);

  resetPawnGroup();
}

function resetPawnGroup() {
  if (!pawnGroup) return;
  const target = pos <= 0
    ? { x: 0, z: HALF + CELL * 1.7 }
    : ringPos(Math.max(0, Math.min(23, pos - 1)));
  const sq = pos > 0 && data ? data.board.squares[pos - 1] : null;
  const y = 0.30 + (sq ? cellHeight(sq) : 0);
  pawnGroup.position.set(target.x, y, target.z);
  if (suitcase) suitcase.position.set(0.36, 0.16, 0.08);
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
  die.position.set(0, 2.2, 0);   // 懸空於棋盤中央
  die.visible = false;
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

  // 鏡頭平順地跟著棋子
  if (pawnGroup && camera) {
    const k = 1 - Math.pow(0.0008, dt);   // 追蹤的阻尼
    camPos.x += (pawnGroup.position.x * 0.32 - camPos.x) * k;
    camPos.z += ((CAM_Z * camScale + pawnGroup.position.z * 0.22) - camPos.z) * k;
    camLook.x += (pawnGroup.position.x * 0.28 - camLook.x) * k;
    camLook.z += (pawnGroup.position.z * 0.24 - camLook.z) * k;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
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
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile(), alpha: false });
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
  scene.background = new THREE.Color(0xd9cba7);
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
    camScale = Math.max(1, 1.55 / camera.aspect);
    camPos.y = CAM_Y * camScale;
    camera.updateProjectionMatrix();
  };
  wrap.innerHTML = "";
  const canvas = renderer.domElement;
  canvas.classList.add("board3d-canvas");
  canvas.setAttribute("aria-label", "3D 環形棋盤");
  wrap.appendChild(canvas);
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
function orientationFor(value, yawBias) {
  // 從 DIE_FACES 裡找到第一個 value 對應的面法線
  const face = DIE_FACES.find((f) => f.value === value) || DIE_FACES[2];
  const q = new THREE.Quaternion();
  // 偏航（繞 Y）不改變哪一面朝上，只是讓骰子每次外觀不同
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawBias);
  // 把該面的法線旋到 +Y：用 setFromUnitVectors
  const toUp = new THREE.Quaternion().setFromUnitVectors(face.normal, new THREE.Vector3(0, 1, 0));
  q.premultiply(toUp);
  return q;
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
    die.position.set(0, 2.2, 0);
    if (typeof window !== "undefined") window.__dieTargetValue = value;
    window.__dieSettledValue = null;
    const startQ = die.quaternion.clone();
    // 起手就亂轉（不進 RNG，只是看的），用 yawBias 派生
    const spinAxis = new THREE.Vector3(
      Math.sin(yawBias * 1.3),
      0.85,
      Math.cos(yawBias * 1.1)
    ).normalize();
    const spinTurns = (4.6 + (value % 3) * 0.7);
    const pq = new THREE.Quaternion().setFromAxisAngle(spinAxis, spinTurns * Math.PI * 2);
    startQ.premultiply(pq);
    die.quaternion.copy(startQ);

    const DUR = 1000;
    const ZOOM_START = 0.72;   // 0.72 ~ 1 是最後「放大顯示點數」那段
    const t0 = performance.now();

    const frame = (now) => {
      const raw = Math.min(1, (now - t0) / DUR);
      // 前段快速旋轉消失；後段貼齊 finalQ
      const easeOut = 1 - Math.pow(1 - raw, 2.2);
      // quaternion 用球面插值：在中途切到 finalQ 之前先留在 startQ 附近
      if (raw < ZOOM_START) {
        const slerpQ = new THREE.Quaternion();
        const k = easeOut / ZOOM_START * 0.85;
        slerpQ.copy(startQ).slerp(finalQ, Math.min(1, k));
        die.quaternion.copy(slerpQ);
      } else {
        die.quaternion.copy(finalQ);
      }
      // 拋物線軌跡：起點高一點，中段往上翻，最後落到中央偏上
      const arc = Math.sin(easeOut * Math.PI) * 2.4;
      die.position.y = 1.6 + arc + (raw > ZOOM_START ? (raw - ZOOM_START) / (1 - ZOOM_START) * 0.6 : 0);
      die.position.x = Math.sin(easeOut * Math.PI * 2) * 0.6 * (1 - raw);
      die.position.z = -Math.cos(easeOut * Math.PI * 1.7) * 0.6 * (1 - raw);
      die.rotation.x += 0;     // 保留：旋轉全靠 quaternion，這裡不做累加，避免漂

      // 最後階段：放大顯示點數
      if (raw > ZOOM_START) {
        const k = (raw - ZOOM_START) / (1 - ZOOM_START);
        die.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.55 + k * 0.15);
      }

      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        // 落地：骰子停在原地、scale 回正常、輕微上下彈一下
        const settleStart = now;
        if (typeof window !== "undefined") window.__dieSettledValue = value;
        const settle = () => {
          const k = Math.min(1, (performance.now() - settleStart) / 260);
          die.quaternion.copy(finalQ);
          die.position.set(0, 1.85 + (1 - k) * 0.2 * Math.sin(k * Math.PI * 3), 0);
          die.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.18);
          if (k < 1) requestAnimationFrame(settle);
          else {
            die.position.set(0, 1.85, 0);
            die.scale.setScalar(1);
            // 短暫停頓讓玩家看清，然後淡出
            setTimeout(() => {
              const fadeStart = performance.now();
              const fade = () => {
                const kk = Math.min(1, (performance.now() - fadeStart) / 220);
                die.scale.setScalar(1 - kk * 0.55);
                die.position.y = 1.85 - kk * 0.6;
                if (kk < 1) requestAnimationFrame(fade);
                else {
                  die.visible = false;
                  die.scale.setScalar(1);
                  die.position.set(0, 2.2, 0);
                  resolve();
                }
              };
              requestAnimationFrame(fade);
            }, 220);
          }
        };
        settle();
      }
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
        suitcase.position.x = 0.36 - Math.sin(k * Math.PI) * 0.22;
        suitcase.position.z = 0.08 - Math.sin(k * Math.PI) * 0.18;
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
            suitcase.position.x += (0.36 - suitcase.position.x) * 0.25;
            suitcase.position.z += (0.08 - suitcase.position.z) * 0.25;
            suitcase.rotation.z = Math.sin(lk * Math.PI * 2) * 0.12;
          }
          pawnGroup.position.y = endY + Math.sin(lk * Math.PI) * 0.12;
          if (lk < 1) requestAnimationFrame(land);
          else {
            if (pawn) pawn.scale.set(1, 1, 1);
            if (suitcase) {
              suitcase.position.set(0.36, 0.16, 0.08);
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