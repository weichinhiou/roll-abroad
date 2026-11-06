# 大赴翁共用美術

2026-10-30，依 Jean 採納的鮮豔卡通概念稿製作，使用內建 **image_gen**。一張產出、檢視、轉為本機 WebP、導入後再做下一張。沒有使用 API/CLI 備援，也沒有複製參考作品素材。原始生成 PNG 留在製作機的 generated_images；本資料夾的 WebP 是正式可部署素材，不依賴原始路徑。

共同風格：原創 Q 版國際學術旅人、鮮豔的天空藍/陽光黃/珊瑚橘/青綠/紫、立體玩具質感、明亮日光。所有文字由介面繪製，素材不含姓名、年份、科別、真實會議或院內金額（唯一例外：上方章節掛牌把「第 N 章・章名」畫死在圖上，見下方條目）。

## 最終提示詞組（製作規格）

### travel-world.webp

Production game background, landscape 1536×1024. Vivid stylized 3D cartoon academic travel world, cyan ocean, sunny blue sky, green coastal islands, airport peninsula and glass conference hall at upper/outer edges, small white aircraft and fluffy clouds. Central 70 percent and lower middle must be calm open turquoise water, low contrast, reserved for a real interactive board rendered in code. No board, tiles, HUD, cards, people portraits, dice, lettering, logos or numbers. Original architecture only. Crisp polished toy forms and high color separation.

### travel-plaza.webp

Production square ground texture, strict orthographic top-down view. Rounded square campus plaza, warm ivory cobblestone, sunshine paving, green lawns, tiny flowerbeds, turquoise water channels and white bridges near edges. Clean open central plaza reserved for a real dice; back upper lots reserved for 3D airport and conference models. No buildings, people, dice, tile ring, HUD, lettering or baked perspective. Full-bleed square, bright stylized cartoon materials.

### traveler.webp

Single character bust on a genuinely transparent square background. Original friendly young-adult Taiwanese-looking researcher, warm brown eyes, fluffy short brown hair, cheerful confident smile, teal jacket, cream shirt, mustard-yellow backpack straps, blank conference badge. Slight three-quarter turn to viewer's right, holding backpack strap, same identity/colors as the adopted concept. Polished vivid 3D cartoon toy art, clear silhouette at 90px. Whole hair and shoulders inside canvas with safe margins. No frame, UI, lettering, colored background or extra characters.

### black-cat.webp

Single full-body sitting black cat mascot on genuine transparent background. Shiny charcoal fur, golden eyes, pink inner ears and nose, friendly mischievous smile, one paw raised, curled tail, sky-blue scarf, yellow blank luggage tag. Turn slightly toward viewer's left. Vivid 3D cartoon toy style matching traveler, clear silhouette at 64px, complete ears/paw/tail with safe transparent margins. No speech bubble, frame, lettering, numbers or scene.

### chapter-emblems.webp

One square atlas, exact 2×2 equal quadrants without gutters/margins. Original dimensional toy-like icons centered with safe internal padding, no text, numbers, logos or UI. Top-left: rolled research paper, blue pen, green checkmark on pale mint. Top-right: white airplane, blue passport and coral suitcase on pale blue. Bottom-left: microphone, golden podium, purple research poster on pale yellow. Bottom-right: completed reports, green checkmark, welcoming house roof on pale lavender. Each icon fills ~65% of its quadrant, no overlap across boundaries.

### hud-icons.webp

One square atlas, exact 3×3 equal cells, genuinely transparent background, no gutters/margins, no text or UI chrome. Nine centered vivid polished 3D toy icons with generous consistent padding: row 1 stopwatch, gold coins, green/yellow lightning bolt; row 2 purple graduation cap, blue calendar with orange tab, blue shield with a friendly adviser silhouette; row 3 turquoise open door, purple backup USB flash drive, coral business-card holder. Center positions align exactly to 1/6, 1/2, 5/6 on each axis. Icons never cross cells, readable at 24–40px.

### world-desktop.webp（桌機底板）

Jean 提供的原圖 `ChatGPT 圖像 2026年11月5日 下午12_36_20.png`（1672×941，2,661KB），非 image_gen 產出。轉檔：`tools/build-backgrounds.py`，WebP quality 78 → **180KB**。內容：學術港灣＋世界地標全景，中央水面低對比留給 3D 棋盤。掛在 `game-art.css` 的 `body` 背景，桌機與 ≥760px 版型共用。
（2026-11-05 第一次用的是 `學術港灣與世界地標全景.png`，同尺寸、WebP 172KB；同日被下面這張換掉。）

### world-mobile.webp（手機底板）

Jean 提供的原圖 `大學旅港水彩全景.png`（941×1672 直式，2,486KB），非 image_gen 產出。轉檔：`tools/build-backgrounds.py`，縮到寬 900（900×1599）、WebP quality 74 → **123KB**。掛在 `game-art.css` 的 `@media(max-width:759px)` body 背景段，`background-position:center top`（直式圖上方是港灣地標，下方大片低對比海面正好讓給 3D 棋盤）。

### 底板轉檔原則（兩張共用）

- **一律 WebP**：原 PNG 都 2.5MB 級，是整個網站最大的一檔，走 PNG 會拖慢首屏；WebP 壓到 120–180KB 級（壓縮率約 1/15）。品質桌機 78／手機 74，實測與原圖看不出差異（背景大面積漸層與海面最吃空間，78 以上差異肉眼不可辨）。
- 只縮不裁：桌機上限寬 1680（1366–1920 都靠 `background-size: cover` 裁切），手機上限寬 900（手機視窗 360–430、2 倍 dpr 夠用）。
- 沒做響應式兩張以上：本來桌機手機就各掛一張（同一 media query），再多切尺寸對這個畫面尺寸沒收益。
- 換圖重跑 `python tools/build-backgrounds.py [桌機原圖] [手機原圖]`。

### chapter-banner-1…5.webp ＋ chapter-banner-1…5-norope.webp（上方章節掛牌）

Jean 提供的五張去背 PNG（`Roll_Abroad_五章節_立體去背Banner.zip`，原檔留製作機 `Downloads`，不進 repo），非 image_gen 產出。取代原本用 CSS 畫的文字章節列。

- 轉檔腳本：`tools/build-chapter-banners.py`（改圖重跑這支即可）。依 alpha 找出實際範圍、裁掉透明邊，再用「每列不透明度覆蓋率」區分繩子（約 6%）與牌面（>60%）抓牌面頂邊，裁出無繩版；抓錯會直接報錯中止。
- `chapter-banner-N.webp`：含繩版（669–766 × 308–311），桌機與 760–1100px 版型用，掛牌從頁首垂下來。
- `chapter-banner-N-norope.webp`：手機用，從銅環上方 12px 處截斷（留一截繩頭，銅環才不会被切一半），高 222–225。WebP quality 92，十張共約 520KB。
- 圖裡的字是畫在圖上的（第一章・投稿…第五章・回院之後），所以 `alt` 由 `render.js` 寫入；清單與尺寸在 `src/art.js` 的 `CHAPTER_BANNERS`，尺寸同時是介面預留位置，改了要同步。
- 兩張圖由 `<picture>` 的 media query 挑，`src/render.js` 換章時一起換 `src`／`srcset`／`alt`；`src/app.js` 開局先預載十張，換章才不會閃白。

### brand-logo.webp（左上標題品牌 Logo）

Jean 提供的原圖 `大赴翁：Roll Abroad.png`（1536×1024 去背 RGBA，1,483KB），非 image_gen 產出。取代原本用 CSS 文字＋陰影畫的標題。轉檔：`tools/build-brand-logo.py`，依 alpha 裁掉透明邊（bbox 105,239→1422,828）、上限寬 900 → **900×403、105KB**，WebP quality 90（標題字要銳利，比底板抓高）。

- 圖裡有字（大赴翁／Roll Abroad），`alt` 給螢幕閱讀器；`index.html` 是 `<h1><img class="brand-logo">`——h1 留語意、圖當內容，CSS 的 `h1{margin:0;line-height:0}` 清掉舊文字樣式。
- 桌機 `height:clamp(76px,9.8vh,104px)`、手機（`@media(max-width:759px)`）`clamp(46px,12.5vw,58px)`，寬跟圖走（比例約 2.23:1）。
- 換圖重跑 `python tools/build-brand-logo.py [原圖]`，尺寸有變要同步 `index.html` 的 `width`/`height`。

### ending-backdrop.webp ＋ ending-backdrop-mobile.webp（旅程結算畫面底版）

結算畫面（`#settlement`）的底版圖，桌機 1600×900／手機 900×1600，WebP q80／q78。**目前是占位漸層**（共約 9KB），等 Jean 用 GPT 生好圖丟過來，重跑：

```
python tools\build-ending-bg.py "C:\Users\office\Downloads\桌機圖.png" "C:\Users\office\Downloads\手機圖.png"
```

- 腳本等比縮放＋置中裁切到固定規格，不會變形；手機原圖可省略（改從桌機圖裁中央直式，但比例差多時另生直式圖比較好）。
- 規格固定，換圖不用改 CSS 也不用改程式；`test/art.test.js` 會擋尺寸跑掉與體積超標（兩張 <500KB）。
- 要放字的地區留低對比（左上到中央），上方暗角由 CSS 疊加，圖本身不用壓暗。

#### 給生成模型的提示詞（GPT 生圖用，桌機＋手機各出一張）

**Why（版面遮擋，決定留白）**：結算面板是半透明白卡會蓋掉中央約 65%，上面 25% 疊「旅程結算」標題與金色稱號（有 CSS 深色漸層＋文字陰影），下面 20% 放按鈕，右上角被小黑貓疊住，四角 23px 圓角＋4px 木框。所以：**重要元素只放四邊緣帶與天空／海面的留白**，主體離任何邊至少 10%（腳本置中裁切）。

**桌機版（16:9）**

> Production full-screen game UI backdrop, landscape 16:9 (target 1600×900). Vivid stylized 3D cartoon academic-travel world in the same family as a cyan turquoise harbour: golden-hour return-home mood, sunset harbour pier with one moored boat, distant simplified world landmarks and a glass conference hall pushed to the outer edges, a small white aircraft and fluffy clouds high in the sky, small suitcase and luggage cart silhouettes on the far left and right. Warm gold and cyan palette, crisp polished toy forms, high colour separation, soft painterly depth of field, warm rim light on the horizon.
>
> Layout constraints (follow strictly): keep the central 65 percent calm, open and low-contrast — only soft sky-to-sea gradient, faint reflected light, no detail; keep the top 25 percent clean and low contrast for a large gold headline, do NOT pre-darken or vignette it yourself; keep the bottom 20 percent quiet and simple for buttons; the top-right corner must stay quiet; nothing important inside 10 percent of any edge. Monochrome-free, no foggy mush — still vivid and cheerful, just low contrast where the UI sits.
>
> No text, no lettering, no numbers, no signage, no logos, no stamps, no banners, no frames, no people or faces, no dice, no game tiles, no chess board, no UI elements, no watermark.

**手機版（9:16 直式）**

> Same scene, same lighting and same colour palette, vertical portrait composition (target 900×1600, aspect 9:16). Tall variant: sunset sky and clouds with a small aircraft occupy the top third, the cyan harbour and distant landmarks descend through the middle, a quiet foreground pier with a moored boat at the bottom. Central vertical band stays calm and low contrast all the way down, because a translucent results card is rendered on top in code; keep the upper quarter clean and low contrast for a gold headline, keep the bottom fifth simple for buttons, and nothing important inside 10 percent of any edge. Same toy-form style and same golden cyan palette as the landscape version. No text, lettering, numbers, signage, logos, stamps, frames, people, faces, dice, tiles or UI, no watermark.

**紅線（最容易踩的）**
- **兩張都不要有字**（標題稱號是程式疊的，圖裡的字會重疊）。
- **不要預先壓暗、不要自己做暗角**（CSS 已疊一層深藍漸層，疊兩次會髒）。
- **不要拿橫式圖裁去用**：16:9 裁到 9:16 只剩中央 31% 寬，主體會被砍光，一定要生直式。
- GPT 常出 1536×1024（橫）／1024×1536（直），都可以，腳本會 cover 置中裁；但**主體請離邊 ≥10%**，否則裁掉。
- 色調對齊本站既有美術（青綠海、暖金陽光、玩具式 3D 卡通），別改風格方向。

## 維護

- `src/art.js` 是檔名清單；`scene-art.js` 依四章圖集的固定位置讀取。
- 社群分享圖與 Favicon 在**隔壁** `assets/brand/`（不做 WebP，規格由社群平台與瀏覽器指定），製作與重製紀錄見 `assets/brand/README.md`。
- HUD 圖集順序對應 `render.js` 與 `game-art.css`，不可只換順序而不改對應。
- 改圖後執行 `npm test`，並在本機檢查桌機/375px/2D 備援。總檔案大小測試是部署預算，不是畫質評分。
- 素材不代表真實發生的案例；個別卡片是否顯示「📌 真實改編」仍由原 `trueStory` 欄位決定。
