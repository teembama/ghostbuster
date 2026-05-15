import pandas as pd
import networkx as nx
from typing import Dict, List
from itertools import combinations


def build_network_graph(employees: List[Dict]) -> Dict:
    df = pd.DataFrame(employees)
    flagged = df[df["classification"] != "VERIFIED"].copy()

    G = nx.Graph()

    for _, row in flagged.iterrows():
        G.add_node(
            row["id"],
            name=row["name"],
            fraud_score=row["fraud_score"],
            ministry=row["ministry"],
        )

    seen_edges = set()

    for _, group in flagged.groupby("bank_account"):
        if len(group) < 2:
            continue
        ids = group["id"].tolist()
        for a, b in combinations(ids, 2):
            key = frozenset({a, b})
            if key not in seen_edges:
                seen_edges.add(key)
                G.add_edge(a, b, type="shared_account", weight=2.0)

    bio_flagged = flagged[flagged["biometric_id"].notna()]
    for _, group in bio_flagged.groupby("biometric_id"):
        if len(group) < 2:
            continue
        ids = group["id"].tolist()
        for a, b in combinations(ids, 2):
            key = frozenset({a, b})
            if key not in seen_edges:
                seen_edges.add(key)
                G.add_edge(a, b, type="shared_biometric", weight=1.5)

    nodes = [
        {
            "id": n,
            "name": G.nodes[n]["name"],
            "type": "employee",
            "fraud_score": G.nodes[n]["fraud_score"],
            "ministry": G.nodes[n]["ministry"],
        }
        for n in G.nodes
    ]

    edges = [
        {
            "source": u,
            "target": v,
            "type": G.edges[u, v]["type"],
            "weight": G.edges[u, v]["weight"],
        }
        for u, v in G.edges
    ]

    return {"nodes": nodes, "edges": edges}


def get_largest_fraud_ring(employees: List[Dict]) -> Dict:
    graph_data = build_network_graph(employees)

    if not graph_data["nodes"]:
        return {"nodes": [], "edges": [], "size": 0}

    G = nx.Graph()
    for node in graph_data["nodes"]:
        G.add_node(node["id"], **{k: v for k, v in node.items() if k != "id"})
    for edge in graph_data["edges"]:
        G.add_edge(edge["source"], edge["target"], type=edge["type"], weight=edge["weight"])

    components = list(nx.connected_components(G))
    if not components:
        return {"nodes": [], "edges": [], "size": 0}

    largest_ids = max(components, key=len)
    sub = G.subgraph(largest_ids)

    nodes = [
        {
            "id": n,
            "name": sub.nodes[n]["name"],
            "type": "employee",
            "fraud_score": sub.nodes[n]["fraud_score"],
            "ministry": sub.nodes[n]["ministry"],
        }
        for n in sub.nodes
    ]

    edges = [
        {
            "source": u,
            "target": v,
            "type": sub.edges[u, v]["type"],
            "weight": sub.edges[u, v]["weight"],
        }
        for u, v in sub.edges
    ]

    return {"nodes": nodes, "edges": edges, "size": len(nodes)}
