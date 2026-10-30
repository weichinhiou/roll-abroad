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
