@echo off
echo Formatting Python venv natively protecting architecture limits...
cd %~dp0
if not exist "venv\" (
    echo Bootstrapping virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Verifying mapping limits ensuring module installation completed...
pip install fastapi uvicorn httpx pydantic pytest python-dotenv >nul 2>&1
echo ----------------------------------------------------
echo Spooling Validation Proxy Locally over Port 8000
echo ----------------------------------------------------
uvicorn main:app --reload --port 8000
