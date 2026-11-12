# 라룹이 마을(방 밖)의 건물·소품을 Kenney Fantasy Town Kit(CC0)에서 골라 조립하고 한 glb로 묶는다.
# 쓰는 법: blender -b -P scripts/lobby3d/build-village.py -- <Kenney "Models/GLB format" 폴더> <출력 glb> [미리 보기 png]
#   (Blender 5.2에서 확인. 출력은 apps/mobile/assets/models/lobby-village.glb로 복사한다)
# 배치는 앱과 같은 apps/mobile/src/lib/lobby3d/village-layout.json을 읽는다(앱은 같은 파일로 막힌 칸·장소를 계산한다).
# 묶음 이름(앱이 찾는다):
#   bld-<건물 id>  건물 하나(벽·문·창·지붕). 라룹이를 가리면 앱이 반투명하게 한다
#   glow-<무엇>    밤에 켜지는 불빛 판(창, 가로등). 앱이 새벽·어스름·밤에만 보인다
#   props          분수·가로등·노점·벤치·바위
#   paths          돌길
#   hedges         뒤쪽·양옆 가장자리 생울타리(계절 색은 앱이 칠한다)
#   fences         앞쪽(카메라 쪽) 가장자리 나무 울타리
# 나무·풀밭처럼 계절 색이 바뀌는 것은 앱이 코드로 짓는다(창밖 풍경과 같은 색 규칙).
# 좌표: 앱 (x, y 위, z 앞) = Blender (x, -y, z). glTF 내보내기가 Blender Z 위를 Y 위로 바꾼다.
import json
import math
import os
import sys
import tempfile

import bpy
from mathutils import Matrix

args = sys.argv[sys.argv.index("--") + 1 :]
src, out = args[0], args[1]
preview = args[2] if len(args) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
LAYOUT_PATH = os.path.join(HERE, "..", "..", "apps", "mobile", "src", "lib", "lobby3d", "village-layout.json")
with open(LAYOUT_PATH, encoding="utf-8") as f:
    LAYOUT = json.load(f)
W, D = LAYOUT["width"], LAYOUT["depth"]

# Kenney 한 칸(벽 높이 1) = 앱 3칸. 문 높이가 라룹이(키 약 1.9)보다 넉넉하다
S = 3.0

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
_cache = {}

# ---------- 색 ----------
# Kenney 색 그림(512×512, 64px 칸)을 고쳐 쓴다: 회청색 회벽을 따뜻한 크림색으로 바꾸고, 빨간 지붕은 칸을 옮겨 쓴다.
palette = bpy.data.images.load(os.path.join(src, "Textures", "colormap.png"))
PW, PH = palette.size
CELL = 64 / PW  # 한 칸의 UV 폭


def recolor_cell(col, row, top, bottom):
    """색 그림의 칸(col, row: 위에서부터, 128px 높이 줄)을 위→아래 그라데이션 top→bottom(sRGB 0~1)으로 칠한다."""
    px = list(palette.pixels)
    y0 = PH - (256 + row * 128)  # Blender 그림은 아래부터 센다. 칸 줄은 위 128px(검정) 아래부터 128px씩이다
    for y in range(y0, y0 + 128):
        t = (y - y0) / 127  # 0 = 아래, 1 = 위
        c = [bottom[i] + (top[i] - bottom[i]) * t for i in range(3)]
        lin = [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c]
        for x in range(col * 64, col * 64 + 64):
            i = (y * PW + x) * 4
            px[i : i + 3] = lin
    palette.pixels = px


def srgb(h):
    return tuple(int(h[i : i + 2], 16) / 255 for i in (1, 3, 5))


# 회벽(둘째 줄 둘째 칸, 회청색): 크림색. 벽 아래 띠·지붕 밑(둘째 줄 첫째 칸, 짙은 회청): 따뜻한 짙은 갈색
recolor_cell(1, 1, srgb("#FBF0DC"), srgb("#E3CFAE"))
recolor_cell(0, 1, srgb("#7A6050"), srgb("#5A463A"))
# 고친 그림을 파일로 저장해 다시 읽고 glb에 넣는다(고친 픽셀이 내보내기에 그대로 들어가게)
PALETTE_OUT = os.path.join(tempfile.gettempdir(), "writeloop-village-colormap.png")  # 저장소 밖 임시 파일
palette.filepath_raw = PALETTE_OUT
palette.file_format = "PNG"
palette.save()
palette = bpy.data.images.load(PALETTE_OUT, check_existing=False)
palette.name = "village-colormap"
palette.pack()


def load_piece(name):
    """Kenney glb 하나를 불러와 메시 하나로 합친 원본을 돌려준다(장면에서 숨긴다). 같은 부품은 한 번만 불러온다."""
    if name in _cache:
        return _cache[name]
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, name + ".glb"))
    new = [o for o in scene.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    if len(meshes) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
    base = meshes[0]
    base.name = "src-" + name
    # 색 그림을 고친 그림으로 바꾼다(물 재질은 그대로)
    for m in base.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE":
                    n.image = palette
    scene.collection.objects.unlink(base)
    _cache[name] = base
    return base


def place(name, parent, x, z, rot=0.0, scale=S, y=0.0, uv_shift=None):
    """부품 하나를 앱 좌표 (x, z)에 놓는다. rot는 위에서 본 회전(도. 0이면 부품의 +x가 앱 +x, -90이면 앱 앞).
    uv_shift가 있으면 그 칸(UV 범위)의 색을 옆 칸으로 옮긴 복사본을 쓴다(빨간 지붕)."""
    base = load_piece(name)
    o = base.copy()
    o.data = base.data.copy()
    if uv_shift:
        (u0, u1), du = uv_shift
        uv = o.data.uv_layers.active.data
        for loop in uv:
            if u0 <= loop.uv[0] < u1:
                loop.uv[0] += du
    scene.collection.objects.link(o)
    o.location = (x, -z, y)
    o.rotation_mode = "XYZ"  # glTF로 불러온 부품은 쿼터니언 회전이라 바꿔 둔다
    o.rotation_euler = (0, 0, math.radians(rot))
    o.scale = (scale, scale, scale) if not isinstance(scale, tuple) else scale
    o.parent = parent
    return o


def group(name):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    return e


def glow_mat(name, color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Strength"].default_value = 1.0
    return m


GLOW = glow_mat("glow", (1.0, 0.78, 0.42))


def glow_quad(parent, name, cx, cy, cz, w, h, facing):
    """밤에 켜지는 불빛 판(세로 직사각형). facing은 판이 보는 앱 방향."""
    hw, hh = w / 2, h / 2
    if facing == "front":
        verts = [(cx - hw, -cz, cy - hh), (cx + hw, -cz, cy - hh), (cx + hw, -cz, cy + hh), (cx - hw, -cz, cy + hh)]
    elif facing == "left":
        verts = [(cx, -(cz + hw), cy - hh), (cx, -(cz - hw), cy - hh), (cx, -(cz - hw), cy + hh), (cx, -(cz + hw), cy + hh)]
    else:  # right
        verts = [(cx, -(cz - hw), cy - hh), (cx, -(cz + hw), cy - hh), (cx, -(cz + hw), cy + hh), (cx, -(cz - hw), cy + hh)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], [(0, 1, 2, 3)])
    me.materials.append(GLOW)
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.parent = parent
    return o


# 앱 방향별 회전: 벽 부품의 벽은 부품 +x 가장자리에 있다. 앱 앞(+z) = Blender -y.
FACE_ROT = {"right": 0.0, "front": -90.0, "left": 180.0, "back": 90.0}
WALLS = {
    "plaster": {"plain": "wall", "door": "wall-door", "window": "wall-window-shutters"},
    "wood": {"plain": "wall-wood", "door": "wall-wood-door", "window": "wall-wood-window-shutters"},
}
# 지붕 색: 지붕 부품은 셋째 줄 둘째 칸(청록)을 쓴다. 빨강은 그 왼쪽 칸이다
ROOF_UV = {"green": None, "red": ((CELL * 1, CELL * 2), -CELL)}
# 창 불빛 판: 벽 부품(크기 1) 안에서 창 가운데 높이와 크기(Kenney 단위)
WINDOW_GLOW = {"y": 0.5, "w": 0.34, "h": 0.36}
glows = group("glow-windows")


def build_house(b):
    x0, z0, x1, z1 = b["rect"]
    nx, nz = round((x1 - x0) / S), round((z1 - z0) / S)
    root = group("bld-" + b["id"])
    walls = WALLS[b["wall"]]
    floors = b["floors"]
    door_i = min(range(nx), key=lambda i: abs(x0 + S / 2 + S * i - b["door"]))
    front_z = z0 + S / 2 + S * (nz - 1)
    for f in range(floors):
        y = f * S
        for i in range(nx):
            cx = x0 + S / 2 + S * i
            is_door = f == 0 and i == door_i
            place(walls["door"] if is_door else walls["window"], root, cx, front_z, FACE_ROT["front"], y=y)
            if not is_door:
                glow_quad(glows, f"glow-win-{b['id']}", cx, y + WINDOW_GLOW["y"] * S, z1 - 0.06 * S, WINDOW_GLOW["w"] * S, WINDOW_GLOW["h"] * S, "front")
            place(walls["plain"], root, cx, z0 + S / 2, FACE_ROT["back"], y=y)
        for j in range(nz):
            cz = z0 + S / 2 + S * j
            side = walls["window"] if (j + f) % 2 == 0 else walls["plain"]
            place(side, root, x0 + S / 2, cz, FACE_ROT["left"], y=y)
            place(side, root, x0 + S / 2 + S * (nx - 1), cz, FACE_ROT["right"], y=y)
    # 지붕: 앞줄은 앞으로, 뒷줄은 뒤로 기우는 박공(용마루가 x 방향). 한 줄짜리는 박공 부품
    ry = floors * S
    uv = ROOF_UV[b["roof"]]
    for i in range(nx):
        cx = x0 + S / 2 + S * i
        if nz == 1:
            # 한 줄짜리: 박공 부품의 용마루를 x 방향으로 이어 붙인다
            place("roof-gable", root, cx, front_z, FACE_ROT["right"], y=ry, uv_shift=uv)
        else:
            place("roof", root, cx, front_z, FACE_ROT["back"], y=ry, uv_shift=uv)
            place("roof", root, cx, z0 + S / 2, FACE_ROT["front"], y=ry, uv_shift=uv)
            for j in range(1, nz - 1):
                place("roof-flat", root, cx, z0 + S / 2 + S * j, 0, y=ry, uv_shift=uv)
    return root


for b in LAYOUT["buildings"]:
    build_house(b)

# ---------- 소품 ----------
props = group("props")
fx = LAYOUT["fountain"]
place("fountain-round-detail", props, fx["x"], fx["z"], 0, scale=fx["radius"])
LANTERN_SCALE = 1.6
for i, (x, z) in enumerate(LAYOUT["lanterns"]):
    place("lantern", props, x, z, 0, scale=LANTERN_SCALE)
    # 등 불빛: 등갓 안의 작은 판 두 장(앞·옆)
    lamp = group(f"glow-lamp-{i}")
    glow_quad(lamp, f"glow-lamp-{i}-a", x, 1.32 * LANTERN_SCALE, z + 0.001, 0.12 * LANTERN_SCALE, 0.16 * LANTERN_SCALE, "front")
for s in LAYOUT["stalls"]:
    place("stall-red" if s["color"] == "red" else "stall-green", props, s["x"], s["z"], -90, scale=2.0)
for bch in LAYOUT["benches"]:
    place("stall-bench", props, bch["x"], bch["z"], bch["rot"], scale=2.4)
for x, z in LAYOUT["rocks"]:
    place("rock-large", props, x, z, 30, scale=1.2)

# ---------- 길 ----------
paths = group("paths")
for x0, z0, x1, z1 in LAYOUT["paths"]:
    for x in range(int(x0), int(x1)):
        for z in range(int(z0), int(z1)):
            place("road", paths, x + 0.5, z + 0.5, 0, scale=(1.0, 1.0, 1.0), y=0.005)

# ---------- 가장자리 생울타리 ----------
hedges = group("hedges")
for x in range(W):
    place("hedge-large", hedges, x + 0.5, 0.5, FACE_ROT["back"], scale=(1.0, 1.0, 1.6))
for z in range(1, D - 1):
    place("hedge-large", hedges, 0.5, z + 0.5, FACE_ROT["left"], scale=(1.0, 1.0, 1.6))
    place("hedge-large", hedges, W - 0.5, z + 0.5, FACE_ROT["right"], scale=(1.0, 1.0, 1.6))

# ---------- 앞쪽 가장자리 울타리 ----------
# 카메라 쪽은 키가 낮은 나무 울타리로 둘러 마을 안이 가리지 않게 한다(Kenney 한 칸 = 앱 1칸 너비로 이어 붙인다)
fences = group("fences")
for x in range(W):
    place("fence", fences, x + 0.5, D - 0.5, FACE_ROT["front"], scale=(1.0, 1.0, 2.0))

# ---------- 묶음마다 메시 하나로 합친다(그리기 횟수를 줄인다) ----------
bpy.context.view_layer.update()


def join_children(root):
    kids = [o for o in root.children if o.type == "MESH"]
    if not kids:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for o in kids:
        o.select_set(True)
    bpy.context.view_layer.objects.active = kids[0]
    # 부모 변환을 메시에 적용한 뒤 합친다
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    merged = bpy.context.view_layer.objects.active
    merged.name = root.name + "-mesh"
    merged.parent = root


for root in [o for o in scene.objects if o.type == "EMPTY"]:
    join_children(root)

# ---------- 구석 어둠 ----------
AO_DISTANCE = 1.2
AO_STRENGTH = 0.5
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.device = "CPU"
if scene.world is None:
    scene.world = bpy.data.worlds.new("world")
scene.world.light_settings.distance = AO_DISTANCE
# 바닥이 있어야 벽 아래가 어두워진다(굽고 나서 지운다)
gm = bpy.data.meshes.new("bake-ground")
gm.from_pydata([(-20, 20, 0), (W + 20, 20, 0), (W + 20, -D - 20, 0), (-20, -D - 20, 0)], [], [(0, 1, 2, 3)])
ground = bpy.data.objects.new("bake-ground", gm)
scene.collection.objects.link(ground)
meshes = [o for o in scene.objects if o.type == "MESH" and o.parent and not o.parent.name.startswith("glow")]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    attr = o.data.color_attributes.new("ao", "BYTE_COLOR", "CORNER")
    o.data.color_attributes.active_color = attr
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
for o in meshes:
    for c in o.data.color_attributes["ao"].data:
        v = 1 - AO_STRENGTH * (1 - c.color[0])
        c.color = (v, v, v, 1)
bpy.data.objects.remove(ground, do_unlink=True)

# ---------- 미리 보기 ----------
if preview:
    g = bpy.data.meshes.new("ground")
    g.from_pydata([(0, 0, 0), (W, 0, 0), (W, -D, 0), (0, -D, 0)], [], [(0, 1, 2, 3)])
    go = bpy.data.objects.new("preview-ground", g)
    scene.collection.objects.link(go)
    gmat = bpy.data.materials.new("grass")
    gmat.diffuse_color = (0.42, 0.66, 0.32, 1)
    go.data.materials.append(gmat)
    cam = bpy.data.cameras.new("cam")
    cam.lens_unit = "FOV"
    cam.angle_y = math.radians(30)
    c = bpy.data.objects.new("cam", cam)
    scene.collection.objects.link(c)
    pitch = math.radians(42)
    dist = 52
    tx, tz = W / 2, D / 2
    c.location = (tx, -(tz + dist * math.cos(pitch)), dist * math.sin(pitch))
    c.rotation_euler = (math.radians(90) - pitch, 0, 0)
    scene.camera = c
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(go, do_unlink=True)
    bpy.data.objects.remove(c, do_unlink=True)
    print("preview", preview)

# ---------- 내보내기 ----------
bpy.ops.object.select_all(action="DESELECT")
for o in scene.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_vertex_color="ACTIVE")
print("groups", sorted(o.name for o in scene.objects if o.type == "EMPTY"), "bytes", os.path.getsize(out))
