#!/usr/bin/env python3
"""
Procedural universe generator for Federation game.
Seed-based deterministic star system generation.
"""

import json
import math
import random
import sys
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


@dataclass
class Planet:
    name: str
    type: str
    radius_km: float
    temperature_k: float
    atmosphere: str
    resources: Dict[str, float]
    moons: int


@dataclass
class StarSystem:
    seed: int
    system_name: str
    coordinates: List[float]
    star_type: str
    planets: List[Planet]


STAR_TYPES = [
    ("M", 0.76), ("K", 0.12), ("G", 0.06),
    ("F", 0.03), ("A", 0.015), ("B", 0.005), ("O", 0.0005)
]
PLANET_TYPES = ["rocky", "ice", "gas_giant", "water_world", "lava", "desert"]
ATMOSPHERES = ["None", "H2-He", "CO2", "N2", "N2-O2", "CH4", "SO2"]
RESOURCE_TYPES = ["iron", "carbon", "water", "rare_earths", "helium3", "tritium"]


def _weighted_choice(rng, items):
    total = sum(w for _, w in items)
    r = rng.random() * total
    cumulative = 0
    for item, weight in items:
        cumulative += weight
        if r <= cumulative:
            return item
    return items[-1][0]


def _generate_name(rng, prefix=True):
    syllables = ["al", "be", "cor", "del", "el", "far", "gal", "hen", "ir", "jor", "kal", "ly", "mor", "nor", "or", "pel", "quel", "ren", "sol", "tar", "ul", "vor", "wor", "xen", "yor", "zel"]
    if prefix:
        parts = [rng.choice(syllables).capitalize() for _ in range(rng.randint(2, 3))]
        return "".join(parts) + ("" if rng.random() > 0.3 else f" {rng.choice(['Prime', 'Major', 'Minor', 'IV', 'VII', 'IX'])}")
    return rng.choice(syllables).capitalize() + "us"


def _generate_resources(rng) -> Dict[str, float]:
    return {res: round(rng.random(), 2) for res in RESOURCE_TYPES if rng.random() > 0.4}


def _planet_temp(star_type, distance_au) -> float:
    temp_map = {"O": 35000, "B": 15000, "A": 9000, "F": 7000, "G": 5800, "K": 4500, "M": 3000}
    t_star = temp_map.get(star_type[0] if star_type else "G", 5800)
    return round(t_star / math.sqrt(distance_au + 0.1), 1)


def generate_system(seed: int, name_override: Optional[str] = None) -> StarSystem:
    rng = random.Random(seed)
    if HAS_NUMPY:
        rng.seed(seed)

    system_name = name_override or _generate_name(rng)

    coords = [round(rng.uniform(-1000, 1000), 2) for _ in range(3)]

    star_type = _weighted_choice(rng, STAR_TYPES)
    star_type += str(rng.randint(1, 9)) + ("V" if rng.random() > 0.2 else "III")

    num_planets = rng.randint(1, 8)
    planets = []
    for i in range(num_planets):
        ptype = rng.choice(PLANET_TYPES)
        distance = round(rng.uniform(0.3, 30.0), 2)
        radius = round(rng.uniform(2000, 140000), 0) if ptype == "gas_giant" else round(rng.uniform(2000, 15000), 0)
        temp = _planet_temp(star_type, distance)
        atmos = rng.choice(ATMOSPHERES)

        if ptype == "gas_giant":
            atmos = rng.choice(["H2-He", "H2-He", "None"])
        elif ptype == "ice":
            atmos = rng.choice(["None", "N2", "CH4"])
        elif ptype == "lava":
            atmos = rng.choice(["None", "CO2", "SO2"])

        moons = rng.randint(0, 5) if ptype != "asteroid" else 0

        planets.append(Planet(
            name=f"{system_name} {['I','II','III','IV','V','VI','VII','VIII'][i]}",
            type=ptype,
            radius_km=radius,
            temperature_k=temp,
            atmosphere=atmos,
            resources=_generate_resources(rng),
            moons=moons
        ))

    return StarSystem(
        seed=seed,
        system_name=system_name,
        coordinates=coords,
        star_type=star_type,
        planets=planets
    )


def generate_sector(seed: int, num_systems: int = 10) -> List[StarSystem]:
    rng = random.Random(seed)
    systems = []
    base_x, base_y, base_z = 0, 0, 0
    for i in range(num_systems):
        s_seed = seed + i
        system = generate_system(s_seed)
        jitter = 50
        system.coordinates = [
            round(base_x + rng.uniform(-jitter, jitter), 2),
            round(base_y + rng.uniform(-jitter, jitter), 2),
            round(base_z + rng.uniform(-jitter, jitter), 2),
        ]
        systems.append(system)
    return systems


def system_to_dict(s: StarSystem) -> Dict:
    return {
        "seed": s.seed,
        "system_name": s.system_name,
        "coordinates": s.coordinates,
        "star_type": s.star_type,
        "planets": [asdict(p) for p in s.planets]
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Procedural universe generator")
    parser.add_argument("--seed", type=int, required=True, help="Base seed for generation")
    parser.add_argument("--sector", type=int, default=1, help="Number of systems (default: 1)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    if args.sector > 1:
        systems = generate_sector(args.seed, args.sector)
        result = [system_to_dict(s) for s in systems]
    else:
        system = generate_system(args.seed)
        result = system_to_dict(system)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
