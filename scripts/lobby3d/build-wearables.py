# 라룹이 착용 모델(모자·상의·하의·신발·선글라스·백팩·머플러·목걸이)을 만들어 한 glb로 묶는다(캐릭터 꾸미기 ①·⑤).
# 쓰는 법: blender -b -P scripts/lobby3d/build-wearables.py -- <라룹이 glb> <야구모자 glb> <출력 glb> [미리 보기 png(앞·뒤 두 장)]
#   (Blender 5.2에서 확인. 라룹이 glb는 apps/mobile/assets/models/writeloop.glb, 출력은 apps/mobile/assets/models/lobby-wearables.glb)
# 모두 라룹이 모델과 같은 좌표(쉬는 자세)로 내보낸다. 앱이 라룹이 모델 아래에 두고
#   wear-hat·wear-hat-blue·wear-hat-green·wear-sunglasses(머리 뼈), wear-backpack·wear-muffler·wear-necklace(몸통 뼈),
#   wear-shoe-l(왼발 뼈. 신발은 한 짝만 넣고 앱이 좌우로 뒤집어 오른발에도 붙인다)은 그 뼈에 붙이고(자리는 그대로),
#   wear-top·wear-bottom(뼈대로 휘는 껍질)은 라룹이 뼈대에 뼈 이름으로 다시 묶는다.
# 상의·하의는 라룹이 몸에서 그 부위(뼈 무게가 가장 큰 뼈로 가름)를 떠서 법선 쪽으로 살짝 부풀린다. 그래서 몸에 꼭 맞고 같은 뼈대로 움직인다.
# 상의·하의·신발의 색만 다른 아이템은 앱이 재질 색을 바꿔 그린다. 모자는 무늬 그림이 있어 주황 부분의 색을 바꾼 사본을 따로 넣는다.
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

# ---------- 모자 색 바꾸기(무늬 그림의 주황 부분만) ----------
import colorsys

import numpy as np


def recolor_hat(name, hue_deg):
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
                idx = np.nonzero(orange)[0]
                for k in idx:
                    h, l, s_ = colorsys.rgb_to_hls(px[k, 0], px[k, 1], px[k, 2])
                    nr, ng, nb = colorsys.hls_to_rgb(hue_deg / 360.0, l, s_)
                    px[k, 0], px[k, 1], px[k, 2] = nr, ng, nb
                img.pixels[:] = px.ravel()
                img.pack()
                n.image = img
    return o


recolor_hat("wear-hat-blue", 212)
recolor_hat("wear-hat-green", 128)

# ---------- 새 모델: 선글라스·백팩·머플러·목걸이 ----------
s_lo, s_hi = region_bounds({"spine"})
head_w = h_hi.x - h_lo.x
head_h = h_hi.z - h_lo.z
head_cx = (h_lo.x + h_hi.x) / 2
body_w = s_hi.x - s_lo.x
body_d = s_hi.y - s_lo.y


def front_y_at(x, z, names=("head",), band=0.03):
    """그 높이·가로 자리 근처의 몸 앞면(가장 작은 y)."""
    ys = [
        (body.matrix_world @ v.co).y
        for v, d in zip(body.data.vertices, dom)
        if d in names and abs((body.matrix_world @ v.co).x - x) < band and abs((body.matrix_world @ v.co).z - z) < band
    ]
    return min(ys) if ys else h_lo.y


def section_at(z, names=("spine",), band=0.02):
    """그 높이 근처 몸(names 뼈 부위)의 가운데와 가로·앞뒤 반지름."""
    pts = [body.matrix_world @ v.co for v, d in zip(body.data.vertices, dom) if d in names]
    pts = [p_ for p_ in pts if abs(p_.z - z) < band]
    xs = [p_.x for p_ in pts]
    ys = [p_.y for p_ in pts]
    return Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, z)), (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2


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


def rounded_box(size, center, bevel, mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new("bev", "BEVEL")
    m.width = bevel
    m.segments = 3
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
    o = bpy.context.active_object
    return finish(o, mat)


def ring(center, rx, ry, radius, mat, tilt=0.0, segments=40):
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
    o = bpy.context.active_object
    return finish(o, mat)


# 선글라스: 검은 테와 알 둘, 코받침 다리. 눈 높이(머리 높이의 약 0.42)에 얼굴 앞면을 따라 얹는다
glass_mat = solid_material("wear-sunglasses-lens", "#1E1E24")
frame_mat = solid_material("wear-sunglasses-frame", "#101014")
eye_z = h_lo.z + head_h * 0.47
eye_dx = head_w * 0.17
lens_w, lens_h = head_w * 0.25, head_h * 0.2
parts = []
for side in (-1, 1):
    x = head_cx + side * eye_dx
    fy = front_y_at(x, eye_z)
    # 얼굴이 둥글어 알 가운데 앞면보다 알 너비의 0.25만큼 앞에 둔다(코 쪽 가장자리가 얼굴에 묻히지 않게)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=lens_w / 2, depth=lens_h * 0.12, location=(x, fy - lens_w * 0.25, eye_z))
    lens = finish(bpy.context.active_object, glass_mat)
    lens.scale = (1, 1, lens_h / lens_w)
    bev = lens.modifiers.new("bev", "BEVEL")
    bev.width = lens_h * 0.04
    bev.segments = 2
    bpy.context.view_layer.objects.active = lens
    bpy.ops.object.modifier_apply(modifier="bev")
    # 원기둥 축(z)을 앞(−y)으로 눕히고, 얼굴 곡면을 따라 바깥쪽 알을 조금 뒤로 돌린다
    lens.rotation_euler = (math.radians(90), 0, side * math.radians(-12))
    bpy.context.view_layer.objects.active = lens
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    parts.append(lens)
    # 귀 쪽으로 가는 다리
    parts.append(tube([Vector((x + side * lens_w * 0.5, fy - lens_h * 0.1, eye_z + lens_h * 0.3)),
                       Vector((head_cx + side * head_w * 0.47, front_y_at(head_cx + side * head_w * 0.45, eye_z) + head_h * 0.08, eye_z + lens_h * 0.35))],
                      lens_h * 0.05, frame_mat))
fy_mid = front_y_at(head_cx, eye_z) - lens_w * 0.15
parts.append(tube([Vector((head_cx - eye_dx + lens_w * 0.45, fy_mid - lens_h * 0.12, eye_z + lens_h * 0.3)),
                   Vector((head_cx, fy_mid - lens_h * 0.2, eye_z + lens_h * 0.36)),
                   Vector((head_cx + eye_dx - lens_w * 0.45, fy_mid - lens_h * 0.12, eye_z + lens_h * 0.3))], lens_h * 0.06, frame_mat))
join(parts, "wear-sunglasses")

# 목 높이: 턱(머리 부위 가장 아래) 바로 아래. 그 높이 몸통 단면을 따라 두른다(머리가 커서 더 위는 가려진다)
neck_z = h_lo.z - (s_hi.z - s_lo.z) * 0.05
neck_c, neck_rx, neck_ry = section_at(neck_z)
chest_z = neck_z - (s_hi.z - s_lo.z) * 0.2
chest_front = front_y_at(neck_c.x, chest_z, names=("spine",), band=0.04)

# 머플러: 목에 두른 두툼한 고리와 앞으로 늘어진 끝
muffler_mat = solid_material("wear-muffler", "#D23C3C")
m_ring = ring(neck_c, neck_rx + body_w * 0.06, neck_ry + body_w * 0.06, body_w * 0.085, muffler_mat)
m_tail = rounded_box((body_w * 0.17, body_w * 0.07, body_w * 0.36),
                     (neck_c.x - body_w * 0.15, chest_front - body_w * 0.06, neck_z - body_w * 0.2), body_w * 0.04, muffler_mat)
m_tail.rotation_euler = (math.radians(-8), 0, math.radians(6))
bpy.context.view_layer.objects.active = m_tail
bpy.ops.object.transform_apply(rotation=True)
join([m_ring, m_tail], "wear-muffler")

# 목걸이: 목에 건 가는 금줄(앞이 처지게)과 가슴 앞 펜던트
gold_mat = solid_material("wear-necklace", "#E0B33C")
n_ring = ring(neck_c, neck_rx + body_w * 0.035, neck_ry + body_w * 0.035, body_w * 0.018, gold_mat, tilt=body_w * 0.1)
bpy.ops.mesh.primitive_uv_sphere_add(radius=body_w * 0.07, location=(neck_c.x, chest_front - body_w * 0.06, chest_z))
pend = finish(bpy.context.active_object, gold_mat)
pend.scale = (1, 0.55, 1.15)
join([n_ring, pend], "wear-necklace")

# 백팩: 등 뒤의 둥근 가방과 덮개, 어깨에 걸친 멜빵 둘
pack_mat = solid_material("wear-backpack", "#C8443A")
flap_mat = solid_material("wear-backpack-flap", "#A8332C")
strap_mat = solid_material("wear-backpack-strap", "#6E2A24")
# 라룹이는 말린 꼬리가 등 대부분을 덮어서, 가방은 꼬리 바깥(뒤)에 메고 멜빵은 꼬리를 피해 양옆으로 지난다
t_lo, t_hi = region_bounds({"tail_1", "tail_2", "tail_3"})
pack_w = body_w * 0.66
pack_d = body_d * 0.32
pack_h = (t_hi.z - t_lo.z) * 0.78
pack_c = Vector((neck_c.x, t_hi.y + pack_d * 0.5 + 0.01, t_lo.z + (t_hi.z - t_lo.z) * 0.55))
bag = rounded_box((pack_w, pack_d, pack_h), pack_c, pack_w * 0.18, pack_mat)
flap = rounded_box((pack_w * 0.92, pack_d * 0.3, pack_h * 0.3), (pack_c.x, pack_c.y + pack_d * 0.42, pack_c.z + pack_h * 0.12), pack_w * 0.1, flap_mat)
straps = []
for side in (-1, 1):
    x = neck_c.x + side * body_w * 0.33
    straps.append(tube([Vector((x, pack_c.y - pack_d * 0.4, pack_c.z + pack_h * 0.4)),
                        Vector((x, t_hi.y - (t_hi.y - neck_c.y) * 0.5, neck_z + body_w * 0.02)),
                        Vector((x, neck_c.y + neck_ry * 0.2, neck_z + body_w * 0.04)),
                        Vector((x, chest_front - body_w * 0.03, chest_z)),
                        Vector((x + side * body_w * 0.05, chest_front - body_w * 0.01, chest_z - pack_h * 0.45))], body_w * 0.035, strap_mat))
join([bag, flap, *straps], "wear-backpack")

# ---------- 미리 보기 ----------
if preview:
    body.hide_render = False
    for name in ("wear-hat-blue", "wear-hat-green", "wear-necklace"):
        scene.objects[name].hide_render = True
    cam = bpy.data.cameras.new("cam")
    c = bpy.data.objects.new("cam", cam)
    scene.collection.objects.link(c)
    scene.camera = c
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 700
    scene.render.resolution_y = 900
    base, ext = os.path.splitext(preview)
    for suffix, loc, rot in (("-front", (1.0, -2.6, 1.1), (75, 0, 21)), ("-back", (-1.0, 2.6, 1.1), (75, 0, 201))):
        c.location = loc
        c.rotation_euler = tuple(math.radians(a) for a in rot)
        scene.render.filepath = base + suffix + ext
        bpy.ops.render.render(write_still=True)
    # 목걸이만(머플러·백팩 숨김) 앞에서 가까이
    scene.objects["wear-muffler"].hide_render = True
    scene.objects["wear-backpack"].hide_render = True
    scene.objects["wear-necklace"].hide_render = False
    c.location = (0.5, -1.6, 0.75)
    c.rotation_euler = (math.radians(82), 0, math.radians(17))
    scene.render.filepath = base + "-necklace" + ext
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(c, do_unlink=True)

# ---------- 내보내기: 라룹이 몸은 빼고 뼈대와 착용 아이템만 ----------
bpy.data.objects.remove(body, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
for o in scene.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_apply=False, export_animations=False, export_skins=True)
print("wearables", sorted(o.name for o in scene.objects), "bytes", os.path.getsize(out))
