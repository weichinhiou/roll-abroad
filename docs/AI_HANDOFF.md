# AI Handoff

> 更新：2026-10-30（台灣時間），Codex 加上 Task 14：鮮豔卡通共用美術（`codex/game-art`，基線 `256f5d6`，獨立 worktree，**未 push、未合併 main**）。Task 1–2 的未提交測試仍留在原工作目錄，不包含在這條美術分支。
> 換機器、換工具（Claude Code／Codex）或換 session 時，先讀這份，再讀 [plan.md](plan.md)。

## Project

《大赴翁》Roll Abroad：`D:\Git\Game\roll-abroad`，遠端 https://github.com/weichinhiou/roll-abroad （**目前是私人 repo**）。

## Goal

在 **2026-11-09 黑客松**前，做出可以展示的單人擲骰遊戲：24 格、四章、壁報與口報兩條路線、機會／命運卡、道具、結局，並且有 3 分鐘展示模式。之後在任意門的任務實驗室加上外連卡片（KIDE 報告也會提到這一點）。

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
| `src/engine.js` | `initialState`、`rollDie`／`forcedRoll`、`applyMove`（里程碑 6／12／18／24 強制停）、`isEligible`、`drawCard`（優先處理連鎖 `pending`）、`applyChoice`、`checkpointAt`、`settle`（四種結局寫死在檔案底部的 `data_endings`） |
| `src/app.js` | 狀態流程；預設 seed 是 `demo-1109`；存檔用 localStorage |
| `src/render.js`、`styles.css`、`index.html` | 畫面 |
| `data/board.json` | 24 格 |
| `data/events.json` | `{ cards: [...] }` 共 20 張，`deck` 是 chance／fate，`tone` 是 real／funny／fantasy；路線欄位的值有 `both`、`poster`、`oral`，以及連鎖用的 `mentor`、`network` |
| `data/checkpoints.json` | 里程碑：`route`（第一章選路線）、`gate` 等 |
| `data/items.json` | 5 種道具：plan、consult、door、usb（壁報線送）、badge（口報線送） |

## Tasks

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

## Review Notes

- 雛形 `c5dfa48` 和 plan 的差異：資源名稱是 `time／money／energy／knowledge`，plan 寫的是 `budget／insight`，**以程式為準**；卡片 20 張（plan 是 24 張）；沒有 `test/`；沒有展示模式。
- 模擬腳本暫時放在 Claude 的暫存資料夾，**沒有進 repo**；做 Task 1 時改寫成 `test/simulate.test.js`。腳本只用「隨機選項」模擬，不代表真人玩家的選擇分布。
- **沒驗證**：畫面是否正常（沒有開瀏覽器看）、手機版、實際一局的分鐘數、真人覺不覺得好玩。

## Handoff Status

In Progress
