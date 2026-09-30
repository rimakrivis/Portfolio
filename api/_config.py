"""
Everything personal lives in agent.config.json (name, email, pages, widget texts).
The code stays the same for anyone's portfolio: swap the config, the CV and the facts file.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "agent.config.json").read_text(encoding="utf-8"))

PERSON = CONFIG["person"]
KNOWLEDGE = CONFIG["knowledge"]
FIRST = PERSON["first_name"]
EMAIL = PERSON["email"]
