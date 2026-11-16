# 지금 고글(wear-goggles.glb)의 렌즈 판은 모양 그대로 두고(돌리기·옮기기만) 이마에 더 가깝게 놓고, 띠만 머리를 따라 감기게 새로 만든다.
# 입력은 지금 앱에 든 고글(= 기존 build-goggles.py가 받은 원본 고글에서 만든 결과)이다. 이 파일을 고쳐 만드는 방식이다.
#   blender -b --factory-startup -P fit-goggles-to-head.py -- <지금 wear-goggles.glb> <몸.glb> <out.glb> [이름=값 ...]
# 예:
#   blender -b --factory-startup -P fit-goggles-to-head.py -- wear-goggles.glb writeloop.glb out\wear-goggles.glb
# (Blender는 mathutils의 BVH와 질감 읽기에만 쓴다. glb는 이 스크립트가 직접 읽고 쓴다: 판의 꼭짓점 차례·UV·법선(돌리기만)·질감 그림 바이트·재질·노드가 지금 파일 그대로다.)
# 이름=값(길이는 m, 몸 좌표: x 캐릭터 왼쪽, y 위, z 앞):
#   plate_z    렌즈 판을 가르는 값(기본 0.19). 지금 고글의 UV 섬(인덱스로 이어진 점 묶음) 가운데 모든 점의 z가 이 값 이상인 섬이 판이고, 나머지는 띠다(qa 테스트의 판 찾기와 같다)
#   pose       판 자리를 직접 줄 때: "눕히는 각도(도),위로(m),앞으로(m)". 안 주면 아래 한도 안에서 판 가운데 뒷면이 이마에 가장 가까운 자리를 찾는다
#   max_shrink 눕혀서 앞에서 본 높이가 줄어도 되는 한도(기본 0.04 = 4%. qa 판정 G4는 ±5%)
#   max_dy     판 위·아래 끝 높이가 달라져도 되는 한도(기본 0.007. qa 판정 G4는 ±1cm)
#   gap        판을 몸에 댈 때 표본점(꼭짓점·변 가운데·면 가운데)과 몸 사이에 남기는 틈(기본 0.001)
#   strap_h, strap_t  새 띠의 높이·두께(기본 0.062, 0.026 = 받은 띠와 같게)
#   strap_clr  띠 안쪽 면과 몸 사이 틈(기본 0.0035)
#   strap_n    띠를 나누는 마디 수(기본 44)
#   arm_x      판 끝에서 머리로 가는 이음 띠가 판 뒤의 띠 자리(띠가 붙어 있던 구멍) 어디에서 나오는지(0 = 안쪽 끝, 1 = 바깥 끝. 기본 0.35)
#   arm_off    띠가 붙어 있던 구멍에서 첫 띠 단면까지 거리(구멍 테두리에서 띠 단면으로 좁아지는 길이. 기본 0.025)
#   strap_back_y  띠 뒤쪽 가운데 높이(기본: 지금 띠의 뒤쪽 가운데 높이)
#   hug_max    머리에 감기는 구간에서 띠 안쪽 면의 가운데가 몸에서 이보다 멀면 쪼개서 붙인다(기본 0.006)
# 결과: 메시 노드 하나(이름 wear-goggles), 노드 변환 없음, 몸 좌표(쉬는 자세). <out.glb>.info.json에 쓴 값과 확인 수치를 남긴다.
# 하는 일:
#   1) 지금 고글에서 판(위 plate_z 규칙)의 삼각형만 남긴다. 판 꼭짓점은 지금 파일의 차례·UV 그대로다.
#   2) 판을 가로축(x) 둘레로 눕히고(위쪽이 뒤로) 위아래·앞뒤로 옮긴다. 판 안의 점 사이 거리는 그대로다.
#      자리는 각도·높이마다 판을 뒤로 밀어 몸에 처음 닿는 곳(틈 gap)으로 잡고, 판 가운데 뒷면(가운데에서 좌우 6cm 안)의 이마까지 평균 거리가 가장 작은 것을 고른다.
#   3) 띠: 판 뒤의 띠 자리(구멍)에서 뒤로 곧게 가 가장 가까운 머리 옆면(관자놀이)에 닿고(이음 구간. 판 끝이 머리에서 떠 있어 이 구간은 뜨지만 갈수록 머리에 가까워진다),
#      거기서부터 귀 뿌리를 지나 머리 뒤로 머리에 감긴다. 감기는 구간은 바깥 모양이 팽팽한 띠이고 안쪽 면만 몸에 닿게 내려 붙인다.
#      띠의 첫 부분은 판의 구멍 테두리에서 띠 단면으로 좁아지며 이어진다. 띠 색은 지금 띠의 질감 자리 하나를 쓴다(질감 그림은 그대로다).
# 확인: 끝에 적는 check(몸 속 표본점, 띠에서 몸을 향하고 가려지지 않은 면의 거리), size(G4), 판 점 사이 거리 변화를 본다.
#       몸 파일이 바뀌면 다시 만들고 이 수와 그림을 다시 본다. 같은 입력이면 결과 파일이 바이트까지 같다.
import json
import math
import os
import struct
import sys
import tempfile

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1:]
base_glb, body_glb, dst = args[:3]
kv = dict(a.split("=", 1) for a in args[3:] if "=" in a)
num = lambda name, default: float(kv.get(name, default))
PLATE_Z = num("plate_z", 0.19)
MAX_SHRINK = num("max_shrink", 0.04)
MAX_DY = num("max_dy", 0.007)
GAP = num("gap", 0.001)
CEN_HALF = num("center_half", 0.06)      # "판 가운데"로 보는 좌우 폭의 절반(자리 찾기에 쓴다)
STRAP_H = num("strap_h", 0.062)
STRAP_T = num("strap_t", 0.026)
STRAP_CLR = num("strap_clr", 0.0035)
STRAP_N = int(kv.get("strap_n", 44))
ARM_X = num("arm_x", 0.35)
ARM_OFF = num("arm_off", 0.025)
AXIS_Z = num("axis_z", -0.015)           # 띠가 도는 세로축의 앞뒤 자리
SMOOTH_DEG = num("strap_smooth", 3.0)    # 감기는 구간의 반지름을 둘레 방향으로 고르게 하는 폭(도)
TAUT_ROUNDS = int(kv.get("strap_taut", 3))
TURN_WEIGHT = num("strap_turn", 0.05)    # 굽은 곳에 마디를 더 주는 정도(라디안당 m)
PAD_UNIT = num("strap_pad_unit", 0.006)  # 팽팽한 띠가 몸에서 이만큼 뜬 곳은 마디를 두 배로 촘촘히
DIP_MAX = num("strap_dip", 0.03)         # 감기는 구간에서 띠 안쪽이 몸 쪽으로 두꺼워지는 한도
HUG_MAX = num("hug_max", 0.006)
MIN_OUT = num("min_out", 0.0012)         # 띠 표본점이 몸에서 이만큼은 밖에 있게 한다
POKE_MAX = int(kv.get("poke_max", 40))   # 띠 안쪽 면을 쪼개는 횟수 한도
HUG_ZONE = num("hug_zone", 0.004)        # 판 가까이(판 끝이 뜬 거리 + 3cm 안)의 감기는 구간에서는 이보다 멀면 쪼개서 붙인다
COLLAR = num("collar", 0.006)            # 판 구멍 테두리에 두르는 좁은 띠의 폭

smoothstep = lambda t: (lambda u: u * u * (3 - 2 * u))(np.clip(t, 0.0, 1.0))
unit = lambda v: v / (np.linalg.norm(v) + 1e-30)

# ---------- glb 읽기 ----------
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def glb_load(path):
    b = open(path, "rb").read()
    jl = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20 + jl].decode("utf8"))
    bl = struct.unpack_from("<I", b, 20 + jl)[0]
    return js, b[20 + jl + 8:20 + jl + 8 + bl]


def accessor(js, bin_, i):
    a = js["accessors"][i]; v = js["bufferViews"][a["bufferView"]]
    n = NC[a["type"]]; dt = np.dtype(CT[a["componentType"]])
    off = v.get("byteOffset", 0) + a.get("byteOffset", 0); stride = v.get("byteStride", n * dt.itemsize)
    if stride == n * dt.itemsize:
        return np.frombuffer(bin_, dt, a["count"] * n, off).reshape(a["count"], n).copy()
    return np.stack([np.frombuffer(bin_, dt, n, off + k * stride) for k in range(a["count"])])


def first_mesh(js):
    node = next(n for n in js["nodes"] if "mesh" in n)
    return js["meshes"][node["mesh"]]["primitives"][0]


bjs, bbin = glb_load(body_glb)
bp = first_mesh(bjs)
BP = accessor(bjs, bbin, bp["attributes"]["POSITION"]).astype(np.float64)   # 쉬는 자세(테스트가 보는 것과 같은 점)
BI = accessor(bjs, bbin, bp["indices"]).reshape(-1, 3).astype(np.int64)
tree = BVHTree.FromPolygons([tuple(p) for p in BP], [tuple(int(k) for k in t) for t in BI])

gjs, gbin = glb_load(base_glb)
gp = first_mesh(gjs)
P = accessor(gjs, gbin, gp["attributes"]["POSITION"]).astype(np.float64)
N = accessor(gjs, gbin, gp["attributes"]["NORMAL"]).astype(np.float64)
UV = accessor(gjs, gbin, gp["attributes"]["TEXCOORD_0"]).astype(np.float64)
I = accessor(gjs, gbin, gp["indices"]).reshape(-1, 3).astype(np.int64)
iv = gjs["bufferViews"][gjs["images"][0]["bufferView"]]
IMG = gbin[iv.get("byteOffset", 0):iv.get("byteOffset", 0) + iv["byteLength"]]
print("base goggles verts", len(P), "tris", len(I), "| body tris", len(BI))


def dist(p):
    return tree.find_nearest(Vector(p))[3]


def nearest(p):
    return np.array(tree.find_nearest(Vector(p))[0])


def inside(p):
    """몸 속인가: 세 방향으로 쏜 광선이 몸 표면을 홀수 번 지나는지 세어 다수로 정한다."""
    votes = 0
    for d in (Vector((0.0, 0.0, 1.0)), Vector((0.0, 1.0, 0.0)), Vector((0.5774, 0.5774, 0.5774))):
        o = Vector(p); hits = 0
        while True:
            h = tree.ray_cast(o, d, 5.0)
            if h[0] is None:
                break
            hits += 1
            o = h[0] + d * 1e-6
        votes += hits % 2
    return votes >= 2


def sdist(p):
    """몸까지 부호 있는 거리(밖 +, 속 -)."""
    d = dist(p)
    return -d if inside(p) else d


def extent(X):
    y0, y1 = X[:, 1].min(), X[:, 1].max(); m = X[:, 1] >= y0 + 0.75 * (y1 - y0)
    return float(y0), float(y1), float(X[m, 0].max() - X[m, 0].min())


# ---------- 1. 판과 띠를 나눈다 ----------
# 판 = 지금 고글의 UV 섬(삼각형 인덱스로 이어진 점 묶음) 가운데 모든 점의 z가 plate_z 이상인 섬. 띠의 섬은 옆·뒤로 이어져 z가 작은 점을 품는다.
par = np.arange(len(P))


def find(a):
    while par[a] != a:
        par[a] = par[par[a]]; a = par[a]
    return a


for t in I:
    par[find(t[0])] = find(t[1]); par[find(t[1])] = find(t[2])
root_of = np.array([find(i) for i in range(len(P))])
not_plate = np.zeros(len(P), bool); np.logical_or.at(not_plate, root_of, P[:, 2].astype(np.float32) < PLATE_Z)
is_plate_v = ~not_plate[root_of]
used = np.where(is_plate_v)[0]                                   # 판 꼭짓점(지금 파일 차례 그대로)
remap = np.full(len(P), -1); remap[used] = np.arange(len(used))
PL_T = remap[I[is_plate_v[I].all(1)]]                            # 판 삼각형
PL_N = N[used]; PL_UV = UV[used]
V0 = P[used]
c0 = (V0.min(0) + V0.max(0)) / 2                                 # 판 가운데(돌리는 축이 지나는 곳)
E = np.concatenate([PL_T[:, [0, 1]], PL_T[:, [1, 2]], PL_T[:, [2, 0]]]); E.sort(1); E = np.unique(E, axis=0)
S0 = np.concatenate([V0, V0[PL_T].mean(1), (V0[E[:, 0]] + V0[E[:, 1]]) / 2])   # 판 표본점(꼭짓점·면 가운데·변 가운데)
T0 = V0[PL_T]; fc0 = T0.mean(1); fn0 = np.cross(T0[:, 1] - T0[:, 0], T0[:, 2] - T0[:, 0]); far0 = np.linalg.norm(fn0, axis=1) / 2
fn0 /= (2 * far0[:, None] + 1e-30); fn0[(fn0 * PL_N[PL_T].sum(1)).sum(1) < 0] *= -1
backf = (fn0[:, 2] < -0.7) & (far0 > 1e-9)                       # 판 뒷면(뒤를 보는 면)
cenf = backf & (np.abs(fc0[:, 0] - c0[0]) < CEN_HALF)            # 판 가운데 뒷면
base_ext = extent(P)
print("plate verts", len(used), "tris", len(PL_T), "| strap tris removed", len(I) - len(PL_T), "| back faces", int(backf.sum()), "central", int(cenf.sum()))

# 띠 색 자리: 지금 띠(머리 뒤쪽) 면 가운데 둘레 색이 고르고 띠의 보통 밝기에 가까운 질감 자리 하나. 새 띠는 모두 이 색을 쓴다.
import bpy
tmp = os.path.join(tempfile.gettempdir(), "wear-goggles-v2-texture.jpg")
open(tmp, "wb").write(IMG)
img = bpy.data.images.load(tmp)
TW, THH = img.size
px = np.empty(TW * THH * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(THH, TW, 4)[:, :, :3]   # 아래 줄부터
tri_z = P[I][:, :, 2].mean(1)
cands = []
for t in np.where(tri_z < 0.5 * P[:, 2].min())[0]:
    u, v = UV[I[t]].mean(0)
    ci, cj = int(round((1 - v) * (THH - 1))), int(round(u * (TW - 1)))
    if 4 <= ci < THH - 4 and 4 <= cj < TW - 4:
        win = px[ci - 4:ci + 5, cj - 4:cj + 5].reshape(-1, 3)
        cands.append((float(win.mean()), float(win.std()), float(u), float(v)))
med = float(np.median([c[0] for c in cands]))
best = min(cands, key=lambda c: (round(c[1] + abs(c[0] - med), 4), c[2], c[3]))
STRAP_UV = np.array((best[2], best[3]))
print("strap color uv(glTF)", STRAP_UV.round(4), "mean", round(best[0], 3), "spread", round(best[1], 4))
back_strap = P[P[:, 2] < 0.9 * P[:, 2].min()]
STRAP_BACK_Y = num("strap_back_y", (back_strap[:, 1].min() + back_strap[:, 1].max()) / 2)


# ---------- 2. 판 자리(돌리기·옮기기만) ----------
def pose_pts(X, ang, ty, tz):
    ca, sa = math.cos(ang), math.sin(ang); d = X - c0
    return np.stack([c0[0] + d[:, 0], c0[1] + d[:, 1] * ca + d[:, 2] * sa + ty, c0[2] - d[:, 1] * sa + d[:, 2] * ca + tz], 1)


def pose_dirs(Dv, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    return np.stack([Dv[:, 0], Dv[:, 1] * ca + Dv[:, 2] * sa, -Dv[:, 1] * sa + Dv[:, 2] * ca], 1)


def touch_tz(ang, ty):
    """그 각도·높이에서 판을 뒤로 밀어 표본점이 몸에 처음 닿는 자리(틈 GAP)."""
    X = pose_pts(S0, ang, ty, 0.30); go = 9.0
    for p in X:
        h = tree.ray_cast(Vector(p), Vector((0, 0, -1)), 2.0)
        if h[0] is not None and h[3] < go:
            go = h[3]
    return 0.30 - go + GAP


def back_dist(ang, ty, tz):
    d = np.array([dist(p) for p in pose_pts(fc0, ang, ty, tz)])
    return {"center_mean": float(np.average(d[cenf], weights=far0[cenf])), "center_min": float(d[cenf].min()),
            "back_mean": float(np.average(d[backf], weights=far0[backf])), "back_max": float(d[backf].max())}


def size_change(ang, ty, tz):
    y0, y1, uw = extent(pose_pts(V0, ang, ty, tz))
    return (y1 - y0) / (base_ext[1] - base_ext[0]) - 1, y0 - base_ext[0], y1 - base_ext[1], uw / base_ext[2] - 1


now = back_dist(0.0, 0.0, 0.0)
if kv.get("pose"):
    deg, ty, tz = [float(v) for v in kv["pose"].split(",")]
    ang = math.radians(deg)
else:
    def scan(degs, tys):
        out = []
        for deg in degs:
            for ty in tys:
                ang = math.radians(deg); tz = touch_tz(ang, ty)
                hch, dlo, dhi, wch = size_change(ang, ty, tz)
                if hch < -MAX_SHRINK or hch > MAX_SHRINK or abs(dlo) > MAX_DY or abs(dhi) > MAX_DY or abs(wch) > MAX_SHRINK:
                    continue
                out.append((back_dist(ang, ty, tz)["center_mean"], float(deg), float(ty), float(tz)))
        return out
    coarse = scan(np.arange(0.0, 36.1, 2.0), np.arange(-0.008, 0.0081, 0.004))
    _, d1, t1, _ = min(coarse)
    fine = scan(np.arange(d1 - 2.0, d1 + 2.01, 0.5), np.arange(t1 - 0.004, t1 + 0.0041, 0.001))
    _, deg, ty, tz = min(fine + coarse)
    ang = math.radians(deg)
new = back_dist(ang, ty, tz)
hch, dlo, dhi, wch = size_change(ang, ty, tz)
print(f"pose: tilt {deg:.1f} deg, up {ty*100:+.2f} cm, forward {tz*100:+.2f} cm | height {hch*100:+.2f}% yLo {dlo*100:+.2f}cm yHi {dhi*100:+.2f}cm upper width {wch*100:+.2f}%")
print("plate back to body (cm): center mean %.2f -> %.2f | center min %.2f -> %.2f | whole back mean %.2f -> %.2f | whole back max %.2f -> %.2f" % (
    now["center_mean"] * 100, new["center_mean"] * 100, now["center_min"] * 100, new["center_min"] * 100,
    now["back_mean"] * 100, new["back_mean"] * 100, now["back_max"] * 100, new["back_max"] * 100))
VP = pose_pts(V0, ang, ty, tz)            # 새 판 꼭짓점
VN = pose_dirs(PL_N, ang)
_R = np.array(((1, 0, 0), (0, math.cos(ang), math.sin(ang)), (0, -math.sin(ang), math.cos(ang))))
RIGID = np.eye(4); RIGID[:3, :3] = _R; RIGID[:3, 3] = c0 - _R @ c0 + np.array((0.0, ty, tz))   # 새 자리 = RIGID · 지금 자리
assert np.abs((np.c_[V0, np.ones(len(V0))] @ RIGID.T)[:, :3] - VP).max() < 1e-9
XC = float(c0[0])

# ---------- 3. 판 뒤에서 띠가 붙어 있던 자리(구멍)를 찾는다 ----------
key = np.round(VP / 1e-5).astype(np.int64)
_, weld = np.unique(key, axis=0, return_inverse=True); weld = weld.ravel()      # 질감 경계에서 갈라진 점을 같은 자리끼리 묶는다
count = {}
for t in PL_T:
    for k in range(3):
        a, b = int(weld[t[k]]), int(weld[t[(k + 1) % 3]])
        count[(min(a, b), max(a, b))] = count.get((min(a, b), max(a, b)), 0) + 1
starts = {}
for t in PL_T:
    for k in range(3):
        a, b = int(weld[t[k]]), int(weld[t[(k + 1) % 3]])
        if count[(min(a, b), max(a, b))] == 1:
            starts.setdefault(a, []).append((a, b, int(t[k])))                  # 붙은 면이 a → b로 돈다
loops = []
while starts:
    a = next(iter(starts)); loop = [starts[a].pop()]
    if not starts[a]:
        del starts[a]
    while loop[-1][1] != a and loop[-1][1] in starts:
        b = loop[-1][1]; loop.append(starts[b].pop())
        if not starts[b]:
            del starts[b]
    if loop[-1][1] == a and len(loop) >= 3:
        loops.append(np.array([VP[e[2]] for e in loop]))
holes = {}
for Lp in loops:
    cen = Lp.mean(0); size = np.linalg.norm(Lp - cen, axis=1).max(); side = 1 if cen[0] > XC else -1
    if size > 0.02 and (side not in holes or size > holes[side][1]):
        holes[side] = (Lp, size, cen)
print("open loops", len(loops), "| strap holes:", {s: (len(h[0]), np.round(h[2], 4).tolist()) for s, h in holes.items()})

# ---------- 4. 새 띠 ----------
R0 = 1.0


def env(th, y):
    """각도 th, 높이 y에서 바깥에서 축 쪽으로 쏜 광선이 처음 닿는 몸 반지름(귀처럼 튀어나온 곳을 넘어가게 가장 바깥을 쓴다)."""
    h = tree.ray_cast(Vector((XC + R0 * math.sin(th), y, AXIS_Z + R0 * math.cos(th))), Vector((-math.sin(th), 0.0, -math.cos(th))), R0)
    return R0 - h[3] if h[0] is not None else float("nan")


def gauss_kernel(sigma_cells):
    r = max(1, int(math.ceil(3 * sigma_cells)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma_cells) ** 2)
    return k / k.sum()


# 띠가 판에서 나오는 곳: 구멍 테두리가 놓인 평면에서, 구멍의 좌우 폭 가운데 arm_x 자리(안쪽 끝 0 ~ 바깥 끝 1).
arm_start = {}
for side, (Lp, size, cen) in holes.items():
    ax = np.abs(Lp[:, 0] - XC)
    x_arm = XC + side * (ax.min() + ARM_X * (ax.max() - ax.min()))
    nrm = unit(sum(np.cross(Lp[j] - cen, Lp[(j + 1) % len(Lp)] - cen) for j in range(len(Lp))))
    y_arm = (Lp[:, 1].min() + Lp[:, 1].max()) / 2
    z_arm = cen[2] - (nrm[0] * (x_arm - cen[0]) + nrm[1] * (y_arm - cen[1])) / nrm[2]      # 그 (x, y)에서 구멍 평면의 z
    arm_start[side] = np.array((x_arm, y_arm, z_arm))
y_end = (arm_start[1][1] + arm_start[-1][1]) / 2; z_end = (arm_start[1][2] + arm_start[-1][2]) / 2

# 감기는 구간의 팽팽한 띠: 방위각 1도마다(0 = 앞, 90도 = 캐릭터 왼쪽, 180도 = 뒤) 띠 높이 구간의 머리 반지름에 곧은 선을 맞춘다.
TH = np.radians(np.arange(35.0, 325.01, 1.0))
NTH = len(TH); KS = 7
r_mid = np.full(NTH, 0.30); slope = np.zeros(NTH); yc = np.zeros(NTH); hv = np.full(NTH, STRAP_H * 0.9)
samples_r = np.zeros((NTH, KS)); samples_y = np.zeros((NTH, KS))
for rnd in range(4):
    zc = AXIS_Z + r_mid * np.cos(TH)
    zb = float(np.interp(math.pi, TH, zc))
    yc = STRAP_BACK_Y + (y_end - STRAP_BACK_Y) * np.clip((zc - zb) / (z_end - zb), 0, 1)   # 판 뒤 높이에서 머리 뒤쪽 높이까지 앞뒤 자리에 비례해 내려간다
    for i, th in enumerate(TH):
        ys = yc[i] + hv[i] * (np.arange(KS) / (KS - 1) - 0.5)
        rs = np.array([env(th, y) for y in ys]); ok = np.isfinite(rs)
        if ok.sum() < 3:
            continue
        samples_r[i] = np.where(ok, rs, np.nanmin(rs)); samples_y[i] = ys
        b, a = np.polyfit(ys[ok] - yc[i], rs[ok], 1)
        slope[i] = b; r_mid[i] = a; hv[i] = STRAP_H / math.sqrt(1 + b * b)
ks = gauss_kernel(SMOOTH_DEG)
sm = lambda a: np.convolve(np.pad(a, len(ks) // 2, mode="edge"), ks, mode="valid")
slope = sm(slope)
req = np.max(samples_r + STRAP_CLR - slope[:, None] * (samples_y - yc[:, None]), axis=1)
r_mid = req.copy()
for _ in range(TAUT_ROUNDS):
    r_mid = np.maximum(sm(r_mid), req)      # 오목한 곳은 건너가고 볼록한 곳은 그대로 따라간다
hv = STRAP_H / np.sqrt(1 + slope ** 2)
pt = lambda th, r, y: np.array((XC + r * math.sin(th), y, AXIS_Z + r * math.cos(th)))
Bf = np.array([pt(TH[i], r_mid[i] - slope[i] * hv[i] / 2, yc[i] - hv[i] / 2) for i in range(NTH)])
Tf = np.array([pt(TH[i], r_mid[i] + slope[i] * hv[i] / 2, yc[i] + hv[i] / 2) for i in range(NTH)])
Cf = (Bf + Tf) / 2; Uf = (Tf - Bf) / np.linalg.norm(Tf - Bf, axis=1)[:, None]
pad = r_mid - req

# 이음 구간: 판 뒤에서 뒤로 곧게 가 머리 옆면에 닿는 곳(감기는 띠가 그 좌우 자리 x에 이르는 곳)까지.
u0 = unit(pose_dirs(np.array([[0.0, 1.0, 0.0]]), ang)[0])        # 판과 함께 누운 위 방향
land = {}
for side in (1, -1):
    sel = np.where(np.sin(TH) * side > 0)[0]
    if side < 0:
        sel = sel[::-1]                                          # 앞쪽부터
    front = sel[side * (Cf[sel, 0] - arm_start[side][0]) >= 0]
    land[side] = int(front[0])
iL, iR = land[1], land[-1]
print("strap leaves plate at", arm_start[1].round(3), arm_start[-1].round(3), "| lands at", round(math.degrees(TH[iL]), 1), "deg", Cf[iL].round(3), "and", round(math.degrees(TH[iR]), 1), "deg", Cf[iR].round(3),
      "| bridge cm", round(float(np.linalg.norm(Cf[iL] - arm_start[1])) * 100, 1), round(float(np.linalg.norm(Cf[iR] - arm_start[-1])) * 100, 1))


def arm(side, idx):
    S = arm_start[side]; L = Cf[idx]; d = unit(L - S); S2 = S + d * ARM_OFF          # 구멍에서 arm_off만큼 나온 곳이 첫 단면
    n = max(8, int(np.linalg.norm(L - S2) / 0.005))
    w = np.linspace(0, 1, n, endpoint=False)[:, None]
    Uu = u0 * (1 - smoothstep(w)) + Uf[idx] * smoothstep(w)
    return S2 + (L - S2) * w, Uu / np.linalg.norm(Uu, axis=1)[:, None]


aLC, aLU = arm(1, iL); aRC, aRU = arm(-1, iR)
Call = np.concatenate([aLC, Cf[iL:iR + 1], aRC[::-1]]); Uall = np.concatenate([aLU, Uf[iL:iR + 1], aRU[::-1]])
pad_all = np.concatenate([np.zeros(len(aLC)), pad[iL:iR + 1], np.zeros(len(aRC))])
hug_all = np.concatenate([np.zeros(len(aLC), bool), np.ones(iR - iL + 1, bool), np.zeros(len(aRC), bool)])
# 마디를 고른다: 길이에 굽은 정도와 몸에서 뜬 정도를 더한 값이 고르게.
seg = np.linalg.norm(np.diff(Call, axis=0), axis=1)
dirs = np.diff(Call, axis=0) / seg[:, None]
turn = np.r_[0, np.arccos(np.clip((dirs[1:] * dirs[:-1]).sum(1), -1, 1)), 0]
meas = np.r_[0, np.cumsum(seg * (1 + (pad_all[:-1] + pad_all[1:]) / 2 / PAD_UNIT) + TURN_WEIGHT * (turn[:-1] + turn[1:]) / 2)]
mq = np.linspace(0, meas[-1], STRAP_N)
Cs = np.stack([np.interp(mq, meas, Call[:, k]) for k in range(3)], 1)
Us = np.stack([np.interp(mq, meas, Uall[:, k]) for k in range(3)], 1); Us /= np.linalg.norm(Us, axis=1)[:, None]
on_head = np.interp(mq, meas, hug_all.astype(float)) > 0.5       # 머리에 감기는 구간의 마디
Bs = Cs - Us * STRAP_H / 2; Ts = Cs + Us * STRAP_H / 2


def strap_normals(Bs, Ts):
    """띠 안쪽 면(아래·위 가장자리 사이)의 바깥 법선: 아래·위 가장자리에서 따로."""
    out = []
    for Ed in (Bs, Ts):
        n = np.cross(Ts - Bs, np.gradient(Ed, axis=0))
        n /= np.linalg.norm(n, axis=1)[:, None]
        rad = Ed - np.array((XC, 0, AXIS_Z)); rad[:, 1] = 0
        n[(n * rad).sum(1) < 0] *= -1
        out.append(n)
    return out


# 팽팽한 띠가 몸에서 띠 틈의 0.6배보다 가까운 곳은 그 마디를 바깥으로 민다.
for it in range(60):
    Nb, Nt = strap_normals(Bs, Ts)
    push = np.zeros((STRAP_N, 2))
    for i in range(STRAP_N):
        for j in ((i,) if i == STRAP_N - 1 else (i, i + 1)):
            for v in np.linspace(0, 1, 7):
                p = ((1 - v) * Bs[i] + v * Ts[i] + (1 - v) * Bs[j] + v * Ts[j]) / 2
                lack = 0.6 * STRAP_CLR - sdist(p)
                if lack > 0:
                    for k in {i, j}:
                        push[k, 0] = max(push[k, 0], lack * (1 - v)); push[k, 1] = max(push[k, 1], lack * v)
    if push.max() <= 0:
        break
    Bs += Nb * (push[:, :1] + 1e-4 * (push[:, :1] > 0)); Ts += Nt * (push[:, 1:] + 1e-4 * (push[:, 1:] > 0))
Nb, Nt = strap_normals(Bs, Ts)
nrm_at = lambda i, v: unit((1 - v) * Nb[i] + v * Nt[i])
on_band = lambda i, v: (1 - v) * Bs[i] + v * Ts[i]

# 안쪽 면: 감기는 구간에서는 팽팽한 띠에서 몸 쪽으로 내려가 몸에서 띠 틈만큼 떨어진 곳에 둔다(오목한 곳에서 띠 안쪽이 두꺼워져 몸에 닿는다).
# 이음 구간(판 뒤에서 머리에 닿기까지)은 내리지 않는다(곧은 띠 그대로).
INNER_V = (0.0, 0.5, 1.0)
dip = np.zeros((STRAP_N, len(INNER_V)))
for i in np.where(on_head)[0]:
    for k, v in enumerate(INNER_V):
        p0 = on_band(i, v); n = nrm_at(i, v); t = 0.0; prev = dist(p0); hit = prev <= STRAP_CLR
        while not hit and t < DIP_MAX:
            t += 0.001
            d = dist(p0 - n * t)
            if d <= STRAP_CLR:
                t -= 0.001 * (STRAP_CLR - d) / max(prev - d, 1e-9); hit = True
                break
            prev = d
        dip[i, k] = min(max(t, 0.0), DIP_MAX)
inner = lambda i, k: on_band(i, INNER_V[k]) - nrm_at(i, INNER_V[k]) * dip[i, k]
for it in range(60):     # 안쪽 면의 표본점이 몸에 MIN_OUT보다 가까우면 그 점을 팽팽한 띠 쪽으로 되민다
    lack = np.zeros_like(dip)
    for i in range(STRAP_N):
        for k in range(len(INNER_V)):
            groups = [[(i, k)]]
            if k + 1 < len(INNER_V):
                groups.append([(i, k), (i, k + 1)])
            if i + 1 < STRAP_N:
                groups.append([(i, k), (i + 1, k)])
                if k + 1 < len(INNER_V):
                    groups += [[(i, k), (i + 1, k + 1)], [(i, k), (i, k + 1), (i + 1, k + 1)], [(i, k), (i + 1, k + 1), (i + 1, k)]]
            for g in groups:
                s = sdist(sum(inner(a, b) for a, b in g) / len(g))
                if s < MIN_OUT:
                    for a, b in g:
                        lack[a, b] = max(lack[a, b], MIN_OUT - s + 2e-4)
    if lack.max() <= 0:
        break
    dip = dip - lack
print("strap: stations", STRAP_N, "on head", int(on_head.sum()), "| inner dip cm max", round(float(dip.max()) * 100, 2))

# 단면(점 7개): 안쪽 면 셋, 위 가장자리, 바깥 둘, 아래 가장자리. 꼭짓점은 (자리, 음영 묶음)으로 만든다: 0 안쪽 면 / 1 바깥쪽 / 2 판 구멍에서 좁아지는 부분.
EDGE = 0.30
RING = 7
SV = []; SG = []                        # 띠 꼭짓점 자리, 음영 묶음
ST = []                                 # 띠 삼각형(꼭짓점 번호 셋, 묶음)
ring_pts = np.array([[inner(i, 0), inner(i, 1), inner(i, 2),
                      Ts[i] + EDGE * STRAP_T * Nt[i],
                      on_band(i, 0.72) + STRAP_T * nrm_at(i, 0.72),
                      on_band(i, 0.28) + STRAP_T * nrm_at(i, 0.28),
                      Bs[i] + EDGE * STRAP_T * Nb[i]] for i in range(STRAP_N)])
axis_pts = ring_pts.mean(1)


def add_vert(p, grp):
    SV.append(np.asarray(p, float)); SG.append(grp); return len(SV) - 1


vid = {}                                # (마디, 단면 점, 묶음) → 꼭짓점 번호
def rv(i, k, grp):
    if (i, k, grp) not in vid:
        vid[(i, k, grp)] = add_vert(ring_pts[i, k], grp)
    return vid[(i, k, grp)]


def add_tri(a, b, c, grp, away_from):
    """삼각형을 더한다. 법선이 away_from에서 멀어지는 쪽을 보게 돈다."""
    pa, pb, pc = SV[a], SV[b], SV[c]
    if np.cross(pb - pa, pc - pa) @ ((pa + pb + pc) / 3 - away_from) < 0:
        b, c = c, b
    ST.append((a, b, c, grp))


for i in range(STRAP_N - 1):
    ax = (axis_pts[i] + axis_pts[i + 1]) / 2
    for k in range(RING):
        k2 = (k + 1) % RING
        grp = 0 if k in (0, 1) else 1
        a, b, c, d = rv(i, k, grp), rv(i, k2, grp), rv(i + 1, k2, grp), rv(i + 1, k, grp)
        add_tri(a, b, c, grp, ax); add_tri(a, c, d, grp, ax)

# 판의 구멍 테두리에서 첫(끝) 띠 단면으로 좁아지는 부분. 테두리 점은 판 꼭짓점과 같은 자리에 띠 색으로 새로 만든다(판 꼭짓점은 그대로 둔다).
#  - 테두리에서 collar만큼 들어간 고리까지 좁은 띠를 먼저 두른다(판에 바로 붙은 띠 면이 테두리를 따라 고르게 생긴다).
#  - 그 고리와 띠 단면의 점을 둘레 각도 차례로 번갈아 이어 삼각형으로 메운다.
def simplify_loop(Lp, tol):
    """거의 곧게 이어진 점을 뺀다(삼각형을 아낀다. 테두리와 tol 안에서 같다)."""
    Lp = [p for p in Lp]; changed = True
    while changed and len(Lp) > 10:
        changed = False
        for j in range(len(Lp)):
            a_, b_, c_ = Lp[j - 1], Lp[j], Lp[(j + 1) % len(Lp)]
            if np.linalg.norm(np.cross(b_ - a_, c_ - a_)) / (np.linalg.norm(c_ - a_) + 1e-12) < tol:
                Lp.pop(j); changed = True
                break
    return np.array(Lp)


for side, st in ((1, 0), (-1, STRAP_N - 1)):
    Lp, size, cen = holes[side]
    Lq = simplify_loop(Lp, 0.0005)
    axis_dir = unit(axis_pts[st] - cen)
    e1 = unit(Us[st] - (Us[st] @ axis_dir) * axis_dir); e2 = np.cross(axis_dir, e1)
    ang_of = lambda p, c: math.atan2((p - c) @ e2, (p - c) @ e1) % (2 * math.pi)
    la = np.array([ang_of(p, cen) for p in Lq]); order = np.argsort(la); Lq = Lq[order]; la = la[order]
    ra = np.array([ang_of(p, axis_pts[st]) for p in ring_pts[st]]); rorder = np.argsort(ra); ra = ra[rorder]; rp = ring_pts[st][rorder]

    def ring_at(a):
        """띠 단면 둘레에서 각도 a에 있는 점."""
        j = int(np.searchsorted(ra, a, side="right")) - 1
        a0 = ra[j % RING] - (2 * math.pi if j < 0 else 0); a1 = ra[(j + 1) % RING] + (2 * math.pi if j + 1 >= RING else 0)
        f = (a - a0) / max(a1 - a0, 1e-9)
        return rp[j % RING] + f * (rp[(j + 1) % RING] - rp[j % RING])
    Mq = np.array([l + (ring_at(a) - l) * min(1.0, COLLAR / np.linalg.norm(ring_at(a) - l)) for l, a in zip(Lq, la)])
    lid = [add_vert(p, 2) for p in Lq]; mid_ = [add_vert(p, 2) for p in Mq]
    rid = [rv(st, int(k), 2) for k in rorder]
    nl, nr = len(lid), len(rid)
    mid_pt = (cen + axis_pts[st]) / 2
    for i in range(nl):
        i2 = (i + 1) % nl
        add_tri(lid[i], lid[i2], mid_[i2], 2, mid_pt); add_tri(lid[i], mid_[i2], mid_[i], 2, mid_pt)
    i = j = 0
    while i < nl or j < nr:
        la_next = (la[(i + 1) % nl] + (2 * math.pi if i + 1 >= nl else 0)) if i < nl else float("inf")
        ra_next = (ra[(j + 1) % nr] + (2 * math.pi if j + 1 >= nr else 0)) if j < nr else float("inf")
        if la_next <= ra_next:
            add_tri(mid_[i % nl], mid_[(i + 1) % nl], rid[j % nr], 2, mid_pt); i += 1
        else:
            add_tri(mid_[i % nl], rid[(j + 1) % nr], rid[j % nr], 2, mid_pt); j += 1

# 머리에 감기는 구간에서 안쪽 면 가운데가 몸에서 먼 삼각형은 가운데에 점을 넣어 몸 쪽으로 붙인다(이음 구간은 그대로 둔다).
ZONE_R = new["back_max"] + 0.03
poked = 0
for rnd in range(3):
    todo = []
    for ti, (a, b, c, grp) in enumerate(ST):
        if grp != 0:
            continue
        cen = (SV[a] + SV[b] + SV[c]) / 3
        d = dist(cen)
        near_plate = np.linalg.norm(VP - cen, axis=1).min() < ZONE_R        # 판 가까이(qa가 이음 구간으로 보는 범위)에서는 더 고르게 붙인다
        if (HUG_ZONE if near_plate else HUG_MAX) < d <= 0.02:
            todo.append((ti, cen))
    if not todo or poked + len(todo) > POKE_MAX:
        break
    for ti, cen in sorted(todo, key=lambda r: -r[0]):
        a, b, c, grp = ST.pop(ti)
        loc = nearest(cen); d = np.linalg.norm(cen - loc)
        m = add_vert(loc + (cen - loc) * (STRAP_CLR / d), 0)
        ax = cen + (cen - loc) / d * 0.02            # 띠 속 쪽(몸 반대쪽)
        add_tri(a, b, m, 0, ax); add_tri(b, c, m, 0, ax); add_tri(c, a, m, 0, ax)
        poked += 1
SV = np.array(SV); SG = np.array(SG)

# ---------- 5. 한 메시로 모은다 ----------
ST_idx = np.array([t[:3] for t in ST]); ST_grp = np.array([t[3] for t in ST])
sn = np.zeros_like(SV); fnS = np.cross(SV[ST_idx[:, 1]] - SV[ST_idx[:, 0]], SV[ST_idx[:, 2]] - SV[ST_idx[:, 0]])
for k in range(3):
    np.add.at(sn, ST_idx[:, k], fnS)
sn /= np.linalg.norm(sn, axis=1)[:, None] + 1e-30
nP, nS = len(VP), len(SV)
OUT_P = np.concatenate([VP, SV]).astype(np.float32)
OUT_N = np.concatenate([VN / (np.linalg.norm(VN, axis=1)[:, None] + 1e-30), sn]).astype(np.float32)
OUT_UV = np.concatenate([PL_UV, np.tile(STRAP_UV, (nS, 1))]).astype(np.float32)
OUT_I = np.concatenate([PL_T, ST_idx + nP]).astype(np.int64)
is_plate_tri = np.r_[np.ones(len(PL_T), bool), np.zeros(len(ST_idx), bool)]
assert len(OUT_P) < 65536
assert not (np.abs(PL_UV.astype(np.float32) - STRAP_UV.astype(np.float32)).max(1) == 0).any()   # 띠 색 자리가 판 점의 UV와 겹치면 안 된다(테스트가 UV로 판 점을 찾는다)

# ---------- 6. 확인(qa 판정을 흉내 낸 값. 정확한 판정은 테스트가 한다) ----------
Pd = OUT_P.astype(np.float64)
Ed = np.concatenate([OUT_I[:, [0, 1]], OUT_I[:, [1, 2]], OUT_I[:, [2, 0]]]); Ed.sort(1); Ed = np.unique(Ed, axis=0)
allS = np.concatenate([Pd, Pd[OUT_I].mean(1), (Pd[Ed[:, 0]] + Pd[Ed[:, 1]]) / 2])
deep = [float(dist(p)) for p in allS if 0.001 < dist(p) < 0.08 and inside(p)]
gtree = BVHTree.FromPolygons([tuple(p) for p in Pd], [tuple(int(k) for k in t) for t in OUT_I])
fcen = Pd[OUT_I].mean(1); fnrm = np.cross(Pd[OUT_I[:, 1]] - Pd[OUT_I[:, 0]], Pd[OUT_I[:, 2]] - Pd[OUT_I[:, 0]])
fnrm /= np.linalg.norm(fnrm, axis=1)[:, None] + 1e-30
fnrm[(fnrm * OUT_N.astype(np.float64)[OUT_I].sum(1)).sum(1) < 0] *= -1


def facing_gap(t):
    """몸을 향하고(cos > 0.5) 다른 고글 면에 가려지지 않은 면이면 몸까지 거리, 아니면 None."""
    loc, _, _, d = tree.find_nearest(Vector(fcen[t]))
    if d < 1e-4:
        return d
    dirv = (np.array(loc) - fcen[t]) / d
    if fnrm[t] @ dirv <= 0.5:
        return None
    h = gtree.ray_cast(Vector(fcen[t] + dirv * 2e-4), Vector(dirv), max(d - 4e-4, 0.0))
    return None if h[0] is not None else d


end_gap = {1: 0.0, -1: 0.0}
for t in np.where(is_plate_tri & (np.abs(fcen[:, 0]) > 0.15))[0]:
    g_ = facing_gap(t)
    if g_ is not None:
        s_ = 1 if fcen[t, 0] > 0 else -1; end_gap[s_] = max(end_gap[s_], g_)
rows = []
for t in np.where(~is_plate_tri)[0]:
    g_ = facing_gap(t)
    if g_ is not None:
        rows.append((1 if fcen[t, 0] > 0 else -1, float(np.linalg.norm(VP - fcen[t], axis=1).min()), float(g_)))
bridge_far = [r for r in rows if r[2] > 0.01]
outside = [r for r in rows if r[1] > end_gap[r[0]] + 0.02]
bins = {1: {}, -1: {}}
for s_, fp, g_ in rows:
    if fp <= end_gap[s_] + 0.02:
        b_ = int(fp / 0.01); bins[s_][b_] = max(bins[s_].get(b_, 0.0), g_)
rising = [(s_, i, j) for s_ in bins for i in bins[s_] for j in bins[s_] if j > i and bins[s_][j] > bins[s_][i] + 0.002]
check = {
    "samples_inside_body_over_1mm": len(deep), "deepest_cm": round(max(deep, default=0.0) * 100, 2),
    "strap_faces_facing_body_not_hidden": len(rows),
    "plate_end_gap_cm": {"left": round(end_gap[1] * 100, 2), "right": round(end_gap[-1] * 100, 2)},
    "bridge_zone_cm": {"left": round(end_gap[1] * 100 + 2, 2), "right": round(end_gap[-1] * 100 + 2, 2)},
    "strap_faces_over_1cm": len(bridge_far),
    "strap_faces_over_1cm_farthest_from_plate_cm": round(max((r[1] for r in bridge_far), default=0.0) * 100, 2),
    "strap_faces_outside_bridge_zone": len(outside),
    "strap_gap_cm_outside_bridge_zone_max": round(max((r[2] for r in outside), default=0.0) * 100, 2),
    "strap_faces_over_1cm_outside_bridge_zone": int(sum(1 for r in outside if r[2] > 0.01)),
    "bridge_rising_pairs": len(rising),
    "bridge_bins_cm": {("left" if s_ > 0 else "right"): [[k, round(v * 100, 2)] for k, v in sorted(bins[s_].items())] for s_ in bins},
}
print("check", check)
ext = extent(Pd)
size = {"y_min": round(ext[0], 4), "y_max": round(ext[1], 4), "height": round(ext[1] - ext[0], 4), "upper_width": round(ext[2], 4),
        "base": {"y_min": round(base_ext[0], 4), "y_max": round(base_ext[1], 4), "height": round(base_ext[1] - base_ext[0], 4), "upper_width": round(base_ext[2], 4)}}
print("size", size)
# 판 모양이 그대로인지: 판 꼭짓점 사이 거리(아무 쌍 2,000개)를 지금 파일과 견준다.
rng = np.random.default_rng(1); ii = rng.integers(0, nP, 2000); jj = rng.integers(0, nP, 2000)
dd = np.abs(np.linalg.norm(OUT_P[ii].astype(np.float64) - OUT_P[jj], axis=1) - np.linalg.norm(V0[ii] - V0[jj], axis=1)).max()
print("plate rigid: max change of point-to-point distance (m)", float(dd))
print("tris", len(OUT_I), "(plate", len(PL_T), "+ strap", len(ST_idx), ") verts", len(OUT_P), "| strap inner faces split", poked)


# ---------- 7. glb 쓰기(질감 그림·재질·노드는 지금 파일 그대로) ----------
def pad4(b, fill=b"\x00"):
    return b + fill * ((4 - len(b) % 4) % 4)


chunks = [OUT_P.tobytes(), OUT_N.tobytes(), OUT_UV.tobytes(), OUT_I.astype(np.uint16).tobytes(), IMG]
views = []; blob = b""
for c in chunks:
    views.append({"buffer": 0, "byteLength": len(c), "byteOffset": len(blob)})
    blob += pad4(c)
views[0]["target"] = views[1]["target"] = views[2]["target"] = 34962; views[3]["target"] = 34963
js = json.loads(json.dumps(gjs))
js["asset"] = {"generator": "fit-goggles-to-head.py (from " + gjs["asset"].get("generator", "") + ")", "version": "2.0"}
js["accessors"] = [
    {"bufferView": 0, "componentType": 5126, "count": len(OUT_P), "max": OUT_P.max(0).tolist(), "min": OUT_P.min(0).tolist(), "type": "VEC3"},
    {"bufferView": 1, "componentType": 5126, "count": len(OUT_P), "type": "VEC3"},
    {"bufferView": 2, "componentType": 5126, "count": len(OUT_P), "type": "VEC2"},
    {"bufferView": 3, "componentType": 5123, "count": int(OUT_I.size), "type": "SCALAR"},
]
js["bufferViews"] = views
js["buffers"] = [{"byteLength": len(blob)}]
js["meshes"][0]["primitives"][0] = {"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3, "material": 0}
js["images"][0]["bufferView"] = 4
jb = pad4(json.dumps(js, separators=(",", ":")).encode("utf8"), b" ")
with open(dst, "wb") as fp:
    fp.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(jb) + 8 + len(blob)))
    fp.write(struct.pack("<I4s", len(jb), b"JSON")); fp.write(jb)
    fp.write(struct.pack("<I4s", len(blob), b"BIN\x00")); fp.write(blob)
print("wrote", dst, os.path.getsize(dst), "bytes")

with open(dst + ".info.json", "w", encoding="utf-8") as fp:
    json.dump({
        "what": "wear-goggles.glb(v2)를 만들 때 쓴 값과 결과. 지금 고글의 렌즈 판을 돌리고 옮기기만 하고(모양 그대로), 띠를 새로 만들었다. 좌표는 라룹이 쉬는 자세의 몸 좌표.",
        "base": base_glb, "body": body_glb,
        "plate": {"plate_z": PLATE_Z, "tris": int(len(PL_T)), "verts": int(nP),
                  "note": "결과 파일의 처음 verts개가 지금 파일의 판 꼭짓점(지금 파일에서의 번호는 base_vertex_indices)이고 차례·UV가 같다. 새 자리 = rigid_matrix_rows · 지금 자리",
                  "base_vertex_indices": [int(v) for v in used],
                  "rigid_matrix_rows": [[round(float(v), 9) for v in r] for r in RIGID],
                  "pivot": [round(float(v), 6) for v in c0], "tilt_deg": round(float(deg), 3), "up_m": round(float(ty), 5), "forward_m": round(float(tz), 5),
                  "formula": "p' = pivot + Rx(tilt, 위쪽이 뒤로)(p - pivot) + (0, up, forward)",
                  "back_to_body_cm_now": {k: round(v * 100, 2) for k, v in now.items()}, "back_to_body_cm_new": {k: round(v * 100, 2) for k, v in new.items()},
                  "center_half_width_m": CEN_HALF, "gap": GAP, "max_shrink": MAX_SHRINK, "max_dy": MAX_DY},
        "strap": {"h": STRAP_H, "t": STRAP_T, "clr": STRAP_CLR, "n": STRAP_N, "arm_x": ARM_X, "arm_off": ARM_OFF, "back_y": round(float(STRAP_BACK_Y), 4),
                  "uv_gltf": [round(float(v), 4) for v in STRAP_UV], "tris": int(len(ST_idx)), "inner_faces_split": int(poked),
                  "leaves_plate_at": {"left": [round(float(v), 4) for v in arm_start[1]], "right": [round(float(v), 4) for v in arm_start[-1]]},
                  "lands_at": {"left": [round(float(v), 4) for v in Cf[iL]], "right": [round(float(v), 4) for v in Cf[iR]]},
                  "bridge_cm": [round(float(np.linalg.norm(Cf[iL] - arm_start[1])) * 100, 1), round(float(np.linalg.norm(Cf[iR] - arm_start[-1])) * 100, 1)]},
        "tris": int(len(OUT_I)), "size": size, "check": check,
    }, fp, ensure_ascii=False, indent=1)
