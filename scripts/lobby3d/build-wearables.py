# 새 몸(고글 없는 라룹이)에 맞춘 착용 모델을 모델 하나씩의 glb로 만든다(캐릭터 꾸미기, 16 결정: 상의·하의·조끼는 "A 방식").
# 쓰는 법: blender -b --factory-startup -P scripts/lobby3d/build-wearables.py -- <라룹이 glb> <야구모자 glb> <출력 폴더> [이름=값 ...]
#   (Blender 5.2에서 확인. 라룹이 glb는 앱의 apps/mobile/assets/models/writeloop.glb(고글 없는 새 몸),
#    야구모자는 Tripo로 만든 받은 모델 그대로(저장소 밖 C:\WriteLoop-asset\캡모자\baseball cap 3d model.glb).
#    출력은 서버 아이템 목록 폴더 apps/backend/src/main/resources/catalog/files/에 같은 이름으로 넣는다.
#    라룹이 고글 wear-goggles.glb는 build-goggles.py가 따로 만들어 앱에 넣는다.)
#   이름=값: only=top,bottom,vest,hat,shoe,sunglasses,muffler,necklace,backpack(만들 것만), info=<json>(치수·삼각형 수 기록),
#            covered=<폴더>(검사 도구 tools/check_clip.py가 쓰는 "옷이 덮는 살갗" 목록), keep·fill·liftmax 등(아래 값들)
#   같은 입력이면 같은 파일이 나온다(파일 해시가 같다).
# 만드는 것(파일 이름·맨 위 노드 이름은 지금 서버 아이템 목록의 wear-*.glb와 같다):
#   뼈대로 휘는 옷(skin): wear-top.glb(티셔츠), wear-bottom.glb(반바지), wear-vest.glb(조끼)
#     맨 위 노드 writeloop 아래에 옷 메시(wear-top 등, 뼈대 묶음)와 뼈(root …). 앱이 라룹이 뼈대에 뼈 이름으로 다시 묶는다.
#   뼈에 붙이는 것(bone): wear-hat.glb·wear-hat-blue.glb·wear-hat-green.glb(head), wear-sunglasses.glb(head),
#     wear-shoe.glb(노드 wear-shoe-l, foot_l. 앱이 좌우로 뒤집어 foot_r에도 붙인다), wear-muffler.glb·wear-necklace.glb·wear-backpack.glb(spine)
#     메시 노드 하나, 노드 변환 없음. 좌표는 라룹이 쉬는 자세의 몸 좌표다.
#     모양은 지금 것(build-wearables.py)과 같은 방법으로 만들고, 자리와 크기만 새 몸의 치수로 다시 잡는다.
#     백팩만 자리가 다르다(18·19 결정): 꼬리 뒤가 아니라 등에 붙여 등과 꼬리 사이에 멘다. 꼬리를 젖힌 몸이어야 자리가 난다.
#
# A 방식(상의·하의·조끼):
#   1. 몸 메시를 떠서(질감 이음매의 겹친 꼭짓점은 합친다) 옷이 덮을 곳만 남긴다. 끝선은 뼈 무게로 면을 고르지 않고
#      평면(밑단·소매 끝·목·허리·다리 끝)이나 둥근 통(꼬리 자리)으로 면을 "갈라서" 자른다. 그래서 끝선이 곧다.
#      끝선과 나란한 선을 안쪽에 둘 더 갈라 두고(단이 꺾이는 자리), 그 밖의 안쪽 삼각형은 줄인다(끝선·단 선의 꼭짓점은 줄이지 않는다).
#   2. 팔과 몸통 사이처럼 깊이 접힌 골은 조금 메운 뒤, 몸의 법선(고르게 다듬은 것) 쪽으로 띄운다.
#      동작 중에 띄운 거리가 줄어드는 곳(관절 둘레)은 클립 19개의 자세로 재서 미리 더 띄운다.
#   3. 띄운 면을 고르게 다듬되 몸 쪽으로는 들어가지 않게 한다(몸의 잔 굴곡은 메우고, 솟은 곳은 그대로 둔다).
#      끝선에서 안쪽으로 정한 폭까지는 한 단 더 띄워 밑단·소매 끝·허리띠·다리 끝단을 만든다. 밑단·소매 끝·목 둘레는 끝으로 갈수록 조금 벌어진다.
#   4. 끝선에서 몸 살갗 바로 밑까지 면을 이어 두께를 닫는다(옷과 몸 사이가 들여다보이지 않는다).
#      그 면은 끝선보다 옷 안쪽으로 당겨 올려, 외곽선 껍질이 끝선 바로 옆에 갈색 선으로 보인다.
#   5. 뼈 무게는 몸의 것을 그대로 쓴다(가른 자리의 새 꼭짓점은 몸 삼각형 위에서 보간한 값). 그래서 몸과 똑같이 휜다.
#   외곽선: 앱은 옷의 법선(NORMAL)으로 껍질을 부풀린다(characterOutlineMaterial은 _outline_normal·_outline_bias를 쓰지 않는다).
#     그래서 옷은 꼭짓점을 겹치지 않고(질감 좌표 없음) 법선을 모두 부드럽게 둔다. 겹치거나 꺾인 법선이 있으면 껍질이 벌어진다.
import colorsys
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1 :]
char_path, cap_path, out_dir = (os.path.abspath(p) for p in args[:3])
kv = dict(a.split("=", 1) for a in args[3:] if "=" in a)
ONLY = set(kv["only"].split(",")) if kv.get("only") else None
INFO = {}
KEEP = float(kv.get("keep", 0.55))  # 옷 안쪽 삼각형을 남기는 비율(끝선·단 선은 줄이지 않는다)

os.makedirs(out_dir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- 라룹이 ----------
bpy.ops.import_scene.gltf(filepath=char_path)
arm = next(o for o in scene.objects if o.type == "ARMATURE")
body = next(o for o in scene.objects if o.type == "MESH" and o.find_armature() == arm)
# 뼈 표시용 공 같은 다른 메시는 지운다
for o in list(scene.objects):
    if o.type == "MESH" and o is not body:
        bpy.data.objects.remove(o, do_unlink=True)
# 불러오면 첫 동작의 자세가 걸려 있다. 쉬는 자세로 되돌린다(내보낼 때 뼈 자리가 쉬는 자세여야 한다)
if arm.animation_data:
    arm.animation_data_clear()
for pb in arm.pose.bones:
    pb.location, pb.scale = (0, 0, 0), (1, 1, 1)
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (1, 0, 0, 0)
bpy.context.view_layer.update()

GROUPS = {g.name: g.index for g in body.vertex_groups}
ARM_L, ARM_R = ("arm_l", "hand_l"), ("arm_r", "hand_r", "thumb_r")
TAIL = ("tail_1", "tail_2", "tail_3")


def want(name):
    return ONLY is None or name in ONLY


def solid_material(name, hex_color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    rgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in rgb]
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lin, 1)
    m.diffuse_color = (*lin, 1)  # 미리 보기(작업 화면 색)
    return m


# ---------- 몸 치수(뼈 무게가 가장 큰 뼈로 가른 부위. 옷의 끝선에는 쓰지 않고 자리 잡는 데만 쓴다) ----------
_groups = {g.index: g.name for g in body.vertex_groups}


def _dominant(v):
    best, w = None, 0.0
    for g in v.groups:
        if g.weight > w:
            best, w = _groups.get(g.group), g.weight
    return best


BODY_CO = [body.matrix_world @ v.co for v in body.data.vertices]
BODY_DOM = [_dominant(v) for v in body.data.vertices]
_tail_groups = {g.index for g in body.vertex_groups if g.name.startswith("tail_")}
BODY_TAILW = [sum(g.weight for g in v.groups if g.group in _tail_groups) for v in body.data.vertices]  # 꼬리 뼈 무게의 합


def region_points(names):
    return [p for p, d in zip(BODY_CO, BODY_DOM) if d in names]


def region_bounds(names):
    pts = region_points(names)
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


# ---------- A 방식 도구 ----------
def make_base_mesh():
    """몸 메시를 떠서 질감 이음매로 겹친 꼭짓점을 합치고, 다듬은 법선을 꼭짓점 속성(wl_n0)으로 넣는다."""
    me = body.data.copy()
    for attr in list(me.attributes):
        if attr.name.startswith("_outline") or attr.name == "custom_normal":
            me.attributes.remove(attr)
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    bm = bmesh.new()
    bm.from_mesh(me)
    n_before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.normal_update()
    n0 = bm.verts.layers.float_vector.new("wl_n0")
    nrm = {v: v.normal.copy() for v in bm.verts}
    for _ in range(NORMAL_SMOOTH):
        nxt = {}
        for v in bm.verts:
            acc = nrm[v] * 1.0
            for e in v.link_edges:
                acc += nrm[e.other_vert(v)] * 0.5
            nxt[v] = acc.normalized() if acc.length > 1e-9 else nrm[v]
        nrm = nxt
    for v in bm.verts:
        v[n0] = nrm[v]
    open_edges = sum(1 for e in bm.edges if e.is_boundary)
    print(f"base mesh: verts {n_before} -> {len(bm.verts)}, tris {len(bm.faces)}, open edges {open_edges}")
    bm.to_mesh(me)
    bm.free()
    return me


BASE_ME = None


_POSES = None


def sample_poses(step=3):
    """동작 클립을 step 프레임마다 돌려 뼈마다의 변형 행렬(쉬는 자세 → 그 자세)을 모은다. 모양: (자세 수, 뼈 수, 4, 4), 뼈 차례는 GROUPS."""
    global _POSES
    if _POSES is not None:
        return _POSES
    names = sorted(GROUPS, key=GROUPS.get)
    rest_inv = {n: arm.data.bones[n].matrix_local.inverted() for n in names}
    ad = arm.animation_data_create()
    out = []
    for act in sorted(bpy.data.actions, key=lambda a: a.name):
        ad.action = act
        if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
            ad.action_slot = act.slots[0]
        f0, f1 = (int(round(x)) for x in act.frame_range)
        for f in range(f0, f1 + 1, step):
            scene.frame_set(f)
            out.append([np.array(arm.pose.bones[n].matrix @ rest_inv[n]) for n in names])
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.location, pb.scale = (0, 0, 0), (1, 1, 1)
        pb.rotation_quaternion = (1, 0, 0, 0)
    scene.frame_set(0)
    bpy.context.view_layer.update()
    _POSES = np.array(out)
    print("poses sampled", _POSES.shape)
    return _POSES


class Field:
    """자르는 면. value(p) > 0인 쪽을 잘라 낸다. 0인 곳이 끝선이고, 옷 안쪽으로 들어갈수록 음수(거리)다."""

    def __init__(self, fn, grad=None):
        self.fn = fn
        self.grad = grad

    def __call__(self, p):
        return self.fn(p)

    def raw_gradient(self, p):
        if self.grad:
            return self.grad(p)
        h = 1e-5
        return Vector(((self.fn(p + Vector((h, 0, 0))) - self.fn(p - Vector((h, 0, 0)))) / (2 * h),
                       (self.fn(p + Vector((0, h, 0))) - self.fn(p - Vector((0, h, 0)))) / (2 * h),
                       (self.fn(p + Vector((0, 0, h))) - self.fn(p - Vector((0, 0, h)))) / (2 * h)))

    def gradient(self, p):
        """잘라 내는 쪽을 가리키는 단위 벡터."""
        g = self.raw_gradient(p)
        return g.normalized() if g.length_squared > 1e-12 else Vector((0, 0, 1))

    def project(self, p, value):
        """p를 value(p) = value인 곳으로 옮긴다."""
        p = p.copy()
        for _ in range(4):
            f = self.fn(p) - value
            if abs(f) < 1e-9:
                break
            g = self.raw_gradient(p)
            if g.length_squared < 1e-12:
                break
            p -= g * (f / g.length_squared)
        return p


def plane(point, normal):
    """point를 지나는 평면. normal 쪽을 잘라 낸다."""
    n = Vector(normal).normalized()
    c = Vector(point)
    return Field(lambda p: (p - c).dot(n), lambda p: n)


def tube_y(cx, cz, rx, rz):
    """앞뒤(y) 방향으로 뚫린 타원 통. 통 안쪽을 잘라 낸다. 값은 끝선에서 떨어진 거리에 가깝다."""

    def fn(p):
        dx, dz = (p.x - cx) / rx, (p.z - cz) / rz
        r = math.hypot(dx, dz)
        return (1 - r) * min(rx, rz)

    return Field(fn)


class Trim:
    """끝선 하나: 자르는 면과 그 둘레의 단(밑단·소매 끝 등) 모양."""

    def __init__(self, name, field, band=0.0, raise_=0.0, flare=0.0, flare_len=0.06, fade=None):
        self.name, self.field = name, field
        self.band, self.raise_, self.flare, self.flare_len = band, raise_, flare, flare_len
        self.deep = False  # 허리띠처럼 위를 보는 끝선: 두께 면을 두께만큼 깊이 당겨, 내려다보면 끝선 안쪽이 그늘져 보이게 한다
        self.fade = fade  # 자리(살갗 위의 점)에 따라 단·벌어짐을 줄이는 배율(0~1). 소매 끝이 겨드랑이에서 몸통 옷에 묻히는 곳에 쓴다

    def extra(self, s):
        """끝선에서 안쪽으로 s만큼 들어간 곳을 더 띄우는 거리."""
        d = 0.0
        if self.band > 0 and s <= self.band + STEP / 2:
            d += self.raise_
        if self.flare > 0 and s < self.flare_len:
            d += self.flare * (1 - s / self.flare_len) ** 2
        return d


SMOOTH = int(kv.get("smooth", 6))  # 띄운 면을 고르게 다듬는 횟수
FILL = int(kv.get("fill", 30))  # 띄우기 전에 골을 메우는 횟수
LIFT_KEEP = float(kv.get("liftkeep", 0.5))  # 가장 줄어드는 자세에서도 남아야 하는 띄운 거리(base에 대한 비율)
LIFT_MAX = float(kv.get("liftmax", 1.6))  # 동작 중에 가라앉는 곳을 더 띄우는 배율의 한도(1이면 하지 않는다)
FILL_CAP = float(kv.get("fillcap", 0.012))  # 골을 메울 때 살갗에서 떨어질 수 있는 가장 먼 거리
STEP = float(kv.get("step", 0.003))  # 단이 꺾이는 폭(끝선과 나란한 선 둘 사이)
NORMAL_SMOOTH = int(kv.get("nsmooth", 10))  # 띄우는 방향(몸 법선)을 이웃과 고르게 하는 횟수. 팔·몸통 사이 골에서 옷이 서로 파고들지 않게 한다
UNDERCUT = 0.014  # 두께를 닫는 면을 끝선에서 옷 안쪽으로 당겨 올리는 거리. 끝선 밑이 파여 외곽선 껍질이 끝선 바로 옆에 보인다
INSET = 0.004  # 두께를 닫는 면이 살갗 밑으로 들어가는 깊이


class Shell:
    def __init__(self, name):
        global BASE_ME
        if BASE_ME is None:
            BASE_ME = make_base_mesh()
        self.name = name
        o = body.copy()
        o.data = BASE_ME.copy()
        o.name = name
        o.data.name = name
        scene.collection.objects.link(o)
        self.o = o
        self.bm = bmesh.new()
        self.bm.from_mesh(o.data)
        self.dl = self.bm.verts.layers.deform.verify()
        self.n0 = self.bm.verts.layers.float_vector["wl_n0"]
        self.p0 = self.bm.verts.layers.float_vector.new("wl_p0")
        self.vid = self.bm.verts.layers.int.new("wl_id")
        self.tag = self.bm.faces.layers.int.new("wl_tag")
        self.mem = self.bm.faces.layers.int.new("wl_mem")
        self.trims = []
        self.cons = {}  # 꼭짓점 → [(면, 값)]: 다듬은 뒤에도 그 선 위에 있어야 하는 꼭짓점
        self.log = {}

    # --- 뼈 무게 ---
    def w(self, v, names):
        d = v[self.dl]
        return sum(d.get(GROUPS[n], 0.0) for n in names)

    def fw(self, f, names):
        return sum(self.w(v, names) for v in f.verts) / len(f.verts)

    # --- 면 가르기 ---
    def iso_cut(self, faces, field, value=0.0):
        """faces 안에서 field = value인 선을 따라 면을 가른다(지우지는 않는다). 가른 뒤 그 면들은 wl_tag가 1이다."""
        bm, tag = self.bm, self.tag
        for f in bm.faces:
            f[tag] = 0
        faces = [f for f in faces if f.is_valid]
        for f in faces:
            f[tag] = 1
        # 번호 차례로 돈다(집합을 그대로 돌면 돌릴 때마다 차례가 달라 결과 파일이 달라진다)
        bm.verts.index_update()
        bm.edges.index_update()
        bm.faces.index_update()
        verts = sorted({v for f in faces for v in f.verts}, key=lambda v: v.index)
        val = {}
        on = []
        for v in verts:
            x = field(v.co) - value
            if abs(x) < 1e-7:
                x = 0.0
                on.append(v)
            val[v] = x
        for e in sorted({e for f in faces for e in f.edges}, key=lambda e: e.index):
            a, b = e.verts
            fa, fb = val[a], val[b]
            if fa * fb < 0:
                pa, pb = a.co.copy(), b.co.copy()
                lo, hi, flo, fhi = 0.0, 1.0, fa, fb
                t = fa / (fa - fb)
                for _ in range(16):  # 곧지 않은 면(통)은 선 위의 점을 다시 찾는다
                    ft = field(pa.lerp(pb, t)) - value
                    if abs(ft) < 1e-9:
                        break
                    if (ft < 0) == (flo < 0):
                        lo, flo = t, ft
                    else:
                        hi, fhi = t, ft
                    t = lo + (hi - lo) * flo / (flo - fhi)
                t = min(max(t, 1e-4), 1 - 1e-4)
                _, nv = bmesh.utils.edge_split(e, a, t)
                on.append(nv)
        if on:
            on_set = set(on)
            others = sorted((f for f in {f for v in on for f in v.link_faces} if f[tag] == 0), key=lambda f: f.index)
            bmesh.ops.connect_verts(bm, verts=on, faces_exclude=others, check_degenerate=False)
            # 고르지 않은 이웃 면에 새 꼭짓점이 모서리 위에 얹혔으면 맞은편 꼭짓점과 이어 삼각형 둘로 나눈다
            for f in others:
                while f is not None and f.is_valid and len(f.verts) > 3:
                    loops = list(f.loops)
                    k = next((i for i, l in enumerate(loops) if l.vert in on_set), None)
                    if k is None:
                        break
                    opp = loops[(k + 2) % len(loops)].vert
                    other, _ = bmesh.utils.face_split(f, loops[k].vert, opp)
                    f = next((g for g in (f, other) if g is not None and g.is_valid and len(g.verts) > 3), None)
        ngons = [f for f in bm.faces if len(f.verts) > 3]
        if ngons:
            bmesh.ops.triangulate(bm, faces=ngons)
        for v in on:
            self.cons.setdefault(v, []).append((field, value))
        return on

    def trim(self, name, faces, field, band=0.0, raise_=0.0, flare=0.0, flare_len=0.06, fade=None):
        """faces를 field로 갈라 field > 0인 쪽을 지우고, 끝선과 나란한 단 선을 낸다."""
        bm, tag, mem = self.bm, self.tag, self.mem
        self.iso_cut(faces, field)
        dead = [f for f in bm.faces if f[tag] == 1 and field(f.calc_center_median()) > 0]
        bmesh.ops.delete(bm, geom=dead, context="FACES")
        kept = [f for f in bm.faces if f[tag] == 1]
        bit = 1 << len(self.trims)
        for f in kept:
            f[mem] |= bit
        t = Trim(name, field, band, raise_, flare, flare_len, fade)
        self.trims.append(t)
        if band > 0:
            for value in (-band, -(band + STEP)):
                self.iso_cut([f for f in bm.faces if f[mem] & bit], field, value)
        return t

    def remove(self, faces):
        bmesh.ops.delete(self.bm, geom=[f for f in faces if f.is_valid], context="FACES")

    def keep_largest(self):
        """떨어져 남은 조각(꼬리 끝 등)을 지우고 가장 큰 덩어리만 남긴다."""
        bm = self.bm
        seen, best = set(), []
        for f in bm.faces:
            if f in seen:
                continue
            comp, stack = [], [f]
            seen.add(f)
            while stack:
                g = stack.pop()
                comp.append(g)
                for e in g.edges:
                    for h in e.link_faces:
                        if h not in seen:
                            seen.add(h)
                            stack.append(h)
            if len(comp) > len(best):
                best = comp
        keep = set(best)
        self.remove([f for f in bm.faces if f not in keep])

    def tidy_lines(self, dist=0.006):
        """가른 선 위에서 너무 가까운 꼭짓점을 합친다(가늘고 긴 조각 삼각형을 줄인다)."""
        bm = self.bm
        merged = 0
        for _ in range(3):
            pairs = []
            used = set()
            for v in [v for v in self.cons if v.is_valid]:
                if v in used:
                    continue
                keys_v = {(id(f), round(val, 6)) for f, val in self.cons[v]}
                for e in v.link_edges:
                    u = e.other_vert(v)
                    if u in used or u not in self.cons or e.calc_length() > dist:
                        continue
                    keys_u = {(id(f), round(val, 6)) for f, val in self.cons[u]}
                    # 같은 선 위의 이웃끼리만 합친다. 모퉁이(선 둘에 걸친 꼭짓점)는 남긴다
                    if keys_u == keys_v or keys_u < keys_v:
                        pairs.append((v, u))
                        used.add(v)
                        used.add(u)
                        break
            if not pairs:
                break
            for v, u in pairs:
                if v.is_valid and u.is_valid:
                    bmesh.ops.pointmerge(bm, verts=[v, u], merge_co=v.co)
                    merged += 1
        self.cons = {v: c for v, c in self.cons.items() if v.is_valid}
        # 합치면서 생긴 넓이 없는 면은 접어 없앤다(그냥 지우면 구멍이 남는다)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
        self.cons = {v: c for v, c in self.cons.items() if v.is_valid}
        ngons = [f for f in bm.faces if len(f.verts) > 3]
        if ngons:
            bmesh.ops.triangulate(bm, faces=ngons)
        return merged

    # --- 띄우기·다듬기·두께 ---
    def decimate_inside(self, ratio):
        """가른 선 위에 있지 않은 안쪽 꼭짓점만 줄인다(끝선·단 선은 그대로). 뼈 무게와 적어 둔 값은 보간된다."""
        bm = self.bm
        vid = self.vid  # 꼭짓점 층은 처음에 만들어 둔다(나중에 더하면 그동안 잡아 둔 꼭짓점을 다시 찾지 못한다)
        table = {}
        # 선 위 꼭짓점에만 번호를 준다(안쪽 꼭짓점은 0: 줄이면서 값이 섞여도 0이다)
        for i, v in enumerate(bm.verts):
            v[vid] = 0
            if v in self.cons:
                v[vid] = i + 1
                table[i + 1] = self.cons[v]
        me = self.o.data
        bm.to_mesh(me)
        bm.free()
        bpy.ops.object.select_all(action="DESELECT")
        self.o.select_set(True)
        bpy.context.view_layer.objects.active = self.o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_mode(type="VERT")
        bpy.ops.mesh.select_all(action="DESELECT")
        em = bmesh.from_edit_mesh(me)
        evid = em.verts.layers.int["wl_id"]
        for v in em.verts:
            if v[evid] == 0 and not v.is_boundary:
                v.select_set(True)
        em.select_flush(True)
        bmesh.update_edit_mesh(me)
        before = len(em.faces)
        bpy.ops.mesh.decimate(ratio=ratio)
        bpy.ops.object.mode_set(mode="OBJECT")
        self.bm = bm = bmesh.new()
        bm.from_mesh(me)
        self.dl = bm.verts.layers.deform.verify()
        self.n0 = bm.verts.layers.float_vector["wl_n0"]
        self.p0 = bm.verts.layers.float_vector["wl_p0"]
        self.tag = bm.faces.layers.int["wl_tag"]
        self.mem = bm.faces.layers.int["wl_mem"]
        self.vid = vid = bm.verts.layers.int["wl_id"]
        self.cons = {v: table[v[vid]] for v in bm.verts if v[vid] in table}
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
        self.log["decimate"] = [before, len(bm.faces)]

    def finish(self, base, color, smooth_iters=SMOOTH, keep=1.0):
        self.keep_largest()
        if kv.get("covered"):
            # 검사 도구(tools/check_clip.py)용: 이 옷이 덮는 살갗의 꼭짓점 자리(끝선에서 0.025 넘게 안쪽인 것)를 covered=<폴더>에 적는다
            pts = []
            for v in self.bm.verts:
                bits = 0
                for f in v.link_faces:
                    bits |= f[self.mem]
                if all(-t.field(v.co) > 0.025 for i, t in enumerate(self.trims) if bits & (1 << i)):
                    pts.append([round(c, 6) for c in v.co])
            os.makedirs(kv["covered"], exist_ok=True)
            with open(os.path.join(kv["covered"], self.name + ".covered.json"), "w", encoding="utf-8") as fp:
                json.dump(pts, fp)
        merged = self.tidy_lines()
        if keep < 1.0:
            self.decimate_inside(keep)
        bm, n0, p0, mem = self.bm, self.n0, self.p0, self.mem
        # 선 위 꼭짓점을 합치거나 줄이다가 삼각형 하나가 빠져 생긴 구멍은 메운다
        #   (모서리로는 이어지지 않고 꼭짓점으로만 붙어 남은 삼각형은 지운다)
        #   (모서리 하나에 면 셋이 붙은 곳에서 지느러미처럼 선 삼각형도 지운다. 줄이는 과정에서 드물게 생긴다)
        fins = [f for f in bm.faces if sum(1 for e in f.edges if e.is_boundary) == 2 and any(len(e.link_faces) > 2 for e in f.edges)]
        if fins:
            bmesh.ops.delete(bm, geom=fins, context="FACES")
        loose = [f for f in bm.faces if all(e.is_boundary for e in f.edges)]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context="FACES")
        tri_holes = [l for l in self._loops([e for e in bm.edges if e.is_boundary]) if len(l) == 3]
        for l in tri_holes:
            if bm.faces.get(l) is None:
                f = bm.faces.new(l)
                f[mem] = max((g[mem] for v in l for g in v.link_faces if g is not f), default=0)
        if tri_holes:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self.cons = {v: c for v, c in self.cons.items() if v.is_valid}
        bm.verts.ensure_lookup_table()
        # 1. 몸 살갗 자리를 적어 둔다(두께를 닫는 면은 이 자리로 간다)
        for v in bm.verts:
            v[p0] = v.co.copy()
            v[n0] = Vector(v[n0]).normalized()
        extra = {}
        for v in bm.verts:
            bits = 0
            for f in v.link_faces:
                bits |= f[mem]
            x = 0.0
            for i, t in enumerate(self.trims):
                if bits & (1 << i):
                    q = Vector(v[p0])
                    x = max(x, t.extra(max(0.0, -t.field(q))) * (t.fade(q) if t.fade else 1.0))
            extra[v] = x
        # 2. 골을 메운다: 팔과 몸통 사이처럼 깊게 접힌 곳은 양쪽 벽을 그대로 띄우면 옷이 서로 파고든다.
        #    띄우기 전에 이웃의 가운데로 당기되 몸 쪽(법선 반대쪽)으로는 가지 못하게 해서, 골 위에 팽팽한 막을 친다(솟은 곳은 그대로다)
        def neighbors(v):
            return [e.other_vert(v) for e in v.link_edges if (e.is_boundary or not v.is_boundary)]

        for _ in range(FILL):
            nxt = {}
            for v in bm.verts:
                nb = neighbors(v)
                if not nb:
                    continue
                q = v.co.lerp(sum((u.co for u in nb), Vector()) / len(nb), 0.5)
                n = Vector(v[n0])
                h = (q - Vector(v[p0])).dot(n)
                if h < 0:
                    q -= n * h
                # 살갗에서 너무 멀어지지 않게 한다(멀어진 꼭짓점은 동작 중에 살갗을 따라가지 못해 살이 뚫고 나온다)
                d = q - Vector(v[p0])
                if d.length > FILL_CAP:
                    q = Vector(v[p0]) + d * (FILL_CAP / d.length)
                nxt[v] = q
            for v, q in nxt.items():
                v.co = q
            self._hold()
        filled = max(((v.co - Vector(v[p0])).length for v in bm.verts), default=0.0)
        # 메운 면의 법선(이웃과 고르게)으로 띄운다
        bm.normal_update()
        nrm = {v: (v.normal.copy() if v.normal.dot(Vector(v[n0])) > 0.2 else Vector(v[n0])) for v in bm.verts}
        for _ in range(3):
            nx = {}
            for v in bm.verts:
                acc = nrm[v] * 1.0
                for e in v.link_edges:
                    acc += nrm[e.other_vert(v)] * 0.5
                nx[v] = acc.normalized() if acc.length > 1e-9 else nrm[v]
            nrm = nx
        # 동작 중에 옷이 살갗 밑으로 가라앉는 곳은 더 띄운다. 팔·다리가 크게 도는 관절 둘레(겨드랑이·사타구니)는 뼈 무게가 섞여 있어,
        # 띄운 방향이 자세에 따라 살갗과 나란해지며 띄운 거리가 줄어든다. 클립 19개의 자세마다 "띄운 거리가 살갗 법선 쪽으로 얼마나 남는지"(1이면 그대로)를
        # 재서, 가장 줄어드는 자세에서도 base가 남도록 그 꼭짓점의 띄우는 거리를 키운다(가장 크게는 LIFT_MAX배)
        lift = self.pose_lift(nrm) if LIFT_MAX > 1.0 else {v: 1.0 for v in bm.verts}
        for v in bm.verts:
            v.co += nrm[v] * (base * lift[v])
        self.log["lift_over_1.5"] = sum(1 for x in lift.values() if x > 1.5)
        # 3. 고르게 다듬는다. 몸 쪽으로 들어간 만큼은 되돌린다(잔 굴곡은 메우고, 솟은 곳은 그대로)
        start = {v: v.co.copy() for v in bm.verts}
        for _ in range(smooth_iters):
            nxt = {}
            for v in bm.verts:
                nb = neighbors(v)
                if not nb:
                    continue
                avg = sum((u.co for u in nb), Vector()) / len(nb)
                q = v.co.lerp(avg, 0.5)
                h = (q - start[v]).dot(nrm[v])
                if h < 0:
                    q -= nrm[v] * h
                nxt[v] = q
            for v, q in nxt.items():
                v.co = q
            self._hold()
        # 단과 벌어짐을 더한다
        for v in bm.verts:
            v.co += nrm[v] * extra[v]
        self._hold()
        self.log["filled_max"] = round(filled, 4)
        # 4. 끝선에서 살갗 밑까지 면을 이어 두께를 닫는다
        edges = [e for e in bm.edges if e.is_boundary]
        loops = self._count_loops(edges)
        # (bmesh의 extrude는 면을 만드는 차례가 돌릴 때마다 달라 결과 파일이 달라진다. 끝선 모서리 차례대로 직접 만든다)
        twin = {}
        for e in edges:
            for v in e.verts:
                if v not in twin:
                    twin[v] = bm.verts.new(v.co, v)  # 뼈 무게 등 꼭짓점 값도 그대로 옮긴다
        for e in edges:
            l = e.link_loops[0]
            a, b = l.vert, l.link_loop_next.vert  # 옷 면에서 a → b로 도는 모서리. 새 면은 거꾸로 돌아야 같은 쪽을 본다
            bm.faces.new((b, a, twin[a], twin[b]))
        new_set = set(twin.values())
        free = []
        for src, v in twin.items():
            p = Vector(src[p0]) - Vector(src[n0]) * INSET
            ends = [(field, value) for field, value in self.cons.get(src, []) if value == 0.0]
            if ends:
                # 끝선에서 옷 안쪽으로 당겨 올린다(위를 보는 끝선은 두께만큼 더: 내려다보면 끝선 안쪽이 그늘져 보인다).
                # 끝선 둘이 만나는 모퉁이는 두 방향의 가운데로 한 번만 당긴다
                move = Vector()
                for field, value in ends:
                    t = next((t for t in self.trims if t.field is field), None)
                    width = (src.co - p).length
                    pull = max(UNDERCUT, width * 1.2) if (t and t.deep) else UNDERCUT
                    if t and t.fade:
                        pull = max(0.003, pull * t.fade(Vector(src[p0])))
                    move -= field.gradient(p) * pull
                p += move / len(ends)
            else:
                free.append(src)
            v.co = p
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.normal_update()
        # 바깥을 보는지 확인(두께 면이 아닌 면의 법선과 몸 법선)
        dots = [f.normal.dot(sum((Vector(v[n0]) for v in f.verts), Vector())) for f in bm.faces if not any(v in new_set for v in f.verts)]
        if sum(1 for d in dots if d < 0) > len(dots) / 2:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
        self.log.update(merged_on_lines=merged, boundary_loops=loops, boundary_verts_off_line=len(free), off_line_at=[[round(c, 3) for c in v.co] for v in free[:20]])
        # 메시로 옮긴다
        me = self.o.data
        bm.to_mesh(me)
        bm.free()
        for name in ("wl_n0", "wl_p0", "wl_tag", "wl_mem", "wl_id"):
            a = me.attributes.get(name)
            if a:
                me.attributes.remove(a)
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        for name in ("sharp_edge", "sharp_face"):
            a = me.attributes.get(name)
            if a:
                me.attributes.remove(a)
        me.materials.clear()
        me.materials.append(solid_material(self.name, color))
        limit_weights(self.o)
        me.update()
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        self.log.update(tris=tris, verts=len(me.vertices))
        print(self.name, json.dumps(self.log))
        INFO[self.name] = dict(self.log)
        return self.o

    def pose_lift(self, nrm):
        """꼭짓점마다 띄우는 거리에 곱할 배율(1 이상). 지금 자리(살갗)와 띄우는 방향 nrm을 클립의 자세들로 옮겨 본다."""
        bm = self.bm
        poses = sample_poses()  # (F, B, 4, 4)
        verts = list(bm.verts)
        index = {v: i for i, v in enumerate(verts)}
        P = np.array([v.co[:] for v in verts])
        N = np.array([nrm[v][:] for v in verts])
        Wm = np.zeros((len(verts), poses.shape[1]))
        for i, v in enumerate(verts):
            for g, w in v[self.dl].items():
                Wm[i, g] = w
        Wm /= np.maximum(Wm.sum(1, keepdims=True), 1e-9)
        tris = np.array([[index[v] for v in f.verts] for f in bm.faces if len(f.verts) == 3])
        Ph = np.concatenate([P, np.ones((len(P), 1))], 1)
        keep = np.ones(len(verts))
        for M in poses:
            Mv = np.einsum("vb,bij->vij", Wm, M)  # 꼭짓점마다 섞은 행렬
            p = np.einsum("vij,vj->vi", Mv, Ph)[:, :3]
            d = np.einsum("vij,vj->vi", Mv[:, :3, :3], N)
            fn = np.cross(p[tris[:, 1]] - p[tris[:, 0]], p[tris[:, 2]] - p[tris[:, 0]])
            vn = np.zeros_like(p)
            for k in range(3):
                np.add.at(vn, tris[:, k], fn)
            vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
            keep = np.minimum(keep, (d * vn).sum(1))
        scale = np.clip(LIFT_KEEP / np.maximum(keep, LIFT_KEEP / LIFT_MAX), 1.0, LIFT_MAX)
        # 이웃과 고르게(큰 값은 지킨다)
        nb = [[index[e.other_vert(v)] for e in v.link_edges] for v in verts]
        for _ in range(3):
            avg = np.array([scale[n].mean() if n else scale[i] for i, n in enumerate(nb)])
            scale = np.maximum(scale, avg)
        self.log["lift_max"] = round(float(scale.max()), 2)
        return {v: float(scale[i]) for i, v in enumerate(verts)}

    def _hold(self):
        for v, cl in self.cons.items():
            if v.is_valid:
                for _ in range(2 if len(cl) > 1 else 1):
                    for field, value in cl:
                        v.co = field.project(v.co, value)

    @staticmethod
    def _loops(edges):
        """끝선 고리마다 꼭짓점 목록."""
        nb = {}
        for e in edges:
            a, b = e.verts
            nb.setdefault(a, []).append(b)
            nb.setdefault(b, []).append(a)
        seen, out = set(), []
        for v in nb:
            if v in seen:
                continue
            stack, comp = [v], [v]
            seen.add(v)
            while stack:
                x = stack.pop()
                for y in nb[x]:
                    if y not in seen:
                        seen.add(y)
                        stack.append(y)
                        comp.append(y)
            out.append(comp)
        return out

    @classmethod
    def _count_loops(cls, edges):
        """끝선 고리마다 [꼭짓점 수, 가운데 x, y, z]."""
        out = []
        for comp in cls._loops(edges):
            c = sum((u.co for u in comp), Vector()) / len(comp)
            out.append([len(comp), round(c.x, 3), round(c.y, 3), round(c.z, 3)])
        return sorted(out, reverse=True)


def limit_weights(o, limit=4):
    """꼭짓점마다 큰 무게 넷만 남기고 합이 1이 되게 한다(glTF는 꼭짓점마다 뼈 넷)."""
    for v in o.data.vertices:
        gs = sorted(((g.group, g.weight) for g in v.groups), key=lambda x: -x[1])
        keep = [(g, w) for g, w in gs[:limit] if w > 1e-4]
        total = sum(w for _, w in keep) or 1.0
        for g, _ in gs:
            o.vertex_groups[g].remove([v.index])
        for g, w in keep:
            o.vertex_groups[g].add([v.index], w / total, "REPLACE")


def find_armpit(side):
    """팔이 몸통에 붙은 자리의 가장 낮은 곳(겨드랑이). 그 아래로는 팔이 몸통과 떨어져 있다."""
    me = BASE_ME
    names = ARM_L if side > 0 else ARM_R
    idx = [GROUPS[n] for n in names]
    aw = np.zeros(len(me.vertices))
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    for v in me.vertices:
        aw[v.index] = sum(g.weight for g in v.groups if g.group in idx)
    tris = np.array([p.vertices[:] for p in me.polygons])
    best = None
    for zc in np.arange(0.36, 0.16, -0.0025):
        below = (co[tris][:, :, 2] < zc).all(1)
        t = tris[below]
        parent = list(range(len(co)))

        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a

        for a, b, c in t:
            ra, rb, rc = find(a), find(b), find(c)
            parent[rb] = ra
            parent[find(c)] = ra
        used = np.unique(t)
        arm_v = [i for i in used if aw[i] > 0.9]
        torso_v = [i for i in used if aw[i] < 0.02 and abs(co[i, 0]) < 0.1 and co[i, 2] > 0.13]
        if not arm_v or not torso_v:
            continue
        roots_arm = {find(i) for i in arm_v}
        roots_torso = {find(i) for i in torso_v}
        if not (roots_arm & roots_torso):
            best = zc
            break
    # 그 높이 바로 위에서 팔과 몸통을 잇는 자리의 꼭짓점들(팔 무게가 0.2~0.8인 곳) 가운데
    band = [i for i in range(len(co)) if best <= co[i, 2] < best + 0.02 and 0.15 < aw[i] < 0.85 and co[i, 0] * side > 0]
    c = co[band].mean(0) if band else np.array([0.155 * side, 0.03, best])
    return Vector((float(c[0]), float(c[1]), float(best)))


# ---------- 상의·하의·조끼 ----------
def build_skin_wear():
    global BASE_ME
    BASE_ME = make_base_mesh()
    pit = {1: find_armpit(1), -1: find_armpit(-1)}
    print("armpit", {k: tuple(round(x, 4) for x in v) for k, v in pit.items()})
    INFO["armpit_blender"] = {("l" if k > 0 else "r"): [round(x, 4) for x in v] for k, v in pit.items()}
    # 꼬리가 등에 붙은 자리(타원). 옷 뒤는 이 둘레를 둥글게 파낸다
    tail_cx, tail_cz, tail_rx, tail_rz = 0.008, 0.196, 0.086, 0.072
    Z_NECK = 0.394  # 목: 머리 밑바닥(0.40) 바로 아래
    Z_HEM = 0.200  # 티셔츠·조끼 밑단
    Z_WAIST = 0.216  # 반바지 허리(밑단보다 높아 티셔츠 밑단이 허리띠를 덮는다)
    Z_LEG = 0.094  # 반바지 다리 끝(발등 꺾이는 곳 0.085 바로 위)

    def sleeve_plane(side, tilt_deg, drop=0.004, inward=0.006):
        """겨드랑이 바로 밑을 지나는 소매 끝 평면. tilt_deg는 팔 바깥쪽이 올라가는 기울기(0이면 수평).
        팔은 겨드랑이 위로 몸통에 붙어 있다. 평면이 겨드랑이 밑을 지나야 끝선이 팔을 한 바퀴 돌아 닫힌다."""
        t = math.radians(tilt_deg)
        # 평면 법선: 아래(-z)에서 바깥(x) 쪽으로 기울인다 → 바깥쪽 끝선이 높아진다
        n = Vector((side * math.sin(t), 0, -math.cos(t)))
        return plane(pit[side] - Vector((side * inward, 0, drop)), n)

    def near_pit(side):
        """겨드랑이에서 바깥으로 0.04 가는 동안 0에서 1로 커지는 배율. 소매 끝의 안쪽은 몸통 옷에 묻히므로 단을 세우지 않는다."""
        x0 = pit[side].x * side + 0.004
        return lambda p: min(1.0, max(0.0, (p.x * side - x0) / 0.04))

    def back_faces(s):
        return [f for f in s.bm.faces if f.calc_center_median().y > 0.06 and abs(f.calc_center_median().x) < 0.16]

    def arm_below(s, field, side):
        """팔에서 field 아래쪽(field > 0)에 있는 면과, 그 면에 닿아 field에 걸친 면.
        손끝에서 시작해 꼭짓점이 모두 아래쪽인 면만 따라간다. 팔은 겨드랑이 위에서만 몸통에 붙어 있어 몸통으로 새지 않는다."""
        names = ARM_L if side > 0 else ARM_R
        below = {f for f in s.bm.faces if all(field(v.co) > 0 for v in f.verts)}
        stack = [f for f in below if s.fw(f, names) > 0.95 and f.calc_center_median().z < pit[side].z - 0.03]
        inner = set(stack)
        while stack:
            g = stack.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h in below and h not in inner:
                        inner.add(h)
                        stack.append(h)
        leak = [f for f in inner if abs(f.calc_center_median().x) < 0.10]
        if leak or not inner:
            raise SystemExit(f"{s.name}: 팔을 자르는 평면이 겨드랑이보다 높아 몸통까지 번졌다(면 {len(inner)}개, 몸통 쪽 {len(leak)}개). 평면을 낮춘다")
        verts = {v for f in inner for v in f.verts}
        return list(inner | {f for v in verts for f in v.link_faces})  # iso_cut이 번호 차례로 다시 늘어놓는다

    made = {}
    # --- 티셔츠 ---
    if want("top"):
        s = Shell("wear-top")
        s.trim("neck", list(s.bm.faces), plane((0, 0, Z_NECK), (0, 0, 1)), flare=0.004, flare_len=0.02)
        for side in (1, -1):
            f = sleeve_plane(side, 16)
            s.trim("sleeve", arm_below(s, f, side), f, band=0.018, raise_=0.005, flare=0.006, flare_len=0.05, fade=near_pit(side))
        s.trim("hem", list(s.bm.faces), plane((0, 0, Z_HEM), (0, 0, -1)), band=0.02, raise_=0.005, flare=0.007, flare_len=0.07)
        s.trim("tail", back_faces(s), tube_y(tail_cx, tail_cz, tail_rx, tail_rz))
        made["top"] = s.finish(0.015, "#F0873A", keep=KEEP)
    # --- 조끼 ---
    if want("vest"):
        s = Shell("wear-vest")
        s.trim("neck", list(s.bm.faces), plane((0, 0, Z_NECK), (0, 0, 1)), flare=0.004, flare_len=0.02)
        for side in (1, -1):
            f = sleeve_plane(side, 50)
            s.trim("armhole", arm_below(s, f, side), f, band=0.016, raise_=0.005, fade=near_pit(side))
        s.trim("hem", list(s.bm.faces), plane((0, 0, Z_HEM + 0.004), (0, 0, -1)), band=0.02, raise_=0.005, flare=0.007, flare_len=0.07)
        # 앞섶: 가운데를 V로 판다
        vz, vk = 0.285, 1.25
        s.trim("vneck", [f for f in s.bm.faces if f.calc_center_median().y < -0.02 and abs(f.calc_center_median().x) < 0.14],
               Field(lambda p: ((p.z - vz) - abs(p.x) * vk) / math.hypot(1, vk)))
        s.trim("tail", back_faces(s), tube_y(tail_cx, tail_cz, tail_rx, tail_rz))
        made["vest"] = s.finish(0.016, "#5E7F4F", keep=KEEP)
    # --- 반바지 ---
    if want("bottom"):
        s = Shell("wear-bottom")
        for side in (1, -1):
            # 팔(손)은 허리선 아래까지 내려와 있다. 겨드랑이 아래의 팔을 먼저 지운다
            f = plane(pit[side] - Vector((0, 0, 0.004)), (0, 0, -1))
            s.trim("arm", arm_below(s, f, side), f)
        s.trim("waist", list(s.bm.faces), plane((0, 0, Z_WAIST), (0, 0, 1)), band=0.022, raise_=0.005).deep = True
        s.trim("legs", list(s.bm.faces), plane((0, 0, Z_LEG), (0, 0, -1)), band=0.012, raise_=0.004, flare=0.004, flare_len=0.03)
        s.trim("tail", back_faces(s), tube_y(tail_cx, tail_cz, tail_rx, tail_rz))
        made["bottom"] = s.finish(0.011, "#34507A", keep=KEEP)
    return made


def export(objs, file_name, skins):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(out_dir, file_name)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
                              export_animations=False, export_skins=skins, export_morph=False)
    print("exported", file_name, os.path.getsize(path), "bytes")
    return path

# ---------- 뼈에 붙이는 것: 모양은 지금 것 그대로, 자리와 크기만 새 몸에 맞춘다 ----------
def bounds_of(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    return (Vector((min(p.x for p in vs), min(p.y for p in vs), min(p.z for p in vs))),
            Vector((max(p.x for p in vs), max(p.y for p in vs), max(p.z for p in vs))))


def finish(o, mat):
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def rounded_box(size, center, bevel, mat=None, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new("bev", "BEVEL")
    m.width = bevel
    m.segments = segments
    bpy.ops.object.modifier_apply(modifier="bev")
    if mat:
        finish(o, mat)
    return o


def tube(points, radius, mat):
    """점들을 잇는 둥근 줄(곡선에 두께를 주어 메시로)."""
    cu = bpy.data.curves.new("tube", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, pt in zip(sp.bezier_points, points):
        bp.co = pt
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new("tube", cu)
    scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return finish(bpy.context.active_object, mat)


def ring(center, rx, ry, radius, mat, tilt=0.0, segments=40):
    """몸 둘레를 도는 둥근 고리. tilt만큼 앞이 처진다(뒤는 그만큼 올라간다)."""
    pts = []
    for i in range(segments + 1):
        a = 2 * math.pi * i / segments
        pts.append(Vector((center.x + rx * math.cos(a), center.y + ry * math.sin(a), center.z + math.sin(a) * tilt)))
    cu = bpy.data.curves.new("ring", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p_, pt in zip(sp.points, pts):
        p_.co = (pt.x, pt.y, pt.z, 1)
    sp.use_cyclic_u = True
    o = bpy.data.objects.new("ring", cu)
    scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return finish(bpy.context.active_object, mat)


def front_y_at(x, z, names=("head",), band=0.03):
    """그 높이·가로 자리 근처의 몸 앞면(가장 작은 y)."""
    ys = [p.y for p, d in zip(BODY_CO, BODY_DOM) if d in names and abs(p.x - x) < band and abs(p.z - z) < band]
    return min(ys) if ys else None


def section_at(z, names, band=0.015):
    """그 높이 근처 몸(names 뼈 부위)의 가운데와 가로·앞뒤 반지름."""
    pts = [p for p, d in zip(BODY_CO, BODY_DOM) if d in names and abs(p.z - z) < band]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    return Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, z)), (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2


def recolor_hat(hat, name, hue_deg):
    """모자 무늬 그림의 주황 부분만 다른 색으로 바꾼 사본."""
    o = hat.copy()
    o.data = hat.data.copy()
    o.name = name
    scene.collection.objects.link(o)
    for i, m in enumerate(o.data.materials):
        if not m:
            continue
        m2 = m.copy()
        m2.name = f"{name}-{i}"
        o.data.materials[i] = m2
        for n in m2.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                img = n.image.copy()
                img.name = f"{name}-tex"
                px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
                r, g, b = px[:, 0], px[:, 1], px[:, 2]
                mx = np.max(px[:, :3], axis=1)
                mn = np.min(px[:, :3], axis=1)
                sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
                # 주황(빨강이 가장 크고 파랑이 가장 작으며 채도가 높은 곳)만 고른다
                orange = (r >= g) & (g >= b) & (sat > 0.35) & (mx > 0.25)
                for k in np.nonzero(orange)[0]:
                    h, l, s_ = colorsys.rgb_to_hls(px[k, 0], px[k, 1], px[k, 2])
                    px[k, 0], px[k, 1], px[k, 2] = colorsys.hls_to_rgb(hue_deg / 360.0, l, s_)
                img.pixels[:] = px.ravel()
                img.pack()
                n.image = img
    return o


# 새 몸에 맞춘 자리 값(Blender 축: x 왼쪽+, y 앞-, z 위. 키 1)
HAT = {"width": 1.12, "tilt": 0.0, "y": 0.0, "sink": 0.18}
SHOE = {"top": 0.085, "pad": 0.012}
GLASSES = {"z": 0.64, "dx": 0.105, "out": 0.03, "wrap": 12, "temple_x": 0.47, "temple_y": 0.02}
NECK = {"z": 0.375, "muffler_dz": -0.004, "muffler_pad": 0.028, "necklace_dz": 0.0, "necklace_pad": 0.024}
# 백팩: 크기는 어깨 너비에 대한 비율(w 가로, d 앞뒤, h 높이), lean은 위쪽을 앞으로 기울인 각도(등의 기울기), z는 자리를 찾기 시작하는 가운데 높이,
#       embed는 앞면이 등에 닿는 깊이, clear는 가방 밑과 꼬리 윗면 사이의 틈, drop은 멜빵 앞 끝이 어깨에서 내려오는 길이
PACK = {"w": 0.58, "d": 0.2, "h": 0.31, "lean": 18, "z": 0.30, "embed": 0.004, "clear": 0.006, "shoulder_z": 0.375, "strap_x": 0.135, "over": 0.03, "gap": 0.03, "drop": 0.10}


def build_bone_wear():
    made = {}
    h_lo, h_hi = region_bounds({"head"})
    s_lo, s_hi = region_bounds({"spine"})
    head_w, head_h = h_hi.x - h_lo.x, h_hi.z - h_lo.z
    head_cx = (h_lo.x + h_hi.x) / 2
    body_w, body_d = s_hi.x - s_lo.x, s_hi.y - s_lo.y
    INFO["measure_blender"] = {"head_lo": [round(c, 4) for c in h_lo], "head_hi": [round(c, 4) for c in h_hi],
                               "spine_lo": [round(c, 4) for c in s_lo], "spine_hi": [round(c, 4) for c in s_hi]}

    # ----- 모자 -----
    if want("hat"):
        before = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=cap_path)
        cap_meshes = [o for o in scene.objects if o not in before and o.type == "MESH"]
        for o in [o for o in scene.objects if o not in before and o.type != "MESH"]:
            bpy.data.objects.remove(o, do_unlink=True)
        for o in cap_meshes:
            o.data = o.data.copy()
            o.data.transform(o.matrix_world)
            o.parent = None
            o.matrix_world = Matrix.Identity(4)
        if len(cap_meshes) > 1:
            bpy.ops.object.select_all(action="DESELECT")
            for o in cap_meshes:
                o.select_set(True)
            bpy.context.view_layer.objects.active = cap_meshes[0]
            bpy.ops.object.join()
        hat = cap_meshes[0]
        hat.name = "wear-hat"
        # 점 수를 줄이고 그림을 작게 한다(앱 크기). 지금 것과 같다
        dec = hat.modifiers.new("dec", "DECIMATE")
        dec.ratio = 0.45
        bpy.context.view_layer.objects.active = hat
        bpy.ops.object.modifier_apply(modifier="dec")
        for m in hat.data.materials:
            if m and m.use_nodes:
                for n in m.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > 512:
                        n.image.scale(512, 512)
                        n.image.pack()
        # 챙 방향: 긴 쪽(y)으로 챙이 나와 있다. 꼭짓점 평균이 상자 가운데보다 치우친 반대쪽이 챙이다. 챙을 앞(-y)으로 맞춘다
        lo, hi = bounds_of(hat)
        mean_y = sum(v.co.y for v in hat.data.vertices) / len(hat.data.vertices)
        if not mean_y > (lo.y + hi.y) / 2:
            hat.data.transform(Matrix.Rotation(math.pi, 4, "Z"))
        # 크기: 두 귀 사이(안쪽 가장자리 사이 폭)보다 조금 넓게
        ears = sorted([region_bounds({"ear_l"}), region_bounds({"ear_r"})], key=lambda b: (b[0].x + b[1].x) / 2)
        ear_gap = ears[1][0].x - ears[0][1].x
        ear_mid_x = (ears[1][0].x + ears[0][1].x) / 2
        lo, hi = bounds_of(hat)
        hat.data.transform(Matrix.Scale(ear_gap * HAT["width"] / (hi.x - lo.x), 4))
        # 자리: 귀 사이 머리 꼭대기
        lo, hi = bounds_of(hat)
        cap_h = hi.z - lo.z
        pivot = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        hat.data.transform(Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(HAT["tilt"]), 4, "X") @ Matrix.Translation(-pivot))
        lo, hi = bounds_of(hat)
        top_z = max(p.z for p in region_points({"head"}))
        target = Vector((ear_mid_x, HAT["y"], top_z - cap_h * HAT["sink"]))
        hat.data.transform(Matrix.Translation(target - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
        INFO["hat"] = {"ear_gap": round(ear_gap, 4), "head_top_z": round(top_z, 4), "cap_h": round(cap_h, 4)}
        made["hat"] = [hat]
        # 색만 다른 모자(무늬 그림의 주황 부분만 바꾼다)
        for name, hue in (("wear-hat-blue", 212), ("wear-hat-green", 128)):
            made[name[5:]] = [recolor_hat(hat, name, hue)]

    # ----- 신발(왼발 한 짝. 앱이 좌우로 뒤집어 오른발에도 붙인다) -----
    if want("shoe"):
        shoe_mat = solid_material("wear-shoe", "#7A4A2A")
        pts = [p for p in BODY_CO if p.x > 0 and p.z < SHOE["top"]]
        f_lo = Vector((min(p.x for p in pts), min(p.y for p in pts), 0.0))
        f_hi = Vector((max(p.x for p in pts), max(p.y for p in pts), SHOE["top"]))
        size = Vector(((f_hi.x - f_lo.x) + 2 * SHOE["pad"], (f_hi.y - f_lo.y) + 2 * SHOE["pad"], SHOE["top"] + 0.004))
        o = rounded_box(size, (0, 0, 0), min(size.x, size.z) * 0.45, segments=4)
        o.name = "wear-shoe-l"
        for p_ in o.data.polygons:
            p_.use_smooth = True
        # 바닥은 발바닥보다 조금 아래
        o.location = ((f_lo.x + f_hi.x) / 2, (f_lo.y + f_hi.y) / 2, size.z / 2 - 0.004)
        bpy.ops.object.transform_apply(location=True)
        o.data.materials.append(shoe_mat)
        made["shoe"] = [o]

    # ----- 선글라스: 검은 테와 알 둘, 귀 쪽으로 가는 다리 -----
    if want("sunglasses"):
        glass_mat = solid_material("wear-sunglasses-lens", "#1E1E24")
        frame_mat = solid_material("wear-sunglasses-frame", "#101014")
        eye_z, eye_dx = GLASSES["z"], GLASSES["dx"]
        lens_w, lens_h = head_w * 0.25, head_h * 0.2
        parts = []
        for side in (-1, 1):
            x = head_cx + side * eye_dx
            fy = front_y_at(x, eye_z)
            bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=lens_w / 2, depth=lens_h * 0.12, location=(x, fy - GLASSES["out"], eye_z))
            lens = finish(bpy.context.active_object, glass_mat)
            lens.scale = (1, 1, lens_h / lens_w)
            bev = lens.modifiers.new("bev", "BEVEL")
            bev.width = lens_h * 0.04
            bev.segments = 2
            bpy.context.view_layer.objects.active = lens
            bpy.ops.object.modifier_apply(modifier="bev")
            # 원기둥 축(z)을 앞(-y)으로 눕히고, 얼굴 곡면을 따라 바깥쪽 알을 조금 뒤로 돌린다
            lens.rotation_euler = (math.radians(90), 0, side * math.radians(-GLASSES["wrap"]))
            bpy.context.view_layer.objects.active = lens
            bpy.ops.object.transform_apply(rotation=True, scale=True)
            parts.append(lens)
            # 귀 쪽으로 가는 다리: 알 바깥 끝에서 머리 옆으로
            side_x = head_cx + side * head_w * GLASSES["temple_x"]
            parts.append(tube([Vector((x + side * lens_w * 0.5, fy - GLASSES["out"] + lens_h * 0.1, eye_z + lens_h * 0.3)),
                               Vector((side_x, GLASSES["temple_y"], eye_z + lens_h * 0.35))], lens_h * 0.05, frame_mat))
        fy_mid = front_y_at(head_cx, eye_z) - GLASSES["out"]
        parts.append(tube([Vector((head_cx - eye_dx + lens_w * 0.45, fy_mid + lens_h * 0.05, eye_z + lens_h * 0.3)),
                           Vector((head_cx, fy_mid - lens_h * 0.05, eye_z + lens_h * 0.36)),
                           Vector((head_cx + eye_dx - lens_w * 0.45, fy_mid + lens_h * 0.05, eye_z + lens_h * 0.3))], lens_h * 0.06, frame_mat))
        made["sunglasses"] = [join(parts, "wear-sunglasses")]

    # 목: 머리 밑바닥 바로 아래. 그 높이 몸통 단면을 따라 두른다
    neck_z = NECK["z"]
    neck_c, neck_rx, neck_ry = section_at(neck_z, ("spine", "arm_l", "arm_r", "head"))
    neck_c2, torso_rx, torso_ry = section_at(neck_z - 0.03, ("spine",))
    chest_z = neck_z - (s_hi.z - s_lo.z) * 0.2
    chest_front = front_y_at(neck_c.x, chest_z, names=("spine",), band=0.04)
    # 크기의 기준: 어깨 너비(목 높이에서 팔까지 넣은 가로 폭). 옛 몸에서는 몸통 뼈 부위의 폭(0.48)을 기준으로 삼았는데,
    # 새 몸은 뼈 무게가 달라 그 폭이 0.37로 나온다. 같은 크기로 보이게 어깨 너비(0.45)를 쓴다
    ref_w = neck_rx * 2
    INFO["neck_blender"] = {"center": [round(c, 4) for c in neck_c], "rx": round(neck_rx, 4), "ry": round(neck_ry, 4),
                            "torso_center": [round(c, 4) for c in neck_c2], "torso_rx": round(torso_rx, 4), "torso_ry": round(torso_ry, 4),
                            "chest_front": round(chest_front, 4), "chest_z": round(chest_z, 4)}

    # ----- 머플러: 목에 두른 두툼한 고리와 앞으로 늘어진 끝 -----
    if want("muffler"):
        muffler_mat = solid_material("wear-muffler", "#D23C3C")
        r = ref_w * 0.085
        m_ring = ring(Vector((neck_c2.x, neck_c2.y, neck_z + NECK["muffler_dz"])), torso_rx + NECK["muffler_pad"], torso_ry + NECK["muffler_pad"], r, muffler_mat)
        m_tail = rounded_box((ref_w * 0.17, ref_w * 0.07, ref_w * 0.36),
                             (neck_c.x - ref_w * 0.15, chest_front - ref_w * 0.075, neck_z - ref_w * 0.2), ref_w * 0.04, muffler_mat)
        m_tail.rotation_euler = (math.radians(-8), 0, math.radians(6))
        bpy.context.view_layer.objects.active = m_tail
        bpy.ops.object.transform_apply(rotation=True)
        made["muffler"] = [join([m_ring, m_tail], "wear-muffler")]

    # ----- 목걸이: 목에 건 가는 금줄(앞이 처지게)과 가슴 앞 펜던트 -----
    if want("necklace"):
        gold_mat = solid_material("wear-necklace", "#E0B33C")
        pad = NECK["necklace_pad"]
        n_ring = ring(Vector((neck_c2.x, neck_c2.y, neck_z + NECK["necklace_dz"])), torso_rx + pad, torso_ry + pad, ref_w * 0.018, gold_mat, tilt=ref_w * 0.1)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=ref_w * 0.07, location=(neck_c.x, chest_front - ref_w * 0.07, chest_z))
        pend = finish(bpy.context.active_object, gold_mat)
        pend.scale = (1, 0.55, 1.15)
        made["necklace"] = [join([n_ring, pend], "wear-necklace")]

    # ----- 백팩: 등에 붙여 등과 꼬리 사이에 멘 둥근 가방과 덮개, 어깨를 넘어가는 멜빵 둘(18·19 결정) -----
    # 가방은 등의 기울기를 따라 위쪽을 앞으로 기울여 등에 붙이고, 밑은 꼬리 윗면 바로 위에 둔다. 자리는 몸의 치수로 잡는다:
    #   앞뒤는 가방 앞면이 등에 embed만큼만 닿는 곳, 높이는 가방 밑에 꼬리가 clear만큼 떨어지는 가장 낮은 곳.
    # (꼬리를 뒤로 젖힌 몸이어야 자리가 난다. 받은 그대로의 꼬리는 등 바로 뒤에서 머리 밑까지 솟아 있어 가방을 가린다.)
    if want("backpack"):
        pack_mat = solid_material("wear-backpack", "#C8443A")
        flap_mat = solid_material("wear-backpack-flap", "#A8332C")
        strap_mat = solid_material("wear-backpack-strap", "#6E2A24")
        pack_w, pack_d, pack_h = ref_w * PACK["w"], ref_w * PACK["d"], ref_w * PACK["h"]
        lean = Matrix.Rotation(math.radians(PACK["lean"]), 4, "X")  # 위쪽이 앞(-y)으로 기운다
        inv = lean.inverted()
        # 등: 몸통·엉덩이 부위와, 꼬리 뿌리 둘레의 등 살갗(꼬리 뼈 무게가 섞였지만 등에 붙어 거의 움직이지 않는 곳).
        # 꼬리: 꼬리 뼈만 따르는 꼭짓점(뿌리에서 조금 떨어진 곳부터)
        back_pts = [p_ for p_, d_, w_ in zip(BODY_CO, BODY_DOM, BODY_TAILW)
                    if (d_ in ("spine", "hips") or 0 < w_ < 0.95) and p_.y > 0.05 and abs(p_.x) < pack_w * 0.5]
        tail_pts = [p_ for p_, w_ in zip(BODY_CO, BODY_TAILW) if w_ >= 0.95]
        pack_c = Vector((neck_c.x, 0.22, PACK["z"]))
        for _ in range(80):
            # 앞뒤: 가방 높이 안에 든 등 꼭짓점 가운데 가방 쪽으로 가장 나온 점이 앞면에서 embed만큼만 들어오게
            inside = [q.y for q in (inv @ (p_ - pack_c) for p_ in back_pts) if abs(q.x) < pack_w * 0.5 and abs(q.z) < pack_h * 0.5]
            move = max(inside) - (-pack_d * 0.5 + PACK["embed"])
            pack_c += lean @ Vector((0, move, 0))
            # 높이: 가방 밑(가로·앞뒤 범위 안)에 든 꼬리 꼭짓점이 밑면보다 clear만큼 아래에 오게 올린다
            under = [q.z for q in (inv @ (p_ - pack_c) for p_ in tail_pts) if abs(q.x) < pack_w * 0.5 and abs(q.y) < pack_d * 0.5 + 0.01]
            lift = (max(under) + PACK["clear"]) - (-pack_h * 0.5) if under else 0.0
            if lift > 1e-4:
                pack_c += lean @ Vector((0, 0, lift))
            elif abs(move) < 1e-4:
                break

        def placed(o, local):
            o.rotation_euler = (math.radians(PACK["lean"]), 0, 0)
            o.location = pack_c + lean @ Vector(local)
            return o

        bag = placed(rounded_box((pack_w, pack_d, pack_h), (0, 0, 0), min(pack_w * 0.18, pack_d * 0.42), pack_mat), (0, 0, 0))
        flap = placed(rounded_box((pack_w * 0.92, pack_d * 0.3, pack_h * 0.3), (0, 0, 0), min(pack_w * 0.1, pack_d * 0.14), flap_mat), (0, pack_d * 0.42, pack_h * 0.12))
        straps = []
        sh_z = PACK["shoulder_z"]
        gap = PACK["gap"]  # 멜빵이 살갗에서 뜨는 거리(티셔츠 위로 보이게 옷 두께보다 크게)
        for side in (-1, 1):
            x = neck_c.x + side * PACK["strap_x"]
            near = [p for p, d in zip(BODY_CO, BODY_DOM) if d in ("spine", "arm_l", "arm_r") and abs(p.x - x) < 0.03 and abs(p.z - sh_z) < 0.03]
            back_y, front_y = max(p.y for p in near), min(p.y for p in near)
            low_z = sh_z - PACK["drop"]
            low = [p for p, d in zip(BODY_CO, BODY_DOM) if d in ("spine", "arm_l", "arm_r", "hips") and abs(p.x - x) < 0.03 and abs(p.z - low_z) < 0.03]
            low_y = min(p.y for p in low)
            on_bag = pack_c + lean @ Vector((side * pack_w * 0.36, -pack_d * 0.15, pack_h * 0.25))
            behind = Vector((x, back_y + gap, sh_z))
            straps.append(tube([on_bag,
                                Vector(((on_bag.x + x) / 2, max(on_bag.y, behind.y) + 0.004, (on_bag.z + behind.z) / 2 + 0.008)),
                                behind,
                                Vector((x, (back_y + front_y) / 2, sh_z + PACK["over"])),
                                Vector((x, front_y - gap, sh_z - 0.01)),
                                Vector((x + side * ref_w * 0.03, low_y - gap, low_z))], ref_w * 0.035, strap_mat))
        INFO["backpack"] = {"center": [round(c, 4) for c in pack_c], "size_w_d_h": [round(pack_w, 4), round(pack_d, 4), round(pack_h, 4)], "lean_deg": PACK["lean"],
                            "tail_top_under_pack": round(max((p_.z for p_ in tail_pts if abs(p_.x - pack_c.x) < pack_w * 0.5 and p_.y < pack_c.y + pack_d), default=0.0), 4)}
        made["backpack"] = [join([bag, flap, *straps], "wear-backpack")]
    # 단색 모델은 질감 좌표를 뺀다(그림이 없어 쓰이지 않는다). 좌표 이음매로 꼭짓점이 겹치지 않아 외곽선 껍질이 덜 벌어지고,
    # 다시 만들어도 파일이 바이트까지 같다(도형의 질감 좌표는 끝자리가 돌릴 때마다 조금 달라진다)
    for key, objs in made.items():
        for o in objs:
            # 메시 이름을 노드 이름과 같게 둔다(그냥 두면 Cube.002처럼 만든 차례에 따라 달라져, 하나만 만들 때(only=)와 파일이 달라진다)
            o.data.name = o.name
        if key.startswith("hat"):
            continue
        for o in objs:
            while o.data.uv_layers:
                o.data.uv_layers.remove(o.data.uv_layers[0])
            # 네모 면은 여기서 정한 대각선으로 미리 삼각형으로 나눈다(내보낼 때 나누면 대칭인 면의 대각선이 돌릴 때마다 달라질 수 있다)
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bmesh.ops.triangulate(bm, faces=bm.faces, quad_method="FIXED", ngon_method="EAR_CLIP")
            # 면의 차례도 꼭짓점 번호로 정해 둔다(공 도형은 면 차례가 돌릴 때마다 달라진다)
            bm.verts.index_update()
            n = len(bm.verts) + 1

            def order(f, n=n):
                a, b, c = sorted(v.index for v in f.verts)
                return float((a * n + b) * n + c)

            bm.faces.sort(key=order)
            bm.to_mesh(o.data)
            bm.free()
    return made


skin = build_skin_wear() if (ONLY is None or ONLY & {"top", "bottom", "vest"}) else {}
for key, o in skin.items():
    export([arm, o], f"wear-{key}.glb", True)
bone = build_bone_wear() if (ONLY is None or ONLY - {"top", "bottom", "vest"}) else {}
for key, objs in bone.items():
    export(objs, f"wear-{key}.glb", False)

if kv.get("info"):
    with open(kv["info"], "w", encoding="utf-8") as fp:
        json.dump(INFO, fp, ensure_ascii=False, indent=1)
