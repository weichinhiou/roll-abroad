// 共用美術清單。素材隨網站保存，執行時不連圖床或生圖服務。
const asset = (name) => new URL(`../assets/art/${name}.webp`, import.meta.url).href;
export const ART = Object.freeze({
  world: asset("travel-world"),
  board: asset("travel-plaza"),
  traveler: asset("traveler"),
  cat: asset("black-cat"),
  chapters: asset("chapter-emblems"),
  hud: asset("hud-icons"),
});
const images = new Map();
export function artImage(key) { return images.get(key) || null; }
export async function loadBoardArt() {
  // 只等待需要畫進 WebGL 的兩張；缺圖仍可使用程式繪製的備援。
  await Promise.all(["board", "chapters"].map((key) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(key, img); resolve(); };
    img.onerror = () => resolve();
    img.src = ART[key];
  })));
}
