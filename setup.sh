#!/bin/bash
set -e

echo "============================================================"
echo " PARK AI — Setup and Initialization Script (macOS/Linux)"
echo "============================================================"
echo

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 is not installed or not in PATH."
    exit 1
fi

# Create Virtual Environment
echo "Creating virtual environment (venv)..."
python3 -m venv venv

# Activate and Install
echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies from requirements.txt..."
python3 -m pip install --upgrade pip
pip install -r requirements.txt

# Database Init
echo "Initializing database schema..."
python3 init_db.py

# Create .env if not exists
if [ ! -f .env ]; then
    echo "Copying .env.template to .env..."
    cp .env.template .env
fi

echo
echo "============================================================"
echo " Setup Completed Successfully!"
echo " To start the application, run:"
echo " chmod +x run.sh && ./run.sh"
echo "============================================================"
echo
