# 晟自然玩科學｜iPhone PWA 大廳版面基準（2026-11-07）
 
## 用途
將已由 iPhone 實機逐版確認的上下區域規格保存在 Repository。日後其他模擬可以**參考**這套安全區、操作區原則，但不可直接將大廳的特定高度套用到所有實驗；每個模擬仍須獨立驗收。
 
## 目前基準
- 參考頁面：`ssscsystem/index.html`，大廳 v16。上一個使用者實機畫面為 v15，確認頂部位置及底部高度適合；v16 僅修正 Copyright 水平置中。
- 手機 PWA 判斷：`@media (max-width:600px) and (display-mode:standalone)`。
- 大廳外框：`body {padding-top:16px; height:calc(100dvh + 16px); min-height:calc(100dvh + 16px)}`。此數值為從 v11 確認的頂部清晰位置，不要再往上調；注意原有 `header` 仍有 `env(safe-area-inset-top)`。
- 頁面原有 `header` 在手機仍用 `padding-top:calc(12px + env(safe-area-inset-top))`、`padding-bottom:8px`。深色不透明、不使用毛玻璃或發光文字效果。
- 底部：手機 `footer` 最小高度 `76px`，內距 `14px 12px calc(18px + env(safe-area-inset-bottom))`，高度經 v14/v15 實機確認合適。
- Copyright：完整 `© 2026 晟自然玩科學 All Rights Reserved.`，置中於整個 footer 的水平寬度；v16 修正不對稱內距導致的偏左。
- 版本按鈕：僅測試時暫留，浮動在音樂按鈕正上方；手機 `right:10px; bottom:calc(70px + env(safe-area-inset-bottom))`。
- 音樂按鈕：手機 `right:10px; bottom:calc(18px + env(safe-area-inset-bottom))`。不要讓它遮住實驗操作。
- 大廳列表：中間可捲動；不變更原本卡片外觀、分類功能、模擬連結。
 
## 注意
1. 這是**大廳實機基準**，不是已驗收的所有模擬共用 CSS，也不代表 Android 或 Safari 網頁版已驗收。
2. 如後續修改頂部位置、PWA 高度或 footer 高度，應先說明且獨立驗收；不要用新版本意外覆蓋上述核定值。
3. 分類選單（目前一行左右滑動）尚在討論，未定稿。
4. GitHub 寫入成功與 Pages 部署成功是兩個不同狀態。
