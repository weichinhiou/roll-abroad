import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { ART, CHAPTER_BANNERS } from "../src/art.js";

test("共用美術全部隨網站保存為可部署的 WebP，總量不超過 2.5 MiB", async () => {
  let bytes = 0;
  for (const [name, path] of Object.entries(ART)) {
    const url = new URL(path);
    assert.equal(url.protocol, "file:");
    const file = await readFile(url);
    assert.equal(file.subarray(0,4).toString(), "RIFF", `${name} 格式有誤`);
    assert.equal(file.subarray(8,12).toString(), "WEBP", `${name} 不是 WebP`);
    bytes += (await stat(url)).size;
  }
  assert.ok(bytes < 2.5 * 1024 * 1024, `共用美術總量 ${bytes} bytes 太大`);
});

// ── 品牌檔（OG 分享圖與 Favicon）──────────────────────────────
const brand = (f) => new URL(`../assets/brand/${f}`, import.meta.url);

// JPEG 的寬高在 SOF 標記後；PNG 在 IHDR；ICO 看目錄條目
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error("JPEG 標記錯誤");
    const mark = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (mark >= 0xc0 && mark <= 0xcf && mark !== 0xc4 && mark !== 0xc8 && mark !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error("找不到 JPEG SOF");
}
function pngSize(buf) {
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "不是 PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function icoSizes(buf) {
  assert.equal(buf.readUInt16LE(0), 0);
  assert.equal(buf.readUInt16LE(2), 1, "不是 ICO");
  const n = buf.readUInt16LE(4), out = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16;
    out.push({ w: buf[o] || 256, h: buf[o + 1] || 256, bpp: buf.readUInt16LE(o + 6), size: buf.readUInt32LE(o + 8), off: buf.readUInt32LE(o + 12) });
  }
  return out;
}

test("OG 分享圖 1200×630、JPEG、維持在社群預覽的體積預算內", async () => {
  const buf = await readFile(brand("og-cover.jpg"));
  assert.equal(buf.subarray(0, 3).toString("hex"), "ffd8ff", "og-cover.jpg 不是 JPEG");
  assert.deepEqual(jpegSize(buf), { w: 1200, h: 630 });
  assert.ok(buf.length < 300 * 1024, `OG 圖 ${buf.length} bytes 太大，社群預覽會拖慢`);
});

test("Favicon 全家桶：ico 六級尺寸、512 與 apple-touch 180", async () => {
  const ico = icoSizes(await readFile(brand("favicon.ico")));
  assert.deepEqual(ico.map((e) => e.w), [16, 20, 24, 32, 48, 64]);
  assert.deepEqual(ico.map((e) => e.h), [16, 20, 24, 32, 48, 64]);
  for (const e of ico) {
    assert.equal(e.bpp, 32, `${e.w}px 條目不是 32bit`);
    assert.ok(e.size > 0 && e.off + e.size <= (await stat(brand("favicon.ico"))).size, `${e.w}px 條目範圍不對`);
  }
  assert.deepEqual(pngSize(await readFile(brand("icon-512.png"))), { w: 512, h: 512 });
  assert.deepEqual(pngSize(await readFile(brand("apple-touch-icon.png"))), { w: 180, h: 180 });
});

// ── 章節掛牌橫幅（畫面上方那面木牌）───────────────────────────
// WebP 寬高：有透明的是 VP8X（畫布尺寸在第 24 起，3 位元組小端序、要 +1）；無透明走 VP8 影格標頭。
function webpSize(buf) {
  assert.equal(buf.subarray(0, 4).toString(), "RIFF", "不是 WebP");
  assert.equal(buf.subarray(8, 12).toString(), "WEBP", "不是 WebP");
  const tag = buf.subarray(12, 16).toString();
  if (tag === "VP8X") {
    const le3 = (o) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
    return { w: le3(24) + 1, h: le3(27) + 1 };
  }
  assert.equal(tag, "VP8 ", `未支援的 WebP 封裝：${tag}`);
  return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
}

test("五張章節掛牌齊備：含繩版給桌機、無繩版給手機，尺寸對得上 art.js，總量在預算內", async () => {
  assert.equal(CHAPTER_BANNERS.length, 5);
  let bytes = 0;
  for (const b of CHAPTER_BANNERS) {
    const sizes = {};
    for (const [key, w, h] of [["full", b.w, b.h], ["compact", b.sw, b.sh]]) {
      const buf = await readFile(new URL(b[key]));
      sizes[key] = webpSize(buf);
      assert.deepEqual(sizes[key], { w, h }, `第 ${b.n} 章 ${key} 的實際尺寸與 art.js 宣告不符`);
      bytes += buf.length;
    }
    // 無繩版必須真的裁掉繩子、又留整块牌面（繩區佔整體 30–45% 高）
    const cut = 1 - sizes.compact.h / sizes.full.h;
    assert.ok(cut > 0.2 && cut < 0.5, `第 ${b.n} 章無繩版裁切比例 ${cut} 不對`);
    assert.equal(sizes.compact.w, sizes.full.w, "無繩版不該動到寬度");
  }
  assert.ok(bytes < 700 * 1024, `掛牌共 ${bytes} bytes，太重`);
});

test("掛牌接得上：初始 HTML、兩個版型的尺寸、render.js 的換圖", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../game-art.css", import.meta.url), "utf8");
  const js = await readFile(new URL("../src/render.js", import.meta.url), "utf8");
  assert.match(
    html,
    /<picture class="chapter-ribbon"[^>]*>[\s\S]*?<source media="\(max-width:759px\)" srcset="assets\/art\/chapter-banner-1-norope\.webp"[\s\S]*?<img src="assets\/art\/chapter-banner-1\.webp"[^>]*alt="第一章・投稿"/,
    "index.html 的掛牌初始圖沒接好（手機 source 或桌機 img 缺）"
  );
  assert.match(js, /renderChapterBanner\(chapter\)/, "render.js 換章時沒換掛牌");
  assert.match(js, /source\.srcset = b\.compact/, "render.js 沒換手機版掛牌圖");
  assert.match(css, /\.chapter-ribbon\{[^}]*height:clamp/, "桌機掛牌沒用 clamp 定高");
  assert.match(css, /\.chapter-ribbon img\{[^}]*object-fit:contain/, "掛牌沒設 object-fit，寬度會被拉变形");
  const mobile = css.slice(css.indexOf("@media(max-width:759px)"));
  assert.match(mobile, /\.chapter-ribbon\{[^}]*height:clamp/, "手機掛牌沒另外定高");
  const yml = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(yml, /assets\/art\/\*\.webp/, "部署流程沒抓 art 資料夾的 WebP");
});

// ── 左上標題（品牌 Logo）─────────────────────────────────────
test("標題 logo：WebP 有透明、尺寸對得上 HTML、體積在預算內", async () => {
  const buf = await readFile(new URL("../assets/art/brand-logo.webp", import.meta.url));
  const size = webpSize(buf);
  assert.deepEqual(size, { w: 900, h: 403 }, "brand-logo.webp 實際尺寸與 HTML 宣告不符（改圖要同步 width/height）");
  assert.ok(buf.length < 150 * 1024, `brand-logo.webp ${buf.length} bytes，太重`);
});

test("標題 logo 接得上：h1 內的圖與 alt、兩個版型都用 clamp 定高", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../game-art.css", import.meta.url), "utf8");
  assert.match(
    html,
    /<h1><img class="brand-logo" src="assets\/art\/brand-logo\.webp" alt="大赴翁 Roll Abroad" width="900" height="403" \/><\/h1>/,
    "index.html 的標題沒換成品牌 logo（h1 裡的 img／alt／尺寸缺）"
  );
  assert.match(css, /\.brand-logo\{[^}]*height:clamp/, "桌機標題 logo 沒用 clamp 定高");
  assert.match(css, /h1\{margin:0;line-height:0\}/, "h1 還留著舊文字標題樣式，會把圖撐出空隙");
  const mobile = css.slice(css.indexOf("@media(max-width:759px)"));
  assert.match(mobile, /\.brand-logo\{[^}]*height:clamp/, "手機標題 logo 沒另外定高");
});

// ── 旅程結算畫面底版圖 ────────────────────────────────────
test("結算底版：桌機 1600×900、手機 900×1600，都是 WebP 且在體積預算內", async () => {
  let bytes = 0;
  for (const [name, w, h] of [["ending-backdrop.webp", 1600, 900], ["ending-backdrop-mobile.webp", 900, 1600]]) {
    const buf = await readFile(new URL(`../assets/art/${name}`, import.meta.url));
    assert.deepEqual(webpSize(buf), { w, h }, `${name} 實際尺寸不符（改圖重跑 tools/build-ending-bg.py）`);
    bytes += buf.length;
  }
  assert.ok(bytes < 500 * 1024, `結算底版共 ${bytes} bytes，太重`);
});

test("開場介紹面板：與結算共用殼、四項資源與結局都在、開場與設定都有出口", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../game-art.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const intro = html.slice(html.indexOf('<dialog id="intro"'), html.indexOf("</dialog>", html.indexOf('<dialog id="intro"')));
  assert.ok(intro.length > 200, "index.html 缺開場介紹 dialog");
  assert.match(css, /\.settlement,\.intro\{/, "開場面板沒共用結算那套殼");
  // 四項資源（icon 序號跟 HUD 一致）、結局與風格稱號、學習目標都要在
  for (const k of ["hud-0", "hud-1", "hud-2", "hud-3", "endings", "takeaway", "intro-steps", "intro-rule"]) {
    assert.ok(intro.includes(k), `開場介紹缺 ${k}`);
  }
  assert.match(css, /\.intro-steps\{/, "開場介紹的步驟樣式缺失");
  assert.match(html, /data-action="close-intro"/, "開場介紹缺「開始旅程」出口");
  assert.match(html, /data-action="rules"/, "設定裡缺「玩法說明」");
  assert.match(app, /dataset\.action === "rules"/, "app.js 沒接「玩法說明」");
  assert.match(app, /firstRun \|\| .*get\("intro"\) === "1"\) openIntro\(\)/, "沒有存檔時不會自動開、或 ?intro=1 沒接");
});

test("成績單背景：1200×630（與成績單畫布同規格）、WebP、-share-card 有接 bgSrc", async () => {
  const buf = await readFile(new URL("../assets/art/report-card-bg.webp", import.meta.url));
  assert.deepEqual(webpSize(buf), { w: 1200, h: 630 }, "report-card-bg.webp 尺寸要跟成績單畫布一致");
  assert.ok(buf.length < 200 * 1024, `成績單背景 ${buf.length} bytes，下載時會等太久`);
  const card = await readFile(new URL("../src/share-card.js", import.meta.url), "utf8");
  assert.match(card, /opts\.bgSrc/, "share-card.js 沒接背景圖參數");
  assert.match(card, /drawImage\(bg,/, "share-card.js 沒把背景圖蓋到畫布上");
});

test("結算畫面接得上：dialog、兩個版型的底版圖、engine.settlement 與按鈕", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../game-art.css", import.meta.url), "utf8");
  const js = await readFile(new URL("../src/render.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(html, /<dialog id="settlement" class="settlement"/, "index.html 缺結算 dialog");
  assert.match(css, /\.settlement,\.intro\{[^}]*ending-backdrop\.webp/, "桌機底版圖沒接上結算／開場殼");
  const mobile = css.slice(css.indexOf("@media(max-width:759px)"));
  assert.match(mobile, /ending-backdrop-mobile\.webp/, "手機底版圖沒接上");
  assert.match(js, /import \{[^}]*settlement[^}]*\} from "\.\/engine\.js"/, "render.js 沒引 engine.settlement");
  assert.match(js, /data-action="restart"/, "結算畫面缺「再玩一次」");
  assert.match(js, /data-action="report-card"/, "結算畫面缺「下載成績單」");
  assert.match(html, /data-action="demo-settlement"/, "設定裡缺「預覽旅程結算」");
  assert.match(app, /dataset\.action === "settlement"/, "app.js 沒接結算開關");
  const card = await readFile(new URL("../src/share-card.js", import.meta.url), "utf8");
  assert.match(card, /const W = 1200;/, "成績單寬不是 1200（要跟 OG 圖同規格）");
  assert.match(card, /const H = 630;/, "成績單高不是 630");
  assert.match(card, /toBlob/, "成績單沒走 toBlob 下載");
  // 資源條刻意不叫 .bar：全域 .bar 是絕對定位的 HUD 條，會蓋掉右邊數字
  assert.match(css, /\.setres \.sbar\{[^}]*position:relative/, "結算資源條不该沿用 .bar 類別");
});

test("index.html 的 icon 與 OG 指向的品牌檔都存在，部署檔清單有涵蓋", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const paths = [...html.matchAll(/(?:href|content)="((?:assets\/brand\/[^"]+|https:[^"]*assets\/brand\/[^"]+))"/g)]
    .map((m) => m[1].replace(/^https:\/\/weichinhiou\.github\.io\/roll-abroad\//, ""));
  assert.ok(paths.length >= 4, `head 裡只找到 ${paths.length} 個品牌檔引用`);
  for (const p of new Set(paths)) {
    assert.ok(p.startsWith("assets/brand/"), `引用路徑不在品牌資料夾：${p}`);
    await stat(new URL(`../${p}`, import.meta.url));
  }
  assert.ok(/property="og:image"/.test(html), "缺 og:image");
  assert.ok(/name="twitter:card"/.test(html), "缺 twitter:card");
  const yml = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(yml, /assets\/brand/, "部署流程沒把品牌檔放進網站");
});
