# -*- coding: utf-8 -*-
"""結算底版圖的「留白參考圖」生成器：給生成模型（GPT）當參考圖上傳用。

  python tools/build-bg-guide.py

輸出到製作機 Downloads（不進 repo）：
  結算底版-留白參考-桌機1600x900.png
  結算底版-留白參考-手機900x1600.png

遮擋比例來自實測（無頭 Chrome 量 #settlement 的 .set-hero/.set-body/.set-actions）：
  桌機 dialog 980×686：hero 22%、body(白卡) 62%、actions 14%
  手機 dialog 352×776 內容高 1164（要捲動）：hero 31%、其餘被白卡蓋
危險帶（cover 置中裁切看不見的範圍）：桌機左右各約 11%、手機左右各約 10%
"""
import os

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.expandvars(r"%USERPROFILE%\Downloads")
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msjhbd.ttc",
    r"C:\Windows\Fonts\msjh.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
]

BLANK = {
    # (寬, 高, hero 百分比, body 百分比, 左右裁切百分比, 檔名)
    "desk": (1600, 900, 0.22, 0.62, 0.11, "結算底版-留白參考-桌機1600x900.png"),
    "mob": (900, 1600, 0.31, 0.56, 0.10, "結算底版-留白參考-手機900x1600.png"),
}


def font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise SystemExit("no CJK font found")


def zone(draw, box, fill, title, subtitle, f_title, f_sub):
    draw.rectangle(box, fill=fill, outline=(255, 255, 255, 120), width=2)
    x0, y0, x1, y1 = box
    if y1 - y0 < 60:  # 窄條只行標題
        draw.text(((x0 + x1) / 2, (y0 + y1) / 2), title, font=f_title, fill=(255, 255, 255, 230), anchor="mm")
        return
    draw.text(((x0 + x1) / 2, y0 + 26), title, font=f_title, fill=(255, 255, 255, 235), anchor="mm")
    if subtitle:
        draw.multiline_text(((x0 + x1) / 2, y0 + 62), subtitle, font=f_sub, fill=(255, 255, 255, 210), anchor="ma", align="center", spacing=8)


def build(kind):
    w, h, hero_p, body_p, crop_p, name = BLANK[kind]
    im = Image.new("RGBA", (w, h), (24, 70, 112, 255))
    d = ImageDraw.Draw(im, "RGBA")
    f_t = font(30)
    f_s = font(21)
    # 藍天→海面漸層，純粹讓標註看得清楚，不是成品底圖
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=(int(60 + 40 * t), int(120 + 30 * t), int(170 - 20 * t), 255))

    hero_h = int(h * hero_p)
    body_h = int(h * body_p)
    # 主視覺舞台：hero（疊標題級、要低對比）
    zone(d, (0, 0, w, hero_h), (255, 210, 80, 90),
         f"[可見] 上方 {int(hero_p*100)}%（標題會疊這兒）",
         "金色標題＋一段說明＋黑貓（手機黑貓在這兒正中）\n放主視覺/遠景，圖這一段要低對比\n不要做暗角，程式自己疊漸層", f_t, f_s)
    # 完全被白卡蓋住
    zone(d, (0, hero_h, w, hero_h + body_h), (220, 60, 60, 120),
         f"[遮住] 中央 {int(body_p*100)}%：白卡會蓋死",
         "承諾清單／資源條／統計都在白卡裡，這裡放什麼都看不到\n只剩卡片間 12px 細縫與四周約 18px 邊縫透出底圖", f_t, f_s)
    # 按鈕帶
    rest_h = h - hero_h - body_h
    zone(d, (0, hero_h + body_h, w, h), (60, 120, 220, 120),
         f"[遮住] 下方 {round(rest_p := rest_h / h * 100)}%：按鈕＋註記",
         "綠色/金色的「下載成績單」「關閉」按鈕疊這兒，端留簡單", f_t, f_s)
    # cover 裁切危險帶
    cut = int(w * crop_p)
    for x0, x1 in ((0, cut), (w - cut, w)):
        d.rectangle((x0, 0, x1, h), outline=(255, 255, 255, 255), width=6)
        d.line((x0 if x0 else x1, 0, x1 if x0 else x1, h), fill=(255, 255, 255, 90), width=3)
    d.text((cut / 2, h / 2), "實際\n看不到\n(置中裁切)", font=f_s, fill=(255, 255, 255, 235), anchor="mm", align="center", spacing=6)
    d.text((w - cut / 2, h / 2), "實際\n看不到\n(置中裁切)", font=f_s, fill=(255, 255, 255, 235), anchor="mm", align="center", spacing=6)

    # 對話框圓角＋木框示意
    d.rounded_rectangle((8, 8, w - 8, h - 8), radius=int(23 / 980 * w), outline=(255, 200, 120, 255), width=8)
    d.text((w / 2, h - 26), f"{w}×{h}　主體請離任何邊 ≥15%", font=f_s, fill=(255, 255, 255, 220), anchor="ms")

    dst = os.path.join(OUT, name)
    im.convert("RGB").save(dst, "PNG")
    print(name, im.size, os.path.getsize(dst) // 1024, "KB")


if __name__ == "__main__":
    build("desk")
    build("mob")