"""가구 묶음(lobby-furniture.glb)을 가구 하나씩의 glb로 나눈다.

서버 아이템 목록(apps/backend/src/main/resources/catalog/files/)에 가구마다 모델 파일을 두고,
앱에는 처음 방 가구 일곱만 넣는다(apps/mobile/assets/models/furniture/). 다시 내보내지 않고 glb 구조를 그대로 잘라
메시·재질·값이 묶음과 바이트 단위로 같다. 가구를 더하거나 묶음을 다시 만들면 이 스크립트를 다시 돌린다.

    python scripts/lobby3d/split-furniture.py
"""

import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "apps/mobile/assets/models/lobby-furniture.glb"
SERVER_DIR = ROOT / "apps/backend/src/main/resources/catalog/files"
APP_DIR = ROOT / "apps/mobile/assets/models/furniture"

# 가구 종류 id → 묶음 안의 조각 이름들(앞이 가구 모델, 뒤는 딸린 조각: 책상 의자, 창밖 장면)
PIECES = {
    "desk": ["desk", "chair"],
    "bookcase": ["bookcase"],
    "wardrobe": ["wardrobe"],
    "rug": ["rug"],
    "lamp": ["tableLamp"],
    "bed": ["bed"],
    "nightstand": ["nightstand"],
    "floorLamp": ["floorLamp"],
    "plant": ["plant"],
    "smallPlant": ["smallPlant"],
    "books": ["booksStack"],
    "board": ["board"],
    "window": ["window", "windowView"],
    "frame": ["frame"],
}
# 앱에 넣어 내는 처음 방 가구
STARTERS = ["desk", "bookcase", "board", "window", "wardrobe", "rug", "lamp"]


def read_glb(path: Path):
    data = path.read_bytes()
    magic, version, _length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF" or version != 2:
        raise SystemExit(f"glb가 아니다: {path}")
    offset = 12
    doc = None
    binary = b""
    while offset < len(data):
        length, kind = struct.unpack("<II", data[offset : offset + 8])
        chunk = data[offset + 8 : offset + 8 + length]
        if kind == 0x4E4F534A:
            doc = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8 + length
    return doc, binary


def pad(data: bytes, fill: bytes) -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


def write_glb(path: Path, doc: dict, binary: bytes) -> None:
    text = pad(json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), b" ")
    binary = pad(binary, b"\0")
    chunks = struct.pack("<II", len(text), 0x4E4F534A) + text
    if binary:
        chunks += struct.pack("<II", len(binary), 0x004E4942) + binary
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks)


def extract(doc: dict, binary: bytes, names: list[str]) -> tuple[dict, bytes]:
    """이름이 names인 장면 뿌리 노드들과 그 아래만 담은 새 glb 문서."""
    top = {doc["nodes"][i].get("name"): i for i in doc["scenes"][doc.get("scene", 0)]["nodes"]}
    missing = [n for n in names if n not in top]
    if missing:
        raise SystemExit(f"묶음에 없는 조각: {missing}")

    node_map: dict[int, int] = {}
    mesh_map: dict[int, int] = {}
    material_map: dict[int, int] = {}
    accessor_map: dict[int, int] = {}
    view_map: dict[int, int] = {}
    out = {"asset": doc["asset"], "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [], "materials": [], "accessors": [], "bufferViews": [], "buffers": []}
    for key in ("extensionsUsed", "extensionsRequired"):
        if key in doc:
            out[key] = doc[key]
    new_binary = bytearray()

    def take_view(index: int) -> int:
        if index in view_map:
            return view_map[index]
        view = dict(doc["bufferViews"][index])
        chunk = binary[view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]]
        while len(new_binary) % 4:
            new_binary.append(0)
        view["byteOffset"] = len(new_binary)
        view["buffer"] = 0
        new_binary.extend(chunk)
        view_map[index] = len(out["bufferViews"])
        out["bufferViews"].append(view)
        return view_map[index]

    def take_accessor(index: int) -> int:
        if index in accessor_map:
            return accessor_map[index]
        accessor = dict(doc["accessors"][index])
        if "bufferView" in accessor:
            accessor["bufferView"] = take_view(accessor["bufferView"])
        if "sparse" in accessor:
            raise SystemExit("sparse 접근자는 다루지 않는다")
        accessor_map[index] = len(out["accessors"])
        out["accessors"].append(accessor)
        return accessor_map[index]

    def take_material(index: int) -> int:
        if index in material_map:
            return material_map[index]
        material = doc["materials"][index]
        if "textures" in json.dumps(material) or "Texture" in json.dumps(material):
            raise SystemExit("그림(텍스처)이 든 재질은 다루지 않는다")
        material_map[index] = len(out["materials"])
        out["materials"].append(material)
        return material_map[index]

    def take_mesh(index: int) -> int:
        if index in mesh_map:
            return mesh_map[index]
        mesh = json.loads(json.dumps(doc["meshes"][index]))
        for primitive in mesh["primitives"]:
            primitive["attributes"] = {k: take_accessor(v) for k, v in primitive["attributes"].items()}
            if "indices" in primitive:
                primitive["indices"] = take_accessor(primitive["indices"])
            if "material" in primitive:
                primitive["material"] = take_material(primitive["material"])
            if "targets" in primitive:
                primitive["targets"] = [{k: take_accessor(v) for k, v in t.items()} for t in primitive["targets"]]
        mesh_map[index] = len(out["meshes"])
        out["meshes"].append(mesh)
        return mesh_map[index]

    def take_node(index: int) -> int:
        node = json.loads(json.dumps(doc["nodes"][index]))
        if "skin" in node or "camera" in node:
            raise SystemExit("뼈대·카메라가 든 노드는 다루지 않는다")
        new_index = len(out["nodes"])
        node_map[index] = new_index
        out["nodes"].append(node)
        if "mesh" in node:
            node["mesh"] = take_mesh(node["mesh"])
        if "children" in node:
            node["children"] = [take_node(child) for child in node["children"]]
        return new_index

    for name in names:
        out["scenes"][0]["nodes"].append(take_node(top[name]))
    out["buffers"].append({"byteLength": len(pad(bytes(new_binary), b"\0"))})
    if not out["materials"]:
        del out["materials"]
    return out, bytes(new_binary)


def main() -> int:
    doc, binary = read_glb(SOURCE)
    SERVER_DIR.mkdir(parents=True, exist_ok=True)
    APP_DIR.mkdir(parents=True, exist_ok=True)
    for item, names in PIECES.items():
        part_doc, part_binary = extract(doc, binary, names)
        target = SERVER_DIR / f"{item}.glb"
        write_glb(target, part_doc, part_binary)
        print(f"{item}: {target.stat().st_size} bytes")
        if item in STARTERS:
            write_glb(APP_DIR / f"{item}.glb", part_doc, part_binary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
