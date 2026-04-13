# backend/parser.py
# Valide le JSON recu de l'IA et calcule les positions 3D reelles

import unicodedata


FURNITURE_SIZES = {
    "sofa": {"width": 2.0, "depth": 0.9, "height": 0.8},
    "tv": {"width": 1.2, "depth": 0.1, "height": 0.7},
    "bed": {"width": 1.6, "depth": 2.0, "height": 0.5},
    "bathtub": {"width": 0.8, "depth": 1.7, "height": 0.6},
    "table": {"width": 1.2, "depth": 0.8, "height": 0.75},
    "chair": {"width": 0.5, "depth": 0.5, "height": 0.9},
    "kitchen": {"width": 2.5, "depth": 0.6, "height": 0.9},
    "toilet": {"width": 0.4, "depth": 0.7, "height": 0.8},
    "desk": {"width": 1.2, "depth": 0.6, "height": 0.75},
    "desk_lamp": {"width": 0.2, "depth": 0.2, "height": 0.4},
    "fridge": {"width": 0.7, "depth": 0.7, "height": 1.8},
    "garden": {"width": 4.0, "depth": 4.0, "height": 0.25},
}

DEFAULT_FURNITURE_SIZE = {"width": 1.0, "depth": 1.0, "height": 1.0}

ROOM_COLORS = {
    "living_room": "#f5e6c8",
    "bedroom": "#c8d5f5",
    "kitchen": "#c8f5d0",
    "bathroom": "#f5c8e6",
    "garden": "#c8f0c8",
    "default": "#e8e8e8",
}

ROOM_ALIASES = {
    "living_room": "living_room",
    "living": "living_room",
    "salon": "living_room",
    "sejour": "living_room",
    "bedroom": "bedroom",
    "chambre": "bedroom",
    "kitchen": "kitchen",
    "cuisine": "kitchen",
    "bathroom": "bathroom",
    "salle_de_bain": "bathroom",
    "toilet": "bathroom",
    "toilettes": "bathroom",
    "toilette": "bathroom",
    "wc": "bathroom",
    "garden": "garden",
    "jardin": "garden",
}

FURNITURE_ALIASES = {
    "sofa": "sofa",
    "canape": "sofa",
    "canapee": "sofa",
    "tv": "tv",
    "television": "tv",
    "televiseur": "tv",
    "screen": "tv",
    "bed": "bed",
    "lit": "bed",
    "bathtub": "bathtub",
    "douche": "bathtub",
    "shower": "bathtub",
    "table": "table",
    "table_basse": "table",
    "coffee_table": "table",
    "chair": "chair",
    "chaise": "chair",
    "kitchen": "kitchen",
    "cuisiniere": "kitchen",
    "stove": "kitchen",
    "sink": "kitchen",
    "evier": "kitchen",
    "toilet": "toilet",
    "toilettes": "toilet",
    "toilette": "toilet",
    "wc": "toilet",
    "lavabo": "toilet",
    "desk": "desk",
    "bureau": "desk",
    "armoire": "desk",
    "commode": "desk",
    "desk_lamp": "desk_lamp",
    "lampe": "desk_lamp",
    "miroir": "desk_lamp",
    "fridge": "fridge",
    "refrigerateur": "fridge",
    "frigo": "fridge",
    "garden": "garden",
    "jardin": "garden",
}


def _normalize_token(value) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip().replace("-", "_").replace(" ", "_")
    while "__" in text:
        text = text.replace("__", "_")
    return text.strip("_")


def _canonical_room_name(raw_name: str) -> str:
    normalized = _normalize_token(raw_name)
    return ROOM_ALIASES.get(normalized, normalized or "room")


def _canonical_furniture_type(raw_type: str) -> str:
    normalized = _normalize_token(raw_type)
    return FURNITURE_ALIASES.get(normalized, normalized or "chair")


def _room_priority(name: str) -> int:
    normalized = _canonical_room_name(name)
    if normalized == "living_room":
        return 0
    if normalized == "kitchen":
        return 1
    if normalized == "bedroom":
        return 2
    if normalized == "bathroom":
        return 3
    if normalized == "garden":
        return 4
    return 5


def _default_furniture_for_room(room_name: str) -> list:
    if room_name == "living_room":
        return [
            {"type": "sofa", "x": -0.2, "z": 0.05, "rotation": 180},
            {"type": "tv", "x": 0.3, "z": -0.2, "rotation": 0},
            {"type": "table", "x": 0.0, "z": 0.15, "rotation": 0},
        ]
    if room_name == "kitchen":
        return [
            {"type": "kitchen", "x": -0.3, "z": -0.25, "rotation": 0},
            {"type": "fridge", "x": 0.35, "z": -0.2, "rotation": 0},
            {"type": "table", "x": 0.1, "z": 0.2, "rotation": 90},
        ]
    if room_name == "bedroom":
        return [
            {"type": "bed", "x": -0.15, "z": -0.1, "rotation": 0},
            {"type": "desk", "x": 0.25, "z": 0.2, "rotation": 90},
            {"type": "chair", "x": 0.35, "z": 0.3, "rotation": 90},
        ]
    if room_name == "bathroom":
        return [
            {"type": "bathtub", "x": -0.2, "z": -0.1, "rotation": 0},
            {"type": "toilet", "x": 0.25, "z": 0.2, "rotation": 90},
        ]
    if room_name == "garden":
        return [
            {"type": "garden", "x": 0.0, "z": 0.0, "rotation": 0},
        ]
    return [
        {"type": "table", "x": 0.0, "z": 0.0, "rotation": 0},
        {"type": "chair", "x": 0.2, "z": 0.2, "rotation": 0},
    ]


def _infer_furniture_size(furniture_type: str) -> dict:
    normalized = _canonical_furniture_type(furniture_type)

    if normalized in FURNITURE_SIZES:
        return FURNITURE_SIZES[normalized]

    if "garden" in normalized or "jardin" in normalized:
        return {"width": 4.0, "depth": 4.0, "height": 0.25}
    if "tree" in normalized or "plant" in normalized:
        return {"width": 1.2, "depth": 1.2, "height": 2.4}
    if "lamp" in normalized:
        return {"width": 0.25, "depth": 0.25, "height": 0.6}
    if "table" in normalized:
        return {"width": 1.2, "depth": 0.8, "height": 0.75}

    return DEFAULT_FURNITURE_SIZE.copy()


def _safe_float(value, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return default


def validate_and_enrich(house_data: dict) -> dict:
    rooms = house_data.get("rooms", [])
    if not rooms:
        raise ValueError("Aucune piece definie dans le JSON")

    rooms = sorted(rooms, key=lambda room: _room_priority(room.get("name", "")))

    enriched_rooms = []
    grid_cols = 2
    room_gap = 0.0
    current_x = 0.0
    current_z = 0.0
    max_z_in_row = 0.0
    col_index = 0

    for i, room in enumerate(rooms):
        raw_room_name = room.get("name", f"room_{i}")
        room_name = _canonical_room_name(raw_room_name)
        room_width = max(5.0, _safe_float(room.get("width", 5.5), 5.5))
        room_depth = max(4.5, _safe_float(room.get("depth", 5.0), 5.0))

        room_world_x = current_x
        room_world_z = current_z

        raw_furniture = room.get("furniture", [])
        if not isinstance(raw_furniture, list):
            raw_furniture = []

        enriched_furniture = []

        for idx, furn in enumerate(raw_furniture):
            if isinstance(furn, dict):
                furn_type_raw = (
                    furn.get("type")
                    or furn.get("name")
                    or furn.get("item")
                    or furn.get("label")
                    or "chair"
                )
                rel_x = _safe_float(furn.get("x", 0.0), 0.0)
                rel_z = _safe_float(furn.get("z", 0.0), 0.0)
                rotation = _safe_float(furn.get("rotation", (idx % 4) * 90), 0.0)
            else:
                furn_type_raw = str(furn)
                rel_x = -0.25 + (idx % 3) * 0.25
                rel_z = -0.2 + (idx // 3) * 0.2
                rotation = 0.0

            furn_type = _canonical_furniture_type(furn_type_raw)
            furn_size = _infer_furniture_size(furn_type)

            rel_x = max(-0.45, min(0.45, rel_x))
            rel_z = max(-0.45, min(0.45, rel_z))

            abs_x = room_world_x + (room_width / 2) + (rel_x * room_width)
            abs_z = room_world_z + (room_depth / 2) + (rel_z * room_depth)

            enriched_furniture.append({
                "type": furn_type,
                "x": abs_x,
                "z": abs_z,
                "rotation": rotation,
                "size": furn_size,
            })

        if not enriched_furniture:
            for furn in _default_furniture_for_room(room_name):
                furn_type = _canonical_furniture_type(furn["type"])
                furn_size = _infer_furniture_size(furn_type)
                abs_x = room_world_x + (room_width / 2) + (furn["x"] * room_width)
                abs_z = room_world_z + (room_depth / 2) + (furn["z"] * room_depth)
                enriched_furniture.append({
                    "type": furn_type,
                    "x": abs_x,
                    "z": abs_z,
                    "rotation": _safe_float(furn.get("rotation", 0), 0),
                    "size": furn_size,
                })

        enriched_rooms.append({
            "name": room_name,
            "width": room_width,
            "depth": room_depth,
            "world_x": room_world_x,
            "world_z": room_world_z,
            "color": ROOM_COLORS.get(room_name, ROOM_COLORS["default"]),
            "furniture": enriched_furniture,
        })

        current_x += room_width + room_gap
        col_index += 1
        max_z_in_row = max(max_z_in_row, room_depth)

        if col_index >= grid_cols:
            col_index = 0
            current_x = 0.0
            current_z += max_z_in_row + room_gap
            max_z_in_row = 0.0

    return {
        "rooms": enriched_rooms,
        "floors": house_data.get("floors", 1),
        "style": house_data.get("style", "modern"),
    }