@echo off
echo ============================================================
echo  PARK AI — Setup and Initialization Script (Windows)
echo ============================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in system PATH.
    echo Please install Python 3.10+ and try again.
    pause
    exit /b %errorlevel%
)

:: Create Virtual Environment
echo Creating virtual environment (venv)...
python -m venv venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b %errorlevel%
)

:: Activate Virtual Environment & Install requirements
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies from requirements.txt...
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b %errorlevel%
)

:: Initialize SQLite Database
echo Initializing database schema...
python init_db.py
if %errorlevel% neq 0 (
    echo [ERROR] Database initialization failed.
    pause
    exit /b %errorlevel%
)

:: Create .env if not exists
if not exist .env (
    echo Copying .env.template to .env...
    copy .env.template .env >nul
)

echo.
echo ============================================================
echo  Setup Completed Successfully!
echo  To start the application, double-click run.bat or execute:
echo  venv\Scripts\activate.bat && python app.py
echo ============================================================
echo.
pause
