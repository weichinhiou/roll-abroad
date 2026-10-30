# AI Handoff

> 更新：2026-10-30（台灣時間），Claude Code 加上 Task 7（3D 棋盤），對應 commit `4b044f9` 之後。前一版：2026-10-29 20:25，對應 `c5dfa48`。
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

### Task 7：3D 環形棋盤（plan D10，交給院內 OpenCode）
2026-10-30 Jean 決定：棋盤畫面改成 3D，棋子繞著方形棋盤走，感覺參考 https://tmuh.ai/u/jc2jc/or-game-3d/ （只參考風格，不複製它的程式或素材）。**規則不變**：24 格、走完一圈結束、里程碑 6／12／18／24 強制停。

做法：
1. 開新分支 `feature/3d-board`，從最新 `main` 開。
2. 下載 three.js 的固定版本（module 版）放進 `vendor/`，在檔案開頭註明版本與授權（MIT）；不在執行時連 CDN（院內網路與離線 demo 都要能跑）。
3. 新增 `src/board3d.js`：建立場景、把 `data/board.json` 的 24 格排成方形一圈（每邊 6 格，四章用不同顏色，里程碑格加高或加標記），放一顆棋子；對外只提供 `initBoard3d(container, board)` 和 `updateBoard3d(state)` 兩個函式。
4. 擲骰後棋子**一格一格跳過去**（不是瞬間移動），鏡頭略為跟著棋子；動畫結束後才顯示事件卡。這段等待的流程放在 `src/app.js`，`src/engine.js` 不動。
5. `src/render.js` 的 `renderBoard`：WebGL 可用且沒有開「減少動態效果」時用 3D，否則沿用現在的 2D 棋盤。
6. 手機 375 寬要能看到整個棋盤和事件卡；畫面不能擋住資源列和道具按鈕。

驗收：
- 用 `start-game.cmd`（http://localhost:4181）以 seed `demo-1109` 玩完一局，console 沒有錯誤。
- 桌機與手機寬度都截圖；在瀏覽器關掉 WebGL 或開啟減少動態效果時，確認會退回 2D。
- `node --check src/*.js` 通過；engine 的測試／模擬結果不變（engine 沒改，結果要一樣）。
- 在這份交接檔回報：驗證過什麼、沒驗證什麼（例如院內電腦的效能）。
- 完成後 commit 到 `feature/3d-board`；**push 和合併進 `main` 要等 Jean 明說**。

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
