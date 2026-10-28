# 大赴翁 Roll Abroad 開發規範

開始工作前讀取 `D:\Git\AI-Agent\CORE_RULES.md`（若存在），遵守其中的身份、SSOT 與跨專案協作規則。本檔補充這個專案的技術規則。

## 文件入口

- 開工先讀 [README](README.md) 與 [docs/plan.md](docs/plan.md)。plan 是範圍與決定的 SSOT；標「不做」的項目不要自行加進來。
- 複雜的決定與測試結果寫進 `docs/plan.md` 的決策紀錄，或另開 `docs/` 主題文件。

## 技術邊界

- 沿用思想淘金記的做法：無依賴 ES modules、靜態網頁，根目錄就是 application root，部署在 GitHub Pages。不引入 npm 套件、建置工具或後端。
- `src/engine.js` 保持純函式、不依賴 DOM，擲骰、移動、防跳關、抽卡、效果、連鎖、結算都要能用 `node --test` 測試。
- 所有隨機都走 seed，相同的 seed 加上相同的選擇，一定要得到相同的結果。
- 內容放在 `data/*.json`，改內容不需要改程式。

## 內容與公開範圍（這是公開網站）

- 不放院內金額、處罰細節、心得報告原文，也不放作者、年份、科別的組合。
- 規則類卡片只能引用 `D:\Git\Game\subsidy-life-game\content.js` 裡已核對的規則，用概念寫法（例如「出國前要提早上簽」），精確數字導向無界任意門。
- 奇幻卡要標示「純屬虛構」。
- 不收姓名，不連外部 API；存檔只放在 localStorage。

## 回報

完成時要附上實際的驗證結果和沒驗證的項目。只有 Jean 明確授權，才能建立遠端、push 或部署。
