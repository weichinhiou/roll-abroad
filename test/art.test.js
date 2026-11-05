import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { ART } from "../src/art.js";

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
