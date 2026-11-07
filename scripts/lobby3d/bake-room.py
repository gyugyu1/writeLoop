# 라룹이의 방(디오라마) 껍데기를 만들고 빛을 구워 glb로 내보낸다.
# 쓰는 법: blender -b -P scripts/lobby3d/bake-room.py -- <출력 폴더> [samples]
#   (Blender 5.2에서 확인. 저장소 밖 폴더에 내보낸 뒤 <출력 폴더>/room.glb를 apps/mobile/assets/models/lobby-room.glb로 복사한다)
# 방 크기·벽 두께·입구 발판은 apps/mobile/src/lib/lobby3d/engine.ts의 ROOM과 같아야 한다. 무늬 계산은 lobby3d-canvas.tsx와 같다.
# 앱 좌표(three.js, y 위, 앞은 +z)로 적고 Blender 좌표(z 위)로 바꿔 만든다: blender = (x, -z, y).
# 빛(조도)만 Cycles로 굽고, 무늬(널빤지·벽지)와 곱하는 것은 numpy로 한다. 가구 그림자는 굽지 않는다(가구는 앱이 그린다).
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), "out")
SAMPLES = int(argv[1]) if len(argv) > 1 else 256
os.makedirs(OUT, exist_ok=True)

# 앱의 ROOM과 같은 값
W, D, H, T = 8.0, 11.0, 3.2, 0.4
STEP_W, STEP_D = 2.0, 0.7
PX_PER_UNIT = 128

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def b(x, y, z):
    """앱 좌표 → Blender 좌표"""
    return (x, -z, y)


def make_mesh(name, verts, faces, uvs=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([b(*v) for v in verts], [], faces)
    mesh.update()
    if uvs is not None:
        layer = mesh.uv_layers.new(name="UVMap")
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                layer.data[li].uv = uvs[mesh.loops[li].vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def quad(name, corners, flip=False):
    """네 꼭짓점(앱 좌표, 왼아래·오른아래·오른위·왼위 순)으로 UV 0~1 판을 만든다."""
    face = [0, 1, 2, 3] if not flip else [3, 2, 1, 0]
    return make_mesh(name, corners, [face], uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])


def box_faces(x0, x1, y0, y1, z0, z1, skip=()):
    """상자 꼭짓점과 면. skip: 'px','nx','py','ny','pz','nz' 중 뺄 면(앱 좌표 기준 바깥 방향)."""
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = {
        "nz": [0, 3, 2, 1],
        "pz": [4, 5, 6, 7],
        "ny": [0, 1, 5, 4],
        "py": [3, 7, 6, 2],
        "nx": [0, 4, 7, 3],
        "px": [1, 2, 6, 5],
    }
    return v, [f[k] for k in f if k not in skip]


def boxes(name, specs):
    verts, faces = [], []
    for spec in specs:
        v, f = box_faces(*spec[:6], skip=spec[6] if len(spec) > 6 else ())
        base = len(verts)
        verts += v
        faces += [[base + i for i in face] for face in f]
    obj = make_mesh(name, verts, faces)
    # 앱 좌표를 Blender 좌표로 바꾸면 손잡이 방향이 뒤집히므로 법선을 바깥으로 다시 맞춘다.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


# ---------- 모양 ----------
# 바닥(위에서 보아 u는 +x, v는 앞(+z)에서 뒤로)
floor = quad("floor", [(0, 0, D), (W, 0, D), (W, 0, 0), (0, 0, 0)])
# 벽 안쪽 면(벽지). u는 바닥과 닿는 가로 방향, v는 위로
wall_back = quad("wall_back", [(0, 0, 0), (W, 0, 0), (W, H, 0), (0, H, 0)])
wall_left = quad("wall_left", [(0, 0, 0), (0, 0, D), (0, H, D), (0, H, 0)])
wall_right = quad("wall_right", [(W, 0, D), (W, 0, 0), (W, H, 0), (W, H, D)])
# 벽 윗면과 앞 잘린 면(안쪽 면은 위 판이 맡는다)
wall_trim = boxes(
    "wall_trim",
    [
        (-T, W + T, 0, H, -T, 0, ("pz",)),
        (-T, 0, 0, H, 0, D, ("px", "nz")),
        (W, W + T, 0, H, 0, D, ("nx", "nz")),
    ],
)
baseboard = boxes(
    "baseboard",
    [
        (0, W, 0, 0.2, 0, 0.06),
        (0, 0.06, 0, 0.2, 0.06, D),
        (W - 0.06, W, 0, 0.2, 0.06, D),
    ],
)
step = boxes("step", [(W / 2 - STEP_W / 2, W / 2 + STEP_W / 2, -0.22, -0.06, D, D + STEP_D)])
slab = boxes("slab", [(-T, W + T, -0.24, -0.02, -T, D)])

# 판의 법선도 방 안쪽을 보게 맞춘다
for obj, inward in ((floor, (0, 1, 0)), (wall_back, (0, 0, 1)), (wall_left, (1, 0, 0)), (wall_right, (-1, 0, 0))):
    n = obj.data.polygons[0].normal
    want = Vector(b(*inward))
    if n.dot(want) < 0:
        obj.data.flip_normals()

# ---------- 빛 ----------
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.86, 0.9, 1.0, 1)
bg.inputs[1].default_value = 0.45

sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = 2.2
sun_data.angle = math.radians(12)
sun_data.color = (1.0, 0.95, 0.86)
sun = bpy.data.objects.new("sun", sun_data)
scene.collection.objects.link(sun)
# 앞 왼쪽 위에서 뒤 오른쪽 아래로 비춘다(앱 좌표 방향)
sun.rotation_euler = Vector(b(0.42, -0.78, -0.46)).normalized().to_track_quat("-Z", "Y").to_euler()

area_data = bpy.data.lights.new("ceiling", "AREA")
area_data.shape = "RECTANGLE"
area_data.size = 6.0
area_data.size_y = 9.0
area_data.energy = 320
area_data.color = (1.0, 0.96, 0.9)
area = bpy.data.objects.new("ceiling", area_data)
area.location = b(W / 2, 5.6, D / 2)
scene.collection.objects.link(area)

# ---------- 굽기(조도만) ----------
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = True
    scene.cycles.device = "GPU"
except Exception as e:  # GPU가 없으면 CPU로
    print("GPU 설정 실패, CPU로 굽는다:", e)
scene.cycles.samples = SAMPLES
scene.render.bake.margin = 16

# 반사광 색을 위해 면마다 대략의 바탕색(선형)을 준다
ALBEDO = {
    "floor": (0.55, 0.32, 0.16),
    "wall_back": (0.86, 0.79, 0.66),
    "wall_left": (0.86, 0.79, 0.66),
    "wall_right": (0.86, 0.79, 0.66),
    "wall_trim": (0.55, 0.4, 0.24),
    "baseboard": (0.45, 0.22, 0.08),
    "step": (0.26, 0.11, 0.05),
    "slab": (0.26, 0.09, 0.03),
}
SIZE = {
    "floor": (512, 704),
    "wall_back": (512, 205),
    "wall_left": (704, 205),
    "wall_right": (704, 205),
    "wall_trim": (512, 512),
    "baseboard": (256, 256),
    "step": (128, 128),
    "slab": (256, 256),
}
TARGETS = [floor, wall_back, wall_left, wall_right, wall_trim, baseboard, step, slab]

for obj in TARGETS:
    mat = bpy.data.materials.new(obj.name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*ALBEDO[obj.name], 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    obj.data.materials.append(mat)
    if obj.data.uv_layers.get("UVMap") is None:
        obj.data.uv_layers.new(name="UVMap")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(island_margin=0.03)
        bpy.ops.object.mode_set(mode="OBJECT")
        obj.select_set(False)

irr = {}
for obj in TARGETS:
    w, h = SIZE[obj.name]
    img = bpy.data.images.new(obj.name + "_irr", w, h, float_buffer=True)
    mat = obj.data.materials[0]
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = img
    mat.node_tree.nodes.active = node
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=16, use_clear=True)
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    irr[obj.name] = px.reshape(h, w, 4)[:, :, :3].copy()
    mat.node_tree.nodes.remove(node)
    print("baked", obj.name, "mean", irr[obj.name].mean(axis=(0, 1)))


def blur(a, r=2):
    """조도의 잡티를 줄이는 상자 흐림(가장자리는 늘려 붙임)."""
    for axis in (0, 1):
        pad = [(0, 0)] * a.ndim
        pad[axis] = (r, r)
        p = np.pad(a, pad, mode="edge")
        c = np.cumsum(p, axis=axis)
        c = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
        n = a.shape[axis]
        a = (np.take(c, range(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, range(0, n), axis=axis)) / (2 * r + 1)
    return a


for k in irr:
    irr[k] = blur(blur(irr[k]))

# 바닥에서 밝은 쪽(80번째 백분위) 조도를 1로 맞춘 같은 배율을 모든 면에 쓴다
lum = irr["floor"].mean(axis=2)
SCALE = 1.0 / float(np.percentile(lum, 80))
print("scale", SCALE)


def srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def upsample(a, w, h):
    """조도 지도를 무늬 크기로 겹선형 확대."""
    sh, sw = a.shape[:2]
    ys = np.clip((np.arange(h) + 0.5) * sh / h - 0.5, 0, sh - 1)
    xs = np.clip((np.arange(w) + 0.5) * sw / w - 0.5, 0, sw - 1)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    y1 = np.minimum(y0 + 1, sh - 1)
    x1 = np.minimum(x0 + 1, sw - 1)
    fy = (ys - y0)[:, None, None]
    fx = (xs - x0)[None, :, None]
    top = a[y0][:, x0] * (1 - fx) + a[y0][:, x1] * fx
    bot = a[y1][:, x0] * (1 - fx) + a[y1][:, x1] * fx
    return top * (1 - fy) + bot * fy


# ---------- 무늬(앱의 floorTexture·wallpaperTexture와 같은 계산) ----------
def seeded(seed):
    v = [seed]

    def rand():
        v[0] = (v[0] * 16807) % 2147483647
        return v[0] / 2147483647

    return rand


def floor_pattern(width, height):
    """바닥 전체 무늬(되풀이 없음). 널빤지 폭 0.5칸 = 64픽셀, 길이 1.25~2.8칸."""
    size, row_px = width, 64
    base = np.array([0xDC, 0x9C, 0x62], dtype=np.float64)
    out = np.zeros((height, width, 3))
    rand = seeded(7)
    px = np.arange(size)
    for row in range(height // row_px):
        plank_of = np.zeros(size, dtype=int)
        nxt = math.floor(rand() * 160)
        plank = 0
        for x in range(size):
            if x == nxt:
                plank += 1
                nxt += 160 + math.floor(rand() * 200)
            plank_of[x] = plank
        seam = np.zeros(size, dtype=bool)
        for x in range(1, size):
            if plank_of[x] != plank_of[x - 1]:
                seam[max(0, x - 1) : min(size, x + 2)] = True
        tints = np.array([0.9 + rand() * 0.14 for _ in range(plank + 1)])
        phases = np.array([rand() * 100 for _ in range(plank + 1)])
        ph = phases[plank_of]
        for ry in range(row_px):
            edge = 0.74 if ry < 2 else (1.05 if ry == 2 else 1.0)
            grain = 1 + 0.02 * np.sin(ry * 0.3 + np.sin(px * 0.02 + ph) * 2.2 + ph) + 0.01 * np.sin(px * 0.13 + ph)
            k = np.where(seam, 0.78, 1.0) * edge * tints[plank_of] * grain
            out[row * row_px + ry] = np.minimum(255, np.round(base[None, :] * k[:, None]))
    return out  # 행 0 = v 0(앞쪽)


def wallpaper_tile():
    w, h = 128, 256
    base = np.array([0xF4, 0xE6, 0xCF], dtype=np.float64)
    x = np.arange(w)[None, :]
    y = np.arange(h)[:, None]
    stripe = np.where(x % 64 < 32, 1.0, 0.965)
    edge = np.where(x % 32 == 0, 0.95, 1.0)
    dx = (x % 32) - 16
    dy = (y % 32) - 16
    dot = np.where((stripe == 1.0) & (dx * dx + dy * dy < 7), 0.93, 1.0)
    k = stripe * edge * dot
    return np.round(base[None, None, :] * k[:, :, None])


def tile_to(tile, w, h, rep_x, rep_y):
    th, tw = tile.shape[:2]
    ys = (np.floor((np.arange(h) + 0.5) / h * rep_y * th).astype(int)) % th
    xs = (np.floor((np.arange(w) + 0.5) / w * rep_x * tw).astype(int)) % tw
    return tile[ys][:, xs]


FLOOR_PX = (int(W * PX_PER_UNIT), int(D * PX_PER_UNIT))
pattern = {
    "floor": floor_pattern(FLOOR_PX[0], FLOOR_PX[1]),
    "wall_back": tile_to(wallpaper_tile(), int(W * PX_PER_UNIT), 410, W, 1),
    "wall_left": tile_to(wallpaper_tile(), int(D * PX_PER_UNIT), 410, D, 1),
    "wall_right": tile_to(wallpaper_tile(), int(D * PX_PER_UNIT), 410, D, 1),
}
FLAT = {"wall_trim": (0xC4, 0xA4, 0x7C), "baseboard": (0xB5, 0x7A, 0x45), "step": (0x8A, 0x5A, 0x3B), "slab": (0x8A, 0x52, 0x30)}

for obj in TARGETS:
    name = obj.name
    if name in pattern:
        base_srgb = pattern[name]
        h, w = base_srgb.shape[:2]
        light = upsample(irr[name], w, h)
    else:
        light = irr[name]
        h, w = light.shape[:2]
        base_srgb = np.broadcast_to(np.array(FLAT[name], dtype=np.float64), (h, w, 3))
    final = lin_to_srgb(srgb_to_lin(base_srgb) * light * SCALE)
    rgba = np.concatenate([final, np.ones((h, w, 1))], axis=2).astype(np.float32)
    img = bpy.data.images.new(name + "_baked", w, h, alpha=False)
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = os.path.join(OUT, name + ".png")
    img.file_format = "PNG"
    img.save()
    # 내보낼 재질: 구운 그림 하나(앱은 빛을 받지 않는 재질로 바꿔 그린다)
    mat = obj.data.materials[0]
    nodes = mat.node_tree.nodes
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])

# ---------- 내보내기 ----------
for o in bpy.context.view_layer.objects:
    o.select_set(o in TARGETS)
glb = os.path.join(OUT, "room.glb")
kwargs = dict(filepath=glb, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_image_format="JPEG")
try:
    bpy.ops.export_scene.gltf(**kwargs, export_image_quality=90)
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs)
print("exported", glb, os.path.getsize(glb))
