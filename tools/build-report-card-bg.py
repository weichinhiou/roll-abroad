# -*- coding: utf-8 -*-
"""成績單背景圖（assets/art/report-card-bg.webp 的原始碼）。

用法：
  python tools/build-report-card-bg.py [原圖]
      原圖省略時自動抓製作機 Downloads 最新的「夕陽港灣旅行水彩畫.png」。

輸出固定規格 1200×630（跟成績單畫布、OG 分享圖同尺寸），等比縮放＋置中裁切不變形。
CSS／JS 引用：src/share-card.js 以 drawImage 蓋在畫布最底層，載入失敗退回純漸層。
"""
import glob
import os
import sys

from PIL import Image

OUT = r"D:\Git\roll-abroad\assets\art\report-card-bg.webp"
SIZE = (1200, 630)
QUALITY = 82
GUESS = "夕陽港灣旅行水彩畫*.png"


def pick_source():
    if len(sys.argv) > 1:
        return sys.argv[1]
    home = os.path.expandvars(r"%USERPROFILE%\Downloads")
    hits = sorted(glob.glob(os.path.join(home, GUESS)), key=os.path.getmtime, reverse=True)
    if not hits:
        raise SystemExit(f"找不到原圖，給路徑或放進 {home}\\{GUESS}")
    return hits[0]


def cover(im, size):
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def luminance(im):
    """印左半（要疊白字的地方）的亮度與對比，換圖時判斷襯底夠不夠。"""
    box = im.crop((0, 0, int(im.width * 0.55), im.height)).resize((55, 30))
    px = box.tobytes()  # RGB 序列，避開 getdata() 的 deprecation
    lum = [0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] for i in range(0, len(px), 3)]
    return round(sum(lum) / len(lum)), round(max(lum) - min(lum))


def main():
    src = pick_source()
    im = cover(Image.open(src).convert("RGB"), SIZE)
    im.save(OUT, "WEBP", quality=QUALITY, method=6)
    print(os.path.basename(src), "->", os.path.basename(OUT), im.size, os.path.getsize(OUT) // 1024, "KB")
    print("   左半文字區 亮度/對比:", luminance(im))


if __name__ == "__main__":
    main()
