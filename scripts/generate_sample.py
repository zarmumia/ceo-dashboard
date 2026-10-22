"""Generate realistic but fake case data for the demo dashboard.

python scripts/generate_sample.py > data/sample.json
"""
import json
import random
from datetime import datetime, timedelta

random.seed(7)
NOW = datetime(2026, 10, 20, 12, 0)
REPS = ["Rep A", "Rep B", "Rep C"]
SOURCES = ["Partners"] * 5 + ["Past clients"] * 3 + ["Website"] * 2
STAGES = ["new"] * 24 + ["contacted"] * 15 + ["signed"] * 6 + ["waiting_docs"] * 5 + ["filed"] * 9 + ["paid"] * 4


def iso(d):
    return d.replace(microsecond=0).isoformat() if d else None


cases = []
for i in range(1, 241):
    stage = random.choice(STAGES)
    age = random.uniform(0, 6) if stage == "new" and random.random() < 0.8 else random.uniform(3, 90)
    created = NOW - timedelta(days=age)
    stage_since = created if stage == "new" else created + (NOW - created) * random.uniform(0.3, 0.95)
    if stage == "waiting_docs" and random.random() < 0.3:
        stage_since = NOW - timedelta(days=random.uniform(22, 40))
    contacted = None if (stage == "new" and random.random() < 0.35) else created + timedelta(hours=random.uniform(0.2, 30))
    signed = None
    if stage in {"signed", "waiting_docs", "filed", "paid"}:
        signed = stage_since if stage == "signed" else created + (stage_since - created) * random.uniform(0.2, 0.8)
    cases.append({
        "id": f"C-{i:04d}",
        "owner": random.choice(REPS) if random.random() > 0.04 else None,
        "source": random.choice(SOURCES),
        "stage": stage,
        "created_at": iso(created),
        "first_contact_at": iso(contacted),
        "stage_since": iso(stage_since),
        "signed_at": iso(signed),
        "expected_fee": random.choice([900, 1200, 1500, 1800, 2400]),
    })

print(json.dumps({"generated_at": iso(NOW), "currency": "ILS", "cases": cases}, indent=1))
