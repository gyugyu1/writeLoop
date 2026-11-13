# 라룹이 모델(writeloop.glb)에 '고글 끄기'를 더한다(캐릭터 꾸미기 ⑤: 라룹이 고글은 얼굴장식 아이템).
# 쓰는 법: python scripts/lobby3d/add-goggles-toggle.py <라룹이 glb> <출력 glb> [고글 없는 그림 미리 보기 png]
#   (numpy·Pillow·scipy 필요. 입력은 고글 끄기가 아직 없는 라룹이 모델이어야 한다. 출력은 apps/mobile/assets/models/writeloop.glb)
# 라룹이의 고글은 따로 떨어진 조각이 아니라 머리 표면에 그려져 있고 테두리·끈이 살짝 솟아 있다. 그래서 둘을 더한다:
#   1. 몸 메시의 모양 변형(morph target) "noGoggles": 고글 점을 머리 가운데에서 본 주변 털 표면 거리로 끌어내린다.
#   2. 고글 자리를 주변 털색으로 메운 그림: 숨긴 작은 메시 "writeloop_nogoggles"의 재질로 넣어, 앱이 그 그림을 꺼내 몸 재질과 바꿔 낀다.
# 앱은 고글을 감출 때 모양 변형을 1로, 몸 그림을 고글 없는 그림으로 바꾼다. 나머지(점·뼈대·동작·외곽선 속성)는 그대로 둔다.
# 고글 점: 머리 뼈가 가장 큰 무게인 점 가운데 높이(glTF y) 0.625~0.9의 띠에서 털색(밝고 채도가 낮은 색)이 아닌 점과, 둘레가 모두 고글인 점.
# 눈·입(높이 0.62 아래)과 귀(귀 뼈)는 들지 않는다.
import io
import json
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

BAND = (0.625, 0.9)
MORPH = "noGoggles"
NODE = "writeloop_nogoggles"

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def load(path):
    b = open(path, "rb").read()
    assert b[:4] == b"glTF"
    off = 12
    js, binb = None, b""
    while off < len(b):
        ln, ty = struct.unpack_from("<II", b, off)
        off += 8
        chunk = b[off : off + ln]
        off += ln
        if ty == 0x4E4F534A:
            js = json.loads(chunk)
        elif ty == 0x004E4942:
            binb = chunk
    return js, bytearray(binb)


def read(js, binb, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    dt = np.dtype(CT[a["componentType"]])
    n = NC[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0) or dt.itemsize * n
    raw = np.frombuffer(bytes(binb), dtype=np.uint8)
    rows = np.stack([raw[start + k * stride : start + k * stride + dt.itemsize * n] for k in range(a["count"])])
    out = rows.view(dt).reshape(a["count"], n)
    if a.get("normalized"):
        out = out.astype(np.float32) / np.iinfo(dt).max
    return out


def add_view(js, binb, data, target=None):
    while len(binb) % 4:
        binb.append(0)
    off = len(binb)
    binb.extend(data)
    view = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
    if target:
        view["target"] = target
    js["bufferViews"].append(view)
    return len(js["bufferViews"]) - 1


def add_accessor(js, binb, array, kind, target=None, minmax=False):
    array = np.ascontiguousarray(array)
    ct = {np.dtype(np.float32): 5126, np.dtype(np.uint16): 5123, np.dtype(np.uint32): 5125}[array.dtype]
    acc = {"bufferView": add_view(js, binb, array.tobytes(), target), "componentType": ct, "count": len(array), "type": kind}
    if minmax:
        acc["min"] = array.min(0).tolist()
        acc["max"] = array.max(0).tolist()
    js["accessors"].append(acc)
    return len(js["accessors"]) - 1


def save(path, js, binb):
    while len(binb) % 4:
        binb.append(0)
    js["buffers"][0]["byteLength"] = len(binb)
    j = json.dumps(js, separators=(",", ":"), ensure_ascii=False).encode()
    while len(j) % 4:
        j += b" "
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(binb)))
        f.write(struct.pack("<II", len(j), 0x4E4F534A))
        f.write(j)
        f.write(struct.pack("<II", len(binb), 0x004E4942))
        f.write(bytes(binb))


def main(src, out, preview=None):
    js, binb = load(src)
    node = next(n for n in js["nodes"] if n.get("name") == "writeloop_body")
    mesh = js["meshes"][node["mesh"]]
    prim = mesh["primitives"][0]
    if prim.get("targets"):
        raise SystemExit("이미 모양 변형이 있다(고글 끄기를 두 번 더하지 않는다)")
    attrs = prim["attributes"]
    P = read(js, binb, attrs["POSITION"]).astype(np.float64)
    UV = read(js, binb, attrs["TEXCOORD_0"])
    J = read(js, binb, attrs["JOINTS_0"])
    Wt = read(js, binb, attrs["WEIGHTS_0"])
    idx = read(js, binb, prim["indices"]).reshape(-1, 3).astype(np.int64)
    skin = js["skins"][node["skin"]]
    names = [js["nodes"][j].get("name") for j in skin["joints"]]
    dom = J[np.arange(len(J)), np.argmax(Wt, axis=1)]
    is_head = dom == names.index("head")

    material = js["materials"][prim["material"]]
    tex_index = material["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    texture = js["textures"][tex_index]
    image_def = js["images"][texture["source"]]
    bv = js["bufferViews"][image_def["bufferView"]]
    img = Image.open(io.BytesIO(bytes(binb[bv.get("byteOffset", 0) : bv.get("byteOffset", 0) + bv["byteLength"]]))).convert("RGBA")
    W, H = img.size
    px = np.asarray(img).astype(np.float32) / 255

    # 점마다 그림 색
    u = np.clip((UV[:, 0] * W).astype(int), 0, W - 1)
    v = np.clip((UV[:, 1] * H).astype(int), 0, H - 1)
    C = px[v, u, :3]
    mx, mn = C.max(1), C.min(1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    fur = (mx > 0.6) & (sat < 0.15)
    in_band = is_head & (P[:, 1] >= BAND[0]) & (P[:, 1] <= BAND[1])
    goggle = in_band & ~fur

    # 이웃(같은 면)
    neighbors = [set() for _ in range(len(P))]
    for a, b, c in idx:
        neighbors[a].update((b, c))
        neighbors[b].update((a, c))
        neighbors[c].update((a, b))
    # 둘레가 모두 고글인 띠 안의 점(렌즈의 밝은 반사 등)도 고글
    for _ in range(2):
        add = [i for i in np.nonzero(in_band & ~goggle)[0] if neighbors[i] and all(goggle[n] for n in neighbors[i])]
        goggle[add] = True
    # 고글 가장자리(테두리·끈이 솟기 시작하는 옆벽. 털색이라 위에서 빠진다)까지 네 겹 넓힌다
    for _ in range(4):
        edge = [i for i in np.nonzero(in_band & ~goggle)[0] if any(goggle[n] for n in neighbors[i])]
        goggle[edge] = True
    print("goggle vertices", int(goggle.sum()), "of", len(P))

    # 1. 모양 변형: 같은 자리에 겹친 점(그림 이음새)을 하나로 묶고, 고글 점을 둘레 점들의 평균 자리로 거듭 옮겨
    #    위아래 털 표면을 잇는 매끈한 면으로 편다(고글이 아닌 점은 그대로). 머리 위에 따로 덧붙은 고글 조각 가운데
    #    바로 아래에 머리 표면이 있는 것은 펴지 않고 안쪽으로 접어 숨긴다.
    keys = np.round(P * 1e5).astype(np.int64)
    _, group = np.unique(keys, axis=0, return_inverse=True)
    group = group.reshape(-1)
    G = group.max() + 1
    gpos = np.zeros((G, 3))
    np.add.at(gpos, group, P)
    gpos /= np.bincount(group, minlength=G)[:, None]
    gnb = [set() for _ in range(G)]
    for i in range(len(P)):
        gnb[group[i]].update(group[n] for n in neighbors[i])
    for g in range(G):
        gnb[g].discard(g)
    ggog = np.zeros(G, dtype=bool)
    ggog[group[goggle]] = True
    ghead = np.zeros(G, dtype=bool)
    ghead[group[is_head]] = True

    center = (P[is_head].min(0) + P[is_head].max(0)) / 2
    head_pts = gpos[ghead & ~ggog]
    hdirs = head_pts - center
    hrad = np.linalg.norm(hdirs, axis=1)
    hdirs /= hrad[:, None]

    # 묶은 점으로 조각을 나눈다
    gcomp = -np.ones(G, dtype=np.int64)
    for s0 in range(G):
        if gcomp[s0] >= 0:
            continue
        stack = [s0]
        gcomp[s0] = s0
        while stack:
            x = stack.pop()
            for n in gnb[x]:
                if gcomp[n] < 0:
                    gcomp[n] = s0
                    stack.append(n)
    target = gpos.copy()
    folded = np.zeros(G, dtype=bool)
    fixed = np.zeros(G, dtype=bool)
    vec = gpos - center
    rad = np.linalg.norm(vec, axis=1)
    unit = vec / np.maximum(rad, 1e-9)[:, None]
    all_head = np.nonzero(ghead)[0]
    for c in np.unique(gcomp[ggog]):
        members = np.nonzero(gcomp == c)[0]
        if not ggog[members].all():
            continue  # 털과 이어진 조각: 아래에서 거리를 매끈하게 잇는다
        others = all_head[gcomp[all_head] != c]
        cen = gpos[members].mean(0)
        d = cen - center
        r = np.linalg.norm(d)
        d /= r
        od = unit[others]
        cone = od @ d > np.cos(np.radians(10))
        under = cone & (rad[others] < r - 0.003) & (rad[others] > r - 0.06)
        if under.sum() >= 3:
            # 아래에 머리 표면이 있는 덧붙은 껍질: 안쪽으로 접어 숨긴다
            target[members] = center + unit[members] * (rad[members] * 0.7)
            folded[members] = True
            continue
        # 아래가 빈 조각(렌즈처럼 그 자리의 겉면인 것): 점마다 둘레(다른 조각의 털 점) 거리로 맞춘다
        fur_others = others[~ggog[others]]
        fu = unit[fur_others]
        fr = rad[fur_others]
        for g in members:
            cosv = fu @ unit[g]
            near = cosv > np.cos(np.radians(9))
            if near.sum() < 3:
                near = cosv >= np.sort(cosv)[-6]
            target[g] = center + unit[g] * (min(float(np.median(fr[near])), rad[g]) - 0.001)
        fixed[members] = True
    # 털과 이어진 고글 점: 머리 가운데에서 잰 거리만 둘레와 매끈하게 잇는다(방향은 그대로라 오그라들지 않는다)
    free = np.nonzero(ggog & ~folded & ~fixed)[0]
    nb_lists = [np.fromiter(gnb[g], dtype=np.int64) for g in free]
    smooth = rad.copy()
    for g in np.nonzero(fixed)[0]:
        smooth[g] = np.linalg.norm(target[g] - center)
    for _ in range(600):
        nxt = smooth.copy()
        for g, nbs in zip(free, nb_lists):
            if len(nbs):
                nxt[g] = smooth[nbs].mean()
        smooth = nxt
    for g in free:
        target[g] = center + unit[g] * (min(smooth[g], rad[g]) - 0.001)
    deltas = (target[group] - P).astype(np.float32)
    print("goggle groups", int(ggog.sum()), "folded groups", int(folded.sum()), "max push", float(np.linalg.norm(deltas, axis=1).max()))

    # 2. 고글 자리를 털색으로 메운 그림: 그림의 픽셀마다 머리 삼각형의 3D 높이를 칠해 두고(삼각형 평균 높이),
    #    머리이면서 고글 높이 띠에 든 픽셀 가운데 털색이 아닌 것을 가린 뒤 둘레 털색으로 안쪽까지 메운다
    ymap_img = Image.new("F", (W, H), -1.0)
    draw = ImageDraw.Draw(ymap_img)
    for a, b, c in idx:
        if is_head[a] and is_head[b] and is_head[c]:
            draw.polygon([(UV[k, 0] * W, UV[k, 1] * H) for k in (a, b, c)], fill=float((P[a, 1] + P[b, 1] + P[c, 1]) / 3))
    ymap = np.asarray(ymap_img)
    pmx, pmn = px[..., :3].max(-1), px[..., :3].min(-1)
    psat = np.where(pmx > 0, (pmx - pmn) / np.maximum(pmx, 1e-6), 0)
    furpx = (pmx > 0.6) & (psat < 0.15)
    # 머리 삼각형 사이 틈(그림에서 칠해지지 않은 픽셀)까지 들도록 띠 자리를 6픽셀 넓힌다
    band = (ymap >= BAND[0]) & (ymap <= BAND[1])
    for _ in range(6):
        grow = band.copy()
        grow[1:, :] |= band[:-1, :]
        grow[:-1, :] |= band[1:, :]
        grow[:, 1:] |= band[:, :-1]
        grow[:, :-1] |= band[:, 1:]
        band = grow & ((ymap < 0) | (ymap >= BAND[0]))  # 띠 아래(눈·입)로는 넓히지 않는다
    mask = band & ~furpx
    # 눈처럼 대부분이 띠 아래(얼굴)에 있는 그림 덩어리는 위쪽 끝이 띠에 걸쳐도 지우지 않는다
    labels, count = ndimage.label(~furpx)
    below = ndimage.sum((ymap >= 0) & (ymap < BAND[0]), labels, index=np.arange(1, count + 1))
    inside = ndimage.sum((ymap >= BAND[0]) & (ymap <= BAND[1]), labels, index=np.arange(1, count + 1))
    keep = np.zeros(count + 1, dtype=bool)
    keep[1:] = below > inside * 0.5
    mask &= ~keep[labels]
    print("mask pixels", int(mask.sum()))
    # 둘레의 털색 픽셀만 재료로 안쪽까지 메운다(고글 색이 번지지 않게). 가린 픽셀만 바꾼다
    filled = px.copy()
    known = (pmx > 0.82) & (psat < 0.12) & ~mask
    todo = mask.copy()
    for _ in range(600):
        if not todo.any():
            break
        acc_c = np.zeros_like(filled)
        cnt = np.zeros(mask.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            shifted_known = np.roll(np.roll(known, dy, 0), dx, 1)
            shifted = np.roll(np.roll(filled, dy, 0), dx, 1)
            acc_c += shifted * shifted_known[..., None]
            cnt += shifted_known
        front = todo & (cnt > 0)
        filled[front] = acc_c[front] / cnt[front][:, None]
        known = known | front
        todo = todo & ~front
    # 메운 자리의 결 무늬를 지우려고 메운 자리만 살짝 흐리게 한다
    blurred = np.stack([ndimage.uniform_filter(filled[..., k], size=7) for k in range(4)], axis=-1)
    result = px.copy()
    result[mask] = blurred[mask]
    filled = result
    out_img = Image.fromarray((np.clip(filled, 0, 1) * 255).astype(np.uint8), "RGBA")
    if preview:
        out_img.save(preview)
    buf = io.BytesIO()
    out_img.save(buf, "PNG", optimize=True)

    # 모양 변형 붙이기
    prim["targets"] = [{"POSITION": add_accessor(js, binb, deltas, "VEC3", target=34962, minmax=True)}]
    mesh["weights"] = [0.0]
    mesh.setdefault("extras", {})["targetNames"] = [MORPH]

    # 고글 없는 그림: 새 그림·텍스처·재질과, 그 재질을 쓰는 숨긴 작은 메시(삼각형 하나)
    view = add_view(js, binb, buf.getvalue())
    js["images"].append({"bufferView": view, "mimeType": "image/png", "name": "writeloop_body_nogoggles"})
    new_tex = dict(texture)
    new_tex["source"] = len(js["images"]) - 1
    js["textures"].append(new_tex)
    new_mat = json.loads(json.dumps(material))
    new_mat["name"] = "writeloop_body_nogoggles"
    new_mat["pbrMetallicRoughness"]["baseColorTexture"] = {"index": len(js["textures"]) - 1}
    js["materials"].append(new_mat)
    tri = np.array([[0, 0, 0], [0.001, 0, 0], [0, 0.001, 0]], dtype=np.float32)
    tri_uv = np.array([[0, 0], [1, 0], [0, 1]], dtype=np.float32)
    js["meshes"].append(
        {
            "name": NODE,
            "primitives": [
                {
                    "attributes": {
                        "POSITION": add_accessor(js, binb, tri, "VEC3", target=34962, minmax=True),
                        "TEXCOORD_0": add_accessor(js, binb, tri_uv, "VEC2", target=34962),
                    },
                    "material": len(js["materials"]) - 1,
                }
            ],
        }
    )
    js["nodes"].append({"name": NODE, "mesh": len(js["meshes"]) - 1})
    js["scenes"][js.get("scene", 0)]["nodes"].append(len(js["nodes"]) - 1)
    save(out, js, binb)
    print("wrote", out)


if __name__ == "__main__":
    main(*sys.argv[1:4])
