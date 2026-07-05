#!/bin/bash

echo "============================================================"
echo " PARK AI — Launch Script (macOS/Linux)"
echo "============================================================"
echo

if [ ! -d "venv" ]; then
    echo "[WARNING] Virtual environment not found. Running setup.sh first..."
    chmod +x setup.sh
    ./setup.sh
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Starting Flask server on http://localhost:5000..."
python3 app.py
