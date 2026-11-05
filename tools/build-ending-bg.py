# -*- coding: utf-8 -*-
"""旅程結算畫面底版圖（assets/art/ending-backdrop{,-mobile}.webp 的原始碼）。

用法：
  python tools/build-ending-bg.py [桌機原圖] [手機原圖]
      換上 Jean 給的新圖（GPT 生成或任何來源，放製作機，原檔不進 repo）。
      手機原圖可省略：省略時從桌機原圖裁中央直式使用。
  python tools/build-ending-bg.py --placeholder
      還沒拿到圖時的占位底版（暖色漸層），網站不開天窗。

輸出固定規格：桌機 1600×900（WebP q80）、手機 900×1600（WebP q78）。
CSS 引用：game-art.css 的 .settlement（桌機）與 @media(max-width:759px)（手機）。
"""
import os
import sys

from PIL import Image

OUT = r"D:\Git\roll-abroad\assets\art"
SIZE = {"ending-backdrop.webp": (1600, 900), "ending-backdrop-mobile.webp": (900, 1600)}
QUALITY = {"ending-backdrop.webp": 80, "ending-backdrop-mobile.webp": 78}


def cover(im, size):
    """等比縮放後置中裁切到目標尺寸，不變形。"""
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def placeholder(size):
    """占位底版：天空暖黃→港灣藍的直向漸層＋柔和四角暗角。"""
    from PIL import ImageDraw

    w, h = size
    im = Image.new("RGB", (w, h))
    top = (255, 214, 155)
    bottom = (64, 150, 190)
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        row = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = row
    # 暗角：四角疊半透明深藍椭圆，讓結算面板浮得出來
    fade = Image.new("L", (w, h), 0)
    ImageDraw.Draw(fade).ellipse((-w * 0.25, -h * 0.35, w * 1.25, h * 1.35), fill=90)
    im = Image.composite(im, Image.new("RGB", (w, h), (23, 63, 104)), fade)
    return im


def main():
    args = sys.argv[1:]
    placeholder_mode = "--placeholder" in args
    args = [a for a in args if not a.startswith("--")]
    desk_src = args[0] if args else None
    mob_src = args[1] if len(args) > 1 else None

    for name, size in SIZE.items():
        if placeholder_mode:
            im = placeholder(size)
        else:
            src = mob_src if (name.endswith("mobile.webp") and mob_src) else desk_src
            if not src:
                raise SystemExit("give a source image, or use --placeholder")
            if name.endswith("mobile.webp") and not mob_src:
                # 沒手機原圖：從桌機原圖裁中央直式（比例差時 GPT 另生直式圖效果較好）
                im = cover(Image.open(src).convert("RGB"), (900, 1600))
            else:
                im = cover(Image.open(src).convert("RGB"), size)
        dst = os.path.join(OUT, name)
        im.save(dst, "WEBP", quality=QUALITY[name], method=6)
        print(name, im.size, os.path.getsize(dst) // 1024, "KB")


if __name__ == "__main__":
    main()