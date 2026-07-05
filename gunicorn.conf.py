# ==========================================
# PARK AI — Gunicorn WSGI Server Config
# Run command: gunicorn -c gunicorn.conf.py app:app
# ==========================================

import os
import multiprocessing

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "eventlet"

# Timeout settings to prevent connection drops in long-polls
timeout = 120
keepalive = 5

loglevel = "info"
accesslog = "-"
errorlog = "-"
