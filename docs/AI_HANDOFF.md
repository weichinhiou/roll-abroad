# AI Handoff

> 更新：2026-11-05（台灣時間），OpenCode。**Task 25（旅程結算畫面基礎版＋示範出口＋成績單）本機 `main` 在 `40114a4`＋`86c0781`，已連同 Task 24 一起 push 上 main**；下一步是等 Jean 的 GPT 底版圖，到手跑 `python tools\build-ending-bg.py [桌機圖] [手機圖]` 就換好（規格固定、不用改程式）。Task 24（上方章節掛牌橫幅＋桌機／手機底板換新圖＋左上標題品牌 Logo，plan D21）本機已 commit（掛牌 `c215b2b`、底板 `637d2c5`、logo `1e3fadb`），**未 push**（等 Jean 授權），驗證見 Task 24。Task 23（OG 分享圖與 Favicon，`assets/brand/`）`main` 在 `70994fc`，**已 commit 並 push**，部署驗證見 Task 23。Task 22（棋盤 24→32 格、五邊形棋盤、第五章「回院之後」＋回院後卡 N33–N41＋章節門檻＋桌機手機背景換圖＋介面修正）**已發佈上線**（Actions run #10 success，線上驗證見 Task 22）。Task 18～20（建築、Pages 部署、旅人棋子）都已 merge 並發佈到線上。
> 換機器、換工具（Claude Code／Codex）或換 session 時，先讀這份，再讀 [plan.md](plan.md)。

## Project

《大赴翁》Roll Abroad：`D:\Git\roll-abroad`，遠端 https://github.com/weichinhiou/roll-abroad （**public**，線上 <https://weichinhiou.github.io/roll-abroad/>，plan D16）。

## Goal

在 **2026-11-09 黑客松**前，做出可以展示的單人擲骰遊戲：32 格、五章（含「回院之後」）、壁報與口報兩條路線、機會／命運卡、道具、結局，並且有 3 分鐘展示模式。之後在任意門的任務實驗室加上外連卡片（KIDE 報告也會提到這一點）。

## Context

- 2026-10-28：Jean 提出構想。2026-10-29 凌晨：評審團 PLAN 定案，寫成 [plan.md](plan.md)（D1–D9）。
- 2026-10-29 17:51：在另一台電腦推上**可玩的網頁雛形** `c5dfa48`（engine、渲染、24 格棋盤、20 張卡、里程碑、道具）。
- 2026-10-29 晚上：這台電腦（`D:\Git`）fast-forward 到 `c5dfa48`，跑了以下檢查：
  - `node --check src/*.js`：4 個檔案都通過。
  - **1,000 局無頭模擬**（隨機選項，腳本不在 repo 內，見下方「Review Notes」）：
    - 死局 0。
    - 擲骰次數：最少 9、中位數 13、最多 19，平均 13.3。
    - 路線：壁報 511、口報 489。
    - 20 張卡**都抽得到過**，每局平均抽 9.2 張。
    - 結局：steady 639、stage 280、wild 78、**safe 只有 3**。
- 2026-10-29 晚上 Jean 回報「好像無法玩」。原因是**直接雙擊 `index.html`（`file://`）時，瀏覽器會擋掉 ES module 和 `fetch`**，遊戲本身沒有問題。改法（`8bb2fdf`）：新增 `server.mjs`（Node 靜態伺服器，埠 4181）、`start-game.cmd`（雙擊後啟動伺服器並打開瀏覽器）、`npm start`；用 `file://` 打開時，畫面會顯示改用網址開的提示。同時修正 events.json 裡 13 處簡體字和錯字（例如「学会了一个」「延误」「屏幕」「_collaboration」）。用 http 開啟，已經用 `demo-1109`、`jean-test` 兩個 seed 在瀏覽器玩完整局，console 沒有錯誤。**`start-game.cmd` 本身還沒實際雙擊測試過**（當時預覽伺服器占用 4181 埠）。
- 兩台電腦的 JJ 母資料夾路徑不一樣：這台是 `D:\Git\AI-Agent`；另一台是 `D:\Git\jj-agent-core`，草稿放在隨身碟 `J:\`（另一台已經把 `AGENTS.md`、`plan.md` 的路徑改過）。

## Decisions

以 [plan.md §1](plan.md) 的 D1–D9 為準，重點如下：

- 名稱是《大赴翁》Roll Abroad。另開 repo，做成無依賴的靜態網頁，部署在 GitHub Pages。
- 壁報、口報兩條路線都做。公開版不放金額和處罰細節，精確規則用「任意門」道具連到任意門查。
- 規則卡不另外找承辦人審。只用《公文旅行》（`D:\Git\Game\subsidy-life-game`，私人 repo，**先放著不動**）裡已核對過的規則，並用概念寫法。
- MVP 只做 24 張卡；不做多人、AI 生成、登入、資料庫。

## Constraints

- 時程：今天是 10/29，距離 11/9 還有 11 天。11/2–11/3 要找 5 位同仁試玩。
- 技術：不裝 npm 套件、不用建置工具；`src/engine.js` 必須維持純函式、不碰 DOM；所有隨機都走 seed。
- 這會是公開網站：不放心得報告原文，也不放作者、年份、科別的組合；不收姓名。
- 只有 Jean 明確授權，才能把 repo 改成公開、開 Pages、push 任意門的 `main`。

## Files / Areas in Scope

| 檔案 | 內容 |
|---|---|
| `src/engine.js` | `initialState`、`rollDie`／`forcedRoll`、`applyMove`（里程碑 6／12／18／24／32 強制停）、`isEligible`、`drawCard`（優先處理連鎖 `pending`）、`applyChoice`、`checkpointAt`（選項可用 `requires: flag` 依旗標過濾）、`settle`（四種結局寫死在檔案底部的 `data_endings`；高張力＝`strain >= 2`） |
| `src/app.js` | 狀態流程；預設 seed 是 `demo-1109`；存檔用 localStorage |
| `src/render.js`、`styles.css`、`index.html` | 畫面 |
| `data/board.json` | 32 格、milestones [6,12,18,24,32] |
| `data/events.json` | `{ cards: [...] }` 共 77 張，`deck` 是 chance／fate，`tone` 是 real／funny／fantasy，`chapters` 標「哪幾章能抽」；路線欄位的值有 `both`、`poster`、`oral`，以及連鎖用的 `mentor`、`network` |
| `data/checkpoints.json` | 里程碑：`route`（第一章選路線）、`gate`、`session`、`return`（第四章回國報到）、`final`（第五章回饋與傳承，承諾兌現選項帶 `requires`） |
| `data/items.json` | 5 種道具：plan、consult、door、usb（壁報線送）、badge（口報線送） |

## Tasks

### Task 24：上方章節列改掛牌橫幅圖（2026-11-05，已 push）

- Jean 給五張「第 N 章・章名」立體去背 PNG（`Roll_Abroad_五章節_立體去背Banner.zip`，原檔留製作機 `Downloads` 不進 repo），換掉原本用 CSS 畫的金黃文字條。取捨見 plan D21。
- 十張 WebP 進 `assets/art/`：`chapter-banner-N.webp`（含繩，桌機與 760–1100px）＋`chapter-banner-N-norope.webp`（銅環上緣 12px 處截斷的短版，手機），共約 539KB。自動裁切（alpha bbox ＋「每列不透明度覆蓋率」分繩子 6%／牌面 >60%）與轉檔在 `tools/build-chapter-banners.py`，視為素材的原始碼。
- `index.html`：`<div class="chapter-ribbon">` 換成 `<picture id="chapter">`（`<source media="(max-width:759px)">` ＋ `<img>`）。`src/art.js` 新增 `CHAPTER_BANNERS`（路徑＋尺寸）與 `preloadChapterBanners()`（`app.js` 開局呼叫，換章不閃白）。`src/render.js` 新增 `renderChapterBanner()`：換 `src`／`srcset`／`alt`（章名靠 alt 給螢幕閱讀器）。`game-art.css`：掛牌用 `height:clamp` 定高＋`object-fit:contain` 護比例；為讓位，手機資源列 125→138px、手機 3D 棋盤 185→196px、手機 2D 棋盤 196→206px、桌機 2D 棋盤 110→138px，矮螢幕（高 ≤740px）另給掛牌高度。
- `test/art.test.js` 加兩項：十張都是 WebP、實際尺寸對得上 `CHAPTER_BANNERS`、無繩版裁切比例抓得對、總量 <700KB；以及 HTML／CSS／JS 接線（初始圖、兩個版型都定高、`object-fit`、部署檔清單有涵蓋）。

**驗證過：** `npm.cmd run check` 通過、`npm.cmd test` **39 項全過**（原 37＋新 2）；CDP 驅動的無頭 Chrome **九種版型截圖**（1920×1080、1440×900、1100×820、760×900、1280×600 矮螢幕、`prefers-reduced-motion` 的 2D 退回、390×844／360×740／390×650 手機）：掛牌與資源列／標題／設定鈕／狀態列／道具列**重疊面積皆 0**、無頁面溢出、五章的圖與 alt 都正確、手機確實改抓無繩版；**實玩**到第 7 格（擲 4 次）掛牌由 `chapter-banner-1.webp` 換成 `chapter-banner-2.webp`；十張本機都 200／`image/webp`；console 錯誤 0。**沒驗證：** 手機實機（只模擬 viewport）、真實 GPU 表現、`aria-live` 對 `<picture>` 內 alt 變更的朗讀行為（各 SR 不一致）、Actions 發佈後的線上樣貌（尚未 push）。

#### 續做：桌機與手機底板換新圖（同日）

Jean 再給兩張同場景新圖（桌機橫式 1672×941、手機直式 941×1672，PNG 都 2.5MB 級）。轉檔腳本 `tools/build-backgrounds.py`（底板原始碼）：WebP 桌機 q78 → 180KB、手機縮寬 900 後 q74 → 123KB（原圖的 1/15）。**答案：要轉 WebP**，而且舊底板本來就是 WebP，這次只是沿用同一条產線。CSS 引用路徑沒變（`game-art.css` 的 `body` 與手機段），所以沒動程式碼。

**驗證過（底板）：** `npm.cmd test` 39 項全過；四種版型無頭 Chrome 截圖（1440×900、1920×1080 第三章、390×844、360×740 第五章）——新底板與掛牌／資源列／棋盤都不打架（重疊仍 0、無溢出、console 0 錯誤），棋盤落在新圖的低對比海面區。**沒驗證：** 手機實機、真 GPU。

#### 續做：左上標題改品牌 Logo（同日，Task 24 續二）

Jean 給去背標題圖 `大赴翁：Roll Abroad.png`（1536×1024），換掉原本用 CSS 文字＋藍色陰影寫的「大赴翁 Roll Abroad」。轉檔 `tools/build-brand-logo.py`：依 alpha 裁透明邊、上限寬 900 → `assets/art/brand-logo.webp` **900×403、105KB**（WebP q90）。`index.html` 的 `<h1>大赴翁 <span>…</span></h1>` 改 `<h1><img class="brand-logo" src="assets/art/brand-logo.webp" alt="大赴翁 Roll Abroad" width="900" height="403" /></h1>`（h1 留語意，alt 給螢幕閱讀器）；`game-art.css` 清掉舊文字樣式（`h1{margin:0;line-height:0}`＋`.brand-logo{height:clamp(...)}`）、手機段（`@media(max-width:759px)`）另給 `clamp(46px,12.5vw,58px)`。`test/art.test.js` 加兩項：WebP 有透明且尺寸對得上 HTML、兩個版型都定高且 h1 舊樣式清乾淨。

**驗證過（logo）：** `npm.cmd test` **41 項全過**（原 39＋新 2）；CDP 無頭 Chrome **九種版型**（1920×1080、1440×900、1100×820、760×900、1280×600 矮螢幕、`prefers-reduced-motion` 2D、390×844／360×740／390×650 手機）截圖＋量測：logo 顯示尺寸 170–232px 寬（桌機）／103–109px（手機），與掛牌、設定鈕、資源列、棋盤**重疊面積全 0**、無頁面溢出、console 0 錯誤；手機 logo 底緣 y=65、掛牌 y=68 起，各留 3px。**沒驗證：** 手機實機、真 GPU、SR 對 h1 內圖片 alt 的朗讀。

### Task 25：旅程結算畫面（基礎版，2026-11-05，本機 commit `40114a4`＋`86c0781`，已 push）

Jean 說「做一個基礎版給我，底版圖我會讓 GPT 生，你把架構做出來」。**資料→畫面分三層**：

- **資料**：`src/engine.js` 的 `settlement(state)`（純函式）回傳 `{ending, route, res[4], promises[4], stats[4], keyChoices}`；`PROMISES` 對齊 `data/checkpoints.json` 的 `final` 關卡 `requires` 旗標。另外 `applyChoice` 新增：選 `final` 關卡具 `requires` 的選項時記 `state.kept`，用來分辨「已兌現」跟只「帶回承諾」。
- **畫面**：`index.html` 的 `<dialog id="settlement" class="settlement">`；`src/render.js` 的 `fillSettlement()`／`renderSettlement()`／`openSettlement()`，用 `settlement()` 的資料組 HTML（結局＋黑貓／承諾蓋章清單／四資源條／四項統計／關鍵抉擇／再玩一次＋關閉）。
- **開合**：遊戲結束（`status==="done"`）自動開一次（`settlementSeen` 防重複）；還有最後一張卡結果時先在 `#modal` 顯示並給「看旅程結算」按鈕；關掉後面板留「旅程結算」按鈕可重開；`再玩一次` 走既有 `restart`。按鈕分派在 `src/app.js`（`settlement`／`close-settlement`）。

**底版圖預留**：`assets/art/ending-backdrop.webp`（1600×900）＋`ending-backdrop-mobile.webp`（900×1600），現在是占位漸層（共 9KB）。GPT 圖到手後跑 `python tools\build-ending-bg.py [桌機圖] [手機圖]`（等比縮放＋置中裁切，規格固定，不用改 CSS／程式）。

**展示用出口（續做，commit `86c0781`）**
- **設定裡の「預覽旅程結算」**：`index.html` 設定選單一顆 `data-action="demo-settlement"`，走 `render.showSettlementDemo()` 開同一個畫面，資料是 `app.js` 的 `DEMO_STATE`（假的已完成一局，仍過 `engine.settlement()`）。示範版頂部標「示範」、底部改註記「玩到第 32 格會看到你自己這一趟」，不給「再玩一次」以免誤刪玩家進度；`demoOpen` 旗標讓它不會被下次 `draw()` 誤關，重新開始時由 `closeSettlement()` 收掉。
- **`?settle=demo`**：開場直接叫出同一個示範畫面（`boot()` 尾端判 URL 參數），展示不用玩到第 32 格。
- **成績單 PNG**：`src/share-card.js` 把結算資料畫在 1200×630 canvas（跟 OG 圖同規格），「下載成績單」按鈕走 `downloadReportCard()`（`toBlob`＋`a.download=大赴翁-成績單-<seed>.png`）。內容：結局＋評語＋路線、四資源、四項承諾（圓章同配色語彙）、四項統計、旅程代碼與民國日期。純本機產製，不連外部服務。`settlement()` 因此多回傳 `seed`。`package.json` 的 `check` 加入 `src/share-card.js`。

**樣式**：`game-art.css` 尾段 `.settlement` 系列。桌機雙欄、手機單欄（`@media(max-width:759px)` 換手機底版、黑貓改静态置中避免壓字）。地雷記一筆：資源條**不能沿用 `.bar` 類別**（全域 `.bar` 是絕對定位的 HUD 條，會蓋掉右邊數字），已改名 `.sbar` 並有測試守著。

**驗證過：** `npm.cmd run check` 過、`npm.cmd test` **46 項全過**（新增 3 項 engine 結算資料／承諾章／純函式，2 項底版圖與接線）；CDP 無頭 Chrome **實玩流程**（擺第 31 格→擲骰停 32→四項承諾選項都在→選「稿子」→過場視窗→「看旅程結算」開啟→「關閉」→面板重開→「再玩一次」回第 0 格）全對，`kept`／`brought` 判別正確；五種版型截圖（1920×1080、1440×900、1280×800、1100×820、390×844、360×740）桌機不需捲動、手機可捲動、無版面溢出、console 錯誤 0。示範出口與成績單另驗：`?settle=demo` 與設定鈕都叫得出示範版（頂部標「示範」、無「再玩一次」）、關閉後不殘留；`drawReportCard()` 產出 1200×630、按「下載成績單」真的落地 `大赴翁-成績單-demo-settlement.png`（約 260KB），手機 390／360 三個按鈕不溢出。**沒驗證：** 手機實機、真實 GPU、四種結局的實際文案配置（只用 stage 打樣）、手機瀏覽器實際存檔行為（HEAD 版 Chrome 模擬）。



### Task 23：OG 分享圖與 Favicon（2026-11-05，已 commit `70994fc` 並 push）

- Jean 給兩張 AI 生成原圖：「大赴翁：環球旅途啟程.png」（1672×941）做 OG 圖、「復古旅行骰子郵戳徽章.png」（1254×1254 四角透明）做 Favicon。原檔留製作機 `Downloads`，不進 repo。
- 成品放 `assets/brand/`：`og-cover.jpg`（1200×630、183 KB）、`favicon.ico`（16/20/24/32/48/64 六級、32bit PNG 條目、22 KB）、`icon-512.png`（59 KB、256 色調色板）、`apple-touch-icon.png`（180×180、四角補米色底、11 KB）。製作紀要見 `assets/brand/README.md`。
- `index.html` head 補：`description`／`theme-color`／三組 icon link／`og:*`（含 `og:image` 絕對 URL 1200×630）／`twitter:card: summary_large_image`。
- `server.mjs` MIME 補 `.jpg`/`.jpeg`；`deploy.yml` 發佈清單改抓 `assets/brand/*.ico|*.png|*.jpg`（README 不發佈）；`test/art.test.js` 加三支品牌檔測試（JPEG SOF／PNG IHDR／ICO 目錄解析＋head 引用都存在＋deploy.yml 有涵蓋）。**`npm.cmd test` 37 項全過**。
- 製作坑（紀錄在 brand README）：Pillow 存 ICO 寫 BMP 條目且讀不回各級尺寸 → **手寫 ICO 容器**（目錄從第 6 byte 起，PNG 條目）；紙紋小尺寸會糊 → 每級降採樣後 Contrast 1.14＋Color 1.10＋UnsharpMask；全彩 PNG 肥到 480 KB → 256 色量化。
- **驗證過：** `npm.cmd run check`＋37 項測試；本機 4191 Playwright 開站實測四檔 200 且 Content-Type 正確（`image/x-icon`／`image/png`×2／`image/jpeg`）、head 標籤齊備、console 錯誤 0／4xx 0。**沒驗證：** headless Chrome 不抓 favicon（分頁圖示實際顯示＝ICO 結構測試＋模擬分頁列截圖），社群平台實際抓 OG 圖要上線後用 Facebook Sharing Debugger／LINE 預覽工具驗。

### Task 22：棋盤 24→32 格、五邊形棋盤、第五章「回院之後」（2026-11-04，已 commit `6796992`＋`ed3bb25` 並 push，已發佈上線）

依據 plan D19：前 24 格一格不動，新增第 25–32 格全放第五章「回院之後」；棋盤幾何改五邊形，五個角落＝五個里程碑（6／12／18／24／32）。第 24 格改里程碑 `return`「回國報到」，第 32 格 `final`「滿載而歸」（先「兌現承諾」→「回饋與傳承」→ Jean 定案「滿載而歸」）內含承諾兌現選項（選項層級 `requires: flag`，`engine.checkpointAt` 依旗標過濾，全濾空時退回完整清單防死局）。結局計分「高張力」門檻收緊為 `strain >= 2`。五章色 `0xef7d57`／`--c5: #f9dccd`；章徽只有四枚，第五章暫沿用返國章。桌板跟著棋盤外框改五邊形（`scene-art.js` 的 `offsetPoly`／`plateMesh`）。

**續做（同日）：回院後腳本盤點與章節門檻**（plan D20，詳見 [postreturn-cards-2026-11-04.md](postreturn-cards-2026-11-04.md)）：回原始 PDF 堆（`D:\Git\國際會議旅伴`，6 冊 228 篇）重盤回院後素材（心得及建議段 213 篇、建議事項 91 篇），新增 9 張回院後卡 `N33`–`N41`（全掛 `trueStory`；N16／N19 口報卡依 Jean「壁報也有短講」維持 `route: both`）；77 張全標 `chapters`（哪幾章能抽），`drawCard` 設兩道保險（空池退回不限章節、連鎖不受章節限制）。加卡後 1,000 局分布：steady 522／wild 229／safe 132／stage 117，平衡尚未細調。

**續做（同日）：遊戲背景換圖（桌機＋手機）**：Jean 兩度給圖——桌機 `學術港灣與世界地標全景.png`（1672×941）轉 `assets/art/world-desktop.webp`（172KB）、手機 `國際學術旅港灣全景.png`（直式 941×1672）縮寬 900 轉 `assets/art/world-mobile.webp`（115KB）。`game-art.css`：`body` 換 `world-desktop.webp`，`@media(max-width:759px)` 段換 `world-mobile.webp`（`background-position:center top`）；舊 `travel-world.webp` 保留（仍在素材庫、手機段不再引用）。製作紀錄在 `assets/art/README.md`（註明兩張非 image_gen 產出）。

**續做（同日）：介面三處修正**（已 commit `ed3bb25` 並 push）：(1) 里程碑小旗的旗面 `PlaneGeometry` 沒設 rotation，五個角落旗面全朝同一世界方向，側看像歪掉的棍子——改成「旗桿＋旗面」包成 Group、整組 `rotation.y = atan2(ox, oz)` 朝外，旗面改用整塊 128×128 三角貼圖掛在桿頂沿邊伸出（`board3d.js`）。(2) 狀態列 `.rollinfo` 與棋盤下緣操作提示重疊（桌機錨 `bottom:120px` 撞上提示帶 111–133px、手機 165px 撞 183–203px）→ 桌機 145px、手機 215px。(3) 該操作提示（`view-hint` 膠囊）依 Jean 指示**取消，改由黑貓旅伴說**：`render.js` 在 `rolls === 0` 時讓氣泡**輪播兩句**（先講操作提示 7 秒、之後每 5 秒換「點中央骰子，看看下一站！」，換句走 `.swap` 淡入、`prefers-reduced-motion` 下不動畫；`(pointer: coarse)` 決定滾輪或雙指），擲過骰 `stopCompanionHint()` 清定时器並改講行程訊息；並在 `body` 掛 `companion-hint` class 讓手機／760–1100px（原本藏氣泡的兩個區間）開局時也顯示氣泡；`view-hint` 的元素與 CSS 一併移除。驗證：Playwright 量 4–7 種版型座標，狀態列／氣泡與周圍元素 0 重疊；桌機＋手機截圖目視；觸控模擬（`hasTouch`）確認文案轉「雙指縮放」；實測 t=0/8s/13s 三點確認輪播、擲骰後 6.5 秒文字不變（定时器有清）；`npm.cmd run check` 與 `npm.cmd test` 34 項全過。

**發佈與線上驗證（同日，Jean 授權）**：push 觸發 `.github/workflows/deploy.yml`，Actions run **#9（`144484b`）`completed/success`**。線上 <https://weichinhiou.github.io/roll-abroad/> 帶 cache-buster 驗證：`index.html`／`game-art.css`／`styles.css`／`src/render.js`／`src/board3d.js`／三個 `data/*.json`／`world-desktop.webp`（172,036 bytes＝本機相同）／`world-mobile.webp`／`traveler.glb`（`model/gltf-binary`）／`vendor/three.module.js` **全 200 且 Content-Type 正確**；`docs/`、`test/`、`tools/` 回 **404**（沒洩進行內文件）；线上 CSS 抽檢：`world-desktop.webp`✔、`world-mobile.webp`✔、`companion-hint`✔、`bottom:145px`✔、`view-hint` 已不存在✔；`events.json` **77 張**、有 `N41`、有 `chapters`；`board.json` **32 格**、第 32 格 `milestone: final`；`render.js` 有 `startCompanionHint`、`board3d.js` 有 `flagGroup`。Playwright 開线上站（桌機 1366＋手機 390）：`canvas` 存在、黑貓開局氣泡出現並輪播（8 秒後換句）、桌機實點擲骰走到「第 1/32 格・選定會議｜擲骰 1 次」、`.view-hint` 殘留＝無、**console 錯誤 0／4xx 0**，截圖與本機一致。**沒驗證：** 真實 GPU 的 FPS、院內網路到 GitHub 的連速、手機實機手勢。

**驗證過：** `npm.cmd run check` 通過、`npm.cmd test` 34 項全過（含 3 項章節門檻新測試；1,000 局：死局 0、77 張都抽得到、meanRolls 17.7）；Playwright＋無頭 Chrome 本地 4191 兩局實玩到結局（「第四章：回國報到」「第五章：旅程結算」〔後改名滿載而歸〕都出現、requires 過濾實測：無旗標只剩 2 通用選項、有 mentor 多 1 項、頁面顯示「第 24/32 格」「第五章・回院之後」）；console 錯誤 0／4xx 0；2D 退回模式（減少動態效果）32 格、5 里程碑、8 欄 ch5；桌機與手機截圖確認五邊形棋盤＋五邊形桌板＋廣場貼圖正常（UV 修正後）；背景換圖後無頭 Chrome 截桌機 1366×860 與手機 390×844 兩版型：`body` 背景分別為 `world-desktop.webp`／`world-mobile.webp`、4xx 0、console 錯誤 0、棋盤不被背景干擾。**沒驗證：** 真機 FPS、手機實機（只用模擬 viewport）、77 張數值平衡的逐卡分布、舊存檔續玩沒實測（引擎面 pos≤24 直接續玩）、目標一局時間沒有數字；骰子墊與梅花鹿等內圈小物沒重排。**待 Jean 拍板：** N04／N07 是否掛真實標記。

### Task 21：事件卡擴充 36→68 張（2026-11-04，`main`）

從院內 2018–2025 出國開會心得彙編（`D:\Git\國際會議旅伴`，6 冊 PDF、228 篇）挖素材做 32 張新卡（`N01`–`N32`）。設計原則與取捨見 [content-mining-2026-11-04.md](content-mining-2026-11-04.md)，逐筆草稿與出處對照見 [new-cards-32-2026-11-04.md](new-cards-32-2026-11-04.md)。靜態邊界：不貼報告原文、不寫姓名／科別組合、不放金額與處罰細節；精確數字導向無界任意門。

- Jean 拍板「全部做」，另外點名三筆：`N02` 改成**劇本延伸教育**（不知道有什麼補助 → 去無界任意門系統查）、`N03` 改成**出國補助後三年內要發表 SCI 期刊作為成效追蹤**、`N32` 原本是疫情情境**改包裝成一般作業辦法變動**。
- **真實性標記**：22 張對得上心得報告的卡掛 `trueStory`（「院內同仁真的遇過：…」，介面顯示「📌 真實改編」）；`N04`／`N07`／`N26` 是通用出差常識、非特定報告，不掛。
- `social`／`flags` 是**選項層級**欄位（`choice.social`／`choice.flags`），不是 `effects` 的 key，一開始誤寫進 effects，測試擋下來（effects 白名單）後修正。
- `test/events.test.js` 的卡數斷言（36）是守門測試，需隨卡量更新。
- `src/engine.js` 不動。

**驗證過：** `npm.cmd run check` 通過、`npm.cmd test` 31 項全過（含 1,000 局模擬：死局 0、68 張都抽得到、四種結局都有、meanRolls 13.3）；JSON 結構檢查 68 卡 ID 唯一、必填欄位齊、每卡 ≥2 選項；playwright 實玩多局確認新卡抽得到（實測抽到 `N02`/`N10`/`N21`/`N27`/`N28`/`N31`）、「📌 真實改編」標記正常、選項可點、console 錯誤 0／4xx 0。**沒驗證：** 68 張的數值平衡沒跑分布分析、手機尺寸、真人手感、N02 講的無界任意門系統只是文字沒真連線。

### Task 19：上線 GitHub Pages（2026-11-02，`main`）

- 加 `.github/workflows/deploy.yml`：push 到 `main` 就發佈到 <https://weichinhiou.github.io/roll-abroad/>；只複製 `index.html`、`styles.css`、`game-art.css`、`src/`、`data/`、`vendor/`、`assets/art/*.webp|*.glb` 進 `dist`，`docs/`、`tools/`、`test/` 不進網站。
- 免費方案不支援 private 開 Pages（API 回 422 `Your current plan does not support GitHub Pages for this repository.`），依 Jean 選擇把 repo 改 **public**，Pages 來源設 `build_type: workflow`。
- **驗證過：** Actions run `completed/success`；線上 `index.html`(200 text/html)、`src/board3d.js`、兩個 `.glb`（200 `model/gltf-binary`，大小與本機相同）、`travel-world.webp`、`data/events.json` 全 200；`docs/AI_HANDOFF.md` 404（如設計不發佈）；playwright 開線上站 `hasCanvas: true`、console 錯誤 0、無 4xx，截圖確認棋盤、兩棟建築、HUD 正常。**沒驗證：** 院內電腦／手機實機流暢度（swiftshader）、網址在院內防火牆外是否顺、真人玩線上版。


### Task 20：玩家棋子改 Blender 建模的旅人（2026-11-03，分支 `feature/traveler-miniature`，已 merge `main` 並發佈）

Jean 給一張「開心學術旅人」插畫（捲髮男孩、綠外套白襯衫、藍識別證、黃書、黃背包、卡其褲反折、棕鞋、青綠圓底座），要把它做成棋子。仍是美術修正：`src/engine.js` 不動、不新增玩法。

- 建模腳本 `tools/blender/build-traveler.py`（GLB 的原始碼，改造型改腳本重跑）：`runpy.run_path()` 執行 → 清舊物件 → 按節點 join → 套用修改器 → 歸零（雙腳中心為原點、底座底部 z=0、正面 −Y）→ 自帶 Sun＋Area 渲四張檢查圖（正面／側後／上半身／**遊戲俯角**）→ 匯出 `assets/art/traveler.glb`。渲完把燈刪掉、場景相機還原；模型渲暫存時 park 到 y=90 不入鏡別人的模型。成品 4,020 三角面、263 KB、三節點。
- 三個節點是動畫需要：`RA_TravelerBody`（含底座）、`RA_TravelerHead`（原點搬到脖子）、`RA_TravelerCase`（行李箱，原點搬到箱中心）。`board3d.js` 用 head 做 idle「左右看」、用 case 做跳格拖後與落地回正；跳格動畫的基準位置改讀節點原始 position（`CASE_HOME`，box 備援用預設值），不再硬編碼。
- 縮圖取捨寫進 [art-direction.md](art-direction.md)「旅人棋子」：整顆在螢幕上約 40×90 px，所以砍掉口袋／釨子／第二條鞋帶等細碎件、行李箱改橘紅（黃文件夾＋黃背包已經都是黃的）、瀏海抬高到眉上，否則 56° 俯角看成一坨毛球。整體縮放常數 `S = 0.82`。
- `src/board3d.js`：`buildPawn()` 先照原本方式做出 box 棋子，再非同步載 GLB，成功才拆掉 box 換模型（GLB 掛掉不影響遊戲）；載入成功會設 `window.__pawnModel = "glb"` 供驗證。`server.mjs` 已支援 `.glb` MIME、`deploy.yml` 已複製 `assets/art/*.glb`，不用改。

**驗證過（v1）：** `npm run check` 通過、`npm test` 31 項全過；`inspect-traveler.mjs` 用 vendor 的 `GLTFLoader` 解析 GLB 確認三節點名稱、原點與 bbox（v1：body y 0..0.799、head 0.742..1.130、case 0.007..0.369）；playwright 開 http://localhost:4191，`traveler.glb` 回 200 `model/gltf-binary`、`window.__pawnModel` 為 `glb`、console 錯誤 0、無 4xx；A/B 截圖（A 一般載入、B 擋掉 `traveler.glb`）做像素差異定位，差異集中在起點格棋子所在區域，A 是 GLB 旅人、B 是 box 備援，證明替換路徑與備援路徑都活。Blender 端渲四張（含遊戲俯角）確認臉不被頭髮蓋住、底座 z=0。**沒驗證：** 真實 GPU 的 FPS 與陰影表現（headless 軟體渲染）、真人對棋子精緻度的意見、縮到手機尺寸後棋子還讀不讀得出來、行李箱跳格拖曳在實機順不順、插畫參考圖尚未進 repo（`docs/ref/`，見 Open Questions）。

**v2 修正（同日，Jean 看遊戲畫面說「左手結構怪怪的，好像沒有拿文件夾拿行李箱的感覺」）**：v1 的書和行李箱都堆在同一側、手飄在腰邊沒握到東西，俯角下讀成「一團黃色加一團橘色」。改成**兩手各有工作**：左手（+X）下垂握住豎式行李箱的拉把（拉桿兩支柱＋橫把，輪子真的停在底座面上 z=0.114，底座因此往行李箱側加長成橢圓才托得住），右手（−X）抱會議文件夾（黃夾＋白紙從上緣露出一截＋藍標籤線，取代原本夾在腋下的書）。踩到的坑：① `capsule` 的軸是局部 +Z，`rot x` 要**負值**才是小臂往前、`rot y` 要「左側負、右側正」手才往外下垂，符號寫反袖子會往後翹——v1 的怪手就是這個；② 歸零如果連底座 bbox 一起算，偏右的橢圓底座會把人推離格子中心，改成只把 z 壓到 0、x/y 以雙腳為原點。頭髮、手臂、行李箱全部由 `build-traveler.py` 重跑產生（4,020 三角面、263 KB）。

**驗證過（v2 重跑後再驗一次）：** `npm run check` 通過、`npm test` 31 項全過；`inspect-traveler.mjs` 解析 GLB 確認三節點 bbox：body y 0..0.799、head 0.742..1.130、case y 0.093..0.526（拉桿頂端在 0.526，離手 z≈0.63 一截拉桿的距離）、總 4,020 三角面／263,256 bytes；playwright 開 http://localhost:4191（`shot-pawn2.js`、`verify-pawn.js`）：`traveler.glb` 回 200 `model/gltf-binary`、`window.__pawnModel` 為 `glb`、擲骰走到第 1/24 格・選定會議、console 錯誤 0、無 4xx；遊戲畫面 2 倍截圖放大確認左手握到拉桿、文件夾有白紙與藍標籤線、棋子站在格子中央（歸零只壓 z）。**發佈驗證（merge 進 `main` 後）：** Actions run #3 `completed/success`；線上 <https://weichinhiou.github.io/roll-abroad/> 實測 `traveler.glb` 回 200 `model/gltf-binary`、`__pawnModel` 為 `glb`、點 3D 骰子擲到 1 走到「第 1/24 格・選定會議｜擲骰 1 次」、console 錯誤 0／4xx 0。**沒驗證（延續 v1）：** 真實 GPU 的 FPS 與陰影表現、真人對棋子精緻度的意見、縮到手機尺寸後讀不讀得出來、行李箱跳格拖曳實機手感、插畫參考圖尚未進 repo（Open Questions）。

### Task 1：補自動測試（plan.md 要求，目前缺少）
新增 `test/engine.test.js` 和 `package.json` 的 `"test": "node --test"`。要測：
- 防跳關：例如在第 5 格擲出 3，要停在第 6 格。
- 資源上下限（0–10）。
- 口報線不會抽到 `S03`，壁報線不會抽到 `S04`。
- 連鎖：`S03` 的後續、`S02` 的合作種子。
- 相同 seed 加上相同選擇，結果要一模一樣。
- 1,000 局模擬：死局 0、每張卡都抽得到、擲骰次數在 10–15 左右。

### Task 2：結局平衡
`safe` 幾乎抽不到（1,000 局只有 3 局）。調整 `settle` 的門檻，或改用多面向計分（GDD §5.3）。調完用模擬確認四種結局都會出現。

### Task 3：卡片補到 24 張 ✅（2026-10-29 完成）
已經補到 24 張。新增 4 張真實改編卡：`T01` 颱風關機場（壁報）、`T02` 議程只在 App 改（口報）、`T03` 全市罷工、`T04` 公文被退回；`F-usb` 也改寫成真實案例「隨身碟讀不出來」。這 5 張都有 `trueStory` 欄位，畫面會顯示紅框「📌 真實改編」，選完之後行程紀錄也會記一行（規則見 [report-cases.md](report-cases.md)「怎麼用」）。之後要換掉較虛構的卡，同樣從 report-cases.md 挑。

同一次修正了兩個既有 bug：
- `penalty`（行政懲罰）原本整包塞回效果，**扣分從來沒有生效**。
- 名片的 `social` 標在選項上，引擎卻只看卡片，**名片加倍從來沒有觸發**，而且用過也不會扣。

修完之後重跑 1,000 局模擬：死局 0、24 張都抽得到；結局分布是 steady 645、stage 254、wild 98、safe 3（Task 2 的問題還在）。瀏覽器實測：`T04` 卡面的紅框、行程紀錄的「📌 真實改編」、承辦人諮詢免罰，都正常。

### Task 4：展示模式
plan 要求固定 seed、約 3 分鐘走完精華。目前只有預設 seed `demo-1109`，還沒有「展示模式」本身（例如自動推進、只挑精華事件）。

### Task 5：試玩準備（11/2 前）
準備試玩用的網址或筆電，前後測各 5 題，加上 5 分量表。

### Task 6：美術、OG 分享圖、上線（11/6–11/7）
黑貓表情、章節插圖、OG 分享圖。上線前要先請 Jean 同意把 repo 改成公開並開 Pages，然後在任意門的 `src/data/missions.ts` 加一筆卡片（任意門 `main` 的 push 需要 Jean 明說）。

### Task 7：3D 環形棋盤（plan D10，交給院內 OpenCode）✅（2026-10-30 完成）
2026-10-30 Jean 決定：棋盤畫面改成 3D，棋子繞著方形棋盤走，感覺參考 https://tmuh.ai/u/jc2jc/or-game-3d/ （只參考風格，不複製它的程式或素材）。**規則不變**：24 格、走完一圈結束、里程碑 6／12／18／24 強制停。

做法：
1. 開新分支 `feature/3d-board`，從最新 `main` 開。
2. 下載 three.js 的固定版本（module 版）放進 `vendor/`，在檔案開頭註明版本與授權（MIT）；不在執行時連 CDN（院內網路與離線 demo 都要能跑）。
3. 新增 `src/board3d.js`：建立場景、把 `data/board.json` 的 24 格排成方形一圈（每邊 6 格，四章用不同顏色，里程碑格加高或加標記），放一顆棋子；對外只提供 `initBoard3d(container, board)` 和 `updateBoard3d(state)` 兩個函式。
4. 擲骰後棋子**一格一格跳過去**（不是瞬間移動），鏡頭略為跟著棋子；動畫結束後才顯示事件卡。這段等待的流程放在 `src/app.js`，`src/engine.js` 不動。
5. `src/render.js` 的 `renderBoard`：WebGL 可用且沒有開「減少動態效果」時用 3D，否則沿用現在的 2D 棋盤。
6. 手機 375 寬要能看到整個棋盤和事件卡；畫面不能擋住資源列和道具按鈕。

**2026-10-30 完成報告（OpenCode）：**
- 變更檔案：
  - `vendor/three.core.js`、`vendor/three.module.js` —— three.js v0.180.0（MIT）。固定版本進 repo，執行時不連 CDN。來源 `https://unpkg.com/three@0.180.0/build/`，經 npm cache 抓 `three-0.180.0.tgz` 解出來（院內 TLS 攔截，unpkg 直連被節流，npm cache 反而過得去）。檔案開頭有註明版本、來源、MIT 授權全文。
  - `src/board3d.js` —— 新增。只 export `initBoard3d(container, board)`（回 true/false）和 `updateBoard3d(state)`（回 Promise，動畫結束才 resolve）。24 格排成方形一圈、每邊 6 格、四章配色沿用 2D 的 `--c1..--c4` 系、里程碑格加高 + 小旗標記、棋子是一顆人形紅棋。
  - `src/render.js` —— 加 `initBoard(board)`（挑 3D 或 2D）跟 `movePiece(state)`（回 Promise，2D 模式直接 resolve）。`renderBoard` 更名 `renderBoard2d`，只在沒有 3D 時畫。
  - `src/app.js` —— 加 `await movePiece(s)` 等棋子跳完才 `E.drawCard`／`checkpointAt`。3D 一格跳 260ms，加 60ms 之間停頓。
  - `index.html` —— 加 `#board3d` 容器（跟 `#board` 二選一，CSS 裡 `hidden` 對應）。也補了 SVG favicon，躲掉原本 `/favicon.ico` 的 404。
  - `styles.css` —— `.board3d` 規則：桌機 16:10、手機 4:3、`aspect-ratio` 保持盒子穩定；`max-height: 480px` 手機上不吃掉事件卡。
  - `src/engine.js` **沒改**。
  - `package.json` —— `npm run check` 加上 `board3d.js`；新增 `check-vendor` 分開驗 vendor。

- **驗證過什麼（用 headless chromium + playwright 臨時腳本，`--use-gl=swiftshader`）：**
  1. `desktop-3d`（1280x800）：`initBoard3d` 成功、canvas 630×393、`http://localhost:4181` 玩完一局、seed `demo-1109` 擲 13 次、24/24、結局「穩健的學術旅人」、console 0 error。
  2. `mobile375`（375x720）：3D 上下兩側都能看，canvas 341×255，事件卡在下面不被擋，console 0 error。玩完一局、seed 一行、結局與 desktop 一致。
  3. `desktop-2d-reduced`（`prefers-reduced-motion: reduce`）：**順利退回 2D**（`#board3d` `hidden`、`#board` 有 24 格）、console 0 error、結局同上。
  4. `--disable-webgl`：也退回 2D，24 格都在，玩完一局，console 0 error。原本 three.js 會先噴紅字再退回，已改成 board3d 先用 `getContext('webgl')` 試一次、不可用就直接跳過 three.js，所以沒有 THREE 錯誤。
  5. `node --check src/*.js` 全過；`node --check vendor/three.module.js + three.core.js` 也過。
  6. `node verify.js`（800ms 內等動畫，模擬真人按速度）連打 300 次骰子／選項，24 格、結局一致 → engine 加了 3D 順序排程後行為沒變。

- **沒驗證什麼：**
  - **真機 60fps 效能**：headless chromium 是 swiftshader 軟體 raster，不等於院內 Intel 內顯或手機 GPU。室內機、投影機、手機上要順跑，請 Jean 實機看一下。三個不同長寬比都對、語意上 24 格都在，但實際捲動、投影機色彩、手指滑動沒驗。
  - **真的滑鼠／觸控操作**：驗證用 `element.click()`，沒走 hover、focus、鍵盤 tab。intent 上沒改互動結構，純 3D 畫面替換，但「點一下 3D 棋子有沒有反應」這種事沒驗。
  - **動畫速度是否恰到好處**：260ms/格 是我挑的（相加 13 擲 ≈ 10 秒），太慢或太快要 Jean 反饋再調。
  - **`vendor/three.core.js` 是不是剛好要用的版本**：three.js 我 verify 過能載入、能做到 init + hop + resize + 控制台乾淨，但沒跑 three.js 自家測試。
  - **KVKK 合規**：three.js 是 MIT，直接進 `vendor/` 檔案上有註明出處，法務要再確認一下就好。

驗收：
- ✅ 用 `start-game.cmd`（http://localhost:4181）以 seed `demo-1109` 玩完一局，console 沒有錯誤（自動化驗證過）。
- ✅ 桌機與手機寬度都截圖（`pw/shots/desktop-3d-*.png`、`mobile375-*.png`、`desktop-2d-reduced-*.png`、`webgl-off.png`）；在瀏覽器關掉 WebGL（`--disable-webgl`）或開啟減少動態效果時，確認會退回 2D。
- ✅ `node --check src/*.js` 通過；engine 的測試／模擬結果不變（engine 沒改；`validate: 200 局隨機 end=24/24` 那組先前的結果維持）。
- ✅ 在這份交接檔回報：驗證過什麼、沒驗證什麼（例如院內電腦的效能）。
- ✅ commit 到 `feature/3d-board`；**push 和合併進 `main` 等 Jean 明說**。

### Task 8：選完立刻看到結果（2026-10-30，分支 `feature/choice-result`）
Jean 試玩 3D 版後反映：選完選項，結果只寫進右下角的「行程紀錄」，要往下找，很不直覺。改法：選完之後，事件卡的位置直接顯示結果框（卡名、你選了什麼、說明、資源增減的綠／紅標籤、道具或耗盡的提示），下面接著是「擲骰」按鈕；擲下一次骰子才清掉。結果只存在畫面上，不進存檔、不動 engine（改 `src/app.js`、`src/render.js`、`styles.css`）。

- 驗證過：用 seed `demo-1109` 在瀏覽器擲骰一次、選第一個選項，結果框正確顯示「精力 −1、學術收穫 +2」，console 沒有錯誤。
- 沒驗證：手機 375 寬、整局玩完、結局畫面上的結果框、讀取存檔後重新整理（設計上這時不會顯示結果框）。

### Task 9：美術與骰子畫面（2026-10-30，分支 `feature/3d-art-dice`）

Jean 要求：3D 版美術再上一階（光影、桌面、格子、棋子、鏡頭、效能），並加上 3D 骰子畫面。**骰子只負責「演出」engine 已算出的點數，`src/engine.js` 一個字都沒改。** 貼圖一律 canvas 現畫，不加 npm 套件、不連 CDN、不抓網路圖。

**做了什麼**

- `src/board3d.js`（大改，对外 API 增加）
  - 桌面：圓桌木桌（canvas 畫年輪＋節眼＋明暗漸層）→ 織紋桌布 → 木框棋盤 → 中央麻布；全部 `CanvasTexture`。
  - 中央空地：「大赴翁／ROLL ABROAD」標題板＋四章名稱與章節印記（`centerTexture()`）。
  - 格子：每格一張 canvas 貼圖（格號＋`data/board.json` 的短標籤＋章節印記），四章配色沿用 2D 色系但壓沉一點；里程碑 6／12／18／24 加高（0.8 vs 0.3）、深底金邊、外加一層發光金框、立一面章節色小旗。
  - 光影：暖色半球光＋主平行光（`PCFSoftShadowMap`，陰影圖手機 512／桌機 1024）＋側補光＋冷色輪光；`ACESFilmicToneMapping`、暖色 `Fog`。
  - 棋子：底座＋梯形身體＋金色領圈＋頭＋髮＋雙臂＋**行李箱**（箱身＋把手＋貼紙）；跳格走拋物線、落地 squash & stretch、箱子稍微拖後再回正；idle 時輕微呼吸、頭微微轉。
  - 鏡頭：斜上方俯視（fov 36，`(0,14,12)` 看棋盤中心），用阻尼追蹤棋子位置，移動時平順跟隨、能看到整圈。
  - 效能：`setPixelRatio` 上限（手機 1.6／桌機 2）、陰影圖上限、手機關 antialias；`IntersectionObserver`（棋盤离开畫面）與 `visibilitychange`（分頁隐藏）時 `cancelAnimationFrame` 暫停 render。
  - 3D 骰子：六面 **1/1/2/2/3/3**（相對面配 1↔3、2↔2），點數用 canvas 畫。`rollDice(value)` 擲前滾約 1 秒、停在 `value` 面朝上、放大顯示點數再淡出。**內部不用 `Math.random`**：最終朝向由 `setFromUnitVectors(面法線, +Y)` 算出，外觀偏航角用單調計數器派生，同一次擲骰的動畫只跟 `value` 和計數器有關。
  - 新增 export：`rollDice(value)`、`teleportPawn(n)`、`isBoard3dReady()`；`initBoard3d`／`updateBoard3d` 不變。
  - 驗證用：`window.__dieTargetValue`（這次要演出的點數）、`window.__dieSettledValue`（動畫停穩那一刻寫入，每次擲骰先清空）。只給自動化測試用，刪掉不影響玩法。
- `src/render.js`：`showDice(value)`（3D 呼叫骰子動畫；2D／減少動態效果不播動畫，改在事件卡區前面 prepend「🎲 擲出 X」徽章）、`relocatePiece(n)`、`clearDiceBadge()`、`getMode()`。Task 8 的結果框原封保留。
- `src/app.js`：`roll()` 順序改為 `rollDie`／`forcedRoll` → `applyMove` → **`await showDice(diceValue)`** → `await movePiece()` → 才 `drawCard`／`checkpointAt`；`setBusy()` 在動畫期間把 `.roll`／`.choice`／`.item`／`.forced button` 全部 `disabled`（防連按），結束後還原原本的 disabled 狀態；讀存檔改用 `relocatePiece(S.pos)` 直接定位，不播跳格動畫。
- `styles.css`：新增 `--warm`／`--warm-dark`／`--wood`；`.board3d` 改木質漸層外框＋內高光和陰影；`body.busy` 讓按鈕變淡、`cursor: wait`；`.dice-badge` 樣式；`prefers-reduced-motion` 全域壓動畫。

**驗證過什麼**（headless chromium + playwright，`--use-gl=swiftshader`；`http://localhost:4181`，seed `demo-1109`；腳本 `pw/verify-art-dice.js`）

1. 三個情境各**玩完整局**：擲骰 13 次、位置 24/24、結局「穩健的學術旅人」、**console error 0**
   - `desktop` 1280×800（3D）
   - `mobile375` 375×720 dpr2（3D）
   - `reduced-2d`（`prefers-reduced-motion: reduce`，正確退回 2D：`#board3d` hidden、`#board` 在）
2. **骰子點數一致性：每情境 13 次逐次比對「骰子停住的點數 vs 行程紀錄『擲出 X』」，13/13 全 OK（共 39 次）**。3D 用 `__dieTargetValue`（起手）＋`__dieSettledValue`（落地那一刻寫入）比對；2D 用 `.dice-badge` 文字比對。
3. **「提前規劃」驗過**：開局第一擲改按 `[data-face="2"]`，骰子停在 2、行程紀錄「擲出 2」、道具耗掉；三個情境都驗。（上一版驗證是在遊戲結束後才按，`roll()` 直接 return，等於假通過，已改到開局第一擲。）
4. **動畫期間不能連按**：截圖可見 `.roll` 與道具鈕變淡（`body.busy`），腳本對 disabled 按鈕 `click()` 無效、必須等動畫結束才推得下去。
5. **Task 8 結果框仍在**：骰子動畫中途的截圖看得到上一輪結果框與「精力 −2／學術收穫 +1」標籤。
6. `node --check`：`src/app.js`、`src/engine.js`、`src/render.js`、`src/board3d.js`、`src/storage.js`、`server.mjs` 全過（PowerShell 一檔一檔跑）。
7. `git diff main --stat` 只有 `src/app.js`、`src/board3d.js`、`src/render.js`、`styles.css`（＋這份交接檔），**不含 `src/engine.js`**。
8. 截圖（`pw/shots/`）：`desktop-1-start/2-end/3-plan/roll-mid/roll-settle`、`mobile375-*`、`reduced-2d-*`。骰子動畫中途截圖清楚可見白底黑點骰子在棋盤中央翻滾。

**沒驗證什麼**

- **院內電腦、筆電、投影機、手機實機效能**：驗證用 headless chromium 是 swiftshader 軟體渲染。老實說在 swiftshader 下**首幀要 2–4 秒才畫出來**（編譯 shader），骰子動畫也會被渲染拖住、實際不到 1 秒就跳到尾段。實機有 GPU 應該正常，但**沒在實機跑過**，請 Jean 開 `start-game.cmd` 親眼看流暢度與動畫速度。
- **真鼠標／觸控操作**、鍵盤 Tab／focus 順序：验证都用 `element.click()`。
- **動畫手感**：骰子 1 秒、跳格 260ms＋60ms 停頓是我挑的，太快太慢要 Jean 回饋再調。
- **骰子每次落地朝向**：偏航角用計數器不是隨機，同一格連續擲會看到相似朝向（要更自然可改成用 engine 的骰值派生，但不能引入隨機）。
- 重新整理讀檔後的情況（設計上這時不顯示徽章與結果框）。
- three.js 自家測試沒跑；`vendor/` 那两个檔是 v0.180.0 MIT，Task 7 已載明來源。

驗收：
- ✅ seed `demo-1109` 玩完一局、console 0 錯誤（桌機、手機 375、2D 退回三情境）。
- ✅ 骰子點數與行程紀錄完全一致 39 次，含三次「提前規劃」指定 2。
- ✅ 桌機與 375 寬截圖；減少動態效果退回 2D 並顯示「擲出 X」。
- ✅ 每個 js 檔 `node --check` 通過；`git diff main` 不含 `src/engine.js`。
- ✅ 只在 `feature/3d-art-dice` commit；**push 與合併 `main` 等 Jean 明說**。

### Task 10：桌遊式棋盤與固定鏡頭（2026-10-30，分支 `feature/board-look`）
Jean 在 1280 寬螢幕試玩後反映：畫面歪掉、四邊被切掉、格子很無趣。原因有三個：
1. 原本鏡頭會跟著棋子左右移動，所以畫面看起來歪的。
2. 每邊 6 格平均排開，相鄰兩邊轉角的格子會互相重疊。
3. 卡面貼圖貼在方塊的六個面上，字在側面又出現一次。

改法（`src/board3d.js`）：
- 改成大富翁式的排法：四個角落正好是里程碑 6／12／18／24，做成正方形的大格；每邊中間 5 格是長方形卡片格，格子之間留細縫。
- 卡面：米白卡底，上方是章節色帶（章節圖示＋號碼），中間是標籤，底部有機會／命運／路線的彩色標籤。角落格是深色底、金框、大圖示，標「必停」；第 24 格標「起點／終點」。只有頂面貼卡面，側面用章節深色。
- 出發時棋子站在第 24 格的角落，不再站在棋盤外面。
- 鏡頭固定不跟著棋子移動，依畫面比例自動算距離，整個棋盤一定框得進來。遠近可調 `CAM_FIT`，數字越小越近。

沒選：保留鏡頭跟隨，只修重疊的問題。理由：會跟隨的鏡頭在寬螢幕上就是「歪掉」的來源，固定鏡頭比較穩，也比較好讀字。

- 驗證過：1280×860 和手機 375 寬，整個棋盤都完整、沒被切掉；擲一次骰子，骰子停在 1，棋子跳到第 1 格；console 沒有錯誤。
- 沒驗證：整局玩完、骰子停在 2／3 時的畫面、角落格的 emoji 在院內電腦（Windows 字型）以外的裝置上長怎樣。

### Task 11：玩家可以自己轉動鏡頭（2026-10-30，分支 `feature/camera-orbit`）
Jean 希望能像參考的手術室遊戲那樣自己轉動視角。做法：在 `src/board3d.js` 自己寫簡單的環繞鏡頭（three.js 的 OrbitControls 不在 `vendor/` 裡，所以不另外加檔案）：
- 滑鼠或單指拖曳：左右轉動、上下調整仰角（28°–86°）。
- 滾輪或雙指捏合：縮放（0.55–1.5 倍）。
- 雙擊棋盤或按右上角「回正視角」：回到預設角度。
- 不會自動旋轉，避免玩家讀格子上的字時畫面一直在動。

注意：棋盤上設了 `touch-action: none`，在手機上手指放在棋盤上時，頁面不會跟著捲動，要從棋盤以外的地方滑動。

- 驗證過：1280 寬拖曳可以轉動、「回正視角」會回到預設角度，console 沒有錯誤。
- 沒驗證：手機實機的單指轉動和雙指縮放（只在桌機模擬過）、轉到背面時文字是倒的（設計上就會這樣）。

### Task 12：骰子朝上的點數和實際步數不符（2026-10-30，分支 `fix/dice-face`）
Jean 試玩發現骰面和棋子走的步數看不出關聯。步數由 engine 決定，本來就正確；錯的是 `orientationFor` 的旋轉順序（`premultiply` 寫反），偏航把骰面轉開了。數值計算（每個點數 200 次，共 600 次）：舊寫法 404 次點數不符、567 次停下時是歪的；新寫法都是 0。

`window.__dieSettledValue` 原本只是把目標點數寫回去，永遠顯示正確，所以之前沒抓到；現在改成從骰子實際朝向算出。

**驗證過：** `node --test test/dice.test.js` 通過，改回舊寫法會失敗；`npm run check` 通過；瀏覽器 1400×900 實際擲 4 次（1、3、2、1），朝向算出的點數都等於目標、行程紀錄步數一致、console 沒有錯誤；3 和 2 的截圖肉眼確認。
**沒驗證：** 點數 1 的截圖解析度不足，側面的點也看得到，肉眼無法確定（由數值與朝向計算確認）；手機版的骰子畫面；真人是否看得清楚。
**已知觀察：** 預設鏡頭下骰子側面也看得到，玩家可能讀錯面，還沒處理。

**骰子落地（同一天，Jean 反映懸空會讓人有疑慮）：** 原本骰子停在桌面上方並放大。改成從上方落下、彈跳兩次，翻完後貼在中央桌板（`BOARD_TOP_Y`），停 0.8 秒後在原地縮小收掉；高度依目前朝向計算最低的角（`dieRestY`），翻滾時不會穿進桌板。`test/dice.test.js` 多一項貼合測試（200 種朝向），2 項全過。瀏覽器 1400×900 實擲 2 次：截圖看得到骰子貼在桌板上，點數 1 和 3 的朝上面都正確、console 沒有錯誤。**沒驗證：** 彈跳過程的流暢度（只看停下後的截圖）、手機版、真人觀感。瀏覽器窗格隱藏時動畫會暫停，自動化測試要留意。

### Task 13：骰子在桌布中間、點骰子就擲、結果置中跳出（2026-10-30，分支 `feature/center-dialog`，疊在 `fix/dice-face` 上）
Jean 反映要上下捲動才能在棋盤和按鈕、結果之間來回。Jean 決定：骰子放桌布中間、點骰子就擲、不要擲骰按鈕；結果在畫面正中間跳出。

做法與取捨：
- 3D 模式骰子常駐桌布中間，點骰子擲骰（球形判定放寬範圍）；拖曳超過 6px 算轉鏡頭，不算點擊。
- 事件、結果、結局全部放進原生 `<dialog>`，選完後按「繼續」才回到棋盤；事件必須選擇，Esc 不會關閉。
- 擲骰按鈕保留給鍵盤（取得焦點才看得到）；2D 模式沒有骰子可點，仍正常顯示。

**驗證過：** 1400×900 與 375×812 實際點骰子擲骰並跳出視窗，桌機視窗中心就在畫面中心；375×812 用腳本玩完一局 13 次擲骰到結局視窗（穩健的學術旅人）、「再玩一次」可重開；拖曳不會擲骰；console 沒有錯誤。實測抓到並修正「繼續」按鈕被當成擲骰的 bug。
**有疑問：** 第一輪腳本用固定 1.05 秒讀取，回報 10 次擲骰有 4 次點數不符；改成等落定才比對後，10 次（第一局最後 3 次、第二局 7 次）都相符，推測是讀取時機太早，**成因未完全確認**。
**沒驗證：** 真實手機觸控、實際鍵盤操作、2D 模式與減少動態效果的跳出視窗、真人覺得順不順。
**已知限制：** 事件視窗開著時不能按工具列的「重新開始」，要先做選擇；手機上「提前規劃」的指定點數仍在棋盤下方。

### Task 14：共用美術逐張製作及導入（2026-10-30，`codex/game-art`）

Jean 否定低彩度的資訊介面提案，採納鮮豔卡通 3D 桌遊概念並授權實作。**本輪不做個別機會／命運事件卡圖片**。

- 六張共用圖已逐張以內建 image_gen 製作並接入：旅行世界背景、中央廣場地圖、旅人透明頭像、黑貓透明旅伴、四章 2×2 圖集、資源/道具 3×3 圖集。WebP 合計約 0.95 MB，放在 `assets/art/`，提示詞在該資料夾 README。
- `src/art.js` 管理路徑與需要畫進 3D 的預載；`src/scene-art.js` 建立圖像棋格、廣場貼圖、真正 3D 的航廈/會場/小飛機/樹/海報架。骰子中央保留可點擊空間。
- `game-art.css`、`index.html`、`render.js` 改成浮動 HUD；紀錄/設定收合；被動道具明示自動生效，任意門查詢尚未開放（不擅自補網址）。個別事件仍是文字選擇，里程碑共用章節圖像。
- 點中央骰子、骰面 1/1/2/2/3/3、棋子跳格、置中 dialog、原本選項與結局保留；`engine.js`、`data/` 沒改。
- 新版預覽 `http://localhost:4195/`。原 4193 與原測試工作目錄沒改。以後接續前先 Gate 0，確認不要跑到舊 `feat/engine-tests` 或在正在服務的目錄切分支。
- 驗證：`npm test` 的素材/骰子 3 項及 `npm run check` 通過；桌機與 375px 截圖已檢查。桌機 3D／手機尺寸 3D／減少動態效果 2D 各完整玩一局，都是 13 擲、24/24、相同結局與資源；26 次 3D 骰面一致。另以真正滑鼠測拖曳不誤擲骰與回正，三情境的鍵盤擲骰/選擇/繼續通過、錯誤 0。詳細含失敗與修正記錄見 [art-direction.md](art-direction.md)；不得沿用先前 1,000 局數字作為本分支驗證。
- 未驗證：真實手機 GPU/觸控、院內機器/投影機、Safari、真人喜好。本輪不調結局平衡。

下一步先讓 Jean 在新版預覽試玩，依回饋調大小/視覺重心；之後另開任務補個別事件插畫，不要把本輪共用素材誤當成已完成 24 張事件圖。

### Task 15：棋盤文字清晰度（2026-10-31）

Jean 反映棋盤字不清楚。已放大貼圖主標、改白底深藍字，印刷頂面不受強光/色調映射沖淡；場景原光影保留。桌機指向／手機輕點格子，顯示 23px／20px 的大字名稱與格號章節；不消耗回合，拖曳/縮放/回正收起。當前格、道具與 2D 標籤同步加大。玩法與素材圖片不變。

驗證：npm 的 3 項測試、語法檢查通過；桌機、375px 觸控模擬及 2D 備援的提示/拖曳/骰子/選擇/繼續通過，無水平溢出與 pageerror。沒有重跑整局，真實手機/投影機未驗。詳見 [art-direction.md](art-direction.md) 文末。預覽仍在 4195，重新整理可見。

### Task 16：事件擴充到 36 張（2026-11-01）

Jean 要求更多腳本，已新增 12 張：T05–T11、S04b 是既有心得候選的 8 張真實改編；G01–G04 為原創，不加 trueStory。沒有做個別事件圖片，也未另外網搜。來源對照與改編界線在 [report-cases.md](report-cases.md) 第二批紀錄。

補齊 S04 → S04b 原本不存在的口報後續，加前情旗標避免提前抽到；T10/G03 可觸發原本交流/名片與合作種子。engine 只補 pendingEvent.deck，修正介面將機會/命運誤認為里程碑的識別資料遺漏；沒有改抽牌、資源或結局門檻。

新增 `test/events.test.js`：卡片完整性、連鎖、seed 重現、1,000 局可達性/路線/資源檢查。總計 6 項測試通過；1,000 局死局 0、36 張皆可抽到、平均 13.287 擲。結局 steady 681、stage 222、wild 94、safe 3，safe 偏少尚未解決。真人試玩與完整瀏覽器走局未驗。原引擎測試分支仍獨立，不要將本批測試誤當成 Task 1–2 已全面完成。

### Task 17：引擎測試與結局平衡（Task 1、2，2026-11-02，分支 `fix/engine-tests-balance`）
- 新增 `test/engine.test.js`、`scripts/simulate.mjs`（`node scripts/simulate.mjs 1000` 可印分布）。
- 修 `drawCard` 會改到傳入 state、`isEligible` 章節判斷讀錯物件；新增 `strain` 計數。
- 結局改多面向計分（plan D14）：1,000 局 stage 158、steady 366、wild 285、safe 191。

**驗證過：** `npm test` 31 項全過、`npm run check` 通過、1,000 局死局 0。**沒驗證：** 瀏覽器實際走到新結局、真人選擇下的分布。舊工作目錄 `D:\Git\Game\roll-abroad` 的未提交修改仍在，已複製到這條分支；要清理須先問 Jean。

### Task 18：棋盤建築改 Blender 建模匯出 GLB（2026-11-02，分支 `feature/board-buildings`，已合併 `main` `62dd4f5` 並 push）

Jean 認為棋盤上的 box 合成建築「太醜」，給了桌遊風格參考圖，指定兩棟都重畫：左邊「出發航廈」（奶油牆＋藍玻璃桶頂＋金拱＋航情塔＋布旗＋行李箱）、右邊「國際會場」（紫穹頂＋鼓座玻璃帶＋四柱門廊＋三角楣＋紫布旗＋紫地毯）。這是美術修正，`src/engine.js` 不動、不新增玩法。

- Blender 5.2 建模，材質前綴 `RA_`／`RA_V_`、物件前綴 `RA_APT_`／`RA_VEN_`，分放 `RA_Airport`、`RA_Venue` collection（場景裡別人的 HQ／店面／雪人模型不動）。
- 建模腳本放 `tools/blender/build-airport.py`、`build-venue.py`，視為 GLB 的原始碼：改造型改腳本重跑（`runpy.run_path(...)`），不要手動補網格。腳本自己清掉舊物件、併網格、歸零、渲染三張檢查圖到暫存目錄、再匯出。
- 匯出前套用修改器、按材質 join 成單一 mesh、座標歸零（底座中心為原點、底部 z=0、面向 −Y，匯出後正面朝 +Z）：`assets/art/airport-terminal.glb` 與 `assets/art/international-venue.glb`（第三版後：航廈 557 KB／8,336 tris／17 材質，會場 1,043 KB／16,640 tris／17 材質，均 x ±1.3 內、z 0..2.3/2.6）。渲染時模型暫時 park 到 y=90，避免同一 Blender 檔裡別人的模型入鏡，場景相機渲完還原。
- 第二版依 Jean 重貼的參考圖補回細節：會場加金線地球儀頂飾、屋頂四旗、半圓拱玻璃帷幕＋依拱圓裁短的金格線、立面牆與玻璃雙開門（門不懸空）、紫吊旗白地球 V 下緣、兩側拱窗、兩階紫地毯金邊、圓錐修頂樹＋繡球花；航廈改粗短管制塔（寬玻璃艙＋金簷）、金底白飛機標誌（原本誤做玻璃底）、綠籬帶加黃花、立面金橫桿布旗、行李箱與陶盆。
- 執行時載入走新 vendor 的 `vendor/GLTFLoader.js`＋`vendor/BufferGeometryUtils.js`（three 0.180.0 同版本 MIT，import 已改指 `./three.module.js`；不連 npm、不連 CDN）。
- `src/scene-art.js` 移除兩處 box 合成建築與「出發航廈」「國際會場」招牌，改 `addBuildings(city)` 用 `BUILDINGS` 清單非同步載入，擺位 x ∓1.55、z −1.98，scale 逐棟設定（航廈 .88、會場 .78，Jean 說「機場建築再大一點點」後把航廈由 .78 調大）；載入失敗留空不擋遊戲。小飛機、樹、海報架維持原樣。
- `server.mjs` 補 `.glb`／`.gltf` MIME；`npm run check-vendor` 納入兩個新 vendor 檔。
- 第三版依 Jean 回饋「門窗不夠精緻、有貼面上去的模型感」重做門窗：牆上 boolean 開真洞（切口放 `RA_VenueCut`／`RA_AptCut`，不進模型）、暗色室內 `Interior` 退 9 cm、玻璃退 3 cm、石框／窗台／滴水線／拱心石／拱罩突出 5~8 cm、門扇退進洞內＋門框壁燈突出。`window()` 做成兩支腳本共用的分層組件（暗部→玻璃→框→線腳）。
- 同輪修造型：會場拱後暗部改同形淺碟（方板會露黑角）、金格線依拱圓收斂、柱身加凹槽、簷口加齒飾、立面加壁燈與告示板、花圃改窗下矮槽；航廈屋頂由整片金改奶油屋面＋金壓邊＋屋頂設備／通風管／採光罩，屋脊改採光帶、雷達加支柱與碗、通風柵移到翼樓正面、綠籬壓低不擋玻璃、出發牌改箭頭。金色材質佔比因此下降（會場 50.4%→32.9%、航廈 54.7%→40.4% 三角面）。
- 接觸陰影不做進模型：`board3d.js` 已有 `PCFSoftShadowMap`，真陰影比較自然。

**驗證過（第三版）：** `npm test` 31 項全過、`npm run check`／`check-vendor` 通過；`verify-glb.mjs`／`tris-by-material.mjs` 量測兩棟 bbox 歸零正確（底部 y=0）、金色三角面佔比降至 32.9%／40.4%；Blender 渲染 5 視角（含俯角）確認門窗有暗部層次、無飄件／黑角／z-fighting；playwright 開 http://localhost:4191 無 console error、無 4xx，實際畫面兩棟造型可讀（單棟約 115×115 px），像素差分量得螢幕佔地約 1.3~1.8%。**沒驗證：** 真實 GPU 的 FPS（headless 軟體渲染約 10 FPS，不代表實機）、投影機與手機實際視覺、真人對精緻度的意見、金色佔比再降與兩棟高度錯開的效果。

## Acceptance Criteria

- `npm test`（或 `node --test`）全部通過，包括 1,000 局模擬：死局 0、每張卡都抽得到、四種結局都會出現。
- 手機寬 375 能玩完一局；鍵盤可以操作；支援減少動態效果。
- 展示模式 3 分鐘內走完。
- 試玩至少 5 人，其中至少 3 人想再玩。

## Do Not Change

- `src/engine.js` 不能引入 DOM 或瀏覽器 API。
- 不加 npm 套件或建置工具；不連外部 API；不收姓名。three.js 只能以放進 `vendor/` 的單一檔案引入（plan D10）。
- 《公文旅行》repo 先放著。任意門的 `main` 不要動，除非 Jean 明說。
- 不把 repo 改成公開、不開 Pages，除非 Jean 同意。

## Open Questions

1. 試玩的 5 位同仁是誰，在哪裡試玩（院內電腦或手機）？
2. 結局要維持「單看學術收穫」，還是改成多面向計分？
3. 黑客松的評分表與 demo 時間限制（還沒拿到）。
4. 美術要自繪 SVG，還是用 GPT 插圖？
5. 棋盤建築與旅人棋子的參考圖 PNG 要不要放進 repo（建議 `docs/ref/`）當美術 SSOT？現在圖只在對話裡，下次重建 GLB 沒有依據（Task 18、20）。
6. 網站已公開上線（plan D16），repo 也改 public：`docs/` 的院內流程紀錄對外人可讀，要不要把部分文件移出發佈範圍以外的資料夾或改寫？

## Review Notes

- 雛形 `c5dfa48` 和 plan 的差異：資源名稱是 `time／money／energy／knowledge`，plan 寫的是 `budget／insight`，**以程式為準**；卡片 20 張（plan 是 24 張）；沒有 `test/`；沒有展示模式。
- 模擬腳本暫時放在 Claude 的暫存資料夾，**沒有進 repo**；做 Task 1 時改寫成 `test/simulate.test.js`。腳本只用「隨機選項」模擬，不代表真人玩家的選擇分布。
- **沒驗證**：畫面是否正常（沒有開瀏覽器看）、手機版、實際一局的分鐘數、真人覺不覺得好玩。

## Handoff Status

In Progress
