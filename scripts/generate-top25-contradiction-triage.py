import collections
import datetime
import json
import pathlib

SRC = r"C:/Users/seand/Downloads/graph-snapshot-2026-04-30-18-43-44-883.json"
OUT = r"S:/Archivist-Agent/docs/graph/TOP25_CONTRADICTION_TRIAGE_2026-04-30.md"


def main() -> None:
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)

    nodes = data.get("nodes", [])
    conflicted = [n for n in nodes if str(n.get("status", "")).upper() == "CONFLICTED"]
    top = sorted(conflicted, key=lambda n: n.get("contradictionCount", 0), reverse=True)[:25]
    by_repo = collections.Counter(n.get("repo", "unknown") for n in conflicted)
    by_cat = collections.Counter(n.get("category", "unknown") for n in conflicted)

    lines = []
    lines.append("# Top 25 Contradiction Triage")
    lines.append("")
    lines.append(f"Generated: {datetime.datetime.now(datetime.timezone.utc).isoformat()}")
    lines.append(f"Source snapshot: `{SRC}`")
    lines.append("")
    lines.append("## Snapshot Summary")
    lines.append("")
    lines.append(f"- Total nodes: {len(nodes)}")
    lines.append(f"- Conflicted nodes: {len(conflicted)}")
    lines.append(f"- Top conflicted repos: {by_repo.most_common(8)}")
    lines.append(f"- Top conflicted categories: {by_cat.most_common(8)}")
    lines.append("")
    lines.append("## Recommended Triage Order")
    lines.append("")
    lines.append("- Resolve `root-doc` contradictions first (highest blast radius).")
    lines.append("- Then resolve `governance` contradictions (policy/flow consistency).")
    lines.append("- Then resolve `paper-section` contradictions (reference alignment).")
    lines.append("- Defer low-contradiction leaf docs until root constraints are stable.")
    lines.append("")
    lines.append("## Top 25 Nodes")
    lines.append("")
    lines.append("| Rank | Node ID | Repo | Category | Contradictions | Title |")
    lines.append("|---:|---|---|---|---:|---|")
    for i, n in enumerate(top, 1):
        title = str(n.get("title", "")).replace("|", "/").replace("\n", " ").strip()
        lines.append(
            f"| {i} | `{n.get('id', '')}` | `{n.get('repo', 'unknown')}` | "
            f"`{n.get('category', 'unknown')}` | {n.get('contradictionCount', 0)} | {title} |"
        )

    lines.append("")
    lines.append("## Execution Notes For Lanes")
    lines.append("")
    lines.append("- **Archivist:** own canonical ordering + broadcast triage queue.")
    lines.append("- **Library:** verify source references and document cross-links for top 10.")
    lines.append("- **Kernel:** validate scripts/checks that produce contradiction labeling.")
    lines.append("- **SwarmMind:** execute bulk normalization against approved canonical set.")

    pathlib.Path(OUT).parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(OUT)


if __name__ == "__main__":
    main()
