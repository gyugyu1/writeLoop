# 옷장(캐릭터 꾸미기) 아이템 칸에 보이는 착용 아이템 그림을 착용 모델(lobby-wearables.glb)에서 찍는다.
# 쓰는 법: blender -b -P scripts/lobby3d/render-wearable-icons.py -- <라룹이 glb> <착용 모델 glb> <출력 폴더>
#   (Blender 5.2에서 확인. 출력은 apps/mobile/assets/icons/wearables/에 <아이템 종류>.png로 넣는다)
# 가구 아이콘(render-icons.py)과 같은 조명·투명 배경의 정사각 그림이다. 상의·하의는 몸을 따라 휘는 껍질이라 홀로 찍으면 가장자리가
# 거칠어서, 라룹이가 그 아이템만 입은 모습을 그 부위에 맞춰 찍는다. 신발은 한 짝뿐이라 좌우로 뒤집은 짝을 더해 두 발에 신긴다.
# 아이템을 더하면 PIECES에 (모델 안 이름, 아이템 종류, 보는 각도)를 더하고 다시 돌린다(앱의 wearable-icons.ts에도 한 줄 더한다).
import math
import os
import sys

import bpy
from mathutils import Vector

body_src, src, out = (os.path.abspath(p) for p in sys.argv[sys.argv.index("--") + 1 :][:3])
SIZE = 256

# (모델 안 이름, 아이템 종류, 옆으로 돈 각도(도), 내려다보는 각도(도), 아이템 크기에 곱하는 화면 폭, 화면 가운데를 내리는 정도(아이템 크기 배))
PIECES = [
    ("wear-hat", "capOrange", 30, 28, 2.4, 0.35),
    ("wear-top", "tshirtOrange", 25, 10, 1.25, 0.18),
    ("wear-bottom", "shortsNavy", 25, 12, 1.45, 0.0),
    ("wear-shoe-l", "shoesBrown", 30, 22, 1.7, -0.1),
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
for piece, type_id, yaw, pitch, frame, drop in PIECES:
    shown = {body, meshes[piece], *companions.get(piece, [])}
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
    scene.render.filepath = os.path.join(out, type_id + ".png")
    bpy.ops.render.render(write_still=True)
    print("icon", type_id)
