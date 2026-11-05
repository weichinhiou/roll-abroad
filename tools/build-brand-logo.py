"""左上標題（品牌橫幅）轉檔：assets/art/brand-logo.webp。

輸入：Jean 給的去背 PNG（放製作機 Downloads，不進 repo）。
輸出：assets/art/brand-logo.webp（依 alpha 裁掉透明邊、上限寬 900）
用法：python tools/build-brand-logo.py [原圖]
標題在遊戲介面同時是 <h1>，alt 提供文字，圖裡也有字（大赴翁／Roll Abroad）。
"""
import os
import sys

from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\office\Downloads\大赴翁：Roll Abroad.png"
OUT = r"D:\Git\roll-abroad\assets\art\brand-logo.webp"
MAX_W = 900   # 桌機最大顯示約 200px、dpr 2 也才 400，留足餘裕
QUALITY = 90  # 標題字要銳利，比底板抓高一點

im = Image.open(SRC).convert("RGBA")
box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
if not box:
    raise SystemExit("整張全透明，找不到標題輪廓")
im = im.crop(box)
if im.width > MAX_W:
    im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
im.save(OUT, "WEBP", quality=QUALITY, method=6)

with open(os.path.join(os.environ.get("TEMP", "."), "logo-report.txt"), "w", encoding="utf-8") as f:
    f.write("brand-logo.webp: %dx%d  %dKB（原圖 %dx%d %dKB，alpha bbox %s）\n" % (
        im.width, im.height, os.path.getsize(OUT) // 1024,
        Image.open(SRC).width, Image.open(SRC).height, os.path.getsize(SRC) // 1024, box))
print("brand-logo.webp", im.width, "x", im.height, os.path.getsize(OUT) // 1024, "KB")
