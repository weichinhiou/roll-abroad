# 大赴翁共用美術

2026-10-30，依 Jean 採納的鮮豔卡通概念稿製作，使用內建 **image_gen**。一張產出、檢視、轉為本機 WebP、導入後再做下一張。沒有使用 API/CLI 備援，也沒有複製參考作品素材。原始生成 PNG 留在製作機的 generated_images；本資料夾的 WebP 是正式可部署素材，不依賴原始路徑。

共同風格：原創 Q 版國際學術旅人、鮮豔的天空藍/陽光黃/珊瑚橘/青綠/紫、立體玩具質感、明亮日光。所有文字由介面繪製，素材不含姓名、年份、科別、真實會議或院內金額。

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

## 維護

- `src/art.js` 是檔名清單；`scene-art.js` 依四章圖集的固定位置讀取。
- HUD 圖集順序對應 `render.js` 與 `game-art.css`，不可只換順序而不改對應。
- 改圖後執行 `npm test`，並在本機檢查桌機/375px/2D 備援。總檔案大小測試是部署預算，不是畫質評分。
- 素材不代表真實發生的案例；個別卡片是否顯示「📌 真實改編」仍由原 `trueStory` 欄位決定。
