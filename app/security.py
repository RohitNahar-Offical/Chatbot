import os
import time
import json
import logging
from typing import Dict, Tuple
from collections import defaultdict

# Structured Audit Logging Setup
LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOGS_DIR, exist_ok=True)
AUDIT_LOG_FILE = os.path.join(LOGS_DIR, "audit.log")

audit_logger = logging.getLogger("StraAI_Audit")
audit_logger.setLevel(logging.INFO)
if not audit_logger.handlers:
    file_handler = logging.FileHandler(AUDIT_LOG_FILE, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter('%(message)s'))
    audit_logger.addHandler(file_handler)


class RateLimiter:
    """Sliding-window in-memory rate limiter per IP address."""
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - self.window_seconds
        
        # Filter timestamps outside current window
        self.requests[client_ip] = [
            t for t in self.requests[client_ip] if t > window_start
        ]

        if len(self.requests[client_ip]) < self.max_requests:
            self.requests[client_ip].append(now)
            return True, self.max_requests - len(self.requests[client_ip])
        
        return False, 0


class SecurityControl:
    def __init__(self):
        self.rate_limiter = RateLimiter(
            max_requests=int(os.getenv("RATE_LIMIT_PER_MIN", "30")),
            window_seconds=60
        )
        self.required_access_key = os.getenv("STRA_ACCESS_KEY", "").strip()

    def verify_access(self, client_ip: str, access_key: str = "") -> Tuple[bool, str]:
        # Optional Access Key verification if configured
        if self.required_access_key:
            if access_key != self.required_access_key:
                return False, "Unauthorized: Invalid Access Key"

        # Rate limiting check
        allowed, remaining = self.rate_limiter.is_allowed(client_ip)
        if not allowed:
            return False, "Rate Limit Exceeded: Please wait before sending another request."

        return True, f"OK (Remaining quota: {remaining})"

    def log_audit(self, event_type: str, client_ip: str, details: dict):
        record = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "event_type": event_type,
            "client_ip": client_ip,
            "details": details
        }
        audit_logger.info(json.dumps(record))
