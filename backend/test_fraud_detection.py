import pandas as pd
from fraud_detector import FraudDetector
from network_builder import build_network_graph, get_largest_fraud_ring

df = pd.read_csv("generated_data/synthetic_payroll.csv")
employees = df.to_dict(orient="records")

print(f"Testing with {len(employees)} employees...")

detector = FraudDetector()

results = detector.analyze(employees)

print(f"Analysis completed in {results['summary']['analysis_duration_seconds']:.2f} seconds")

print("\n=== FRAUD DETECTION RESULTS ===")
print(f"Flagged employees:     {results['summary']['flagged_count']}")
print(f"Estimated annual loss: ₦{results['summary']['estimated_loss']:,}")
print("\nFraud breakdown:")
for fraud_type, count in results["fraud_breakdown"].items():
    print(f"  {fraud_type}: {count}")

print("\n=== RISK CLASSIFICATIONS ===")
classifications = {"VERIFIED": 0, "REVIEW_REQUIRED": 0, "HIGH_RISK": 0}
for emp in results["employees"]:
    label = emp.get("classification", "VERIFIED")
    if label in classifications:
        classifications[label] += 1
for label, count in classifications.items():
    print(f"  {label}: {count}")

print("\n=== NETWORK GRAPH STATS ===")
graph = build_network_graph(results["employees"])
print(f"  Nodes: {len(graph['nodes'])}")
print(f"  Edges: {len(graph['edges'])}")

print("\n=== LARGEST FRAUD RING ===")
ring = get_largest_fraud_ring(results["employees"])
print(f"  Ring size: {ring['size']}")

print("\n=== SAMPLE RED FLAGS ===")
high_risk = next(
    (emp for emp in results["employees"] if emp.get("classification") == "HIGH_RISK"),
    None,
)
if high_risk:
    print(f"  Employee: {high_risk['name']}  (score: {high_risk['fraud_score']})")
    flags = high_risk.get("red_flags") or []
    for flag in flags:
        print(f"  [{flag['severity']}] {flag['description']}")
        print(f"         Evidence: {flag['evidence']}")
else:
    print("  No HIGH_RISK employees found.")
