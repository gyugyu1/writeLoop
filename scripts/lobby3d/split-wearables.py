"""착용 모델 묶음(lobby-wearables.glb)을 모델 하나씩의 glb로 나눠 서버 아이템 목록 폴더에 둔다.

서버 아이템 목록(apps/backend/src/main/resources/catalog/files/)에 옷 모델마다 파일을 두고 앱은 필요할 때 받는다.
다시 내보내지 않고 glb 구조를 그대로 잘라 메시·재질·그림·뼈대가 묶음과 바이트 단위로 같다.
- 뼈에 붙이는 모델(모자·선글라스·백팩·머플러·목걸이·신발 한 짝)은 그 노드만 담는다(자리는 라룹이 쉬는 자세 좌표 그대로).
- 뼈대로 휘는 모델(상의·하의)은 뼈대(뼈 이름·묶음 역행렬)를 함께 담는다. 앱이 라룹이 뼈대에 뼈 이름으로 다시 묶는다.
묶음을 다시 만들면(scripts/lobby3d/build-wearables.py, 라룹이 몸이 바뀔 때 등) 이 스크립트를 다시 돌린다.

    python scripts/lobby3d/split-wearables.py
"""

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "apps/mobile/assets/models/lobby-wearables.glb"
SERVER_DIR = ROOT / "apps/backend/src/main/resources/catalog/files"

# 묶음 안의 모델 이름 → 서버 파일 이름(색만 다른 옷은 같은 파일을 쓴다)
MODELS = {
    "wear-hat": "wear-hat.glb",
    "wear-hat-blue": "wear-hat-blue.glb",
    "wear-hat-green": "wear-hat-green.glb",
    "wear-top": "wear-top.glb",
    "wear-bottom": "wear-bottom.glb",
    "wear-shoe-l": "wear-shoe.glb",
    "wear-sunglasses": "wear-sunglasses.glb",
    "wear-backpack": "wear-backpack.glb",
    "wear-muffler": "wear-muffler.glb",
    "wear-necklace": "wear-necklace.glb",
}


def load_glb_tools():
    spec = importlib.util.spec_from_file_location("split_furniture", Path(__file__).with_name("split-furniture.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def extract(doc: dict, binary: bytes, name: str) -> tuple[dict, bytes]:
    """이름이 name인 노드 하나(뼈대로 휘면 그 뼈대까지)만 담은 새 glb 문서."""
    index = next((i for i, n in enumerate(doc["nodes"]) if n.get("name") == name), None)
    if index is None:
        raise SystemExit(f"묶음에 없는 모델: {name}")
    parent = {child: i for i, n in enumerate(doc["nodes"]) for child in n.get("children", [])}

    # 담을 노드: 모델 노드와 그 위, 뼈대로 휘면 뼈들과 그 위
    keep = set()

    def keep_up(i: int) -> None:
        while i is not None and i not in keep:
            keep.add(i)
            i = parent.get(i)

    keep_up(index)
    skin_index = doc["nodes"][index].get("skin")
    if skin_index is not None:
        for joint in doc["skins"][skin_index]["joints"]:
            keep_up(joint)

    out = {"asset": doc["asset"], "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [], "accessors": [], "bufferViews": [], "buffers": []}
    for key in ("extensionsUsed", "extensionsRequired"):
        if key in doc:
            out[key] = doc[key]
    new_binary = bytearray()
    maps = {key: {} for key in ("view", "accessor", "material", "mesh", "texture", "image", "sampler")}

    def take(kind: str, i: int, make):
        if i not in maps[kind]:
            maps[kind][i] = make(i)
        return maps[kind][i]

    def add(key: str, value) -> int:
        out.setdefault(key, []).append(value)
        return len(out[key]) - 1

    def view(i: int) -> int:
        v = dict(doc["bufferViews"][i])
        start = v.get("byteOffset", 0)
        chunk = binary[start : start + v["byteLength"]]
        while len(new_binary) % 4:
            new_binary.append(0)
        v["byteOffset"] = len(new_binary)
        v["buffer"] = 0
        new_binary.extend(chunk)
        return add("bufferViews", v)

    def accessor(i: int) -> int:
        a = dict(doc["accessors"][i])
        if "sparse" in a:
            raise SystemExit("sparse 접근자는 다루지 않는다")
        if "bufferView" in a:
            a["bufferView"] = take("view", a["bufferView"], view)
        return add("accessors", a)

    def image(i: int) -> int:
        im = dict(doc["images"][i])
        if "bufferView" not in im:
            raise SystemExit("glb 밖 그림은 다루지 않는다")
        im["bufferView"] = take("view", im["bufferView"], view)
        return add("images", im)

    def sampler(i: int) -> int:
        return add("samplers", dict(doc["samplers"][i]))

    def texture(i: int) -> int:
        t = dict(doc["textures"][i])
        if "source" in t:
            t["source"] = take("image", t["source"], image)
        if "sampler" in t:
            t["sampler"] = take("sampler", t["sampler"], sampler)
        return add("textures", t)

    def material(i: int) -> int:
        m = json.loads(json.dumps(doc["materials"][i]))

        def walk(value):
            if isinstance(value, dict):
                for k, v in value.items():
                    if k.endswith("Texture") and isinstance(v, dict) and "index" in v:
                        v["index"] = take("texture", v["index"], texture)
                    else:
                        walk(v)
            elif isinstance(value, list):
                for v in value:
                    walk(v)

        walk(m)
        return add("materials", m)

    def mesh(i: int) -> int:
        m = json.loads(json.dumps(doc["meshes"][i]))
        for p in m["primitives"]:
            p["attributes"] = {k: take("accessor", v, accessor) for k, v in p["attributes"].items()}
            if "indices" in p:
                p["indices"] = take("accessor", p["indices"], accessor)
            if "material" in p:
                p["material"] = take("material", p["material"], material)
            if "targets" in p:
                p["targets"] = [{k: take("accessor", v, accessor) for k, v in t.items()} for t in p["targets"]]
        return add("meshes", m)

    # 노드 번호를 먼저 정하고(뼈대가 노드 번호를 가리킨다) 내용을 옮긴다
    order = [i for i in range(len(doc["nodes"])) if i in keep]
    node_map = {old: new for new, old in enumerate(order)}
    for old in order:
        n = json.loads(json.dumps(doc["nodes"][old]))
        n.pop("skin", None)
        if "camera" in n:
            raise SystemExit("카메라가 든 노드는 다루지 않는다")
        if "mesh" in n:
            n["mesh"] = take("mesh", n["mesh"], mesh)
        if "children" in n:
            n["children"] = [node_map[c] for c in n["children"] if c in keep]
            if not n["children"]:
                del n["children"]
        out["nodes"].append(n)
    if skin_index is not None:
        s = dict(doc["skins"][skin_index])
        s["joints"] = [node_map[j] for j in s["joints"]]
        if "skeleton" in s:
            s["skeleton"] = node_map[s["skeleton"]]
        if "inverseBindMatrices" in s:
            s["inverseBindMatrices"] = take("accessor", s["inverseBindMatrices"], accessor)
        out["skins"] = [s]
        out["nodes"][node_map[index]]["skin"] = 0
    roots = doc["scenes"][doc.get("scene", 0)]["nodes"]
    out["scenes"][0]["nodes"] = [node_map[i] for i in roots if i in keep]
    out["buffers"].append({"byteLength": len(new_binary) + (4 - len(new_binary) % 4) % 4})
    return out, bytes(new_binary)


def main() -> int:
    tools = load_glb_tools()
    doc, binary = tools.read_glb(SOURCE)
    SERVER_DIR.mkdir(parents=True, exist_ok=True)
    for name, file_name in MODELS.items():
        part_doc, part_binary = extract(doc, binary, name)
        target = SERVER_DIR / file_name
        tools.write_glb(target, part_doc, part_binary)
        print(f"{name}: {target.name} {target.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
