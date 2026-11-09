// 成績單：把結算資料畫在一張 1200×630 的 canvas 上，按「下載成績單」存成 PNG。
// 尺寸對齊 OG 分享圖；完全不連外部服務（黑貓圖是本站檔案，載不到就只畫文字）。
const W = 1200;
const H = 630;
const FONT = '"Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif';

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function wrap(c, text, x, y, maxW, lh) {
  let line = "";
  for (const ch of text) {
    if (c.measureText(line + ch).width > maxW) {
      c.fillText(line, x, y);
      y += lh;
      line = ch;
    } else line += ch;
  }
  if (line) c.fillText(line, x, y);
  return y + lh;
}

const STAMP = { kept: ["已兌現", "#ff7b6b"], brought: ["待追蹤", "#ffd166"], none: ["未帶回", "#9fc0d4"] };

// d = engine.settlement(state) 的回傳值＋ seed；opts.at = 日期（預設今天）
const loadImg = (src) =>
  src
    ? new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      })
    : Promise.resolve(null);

export async function drawReportCard(canvas, d, opts = {}) {
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  const deep = "#0b3457";
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, deep);
  g.addColorStop(1, "#1a7ba6");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // 背景圖與黑貓一起載；圖沒到就留上面的純漸層（成績單不能開天窗）
  const [bg, cat] = await Promise.all([loadImg(opts.bgSrc), loadImg(opts.catSrc)]);
  if (bg) {
    const s = Math.max(W / bg.width, H / bg.height); // cover：等比縮放＋置中裁切
    const dw = bg.width * s;
    const dh = bg.height * s;
    c.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    // 圖左半是低對比海面但仍偏亮（實測亮度 183），白字要壓一層深藍才站得住
    c.fillStyle = deep + "50";
    c.fillRect(0, 0, W, H);
    const sh = c.createLinearGradient(0, 0, W, 0);
    sh.addColorStop(0, deep + "a6"); // 左：稱號與評語
    sh.addColorStop(0.52, deep + "4d");
    sh.addColorStop(1, deep + "1a"); // 右：船與地標要看得見
    c.fillStyle = sh;
    c.fillRect(0, 0, W, H);
  } else {
    c.fillStyle = "#ffffff10";
    c.beginPath();
    c.arc(W - 70, H - 40, 190, 0, Math.PI * 2);
    c.fill();
  }
  if (cat) c.drawImage(cat, W - 176, 34, 132, 132);

  c.textBaseline = "top";
  c.fillStyle = "#ffe180";
  c.font = `700 20px ${FONT}`;
  c.fillText("大赴翁 Roll Abroad・旅程結算", 56, 44);

  c.fillStyle = "#ffda4b";
  c.font = `900 52px ${FONT}`;
  c.fillText(d.ending.title, 56, 88);
  c.fillStyle = "#eaf6ff";
  c.font = `400 22px ${FONT}`;
  let y = wrap(c, d.ending.text, 56, 162, 620, 32);
  const tag = [d.route, d.style && d.style.title].filter(Boolean).join("・");
  if (tag) {
    c.fillStyle = "#ffd166";
    c.font = `700 20px ${FONT}`;
    c.fillText(tag, 56, y + 4);
    y += 40;
  }

  // 左下：四項資源
  c.font = `700 18px ${FONT}`;
  c.fillStyle = "#bfe4f7";
  c.fillText("四項資源", 56, y + 10);
  d.res.forEach((r, i) => {
    const ry = y + 44 + i * 38;
    c.fillStyle = "#eaf6ff";
    c.font = `700 20px ${FONT}`;
    c.fillText(r.name, 56, ry);
    roundRect(c, 210, ry + 5, 300, 12, 6);
    c.fillStyle = "#ffffff2e";
    c.fill();
    roundRect(c, 210, ry + 5, Math.max(6, Math.min(1, r.value / 10) * 300), 12, 6);
    c.fillStyle = "#7fe0c4";
    c.fill();
    c.fillStyle = "#ffffff";
    c.font = `900 22px ${FONT}`;
    c.fillText(String(r.value), 528, ry);
    c.fillStyle = "#bfe4f7";
    c.font = `400 17px ${FONT}`;
    c.fillText(`${r.delta > 0 ? "+" : ""}${r.delta}`, 574, ry + 3);
  });

  // 右欄：承諾兌現
  const px = 660;
  c.fillStyle = "#bfe4f7";
  c.font = `700 18px ${FONT}`;
  c.fillText("回院之後的承諾", px, 44);
  d.promises.forEach((p, i) => {
    const ry = 86 + i * 74;
    const [label, color] = STAMP[p.kept ? "kept" : p.brought ? "brought" : "none"];
    c.strokeStyle = color;
    c.lineWidth = p.kept ? 4 : 2;
    c.beginPath();
    c.arc(px + 26, ry + 26, 26, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = color;
    c.font = `800 15px ${FONT}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label, px + 26, ry + 27);
    c.textBaseline = "top";
    c.textAlign = "left";
    c.fillStyle = p.brought ? "#ffffff" : "#9fc0d4";
    c.font = `700 21px ${FONT}`;
    wrap(c, p.label, px + 68, ry + 12, 420, 26);
  });

  // 右欄下：這一行程的數字（鋪圖時這區落在船與海面的亮帶上，墊一張半透明卡才看得清）
  const sy = 86 + d.promises.length * 74 + 10;
  if (bg) {
    roundRect(c, px - 18, sy - 16, W - px - 22, 132, 16);
    c.fillStyle = deep + "59";
    c.fill();
  }
  c.fillStyle = "#bfe4f7";
  c.font = `700 18px ${FONT}`;
  c.fillText("這一趟", px, sy);
  d.stats.forEach((s, i) => {
    const sx = px + i * 128;
    c.fillStyle = "#ffffff";
    c.font = `900 26px ${FONT}`;
    c.fillText(String(s.value), sx, sy + 30);
    c.fillStyle = "#bfe4f7";
    c.font = `400 15px ${FONT}`;
    c.fillText(s.label, sx, sy + 62);
  });

  // 頁脚：代碼與日期（相同代碼＝同一趟旅程，叫朋友同 seed 挑戰）
  c.fillStyle = "#0a2f4d88";
  c.fillRect(0, H - 62, W, 62);
  c.fillStyle = "#dff0fb";
  c.font = `700 19px ${FONT}`;
  c.fillText(`旅程代碼 ${d.seed}`, 56, H - 42);
  c.fillStyle = "#a9cee3";
  c.font = `400 17px ${FONT}`;
  const at = opts.at ? new Date(opts.at) : new Date();
  const date = `${at.getFullYear() - 1911}/${String(at.getMonth() + 1).padStart(2, "0")}/${String(at.getDate()).padStart(2, "0")}`;
  c.fillText(`相同代碼與選擇，可以重現同一趟旅程　｜　${date}`, 420, H - 40);
  return canvas;
}

// 畫好直接下載；檔名帶代碼，方便比對不同seed
export async function downloadReportCard(d, opts = {}) {
  const canvas = await drawReportCard(document.createElement("canvas"), d, opts);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `大赴翁-成績單-${d.seed}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}