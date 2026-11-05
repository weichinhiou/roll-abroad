# 大赴翁品牌檔（OG 分享圖與 Favicon）

2026-11-05 加入。原圖由 Jean 提供（AI 生成，原檔留在製作機的 `Downloads`，不進 repo），本資料夾的檔案是正式可部署成品。

| 檔案 | 用途 | 成品規格 | 原圖 |
| :--- | :--- | :--- | :--- |
| `og-cover.jpg` | 社群分享預覽圖（`og:image`／`twitter:image`） | 1200×630 JPEG，183 KB | `大赴翁：環球旅途啟程.png`（1672×941）。16:9→1.91:1 只切掉上方 18px 天空與下方 45px 石台邊緣，標題、飛機、黑貓全部留著 |
| `favicon.ico` | 分頁圖示 | 16／20／24／32／48／64 六級，32bit PNG 條目，22 KB | `復古旅行骰子郵戳徽章.png`（1254×1254，四角透明） |
| `icon-512.png` | 高分屏 PNG 圖示 | 512×512，256 色調色板，59 KB | 同上 |
| `apple-touch-icon.png` | iOS 主畫面圖示 | 180×180，無透明（四角補徽章米色底 #F6EBD6），11 KB | 同上 |

## 重製方式

腳本 `build_brand.py`（在製作機的暫存目錄，必要時搬進 `tools/`）：Pillow 產出。三個要點——

1. **ICO 用手寫容器**（目錄＋PNG 條目）：Pillow 的 ICO 存檔寫出 BMP 條目且工具讀不到各級尺寸；PNG 條目對 Chrome／Edge／Safari／Firefox 與手機都支援，檔案也比較小。目錄從第 6 個 byte 開始。
2. **小尺寸要先銳化**：徽章有紙紋質感，直接 LANCZOS 降到 16–24px 會糊成一團；每級降完做 `Contrast 1.14`＋`Color 1.10`＋`UnsharpMask`。
3. **PNG 走 256 色調色板**：同因為紙紋，無損全色版會肥到 480 KB，量化後 59 KB。

## 驗證

`npm test` 的三支品牌檔測試負責守：OG 圖 dims 與體積、ICO 六級條目範圍、PNG 尺寸、`index.html` 引用的路徑都存在、`deploy.yml` 有涵蓋 `assets/brand`。
