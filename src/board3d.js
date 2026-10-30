// 3D 環形棋盤（plan D10）。three.js 固定版本放 vendor/，執行時不連 CDN。
//
// 對外只提供兩支函式：
//   initBoard3d(container, board)  建立場景與環形棋盤，回傳 true（或 WebGL 失敗時回 false）
//   updateBoard3d(state)           更新棋子位置，回傳 Promise；棋子一格一格跳過去，動畫結束才 resolve
//
// 規則（格子順序、位置、里程碑）由 data/board.json 決定，這裡不寫規則。
import * as THREE from "../vendor/three.module.js";

const CH_COLOR = { 1: 0x9fc79a, 2: 0x8fa3d6, 3: 0xd9a97c, 4: 0xb68fbf };
const MILESTONE_COLOR = 0x2f2c27;
const HALF = 4.0;      // 環形半邊長
const CELL = 1.32;     // 每格尺寸
const REDUCED_MQ = "(prefers-reduced-motion: reduce)";

let ready = false;
let container, renderer, scene, camera, piece, ring;
let pos = 0;           // 目前顯示的格子編號（0 = 出發點，1..24）
let data = null;

function ringPos(n) {
  // n = 0..23，回傳第 n+1 格中心座標。順時鐘：底→右→上→左
  const side = Math.floor(n / 6);
  const t = ((n % 6) + 0.5) / 6;
  if (side === 0) return { x: -HALF + 2 * HALF * t, z: HALF };
  if (side === 1) return { x: HALF, z: HALF - 2 * HALF * t };
  if (side === 2) return { x: HALF - 2 * HALF * t, z: -HALF };
  return { x: -HALF, z: -HALF + 2 * HALF * t };
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f4ec);
  scene.fog = new THREE.Fog(0xf7f4ec, 24, 52);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9c2b0, 1.1);
  hemi.position.set(0, 14, 0);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff6e6, 1.05);
  key.position.set(-7, 12, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const cam = key.shadow.camera;
  cam.left = -10; cam.right = 10; cam.top = 10; cam.bottom = -10;
  cam.near = 1; cam.far = 40;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xcfd6ef, 0.35);
  fill.position.set(6, 6, -8);
  scene.add(fill);

  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 13, 0.6, 48),
    new THREE.MeshStandardMaterial({ color: 0xd8c7a6, roughness: 0.92 })
  );
  table.position.y = -0.35;
  table.receiveShadow = true;
  scene.add(table);

  const field = new THREE.Mesh(
    new THREE.BoxGeometry(2 * HALF + CELL + 0.8, 0.32, 2 * HALF + CELL + 0.8),
    new THREE.MeshStandardMaterial({ color: 0xad8e63, roughness: 0.95 })
  );
  field.position.y = 0;
  field.receiveShadow = true;
  scene.add(field);

  const inner = new THREE.Mesh(
    new THREE.BoxGeometry(2 * HALF - CELL - 0.35, 0.28, 2 * HALF - CELL - 0.35),
    new THREE.MeshStandardMaterial({ color: 0xe7dcc0, roughness: 1 })
  );
  inner.position.y = 0.18;
  inner.receiveShadow = true;
  scene.add(inner);
}

function buildRing(board) {
  ring = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(CELL, 1, CELL);
  board.squares.forEach((sq) => {
    const p = ringPos(sq.n - 1);
    const milestone = sq.kind === "milestone";
    const h = milestone ? 0.72 : 0.28;
    const mat = new THREE.MeshStandardMaterial({
      color: milestone ? MILESTONE_COLOR : CH_COLOR[sq.chapter] || 0xcfcfcf,
      roughness: 0.8,
    });
    const cell = new THREE.Mesh(boxGeo, mat);
    cell.position.set(p.x, 0.28 + h / 2, p.z);
    cell.castShadow = true;
    cell.receiveShadow = true;
    cell.userData = { n: sq.n };
    ring.add(cell);

    if (milestone) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xe7dcc0, roughness: 0.85 })
      );
      pole.position.set(p.x, 1.05, p.z);
      pole.castShadow = true;
      ring.add(pole);
      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.28, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xe1b56a, roughness: 0.75 })
      );
      flag.position.set(p.x + 0.24, 1.55, p.z);
      flag.castShadow = true;
      ring.add(flag);
    }
  });
  scene.add(ring);
}

function buildPiece() {
  piece = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 0.7, 16),
    new THREE.MeshStandardMaterial({ color: 0xd94f30, roughness: 0.55, metalness: 0.1 })
  );
  body.position.y = 0.35;
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0764c, roughness: 0.5, metalness: 0.1 })
  );
  head.position.y = 0.95;
  head.castShadow = true;
  piece.add(body, head);
  placePiece(piece, 0);
  scene.add(piece);
  return piece;
}

function placePiece(p, n) {
  const target = n <= 0 ? { x: 0, z: HALF + CELL * 1.6 } : ringPos(n - 1);
  const y = 0.3 + (n > 0 && data && data.board.squares[n - 1].kind === "milestone" ? 0.72 : 0.28);
  p.position.set(target.x, y, target.z);
}

function tick() {
  // 鏡頭略為跟著棋子
  if (camera && piece) {
    const camX = piece.position.x * 0.32;
    const camZ = 11 + piece.position.z * 0.22;
    camera.position.lerp(new THREE.Vector3(camX, 9, camZ), 0.06);
    camera.lookAt(0, 0.8, 0);
  }
  if (renderer && scene && camera) renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function reduced() {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MQ).matches;
}

function hop(fromN, toN) {
  // 一格一格跳過去；每格 260ms，落地小彈一下。
  return new Promise((resolve) => {
    let cur = fromN;
    const step = () => {
      if (cur >= toN) return resolve();
      cur += 1;
      const target = ringPos(cur - 1);
      const start = piece.position.clone();
      const endY = 0.3 + (data && data.board.squares[cur - 1].kind === "milestone" ? 0.72 : 0.28);
      const t0 = performance.now();
      const DUR = 260;
      const frame = (now) => {
        const u = Math.min(1, (now - t0) / DUR);
        const eased = u * u * (3 - 2 * u);
        piece.position.x = start.x + (target.x - start.x) * eased;
        piece.position.z = start.z + (target.z - start.z) * eased;
        piece.position.y = start.y + (endY - start.y) * eased + Math.sin(eased * Math.PI) * 1.15;
        if (u < 1) requestAnimationFrame(frame);
        else {
          piece.position.set(target.x, endY, target.z);
          setTimeout(step, 60);
        }
      };
      requestAnimationFrame(frame);
    };
    step();
  });
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function initBoard3d(container_, board) {
  if (ready) return true;
  container = container_;
  data = { board };
  if (!container) return false;
  // WebGL 不可用或被政策關掉時，先驗證再叫 three.js，免得 console 冒紅字
  if (!hasWebGL()) return false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    if (!renderer || !renderer.getContext()) return false;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch (e) {
    return false;
  }
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 9, 11);
  camera.lookAt(0, 0.8, 0);

  const fit = () => {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  buildScene();
  buildRing(board);
  buildPiece();
  container.innerHTML = "";
  renderer.domElement.classList.add("board3d-canvas");
  container.appendChild(renderer.domElement);
  fit();
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(fit).observe(container);
  } else if (typeof addEventListener === "function") {
    addEventListener("resize", fit);
  }
  requestAnimationFrame(tick);
  ready = true;
  return true;
}

export function updateBoard3d(state) {
  if (!ready || !piece) return Promise.resolve();
  const target = Number(state && state.pos) || 0;
  const from = pos;
  pos = target;
  if (reduced() || target === from) {
    placePiece(piece, target);
    return Promise.resolve();
  }
  if (target < from) {
    // 重新開始：直接搬到新位置
    placePiece(piece, target);
    return Promise.resolve();
  }
  return hop(from, target);
}