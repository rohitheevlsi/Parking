@echo off
echo ============================================================
echo  PARK AI — Launch Script (Windows)
echo ============================================================
echo.

if not exist venv\Scripts\activate.bat (
    echo [WARNING] Virtual environment not found. Running setup.bat first...
    call setup.bat
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Starting Flask server on http://localhost:5000...
python app.py
if %errorlevel% neq 0 (
    echo [ERROR] Flask server exited with an error.
    pause
    exit /b %errorlevel%
)

pause
