@echo off
cd /d "%~dp0"

echo [BiliNote] Starting backend...
start /b "" cmd /c "cd backend && .\venv\Scripts\activate && python main.py"

echo [BiliNote] Starting frontend...
start /b "" cmd /c "cd BillNote_frontend && pnpm dev" > nul 2>&1

timeout /t 4 /nobreak > nul
start "" http://localhost:3015/

echo.
echo ========================================
echo  All services started.
echo  Close this window to stop all services.
echo ========================================
echo.

:wait
ping 127.0.0.1 -n 3 > nul
goto wait