@echo off
echo Starting Norton Commander Clone...
cd /d "d:\Claude\projects\Norton_Commander_Clone"
npm start
if errorlevel 1 (
    echo.
    echo Error launching application!
    pause
)
