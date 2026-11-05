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

// 上方章節掛牌（tools/build-chapter-banners.py 轉製）。full 含繩子給桌機；
// compact 只留牌面給手機（上方沒空間吊繩）。w/h 是實際像素，供介面預留位置不跳版。
export const CHAPTER_BANNERS = Object.freeze([
  { n: 1, w: 669, h: 311, sw: 669, sh: 222 },
  { n: 2, w: 696, h: 311, sw: 696, sh: 222 },
  { n: 3, w: 684, h: 311, sw: 684, sh: 222 },
  { n: 4, w: 719, h: 308, sw: 719, sh: 225 },
  { n: 5, w: 766, h: 308, sw: 766, sh: 224 },
].map((b) => ({ ...b, full: asset(`chapter-banner-${b.n}`), compact: asset(`chapter-banner-${b.n}-norope`) })));

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

// 掛牌是 HTML 圖、不進 WebGL；先丟給瀏覽器快取，換章那刻才不會閃白。
export function preloadChapterBanners() {
  for (const b of CHAPTER_BANNERS) for (const src of [b.full, b.compact]) new Image().src = src;
}
