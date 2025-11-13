@echo off
echo Starting Norton Commander Clone...
cd /d "d:\Claude\nc-gdrive"
npm start
if errorlevel 1 (
    echo.
    echo Error launching application!
    pause
)
