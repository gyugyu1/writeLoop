# 라룹이 착용 시험 모델(모자·상의·하의·신발)을 만들어 한 glb로 묶는다(캐릭터 꾸미기 ① 기술 시험).
# 쓰는 법: blender -b -P scripts/lobby3d/build-wearables.py -- <라룹이 glb> <야구모자 glb> <출력 glb> [미리 보기 png]
#   (Blender 5.2에서 확인. 라룹이 glb는 apps/mobile/assets/models/writeloop.glb, 출력은 apps/mobile/assets/models/lobby-wearables.glb)
# 모두 라룹이 모델과 같은 좌표(쉬는 자세)로 내보낸다. 앱이 라룹이 모델 아래에 두고
#   wear-hat(머리 뼈), wear-shoe-l(왼발 뼈. 신발은 한 짝만 넣고 앱이 좌우로 뒤집어 오른발에도 붙인다)은 그 뼈에 붙이고(자리는 그대로),
#   wear-top·wear-bottom(뼈대로 휘는 껍질)은 라룹이 뼈대에 뼈 이름으로 다시 묶는다.
# 상의·하의는 라룹이 몸에서 그 부위(뼈 무게가 가장 큰 뼈로 가름)를 떠서 법선 쪽으로 살짝 부풀린다. 그래서 몸에 꼭 맞고 같은 뼈대로 움직인다.
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1 :]
char_path, cap_path, out = args[0], args[1], args[2]
preview = args[3] if len(args) > 3 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- 라룹이 ----------
bpy.ops.import_scene.gltf(filepath=char_path)
arm = next(o for o in scene.objects if o.type == "ARMATURE")
body = next(o for o in scene.objects if o.type == "MESH" and o.find_armature() == arm)
# 누르기 판정용 공 같은 다른 메시는 지운다
for o in list(scene.objects):
    if o.type == "MESH" and o is not body:
        bpy.data.objects.remove(o, do_unlink=True)

groups = {g.index: g.name for g in body.vertex_groups}


def dominant(v):
    best, w = None, 0.0
    for g in v.groups:
        if g.weight > w:
            best, w = groups.get(g.group), g.weight
    return best


dom = [dominant(v) for v in body.data.vertices]


def bone_head(name):
    return arm.matrix_world @ arm.data.bones[name].head_local


def region_bounds(names):
    pts = [body.matrix_world @ v.co for v, d in zip(body.data.vertices, dom) if d in names]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def solid_material(name, hex_color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    rgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in rgb]
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lin, 1)
    m.diffuse_color = (*lin, 1)  # 미리 보기(작업 화면 색)
    return m


def shell(name, keep, offset, color):
    """라룹이 몸에서 keep 뼈가 가장 큰 무게인 면만 남기고 법선 쪽으로 offset만큼 부풀린 껍질(뼈대 묶음 그대로)."""
    o = body.copy()
    o.data = body.data.copy()
    o.name = name
    scene.collection.objects.link(o)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    # 경계에 틈이 나지 않게, 꼭짓점 하나라도 keep 뼈인 면은 남긴다
    drop = [f for f in bm.faces if not any(dom[v.index] in keep for v in f.verts)]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.clear()
    o.data.materials.append(solid_material(name, color))
    # 외곽선용 속성(라룹이에만 있는 것)은 떼어 낸다(앱은 법선으로 부풀린다)
    for attr in list(o.data.attributes):
        if attr.name.startswith("_outline"):
            o.data.attributes.remove(attr)
    return o


# 상의: 몸통·팔(손은 뺀다). 하의: 엉덩이·다리(발·꼬리는 뺀다)
top = shell("wear-top", {"spine", "arm_l", "arm_r"}, 0.02, "#F0873A")
bottom = shell("wear-bottom", {"hips", "leg_l", "leg_r"}, 0.024, "#34507A")

# ---------- 모자 ----------
before = set(scene.objects)
bpy.ops.import_scene.gltf(filepath=cap_path)
cap_meshes = [o for o in scene.objects if o not in before and o.type == "MESH"]
for o in scene.objects:
    if o not in before and o.type != "MESH":
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
# 점 수를 줄이고 그림을 작게 한다(앱 크기)
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
# 챙 방향: 모자는 긴 쪽(y)으로 챙이 나와 있다. 챙은 가운데에서 먼 쪽의 얇은 부분이라, 꼭짓점 평균이 상자 가운데보다 치우친 반대쪽이 챙이다
vs = [v.co for v in hat.data.vertices]
lo = Vector((min(p.x for p in vs), min(p.y for p in vs), min(p.z for p in vs)))
hi = Vector((max(p.x for p in vs), max(p.y for p in vs), max(p.z for p in vs)))
mean_y = sum(p.y for p in vs) / len(vs)
visor_dir = -1 if mean_y > (lo.y + hi.y) / 2 else 1  # 챙이 −y(평균이 +y로 치우침)면 −1
# 라룹이 앞은 Blender −y(glTF +z). 챙을 −y로 맞춘다
if visor_dir == 1:
    hat.data.transform(Matrix.Rotation(math.pi, 4, "Z"))
# 크기·자리: 두 귀 사이(안쪽 가장자리 사이 폭)에 들어가게 줄이고, 귀 사이 머리 꼭대기에 얹는다(귀는 모자 양옆으로 나온다)
h_lo, h_hi = region_bounds({"head"})
ears = sorted([region_bounds({"ear_l"}), region_bounds({"ear_r"})], key=lambda b: (b[0].x + b[1].x) / 2)
ear_gap = ears[1][0].x - ears[0][1].x  # 왼쪽 귀의 안쪽(오른쪽 끝)과 오른쪽 귀의 안쪽(왼쪽 끝) 사이
ear_mid_x = (ears[1][0].x + ears[0][1].x) / 2
vs = [v.co for v in hat.data.vertices]
c_lo = Vector((min(p.x for p in vs), min(p.y for p in vs), min(p.z for p in vs)))
c_hi = Vector((max(p.x for p in vs), max(p.y for p in vs), max(p.z for p in vs)))
head_w = h_hi.x - h_lo.x
# 모자 가로 폭을 귀 사이 폭보다 조금 넓게(귀 안쪽에 살짝 닿는다)
s = ear_gap * 1.12 / (c_hi.x - c_lo.x)
hat.data.transform(Matrix.Scale(s, 4))
vs = [v.co for v in hat.data.vertices]
c_lo = Vector((min(p.x for p in vs), min(p.y for p in vs), min(p.z for p in vs)))
c_hi = Vector((max(p.x for p in vs), max(p.y for p in vs), max(p.z for p in vs)))
cap_h = c_hi.z - c_lo.z
# 모자 아랫단이 눈썹 위에 오게 머리 꼭대기에서 모자 높이의 0.3만큼만 내려 얹는다(조금 뒤로)
head_d = h_hi.y - h_lo.y
# 귀 사이 머리 꼭대기의 조금 앞(−y)에 얹고, 챙이 이마 위로 나오게 한다
target = Vector((ear_mid_x, (h_lo.y + h_hi.y) / 2 - head_d * 0.1, h_hi.z - cap_h * 0.18))
center = Vector(((c_lo.x + c_hi.x) / 2, (c_lo.y + c_hi.y) / 2, c_lo.z))
hat.data.transform(Matrix.Translation(target - center))

# ---------- 신발 ----------
shoe_mat = solid_material("wear-shoe", "#7A4A2A")


def make_shoe(name, foot):
    f_lo, f_hi = region_bounds({foot})
    size = (f_hi - f_lo) * 1.15
    size.z = max(size.z * 0.95, 0.04)
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size.x, size.y * 1.05, size.z)
    bpy.ops.object.transform_apply(scale=True)
    bev = o.modifiers.new("bev", "BEVEL")
    bev.width = min(size.x, size.z) * 0.45
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="bev")
    for p in o.data.polygons:
        p.use_smooth = True
    # 발끝(앞, −y) 쪽으로 조금 나오고, 바닥은 발바닥보다 조금 아래
    o.location = ((f_lo.x + f_hi.x) / 2, (f_lo.y + f_hi.y) / 2 - size.y * 0.06, f_lo.z + size.z / 2 - 0.004)
    bpy.ops.object.transform_apply(location=True)
    o.data.materials.append(shoe_mat)
    return o


# 신발은 한 짝(왼발)만 넣는다. 라룹이는 좌우가 같아(x = 0 기준) 앱이 뒤집어 오른발에 붙인다
make_shoe("wear-shoe-l", "foot_l")

# ---------- 미리 보기 ----------
if preview:
    body.hide_render = False
    cam = bpy.data.cameras.new("cam")
    c = bpy.data.objects.new("cam", cam)
    scene.collection.objects.link(c)
    c.location = (1.3, -2.3, 1.1)
    c.rotation_euler = (math.radians(75), 0, math.radians(29))
    scene.camera = c
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 700
    scene.render.resolution_y = 900
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(c, do_unlink=True)

# ---------- 내보내기: 라룹이 몸은 빼고 뼈대와 착용 아이템만 ----------
bpy.data.objects.remove(body, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
for o in scene.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_apply=False, export_animations=False, export_skins=True)
print("wearables", sorted(o.name for o in scene.objects), "bytes", os.path.getsize(out))
