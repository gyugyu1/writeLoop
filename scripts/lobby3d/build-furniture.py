# 라룹이 방의 가구를 Kenney Furniture Kit(CC0)에서 골라 한 glb로 묶는다.
# 쓰는 법: blender -b -P scripts/lobby3d/build-furniture.py -- <Kenney "Models/GLTF format" 폴더> <출력 glb>
#   (Blender 5.2에서 확인. 출력은 apps/mobile/assets/models/lobby-furniture.glb로 복사한다)
# 가구마다 이름 붙은 묶음 하나로 내보낸다. 모서리를 둥글리고, 구석 어둠을 꼭짓점 색으로 굽는다(테두리 없이 명암으로 모양이 보이게). 묶음의 기준점은 바닥 가운데(벽에 거는 창문·게시판은 가운데)이고,
# 앞면은 방 앞쪽(앱 +z)을 본다. 어디에 놓을지는 앱(lobby3d-furniture.tsx의 FURNITURE_LAYOUT)이 정한다.
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

src, out = sys.argv[sys.argv.index("--") + 1 :][:2]
# 가구는 라이트루프(키 약 1.9)보다 조금 크게 키운다(옷장 약 2.4, 문 약 2.8. 방 벽 높이는 3.2). 창문은 따로 정한 크기다.
SCALE = 2.8
WINDOW_SCALE = 2.5

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def import_piece(name):
    """Kenney glb 하나를 불러와 메시만 남기고 변환을 적용한 메시 목록을 돌려준다."""
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
    return meshes


def bounds(meshes):
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in meshes:
        for v in o.data.vertices:
            lo = Vector(map(min, lo, v.co))
            hi = Vector(map(max, hi, v.co))
    return lo, hi


def finish(piece, meshes, wall_mounted=False, scale=SCALE, depth=1.0):
    """기준점을 바닥 가운데(벽에 거는 것은 가운데)로 옮기고 키운 뒤 이름 붙은 묶음 아래에 둔다. depth는 앞뒤(벽에서 나온 깊이)만 더 키우는 배율."""
    lo, hi = bounds(meshes)
    center = (lo + hi) / 2
    pivot = Vector((center.x, center.y, center.z if wall_mounted else lo.z))
    # Kenney 안쪽 이름과 묶음 이름이 겹치지 않게(묶음 이름에 .001이 붙지 않게) 메시 이름부터 바꾼다
    for o in meshes:
        o.name = f"{piece}_{o.name}"
    root = bpy.data.objects.new(piece, None)
    scene.collection.objects.link(root)
    for o in meshes:
        o.data.transform(Matrix.Translation(-pivot))
        o.data.transform(Matrix.Scale(scale, 4))
        o.data.transform(Matrix.Scale(depth, 4, Vector((0, 1, 0))))
        o.parent = root
    return root


def delete_faces(obj, keep):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    gone = [f for f in bm.faces if not keep(f)]
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()


def material(name, color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    return m


def box(name, size, center, mat):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def rotate_z(meshes, deg):
    for o in meshes:
        o.data.transform(Matrix.Rotation(math.radians(deg), 4, "Z"))


# ---------- Kenney 가구 ----------
# 일기 책상은 다른 가구보다 1.2배 크게, 옷장·책장은 벽에서 나온 깊이만 1.25배로 한다(두툼하게). 탁상 스탠드는 책상 위에 올린다
for piece, name, scale, depth in [
    ("desk", "desk", SCALE * 1.2, 1.0),
    ("chair", "chair", SCALE, 1.0),
    ("wardrobe", "bookcaseClosedDoors", SCALE, 1.25),
    ("rug", "rugRound", SCALE, 1.0),
    ("tableLamp", "lampRoundTable", SCALE, 1.0),
    ("bed", "bedSingle", SCALE, 1.0),
    ("nightstand", "cabinetBedDrawerTable", SCALE, 1.0),
    ("floorLamp", "lampRoundFloor", SCALE, 1.0),
    ("plant", "pottedPlant", SCALE, 1.0),
    ("smallPlant", "plantSmall1", SCALE, 1.0),
    ("booksStack", "books", SCALE, 1.0),
]:
    finish(piece, import_piece(name), scale=scale, depth=depth)

# 책장: 선반마다 책을 몇 권 둔다(Kenney 단위로 놓은 뒤 함께 키운다)
shelf = import_piece("bookcaseOpen")
lo, hi = bounds(shelf)
books = []
for i, (fx, fz) in enumerate([(0.12, 0.3), (0.55, 0.3), (0.3, 0.52), (0.62, 0.74)]):
    b = import_piece("books")
    blo, bhi = bounds(b)
    for o in b:
        o.data.transform(Matrix.Translation(Vector((lo.x + (hi.x - lo.x) * fx - blo.x, lo.y + 0.03 - blo.y, lo.z + (hi.z - lo.z) * fz - blo.z))))
    books += b
finish("bookcase", shelf + books, depth=1.25)

# 창문: wallWindowSlide의 미닫이 두 짝(창살과 유리)을 두 벌 나란히 놓아 가로를 두 배로 넓힌다(가운데 창살로 잇는다).
# 벽 조각이 붙은 바깥 창틀 대신 같은 나무색으로 반듯한 창틀과 창턱을 만든다. 유리는 앱이 반투명으로 바꾼다. 크기는 Kenney 단위로 적는다.
sky = material("glass_sky", (0.62, 0.8, 0.9))
sashes = []
for shift in (-0.2, 0.2):
    for o in import_piece("wallWindowSlide"):
        if "windowBottom" in o.name or "windowTop" in o.name:
            for i, s in enumerate(o.material_slots):
                if s.material and s.material.name.startswith("glass"):
                    o.material_slots[i].material = sky
            o.data.transform(Matrix.Translation(Vector((shift, 0, 0))))
            sashes.append(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
wood = bpy.data.materials.get("wood") or material("wood", (0.896, 0.602, 0.393))
x0, x1, z0, z1, t = 0.10, 0.90, 0.38, 1.07, 0.03
frame = [
    box("win_top", (x1 - x0 + 2 * t, 0.09, t), ((x0 + x1) / 2, 0.025, z1 + t / 2), wood),
    box("win_left", (t, 0.09, z1 - z0), (x0 - t / 2, 0.025, (z0 + z1) / 2), wood),
    box("win_right", (t, 0.09, z1 - z0), (x1 + t / 2, 0.025, (z0 + z1) / 2), wood),
    box("win_mid", (t, 0.09, z1 - z0), ((x0 + x1) / 2, 0.025, (z0 + z1) / 2), wood),
    box("win_sill", (x1 - x0 + 4 * t, 0.14, t), ((x0 + x1) / 2, 0.0, z0 - t / 2), wood),
]
finish("window", sashes + frame, wall_mounted=True, scale=WINDOW_SCALE)

# 창밖이 보이는 자리: 창 안쪽 크기(Kenney 0.748 × 0.664)의 판. 앱이 이 판에 창밖 입체 풍경(lobby3d-outdoor)을 그린다.
view_mat = material("window_view", (1, 1, 1))
view_mesh = bpy.data.meshes.new("windowView")
view_mesh.from_pydata([(-0.374, 0, -0.332), (0.374, 0, -0.332), (0.374, 0, 0.332), (-0.374, 0, 0.332)], [], [[0, 1, 2, 3]])
view_mesh.materials.append(view_mat)
view_obj = bpy.data.objects.new("windowView", view_mesh)
scene.collection.objects.link(view_obj)
finish("windowView", [view_obj], wall_mounted=True, scale=WINDOW_SCALE)

# 질문 게시판: Kenney 모양새(단색 면, 주황 나무 틀)로 만든다. Kenney 단위(벽 높이 1.29)로 만든 뒤 함께 키운다.
wood = bpy.data.materials.get("wood") or material("wood", (0.896, 0.602, 0.393))
cork = material("cork", (0.78, 0.55, 0.32))
paper = material("paper", (0.97, 0.97, 0.95))
note = material("note", (1.0, 0.92, 0.45))
pin = material("pin", (0.9, 0.3, 0.28))
W, H, Dp, F = 0.64, 0.5, 0.03, 0.035
parts = [
    box("frame_top", (W, Dp, F), (0, 0, H / 2 - F / 2), wood),
    box("frame_bottom", (W, Dp, F), (0, 0, -H / 2 + F / 2), wood),
    box("frame_left", (F, Dp, H), (-W / 2 + F / 2, 0, 0), wood),
    box("frame_right", (F, Dp, H), (W / 2 - F / 2, 0, 0), wood),
    box("cork", (W - 2 * F, Dp * 0.6, H - 2 * F), (0, 0.004, 0), cork),
]
n1 = box("note1", (0.16, 0.004, 0.15), (-0.12, -0.012, 0.0), paper)
n2 = box("note2", (0.18, 0.004, 0.16), (0.12, -0.012, -0.03), note)
n1.data.transform(Matrix.Translation(Vector((0.12, 0.012, 0))) @ Matrix.Rotation(math.radians(-6), 4, "Y") @ Matrix.Translation(Vector((-0.12, -0.012, 0))))
p1 = box("pin1", (0.025, 0.02, 0.025), (-0.12, -0.02, 0.06), pin)
p2 = box("pin2", (0.025, 0.02, 0.025), (0.12, -0.02, 0.035), pin)
finish("board", parts + [n1, n2, p1, p2], wall_mounted=True)

# 액자: 게시판과 같은 나무 틀 안에 하늘·언덕·해가 있는 단순한 그림. 가로 1칸·세로 0.8칸이 되게 Kenney 단위로 만든다.
sky_paint = material("paint_sky", (0.62, 0.82, 0.95))
hill_paint = material("paint_hill", (0.45, 0.72, 0.42))
far_hill = material("paint_far_hill", (0.62, 0.8, 0.55))
sun_paint = material("paint_sun", (1.0, 0.85, 0.35))
FW, FH, FD, FF = 1.0 / SCALE, 0.8 / SCALE, 0.03, 0.03
inner_w, inner_h = FW - 2 * FF, FH - 2 * FF
art = [
    box("pframe_top", (FW, FD, FF), (0, 0, FH / 2 - FF / 2), wood),
    box("pframe_bottom", (FW, FD, FF), (0, 0, -FH / 2 + FF / 2), wood),
    box("pframe_left", (FF, FD, FH), (-FW / 2 + FF / 2, 0, 0), wood),
    box("pframe_right", (FF, FD, FH), (FW / 2 - FF / 2, 0, 0), wood),
    box("paint_sky", (inner_w, FD * 0.5, inner_h), (0, 0.004, 0), sky_paint),
    box("paint_far_hill", (inner_w * 0.6, FD * 0.5, inner_h * 0.42), (inner_w * 0.18, -0.002, -inner_h * 0.29), far_hill),
    box("paint_hill", (inner_w, FD * 0.5, inner_h * 0.3), (0, -0.006, -inner_h * 0.35), hill_paint),
    box("paint_sun", (0.035, FD * 0.5, 0.035), (-inner_w * 0.28, -0.004, inner_h * 0.22), sun_paint),
]
finish("frame", art, wall_mounted=True)

# ---------- 둥근 모서리 ----------
# 동물의 숲 가구처럼 모서리를 둥글린다. Kenney 모델은 면마다 꼭짓점이 갈라져 있어, 먼저 같은 자리 꼭짓점을 합친 뒤
# 각진 모서리(30도 넘게 꺾인 곳)만 둥글리고, 평평한 면은 평평하게 두고 둥근 곳만 부드럽게 칠해지게 법선을 정한다.
ROUND = 0.06  # 둥근 모서리 너비(칸). 얇은 판은 겹치지 않게 저절로 줄어든다.


def round_edges(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(obj.data)
    bm.free()
    mod = obj.modifiers.new("round", "BEVEL")
    mod.width = ROUND
    mod.segments = 2
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(30)
    mod.harden_normals = True
    mod.use_clamp_overlap = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="round")
    for poly in obj.data.polygons:
        poly.use_smooth = True


for o in list(scene.objects):
    if o.type == "MESH" and not o.name.startswith("windowView") and not o.name.startswith("rug"):
        round_edges(o)

# ---------- 구석 어둠 ----------
# 테두리 대신 명암으로 모양이 보이게, 가구마다 구석·틈(책장 칸 안, 책상 밑, 문틀 안쪽)이 어둡게 지는 정도를 꼭짓점 색으로 굽는다.
# 가구끼리 서로 가리지 않게 하나씩 떨어뜨려 놓고 굽는다. 너무 어둡지 않게 AO_STRENGTH만큼만 섞는다.
AO_DISTANCE = 0.5
AO_STRENGTH = 0.55
scene.render.engine = "CYCLES"
scene.cycles.samples = 128
scene.cycles.device = "CPU"
if scene.world is None:
    scene.world = bpy.data.worlds.new("world")
scene.world.light_settings.distance = AO_DISTANCE
roots = sorted((o for o in scene.objects if o.type == "EMPTY"), key=lambda o: o.name)
for i, r in enumerate(roots):
    r.location.x = i * 10
bpy.context.view_layer.update()
meshes = [o for o in scene.objects if o.type == "MESH" and not o.name.startswith("windowView")]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    attr = o.data.color_attributes.new("ao", "BYTE_COLOR", "CORNER")
    o.data.color_attributes.active_color = attr
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
for o in meshes:
    data = o.data.color_attributes["ao"].data
    for c in data:
        ao = c.color[0]
        v = 1 - AO_STRENGTH * (1 - ao)
        c.color = (v, v, v, 1)
for r in roots:
    r.location.x = 0
bpy.context.view_layer.update()

# ---------- 내보내기 ----------
roots = [o for o in scene.objects if o.type == "EMPTY"]
for o in scene.objects:
    o.select_set(True)
kwargs = dict(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_vertex_color="ACTIVE")
bpy.ops.export_scene.gltf(**kwargs)
print("pieces", sorted(r.name for r in roots), "bytes", os.path.getsize(out))
