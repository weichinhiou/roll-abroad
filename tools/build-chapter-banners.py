"""五張章節掛牌 Banner 的轉檔腳本（GLB/WebP 素材的原始碼之一）。

輸入：Jean 提供的五張去背 PNG（放在製作機 Downloads 解出來的資料夾，不進 repo）。
輸出：assets/art/chapter-banner-N.webp（含繩子，桌機用）
      assets/art/chapter-banner-N-norope.webp（只留牌面，手機用）
做法：依 alpha 找出實際範圍；再用「每列不透明度覆蓋率」區分繩子（~6%）與牌面（>60%），
      從牌面向上連續掃描得到牌面頂邊，裁出無繩版。改圖重跑這支即可。
"""
import os
import sys

from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\office\AppData\Local\Temp\opencode\banners"
OUT = sys.argv[2] if len(sys.argv) > 2 else r"D:\Git\roll-abroad\assets\art"
ALPHA_MIN = 8
COVER = 0.25  # 覆蓋率門檻：繩子約 6%，牌面 >60%

report = []


def coverage(px, y, x0, x1):
    return sum(1 for x in range(x0, x1) if px[x, y] > ALPHA_MIN)


for n in range(1, 6):
    srcs = [f for f in os.listdir(SRC) if f.startswith(f"{n:02d}_") and f.endswith(".png")]
    if not srcs:
        raise SystemExit(f"找不到第 {n} 章原圖 on {SRC}")
    im = Image.open(os.path.join(SRC, srcs[0])).convert("RGBA")
    px = im.getchannel("A").load()
    x0, y0, x1, y1 = im.getchannel("A").point(lambda v: 255 if v > ALPHA_MIN else 0).getbbox()
    w = x1 - x0

    # 由上往下找第一列「往後連續 5 列都高覆蓋」的列＝牌面頂邊（繩子只有約 6% 覆蓋）
    run = 0
    sign_top = y1 - 1
    for y in range(y0, y1):
        if coverage(px, y, x0, x1) > COVER * w:
            run += 1
            if run == 6:
                sign_top = y - 5
                break
        else:
            run = 0
    sign_top = max(y0, sign_top - 2)
    if y1 - sign_top < (y1 - y0) * 0.4:
        raise SystemExit(f"第 {n} 章牌面頂邊抓錯（y={sign_top}）")
    # 無繩版多留 12 px：掛環高出牌面上緣，留一截繩頭才不會把銅環切一半
    rope_cut = max(y0, sign_top - 12)

    full = im.crop((x0, y0, x1, y1))
    sign = im.crop((x0, rope_cut, x1, y1))
    for img, name in ((full, f"chapter-banner-{n}.webp"), (sign, f"chapter-banner-{n}-norope.webp")):
        img.save(os.path.join(OUT, name), "WEBP", quality=92, method=6)
        report.append(
            f"{name}: {img.width}x{img.height} "
            f"{os.path.getsize(os.path.join(OUT, name)) // 1024}KB "
            f"(src {im.width}x{im.height}, 繩底 y={sign_top})"
        )

with open(os.path.join(SRC, "build-report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report))
print("ok", len(report))
