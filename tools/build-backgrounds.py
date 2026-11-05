"""電腦版／手機版底板換圖用（assets/art/world-*.webp 的原始碼）。

輸入：Jean 給的原圖（放製作機 Downloads，不進 repo）。
輸出：assets/art/world-desktop.webp（橫式桌機底板）
      assets/art/world-mobile.webp（直式手機底板，縮到寬 900）
用法：python tools/build-backgrounds.py [桌機原圖] [手機原圖]
"""
import os
import sys

from PIL import Image

DESK_SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\office\Downloads\ChatGPT 圖像 2026年11月5日 下午12_36_20.png"
MOB_SRC = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\office\Downloads\大學旅港水彩全景.png"
OUT = r"D:\Git\roll-abroad\assets\art"
QUALITY = {"world-desktop.webp": 78, "world-mobile.webp": 74}  # 大面積背景：視覺無損下壓到 120–180KB 級
MOB_W = 900   # 手機底板上限寬（手機視窗 360–430，2 倍 dpr 夠用）
DESK_W = 1680  # 桌機底板上限寬（1366–1920 覆蓋，更大的螢幕由 cover 裁切）

report = []


def to_webp(src, name, max_w):
    im = Image.open(src).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    dst = os.path.join(OUT, name)
    im.save(dst, "WEBP", quality=QUALITY[name], method=6)
    report.append("%s: %dx%d  %dKB  （原圖 %dx%d %dKB）" % (
        name, im.width, im.height, os.path.getsize(dst) // 1024,
        Image.open(src).width, Image.open(src).height, os.path.getsize(src) // 1024))


to_webp(DESK_SRC, "world-desktop.webp", DESK_W)
to_webp(MOB_SRC, "world-mobile.webp", MOB_W)
print(" | ".join(r.split(":")[0] for r in report))
with open(os.path.join(os.environ.get("TEMP", "."), "bg-report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report))
for r in report:  # 視窗編碼可能不是中文，再補一份 ASCII 的
    print(len(r), "bytes")
print("total KB:", sum(os.path.getsize(os.path.join(OUT, n)) for n in ("world-desktop.webp", "world-mobile.webp")) // 1024)
