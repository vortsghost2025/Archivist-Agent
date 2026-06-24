#!/usr/bin/env python3
"""
Seed router — maps existing NPCs and factions to deterministic star systems.
Each NPC/faction gets a home system derived from their ID hash.
"""

import hashlib
import json
import sys
from pathlib import Path
from typing import Dict, Optional

sys.path.insert(0, str(Path(__file__).parent))
from procedural_generator import generate_system


def _hash_to_seed(identifier: str) -> int:
    h = hashlib.sha256(identifier.encode()).hexdigest()
    return int(h[:12], 16)


def get_npc_home_system(npc_id: str, npc_name: str = "") -> Dict:
    seed = _hash_to_seed(npc_id)
    system = generate_system(seed)
    return {
        "npc_id": npc_id,
        "npc_name": npc_name,
        "home_system_seed": seed,
        "home_system": system.system_name,
        "home_coordinates": system.coordinates,
        "home_star_type": system.star_type,
        "home_planet": system.planets[0].name if system.planets else None,
    }


def get_faction_home_system(faction_id: str, faction_name: str = "") -> Dict:
    seed = _hash_to_seed(f"faction:{faction_id}")
    system = generate_system(seed)
    return {
        "faction_id": faction_id,
        "faction_name": faction_name,
        "home_system_seed": seed,
        "home_system": system.system_name,
        "home_coordinates": system.coordinates,
        "home_star_type": system.star_type,
        "capital_planet": system.planets[0].name if system.planets else None,
    }


def generate_faction_territory(faction_id: str, num_systems: int = 5) -> list:
    seed = _hash_to_seed(f"faction:{faction_id}")
    systems = []
    for i in range(num_systems):
        s_seed = seed + i * 1000
        system = generate_system(s_seed)
        systems.append({
            "seed": s_seed,
            "system_name": system.system_name,
            "coordinates": system.coordinates,
            "star_type": system.star_type,
            "role": "capital" if i == 0 else f"outpost_{i}",
        })
    return systems


def main():
    import argparse
    parser = argparse.ArgumentParser(description="NPC/faction seed router")
    parser.add_argument("--npc", type=str, help="NPC ID to route")
    parser.add_argument("--npc-name", type=str, default="", help="NPC display name")
    parser.add_argument("--faction", type=str, help="Faction ID to route")
    parser.add_argument("--faction-name", type=str, default="", help="Faction display name")
    parser.add_argument("--territory", type=int, default=0, help="Generate faction territory (N systems)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    if args.npc:
        result = get_npc_home_system(args.npc, args.npc_name)
        print(json.dumps(result, indent=2))
    elif args.faction:
        if args.territory > 0:
            result = generate_faction_territory(args.faction, args.territory)
        else:
            result = get_faction_home_system(args.faction, args.faction_name)
        print(json.dumps(result, indent=2))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
