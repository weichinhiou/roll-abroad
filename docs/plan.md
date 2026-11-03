# 大赴翁 Roll Abroad：開發計畫

> 建立：2026-10-29。來源包括：Jean 的構想、ChatGPT 的 Creative GDD v0.1（2026-10-28，1,361 行，下稱 GDD）、JJ 的評審團分析（`J:\Git\jj-agent-core\100_Todo\drafts\ai-dev\2026-10-29_roll-abroad-plan.md`；這台的 `D:\Git\jj-agent-core` clone 沒有 `100_Todo`，草稿在隨身碟工作區）。
> 本文件是範圍與決定的 SSOT；GDD 是創意素材庫，不是必做清單。

## 1. 已定案的決定

| # | 決定 | 沒選 | 為什麼 | 決定者／日期 |
|---|---|---|---|---|
| D1 | 名稱定為《大赴翁》Roll Abroad，repo 名稱 `roll-abroad` | Borderless Quest、study-abroad-board-game 等 | 和大富翁同音，一看就知道玩法；「赴」代表赴會。「大富翁」據 JJ 所知是註冊商標，但**沒有實際查證** | Jean，10/28–10/29 |
| D2 | 另開 repo，做成靜態網頁、部署在 GitHub Pages，任務實驗室外連 | 做進任意門（GDD §12 的 Next.js 方案） | 和其他遊戲一致；零依賴；不碰登入與 Gemini 額度 | Jean，10/28 |
| D3 | 這款為主；《公文旅行》（`subsidy-life-game`）為輔，只借用它已核對的規則內容，不合併程式 | 把公文旅行改造成大富翁 | 兩款的玩法結構不同：一個是選管道解謎，一個是擲骰旅程 | Jean，10/29 |
| D4 | **壁報、口報兩條路線都做** | 只做一條 | Jean 想兩條都走。做法是共用大部分卡片，每條路線另外加少量專屬卡 | Jean，10/29 |
| D5 | 公開版不放金額與處罰細節，精確規則導向任意門 | 遊戲裡直接寫數字 | GitHub Pages 是公開網站；數字也會過期 | Jean，10/29 |
| D6 | 規則卡**不另外找承辦人審** | 先給承辦人看過 | Jean 決定。風險由 D5 降低：只寫概念，而且來源是公文旅行已經對照過任意門文件的規則（那些規則 Jean 曾在 2026-09-19 逐項確認） | Jean，10/29 |
| D7 | 期限是 **2026-11-09 黑客松**；同時在 KIDE 的報告中提到這款遊戲已經放進任務實驗室 | — | — | Jean，10/29 |
| D8 | 計畫文件放在本 repo，不寫進任意門 | 寫進任意門的 `docs/features/` | Jean：「獨立出來」 | Jean，10/29 |
| D9 | MVP 事件卡做 24 張，不做 GDD 的 40 張 | 40 張 | 11 天內做不完，品質優先 | JJ 建議，Jean 採納 PLAN |
| D10 | 棋盤畫面改成 **3D 環形桌面**（棋子繞著方形棋盤走），參考 `https://tmuh.ai/u/jc2jc/or-game-3d/` 的感覺；**規則不變**，仍是 24 格走完一圈結束。只換 `render.js` 的棋盤那一層，engine 不動。three.js 下載固定版本放進 repo（`vendor/`），不在執行時連 CDN；WebGL 不可用或「減少動態效果」時退回 2D 棋盤。交給院內 OpenCode 實作（任務見 [AI_HANDOFF.md](AI_HANDOFF.md) Task 7） | 規則一起改成可以跑很多圈；維持 2D SVG | Jean 覺得 3D 跑圈比較有趣；只改畫面可以沿用 engine 與 1,000 局模擬結果，不動 MVP 範圍。參考網站只當風格參考，不複製它的程式或素材 | Jean，10/30 |

### D11：鮮豔卡通共用美術（Jean，2026-10-30）

Jean 採納鮮豔卡通 3D 桌遊概念，授權 Codex 從美術設計開始逐張製作並導入共用圖片。先做旅行世界、中央廣場、旅人、黑貓、四章圖集、資源/道具圖集；**先不做個別機會／命運事件圖片**。原規則、24 格、點中央骰子互動不變。圖片存本地 `assets/art/`，搭配真正的 three.js 棋盤與簡單旅行模型；不在執行時連生圖 API 或圖床。

沒選：低彩度登機證式資訊介面（Jean 認為不夠鮮豔、缺少遊戲感）；用整張概念圖取代可互動棋盤；逐格做完整模型。原因與素材/測試紀錄見 [art-direction.md](art-direction.md)。此決定屬美術層，不新增道具、NPC 關係或玩法。

### D13：`codex/game-art` 定為唯一主線，凍結新功能（Jean，2026-11-02）

試玩與 11/9 黑客松時程很緊，且當時 `main`、`feature/center-dialog`、`codex/game-art`、未提交的 `feat/engine-tests` 並存，容易看錯版本。之後所有工具都從主線接續，只修 bug、測試、平衡與試玩回饋；新功能先不做。沒選：回到 `main` 重做或挑部分美術（主線已完整包含骰子修正與置中視窗）。`main` 尚未更新，合併前要 Jean 試玩確認並先打 checkpoint。

### D14：結局改成多面向計分（JJ 建議，Jean 同意凍結與修復計畫時一併進行、未逐項表態，可再改，2026-11-02）

順序：學術收穫 ≥13 且最低資源 ≥3 → stage；中途資源耗盡過或最低資源 ≤1 → wild；收穫 ≤9 → safe；其餘 steady。1,000 局隨機選項（36 張卡）：stage 158、steady 366、wild 285、safe 191。沒選：只看學術收穫（24 張時試算 safe 仍約 6%，且「高張力」只代表收穫中等）。隨機選項不代表真人選擇，分布要由試玩再確認。

### D15：棋盤建築改 Blender 建模匯出 GLB（Jean 指定，2026-11-02）

Jean 認為 box 合成的建築「太醜」，給桌遊風格參考圖指定兩棟都重畫：左邊「出發航廈」（奶油牆＋藍玻璃桶頂＋金拱＋航情塔）、右邊「國際會場」（紫穹頂＋四柱門廊＋三角楣）。技術做法：Blender 建模 → 按材質併網格 → 匯出 `assets/art/airport-terminal.glb` 與 `assets/art/international-venue.glb` → 用 vendored `GLTFLoader.js`（three 0.180.0 同版本，MIT，import 改指 `vendor/three.module.js`）載入，替換 `scene-art.js` 的 box 合成建築與兩塊建築招牌。屬美術修正：`src/engine.js` 不動、無新玩法、執行時不連任何外部服務。沒選：把 Blender 模型逐件轉成程式化 three.js 程式碼（維護成本高、造型出不來）；直接把參考圖當貼圖（plan D11 明確禁止用整張圖冒充模型）。第三輪依「門窗像貼上去」的回饋改真開窗：牆上 boolean 開洞＋暗部退後＋框料突出（去貼面感的關鍵），屋頂俯角面補層次，金色三角面佔比降到 33~40%。詳見 [AI_HANDOFF.md](AI_HANDOFF.md) Task 18。

**v1 後的修正（同日，Jean 檢討「細節很多不見了 比如地球」）**：兩棟整棟重建、不打補丁，建模腳本 `tools/blender/build-airport.py`／`build-venue.py` 進 repo 當 GLB 的原始碼（改造型改腳本重跑，GLB 是產物）。參考圖是造型唯一依據，但**圖本身還沒進 repo**，需 Jean 放進 `docs/`（否則下次重建沒有依據）。

### D16：網站部署到 GitHub Pages（Jean 同意，2026-11-02）

`push` 到 `main` 由 `.github/workflows/deploy.yml` 發佈到 <https://weichinhiou.github.io/roll-abroad/>。發佈檔只有遊戲執行需要的 `index.html`、`styles.css`、`game-art.css`、`src/`、`data/`、`vendor/`、`assets/art/*.webp|*.glb`；`docs/`、`tools/`、`test/` 不進網站（避免院內流程紀錄變成網站內容）。代價：免費方案不支援 private repo 開 Pages，**repo 因此改成 public**，`docs/` 與建模腳本對外人可讀。沒選：院內伺服器部署（要有 web 空間與上傳權限）、升級 GitHub Pro 維持 private。驗證：Actions run `success`、線上 `index.html`／`src/*.js`／兩個 `.glb`（`model/gltf-binary`）／`webp`／`data/*.json` 都回 200、`docs/` 回 404，playwright 開線上站 console 錯誤 0、無 4xx。

### D17：玩家棋子改 Blender 建模的旅人 GLB（Jean 給插畫，2026-11-03）

玩家棋子由 three.js box 合成改成 `assets/art/traveler.glb`（建模腳本 `tools/blender/build-traveler.py`，造型依 Jean 給的旅人插畫）。模型切成 `RA_TravelerBody`／`RA_TravelerHead`（脖子為原點）／`RA_TravelerCase`（行李箱，箱中心為原點）三節點，`board3d.js` 才能做 idle 左右看與跳格時箱子拖後；GLB 載入失敗留 box 棋子當備援。屬美術修正，`src/engine.js` 不動、無新玩法、執行時不連外部服務。沒選：繼續用 box 合成加貼圖（plan D11 禁止用整張圖冒充模型）、把棋子做成骨架動畫（多餘，遊戲只有跳格與 idle）。代價：多一個 266 KB GLB，以及「參考圖仍不在 repo」。詳見 [AI_HANDOFF.md](AI_HANDOFF.md) Task 20、[art-direction.md](art-direction.md)「旅人棋子」。

## 2. 遊戲設計（MVP）

**2026-11-01 範圍更新（D12，Jean 要求）**：事件由 D9 的 24 張擴充為 36 張，新增 8 張既有心得候選改編與 4 張原創。只擴充腳本，不增加個別事件插圖；來源對照、連鎖修補與測試見 [report-cases.md](report-cases.md) 第二批紀錄。以下早期 24 張分配保留為歷史設計，不再代表目前實際張數。

- **棋盤**：24 格，外觀是四邊的環形棋盤，走完一圈就結束。四章分別是投稿（1–6）、出國準備（7–12）、國際會議（13–18）、返國（19–24）。第 6、12、18、24 格是里程碑，必須停下（防跳關，見 GDD §4.3）。
- **骰子**：每次走 1–3 步（骰面是 1/1/2/2/3/3），每局約 10–15 次擲骰（之後用模擬測試確認）。
- **資源**：時間、經費、精力的初始值都是 8（範圍 0–10）；學術收穫從 0 開始。這些都是遊戲點數，不是真實金額。
- **卡堆**：畫面上分成「機會」（學術機遇、幽默）、「命運」（突發危機、情境抉擇），加上固定的「關卡」（里程碑、行政）。程式內部沿用 GDD 的六種事件類型與 `tone`／`source_type` 欄位。
- **道具（5 種，Jean 的點子）**：提前規劃（指定骰子點數）、承辦人諮詢（免一次行政懲罰）、任意門（查規則，連到任意門）、備份隨身碟（簡報或壁報檔出問題時不受罰）、名片（交流事件的收穫加倍）。
- **卡片**：共 24 張，其中共用 20 張、壁報專屬 2 張、口報專屬 2 張。語氣大約是 18 張真實、5 張幽默、1 張奇幻。從 GDD §7 挑選，優先用附錄 B 的 12 張。
- **故事鏈**：2 條。S03 壁報失蹤（壁報線）／S04 口報的八分鐘（口報線），以及 S02 合作種子（兩條線共用）。
- **結局**：4 種稱號，並回顧本局的 3 個關鍵抉擇。
- **展示模式**：固定 seed，約 3 分鐘走完精華，給黑客松評審看。
- **存檔**：localStorage 存一局進度，可以重新開始。

**不做**（GDD §14、§16.3 以後的內容）：多人、AI 即時生成、登入、資料庫、40 張以上的卡、進修與純參會路線、集章冊、NPC 關係。

## 3. 架構

```
index.html
src/engine.js    純函式：擲骰(seed)、移動＋防跳關、適用條件、抽卡、效果、道具、連鎖排程、結算
src/app.js       狀態流程：intro → ready → moving → event/checkpoint → result
src/render.js    DOM 棋盤（2D 備援）、資源列、事件卡、黑貓回饋
src/board3d.js   3D 棋盤（three.js，D10）
vendor/          three.js 固定版本（D10）
src/storage.js   localStorage
data/board.json  24 格
data/events.json 事件卡（沿用 GDD §12.4 的格式，加 deck: chance|fate|milestone）
data/items.json  道具
test/*.test.js   node --test：單元測試＋1,000 局模擬
```

## 4. 時程（10/29 四 → 11/9 一）

| 日期 | 工作 | 完成標準 |
|---|---|---|
| 10/29–10/31 | engine＋測試；12 張卡；純文字版可以從頭玩到尾 | 1,000 局模擬：死局 0、每張卡都抽得到 |
| 11/2–11/3 | 找 5 位同仁試玩，並依回饋修改 | 至少 3 人想再玩；能說出一個「為什麼這樣選」 |
| 11/3–11/5 | SVG 棋盤、事件卡 UI、道具、兩條路線、補到 24 張卡、4 個結局 | 手機 375 寬能玩完一局 |
| 11/6–11/7 | 黑貓表情、章節插圖、OG 分享圖、展示模式；建立 GitHub repo 並部署 Pages（需 Jean 同意）；在任意門的任務實驗室加卡片（需 Jean 說 push） | 正式網址可以玩 |
| 11/8 | 緩衝、demo 預演、簡報 | 3 分鐘 demo 跑得順 |

## 5. 驗收與指標

- 自動測試：防跳關、資源上下限、適用條件（口報線不會抽到壁報卡）、連鎖事件、seed 可以重現、1,000 局模擬。
- 手動檢查：手機與桌機、鍵盤操作、減少動態效果、文字不溢出。
- 試玩：前後測各 5 題、5 分量表（趣味、學習、清楚、重玩意願）。**不宣稱正式教育成效。**

## 6. 沒驗證／風險

- 11 天的時程很緊，試玩只能做一輪。
- 一局要玩多久、平均擲幾次骰子、資源平衡，目前都是估計。
- 「大富翁」的商標狀況沒有查。
- 心得報告改編的卡片，沒有問過原作者。
- 3D 棋盤（D10）在院內電腦、手機上的效能與 WebGL 支援都還沒測；黑客松現場若用院內電腦 demo，要先實機確認。
