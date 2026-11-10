# 꾸미기 보관함에 보이는 가구 아이콘 그림을 가구 묶음(lobby-furniture.glb)에서 찍는다.
# 쓰는 법: blender -b -P scripts/lobby3d/render-icons.py -- <가구 묶음 glb> <출력 폴더>
#   (Blender 5.2에서 확인. 출력은 apps/mobile/assets/icons/furniture/에 <가구 종류 id>.png로 넣는다)
# 가구마다 같은 각도(앞 오른쪽 위에서 비스듬히)·조명·투명 배경의 정사각 그림이다. 벽에 거는 가구는 앞에서, 깔개는 위에서 더 내려다본다.
# 가구를 더하면 PIECES에 (묶음 안 이름, 종류 id, 보는 각도)를 더하고 다시 돌린다(앱의 furniture-icons.ts에도 한 줄 더한다).
import math
import os
import sys

import bpy
from mathutils import Vector

src, out = (os.path.abspath(p) for p in sys.argv[sys.argv.index("--") + 1 :][:2])
SIZE = 256

# (묶음 안 이름, 종류 id, 옆으로 돈 각도(도), 내려다보는 각도(도))
PIECES = [
    ("wardrobe", "wardrobe", 35, 22),
    ("rug", "rug", 35, 55),
    ("tableLamp", "lamp", 35, 22),
    ("bed", "bed", 35, 30),
    ("nightstand", "nightstand", 35, 25),
    ("floorLamp", "floorLamp", 35, 18),
    ("plant", "plant", 35, 20),
    ("smallPlant", "smallPlant", 35, 25),
    ("booksStack", "books", 35, 28),
    ("frame", "frame", 15, 8),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)

roots = {o.name: o for o in scene.objects if o.parent is None}

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


def world_bounds(root):
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in [root, *root.children_recursive]:
        if o.type != "MESH":
            continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


os.makedirs(out, exist_ok=True)
for piece, type_id, yaw, pitch in PIECES:
    for name, root in roots.items():
        hidden = name != piece
        for o in [root, *root.children_recursive]:
            o.hide_render = hidden
    lo, hi = world_bounds(roots[piece])
    center = (lo + hi) / 2
    radius = (hi - lo).length / 2
    # Blender는 z가 위, 가구 앞면은 -y(앱 +z)를 본다
    direction = Vector((math.sin(math.radians(yaw)) * math.cos(math.radians(pitch)), -math.cos(math.radians(yaw)) * math.cos(math.radians(pitch)), math.sin(math.radians(pitch))))
    cam.location = center + direction * (radius * 4)
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    cam_data.ortho_scale = radius * 2.1
    scene.render.filepath = os.path.join(out, type_id + ".png")
    bpy.ops.render.render(write_still=True)
    print("icon", type_id)
