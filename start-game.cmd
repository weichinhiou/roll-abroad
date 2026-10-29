@echo off
rem 雙擊這個檔案就能在本機試玩：啟動本機伺服器並打開瀏覽器。關掉跳出的伺服器視窗就結束。
cd /d "%~dp0"
start "Roll Abroad server" /min node server.mjs
timeout /t 1 /nobreak >nul
start "" http://localhost:4181
