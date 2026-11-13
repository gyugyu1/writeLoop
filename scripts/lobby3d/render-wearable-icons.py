# 옷장(캐릭터 꾸미기) 아이템 칸에 보이는 착용 아이템 그림을 착용 모델(lobby-wearables.glb)에서 찍는다.
# 쓰는 법: blender -b -P scripts/lobby3d/render-wearable-icons.py -- <라룹이 glb> <착용 모델 glb> <출력 폴더>
#   (Blender 5.2에서 확인. 출력은 apps/mobile/assets/icons/wearables/에 <아이템 종류>.png로 넣는다)
# 가구 아이콘(render-icons.py)과 같은 조명·투명 배경의 정사각 그림이다. 상의·하의는 몸을 따라 휘는 껍질이라 홀로 찍으면 가장자리가
# 거칠어서, 라룹이가 그 아이템만 입은 모습을 그 부위에 맞춰 찍는다. 신발은 한 짝뿐이라 좌우로 뒤집은 짝을 더해 두 발에 신긴다.
# 아이템을 더하면 PIECES에 (모델 안 이름, 아이템 종류, 보는 각도 …, 색)을 더하고 다시 돌린다(앱의 wearable-icons.ts에도 한 줄 더한다).
# 색만 다른 아이템(앱이 재질 색을 바꿔 그리는 것)은 마지막 칸에 앱 목록(wear.ts)과 같은 색을 적는다. 모자는 색을 바꾼 사본 모델이 따로 있다.
# 라룹이 고글(goggles)은 라룹이 모델에 그려진 것이라 착용 모델 없이 라룹이 얼굴만 찍고(자리는 선글라스 모델에 맞춘다),
# 다른 얼굴장식(선글라스)은 라룹이 고글을 끈 얼굴(모양 변형 noGoggles와 고글 없는 몸 그림)로 찍는다.
import math
import os
import sys

import bpy
from mathutils import Vector

body_src, src, out = (os.path.abspath(p) for p in sys.argv[sys.argv.index("--") + 1 :][:3])
SIZE = 256

# (모델 안 이름, 아이템 종류, 옆으로 돈 각도(도), 내려다보는 각도(도), 아이템 크기에 곱하는 화면 폭, 화면 가운데를 내리는 정도(아이템 크기 배), 색)
PIECES = [
    ("wear-hat", "capOrange", 30, 28, 2.4, 0.35, None),
    ("wear-top", "tshirtOrange", 25, 10, 1.25, 0.18, None),
    ("wear-bottom", "shortsNavy", 25, 12, 1.45, 0.0, None),
    ("wear-shoe-l", "shoesBrown", 30, 22, 1.7, -0.1, None),
    ("wear-hat-blue", "capBlue", 30, 28, 2.4, 0.35, None),
    ("wear-hat-green", "capGreen", 30, 28, 2.4, 0.35, None),
    ("wear-top", "tshirtWhite", 25, 10, 1.25, 0.18, "#F4F0E8"),
    ("wear-top", "tshirtYellow", 25, 10, 1.25, 0.18, "#F2C440"),
    ("wear-bottom", "shortsBrown", 25, 12, 1.45, 0.0, "#8A5A3B"),
    ("wear-bottom", "shortsRed", 25, 12, 1.45, 0.0, "#C8443A"),
    ("wear-shoe-l", "shoesRed", 30, 22, 1.7, -0.1, "#C8443A"),
    ("wear-shoe-l", "shoesWhite", 30, 22, 1.7, -0.1, "#DCD8CF"),
    ("wear-sunglasses", "goggles", 20, 8, 1.6, 0.0, None),
    ("wear-sunglasses", "sunglassesBlack", 20, 8, 1.6, 0.0, None),
    ("wear-backpack", "backpackRed", 165, 18, 1.15, 0.0, None),
    ("wear-muffler", "mufflerRed", 20, 18, 1.7, 0.0, None),
    ("wear-necklace", "necklaceGold", 15, 12, 1.8, 0.05, None),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=body_src)
body = next(o for o in scene.objects if o.type == "MESH" and o.name.startswith("writeloop_body"))
bpy.ops.import_scene.gltf(filepath=src)

meshes = {o.name: o for o in scene.objects if o.type == "MESH" and o.name.startswith("wear-")}
# 오른쪽 신발: 왼쪽 신발을 좌우(x)로 뒤집은 짝
from mathutils import Matrix

shoe_r = meshes["wear-shoe-l"].copy()
scene.collection.objects.link(shoe_r)
shoe_r.matrix_world = Matrix.Scale(-1, 4, (1, 0, 0)) @ meshes["wear-shoe-l"].matrix_world
companions = {"wear-shoe-l": [shoe_r]}

# 라룹이 고글 끄기(add-goggles-toggle.py가 더한 것). 없으면 늘 고글을 쓴 얼굴로 찍는다
BODY_ONLY = {"goggles"}
HIDES_GOGGLES = {"sunglassesBlack"}
nog_obj = next((o for o in scene.objects if o.name.startswith("writeloop_nogoggles")), None)
if nog_obj:
    nog_obj.hide_render = True
body_material = body.data.materials[0]
nog_material = nog_obj.data.materials[0] if nog_obj and nog_obj.data.materials else None
goggle_key = body.data.shape_keys.key_blocks.get("noGoggles") if body.data.shape_keys else None


def set_goggles(visible):
    if goggle_key is not None and nog_material is not None:
        goggle_key.value = 0.0 if visible else 1.0
        body.data.materials[0] = body_material if visible else nog_material

scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.device = "CPU"
scene.render.film_transparent = True
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"

world = bpy.data.worlds.new("icons")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.97, 0.92, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45

sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = 2.4
sun = bpy.data.objects.new("sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def world_bounds(o):
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for _ in [o]:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


os.makedirs(out, exist_ok=True)
def tint(objs, hex_color):
    """재질 색을 바꾸고, 되돌릴 원래 색을 돌려준다(None이면 바꾸지 않는다)."""
    saved = []
    if not hex_color:
        return saved
    rgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in rgb]
    for o in objs:
        for m in o.data.materials:
            node = m.node_tree.nodes.get("Principled BSDF") if m and m.use_nodes else None
            if node:
                saved.append((node, tuple(node.inputs["Base Color"].default_value)))
                node.inputs["Base Color"].default_value = (*lin, 1)
    return saved


for piece, type_id, yaw, pitch, frame, drop, color in PIECES:
    shown = {body} if type_id in BODY_ONLY else {body, meshes[piece], *companions.get(piece, [])}
    set_goggles(type_id not in HIDES_GOGGLES)
    for o in scene.objects:
        if o.type == "MESH":
            o.hide_render = o not in shown
    lo, hi = world_bounds(meshes[piece])
    for o in companions.get(piece, []):
        l2, h2 = world_bounds(o)
        lo, hi = Vector(map(min, lo, l2)), Vector(map(max, hi, h2))
    radius = (hi - lo).length / 2
    center = (lo + hi) / 2 - Vector((0, 0, radius * drop))
    # Blender는 z가 위, 라룹이 앞면은 -y(앱 +z)를 본다
    direction = Vector((math.sin(math.radians(yaw)) * math.cos(math.radians(pitch)), -math.cos(math.radians(yaw)) * math.cos(math.radians(pitch)), math.sin(math.radians(pitch))))
    cam.location = center + direction * (radius * 4)
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = radius * frame
    saved = tint([meshes[piece], *companions.get(piece, [])], color)
    scene.render.filepath = os.path.join(out, type_id + ".png")
    bpy.ops.render.render(write_still=True)
    for node, value in saved:
        node.inputs["Base Color"].default_value = value
    print("icon", type_id)
