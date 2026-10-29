"""Weighted decision matrix with vetoes.

Scores run from -2 to +2. Weights sum to 100.
1. Veto: a negative score on a veto criterion eliminates the alternative.
2. Balance: sum(weight * score) / 2, which lands between -100 and +100.
3. Verdict: above +15 approve; 0 to +15 pilot for one cycle; below 0 reject.

Usage:  python tools/decision_matrix.py sample-data/alternatives.json
"""
import json
import sys


def evaluate(spec):
    criteria = spec["criteria"]
    total_weight = sum(c["weight"] for c in criteria)
    if total_weight != 100:
        raise ValueError(f"weights must sum to 100, got {total_weight}")
    rows = []
    for name, scores in spec["alternatives"].items():
        missing = [c["id"] for c in criteria if c["id"] not in scores]
        if missing:
            raise ValueError(f"{name}: missing scores for {missing}")
        bad = [k for k, v in scores.items() if not -2 <= v <= 2]
        if bad:
            raise ValueError(f"{name}: scores out of range for {bad}")
        vetoed = [c["id"] for c in criteria if c["veto"] and scores[c["id"]] < 0]
        balance = sum(c["weight"] * scores[c["id"]] for c in criteria) / 2
        if vetoed:
            verdict = "vetoed (" + ", ".join(vetoed) + ")"
        elif balance > 15:
            verdict = "approve"
        elif balance >= 0:
            verdict = "pilot"
        else:
            verdict = "reject"
        rows.append((name, balance, verdict, bool(vetoed)))
    # Vetoed options go last, the rest by balance.
    rows.sort(key=lambda r: (r[3], -r[1]))
    return rows


def main(path):
    with open(path, encoding="utf-8") as f:
        spec = json.load(f)
    rows = evaluate(spec)
    width = max(len(r[0]) for r in rows)
    print(f"{'alternative'.ljust(width)}  balance  verdict")
    for name, balance, verdict, _ in rows:
        print(f"{name.ljust(width)}  {balance:7.1f}  {verdict}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sample-data/alternatives.json")
