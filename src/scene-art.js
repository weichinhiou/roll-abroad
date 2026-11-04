// 棋盤共用美術：圖片貼圖與簡單 3D 旅行場景。規則留在 engine。
import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { artImage } from "./art.js";
export const CHAPTER_COLORS = {1:0x35c58c,2:0x38aff0,3:0xffc536,4:0xa775e1,5:0xef7d57};
const font = '"Microsoft JhengHei",system-ui,sans-serif';
const emoji = '"Segoe UI Emoji","Apple Color Emoji",sans-serif';
const icons = ["🌐","📝","🤝","📑","📨","🧭","💡","📋","🎟️","🛂","🗓️","✈️","🏷️","🎤","☕","💬","📊","🏆","🧳","📧","✍️","📂","💡","🏠","📄","🎙","🧬","🏫","🔧","📈","🌱","🏁"];
const cssColor = (n) => `#${n.toString(16).padStart(6,"0")}`;
function canvas(w,h) { const c=document.createElement("canvas");c.width=w;c.height=h;return c; }
function texture(c) { const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t; }
function round(ctx,x,y,w,h,r) {ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

// 格面貼圖。shape：corner 是角落（里程碑）正方形格；mid 是沿著邊的一般格
//（寬＝沿邊 0.9、深＝往內 1.4，直立比例、標籤分兩行）。格子 mesh 會自己轉向沿著邊。
const TILE_FACE = { mid: [0.9, 1.4], corner: [1.4, 1.4] };
export function tileArt(sq, milestone, shape) {
  const [tw, td] = TILE_FACE[shape] || TILE_FACE.mid;
  const w = Math.round(tw * 320), h = Math.round(td * 320);
  const c=canvas(w,h),ctx=c.getContext("2d"),color=cssColor(CHAPTER_COLORS[sq.chapter]);
  ctx.fillStyle=color;ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#ffffff";round(ctx,10,10,w-20,h-20,22);ctx.fill();
  ctx.fillStyle=color;ctx.globalAlpha=.18;round(ctx,18,18,w-36,h*.65,17);ctx.fill();ctx.globalAlpha=1;
  const atlas=artImage("chapters");
  if(milestone && atlas){
    // 2×2 共四枚章徽；第五章先沿用返國章（整批素材重製時再補第五枚）
    const i=Math.min(3,sq.chapter-1),sw=atlas.naturalWidth/2,sh=atlas.naturalHeight/2,size=Math.min(w,h)*.48;
    ctx.drawImage(atlas,(i%2)*sw,Math.floor(i/2)*sh,sw,sh,(w-size)/2,h*.17,size,size);
  } else {
    ctx.font=`${Math.round(Math.min(w,h)*.33)}px ${emoji}`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(icons[sq.n-1]||icons[icons.length-1],w/2,h*.34);
  }
  // 圖文分區，主標放大約五成，維持純白底與深藍字。
  ctx.fillStyle="#ffffff";ctx.fillRect(14,h*.60,w-28,h*.35);
  ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#102543";
  const label=String(sq.label),fs=Math.floor(Math.min(w*.23,h*.25));ctx.font=`900 ${fs}px ${font}`;
  if(h>w) { const cut=Math.ceil(label.length/2);ctx.fillText(label.slice(0,cut),w/2,h*.67,w*.9);ctx.fillText(label.slice(cut),w/2,h*.84,w*.9); }
  else ctx.fillText(label,w/2,h*.79,w*.9);
  ctx.font=`800 ${Math.round(Math.min(w,h)*.105)}px ${font}`;ctx.fillStyle="#203b59";
  ctx.fillText(`${sq.n}${milestone ? "・必停" : sq.kind==="fate" ? "・命運" : sq.kind==="route" ? "・路線" : "・機會"}`,w/2,h*.10);
  return texture(c);
}

const materials=new Map();
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.75}));return materials.get(color);}
function box(group,x,y,z,w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function ball(group,x,y,z,r,color){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),mat(color));m.position.set(x,y,z);m.castShadow=true;group.add(m);return m;}
function sign(group,text,x,y,z,w,color){
  const c=canvas(512,128),ctx=c.getContext("2d");ctx.fillStyle=cssColor(color);ctx.fillRect(0,0,512,128);ctx.fillStyle="#ffffff";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`900 66px ${font}`;ctx.fillText(text,256,66,470);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:texture(c),side:THREE.DoubleSide}));m.position.set(x,y,z);group.add(m);
}

// 棋盤後側兩棟建築：Blender 建模匯出的 GLB（正面朝 +Z），與中央骰子左右對稱。
const BUILDINGS = [["../assets/art/airport-terminal.glb", -1.55, .88], ["../assets/art/international-venue.glb", 1.55, .78]];
function addBuildings(city) {
  const loader = new GLTFLoader();
  for (const [rel, x, s] of BUILDINGS) {
    loader.load(new URL(rel, import.meta.url).href, (gltf) => {
      const model = gltf.scene;
      model.position.set(x, 0, -1.98);
      model.scale.setScalar(s);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      city.add(model);
    }, undefined, () => {});     // 載入失敗就留空，不影響遊戲進行
  }
}

// 桌板跟著棋盤外框：凸多邊形往外（d<0 往內）偏移 d 的 miter 版，再拉成有厚度的板。
// 格子外緣離角落最遠約對角 1.0，桌板留 0.95 餘量；內圈留一條「騎樓」淺藍帶。
function offsetPoly(pts, d) {
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cz = pts.reduce((a, p) => a + p.z, 0) / pts.length;
  const n = pts.length, lines = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    let nx = -(b.z - a.z), nz = b.x - a.x;
    const len = Math.hypot(nx, nz) || 1;
    nx /= len; nz /= len;
    if (nx * ((a.x + b.x) / 2 - cx) + nz * ((a.z + b.z) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
    lines.push({ nx, nz, c: a.x * nx + a.z * nz + d });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i - 1 + n) % n], l2 = lines[i];
    const det = l1.nx * l2.nz - l2.nx * l1.nz;
    out.push({ x: (l1.c * l2.nz - l2.c * l1.nz) / det, z: (l2.c * l1.nx - l1.c * l2.nx) / det });
  }
  return out;
}
function plateMesh(pts, d, h, y, color, group) {
  const p = offsetPoly(pts, d);
  const s = new THREE.Shape();
  p.forEach((q, i) => (i ? s.lineTo(q.x, -q.z) : s.moveTo(q.x, -q.z)));
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // XY 立面轉平：(x,-z,0)→(x,0,z)，厚度朝 +Y
  const m = new THREE.Mesh(geo, mat(color));
  m.position.y = y;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
function artFloor(pts, d, topY, group) {
  const p = offsetPoly(pts, d);
  const s = new THREE.Shape();
  p.forEach((q, i) => (i ? s.lineTo(q.x, -q.z) : s.moveTo(q.x, -q.z)));
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const img = artImage("board"), t = img ? texture(img) : null;
  const pos = geo.attributes.position;
  const xs = pos.array.filter((_, i) => i % 3 === 0), ys = pos.array.filter((_, i) => i % 3 === 1);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1, h = Math.max(...ys) - minY || 1;
  const uvs = geo.attributes.uv.array;
  for (let i = 0; i < uvs.length; i++) {
    const base = ((i >> 1) * 3) + (i & 1);   // 第 v 個頂點的第 x 或 y 分量
    uvs[i] = (pos.array[base] - (i & 1 ? minY : minX)) / (i & 1 ? h : w);
  }
  geo.attributes.uv.needsUpdate = true;
  const f = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, color: t ? 0xffffff : 0xfff3d0, roughness: 1 }));
  f.rotation.x = -Math.PI / 2;
  f.position.y = topY;
  f.receiveShadow = true;
  group.add(f);
}

export function buildTravelTable(scene, outer, inner, topY, plate) {
  const group=new THREE.Group();
  if (plate) {
    plateMesh(plate, 0.95, 0.32, -0.24, 0x218cc1, group);   // 深藍桌墊（五邊形）
    plateMesh(plate, 0.38, 0.1, 0.05, 0xd1f1ff, group);      // 淺藍騎樓帶
    plateMesh(plate, -0.72, 0.12, 0.09, 0x5dc9a2, group);    // 綠地內圈
    artFloor(plate, -0.88, topY, group);                     // 廣場插圖（五邊形裁切）
  } else {
    box(group,0,-.08,0,outer*2+.35,.32,outer*2+.35,0x218cc1);
    box(group,0,.1,0,outer*2+.12,.1,outer*2+.12,0xd1f1ff);
    box(group,0,.15,0,inner*2,.12,inner*2,0x5dc9a2);
    const img=artImage("board"),t=img ? texture(img) : null;
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(inner*2-.12,inner*2-.12),new THREE.MeshStandardMaterial({map:t,color:t?0xffffff:0xfff3d0,roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=topY;floor.receiveShadow=true;group.add(floor);
  }
  // 中央骰子周圍留空；模型放在後側，不遮住落地與點擊。
  const city=new THREE.Group();city.position.y=topY;
  // 機場與會場：Blender 重畫的 GLB（assets/art/），載入完成才掛上；失敗留空不影響遊戲。
  addBuildings(city);
  // 小飛機：固定模型，不引入額外隨機或下載模型。
  const plane=new THREE.Group();plane.position.set(0,.98,-2.05);plane.rotation.y=-.3;
  const fuselage=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.7,4,12),mat(0xf6fbff));fuselage.rotation.x=Math.PI/2;plane.add(fuselage);
  box(plane,0,0,0,1.05,.055,.2,0xeaf7ff);box(plane,0,.18,-.36,.06,.32,.27,0xff804d);box(plane,0,.04,-.38,.5,.05,.12,0xffbc3e);city.add(plane);
  // 樹、路燈與海報架，少量共用幾何形狀維持輕量。
  for(const [x,z] of [[-2.35,-.6],[2.35,-.6],[-2.35,1.85],[2.35,1.85]]){
    box(city,x,.2,z,.45,.14,.45,0xf5d27b);box(city,x,.45,z,.09,.5,.09,0x947149);ball(city,x,.8,z,.3,0x45ba78);ball(city,x-.15,.68,z,.2,0x79ce53);
  }
  for(const [x,color] of [[-1.55,0x1ca9d0],[1.55,0xffa43e]]){
    box(city,x,.21,.75,.45,.07,.36,0xb4dbe8);box(city,x,.6,.75,.04,.75,.04,0xffffff);box(city,x,.9,.75,.5,.5,.06,color);
    sign(city,x<0?"研究":"交流",x,.92,.79,.43,color);
  }
  // 地面大標題位於骰子前方，將中央留給操作。
  const title=canvas(768,180),ctx=title.getContext("2d");ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#23648a";ctx.font=`900 115px ${font}`;ctx.fillText("大赴翁",384,70);ctx.font=`700 36px ${font}`;ctx.fillText("ROLL ABROAD",384,145);
  const logo=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.56),new THREE.MeshBasicMaterial({map:texture(title),transparent:true,depthWrite:false}));logo.rotation.x=-Math.PI/2;logo.position.set(0,topY+.008,1.8);group.add(logo);
  group.add(city);scene.add(group);return group;
}
