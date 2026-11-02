// 棋盤共用美術：圖片貼圖與簡單 3D 旅行場景。規則留在 engine。
import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { artImage } from "./art.js";
export const CHAPTER_COLORS = {1:0x35c58c,2:0x38aff0,3:0xffc536,4:0xa775e1};
const font = '"Microsoft JhengHei",system-ui,sans-serif';
const emoji = '"Segoe UI Emoji","Apple Color Emoji",sans-serif';
const icons = ["🌐","📝","🤝","📑","📨","🧭","💡","📋","🎟️","🛂","🗓️","✈️","🏷️","🎤","☕","💬","📊","🏆","🧳","📧","✍️","📂","💡","🏠"];
const cssColor = (n) => `#${n.toString(16).padStart(6,"0")}`;
function canvas(w,h) { const c=document.createElement("canvas");c.width=w;c.height=h;return c; }
function texture(c) { const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t; }
function round(ctx,x,y,w,h,r) {ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

export function tileArt(sq, milestone, shape) {
  const w=Math.round((shape==="h"?1.2:1.8)*240),h=Math.round((shape==="v"?1.2:1.8)*240);
  const c=canvas(w,h),ctx=c.getContext("2d"),color=cssColor(CHAPTER_COLORS[sq.chapter]);
  ctx.fillStyle=color;ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#ffffff";round(ctx,10,10,w-20,h-20,22);ctx.fill();
  ctx.fillStyle=color;ctx.globalAlpha=.18;round(ctx,18,18,w-36,h*.65,17);ctx.fill();ctx.globalAlpha=1;
  const atlas=artImage("chapters");
  if(milestone && atlas){
    const i=sq.chapter-1,sw=atlas.naturalWidth/2,sh=atlas.naturalHeight/2,size=Math.min(w,h)*.48;
    ctx.drawImage(atlas,(i%2)*sw,Math.floor(i/2)*sh,sw,sh,(w-size)/2,h*.17,size,size);
  } else {
    ctx.font=`${Math.round(Math.min(w,h)*.33)}px ${emoji}`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(icons[sq.n-1],w/2,h*.34);
  }
  // 圖文分區，主標放大約五成，維持純白底與深藍字。
  ctx.fillStyle="#ffffff";ctx.fillRect(14,h*.60,w-28,h*.35);
  ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#102543";
  const label=String(sq.label),fs=Math.floor(Math.min(w*.23,h*.25));ctx.font=`900 ${fs}px ${font}`;
  if(shape==="h") { const cut=Math.ceil(label.length/2);ctx.fillText(label.slice(0,cut),w/2,h*.67,w*.9);ctx.fillText(label.slice(cut),w/2,h*.84,w*.9); }
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

export function buildTravelTable(scene, outer, inner, topY) {
  const group=new THREE.Group();
  box(group,0,-.08,0,outer*2+.35,.32,outer*2+.35,0x218cc1);
  box(group,0,.1,0,outer*2+.12,.1,outer*2+.12,0xd1f1ff);
  box(group,0,.15,0,inner*2,.12,inner*2,0x5dc9a2);
  const img=artImage("board"),t=img ? texture(img) : null;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(inner*2-.12,inner*2-.12),new THREE.MeshStandardMaterial({map:t,color:t?0xffffff:0xfff3d0,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=topY;floor.receiveShadow=true;group.add(floor);
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
