# 앱에 넣지 않고 서버 아이템 목록으로만 더하는 가구를 가구 하나씩의 glb로 만든다(build-furniture.py와 같은 크기·둥근 모서리·구석 어둠).
# 쓰는 법: blender -b -P scripts/lobby3d/build-extra-furniture.py -- <Kenney "Models/GLTF format" 폴더> <출력 폴더>
#   (Blender 5.2에서 확인. 출력 폴더는 apps/backend/src/main/resources/catalog/files/. 아이콘은 render-icons.py로 찍는다)
# 가구를 더하면 아래 PIECES에 (종류 id, Kenney 이름)을 더하고, 목록 파일(items.json)에 그리기 정보(draw)와 files를 적는다.
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

src, out_dir = sys.argv[sys.argv.index("--") + 1 :][:2]
SCALE = 2.8
ROUND = 0.06
AO_DISTANCE = 0.5
AO_STRENGTH = 0.55

# (종류 id, Kenney 이름)
PIECES = [
    ("armchair", "loungeChair"),
]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_piece(name):
    scene = bpy.context.scene
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


def finish(piece, meshes):
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in meshes:
        for v in o.data.vertices:
            lo = Vector(map(min, lo, v.co))
            hi = Vector(map(max, hi, v.co))
    center = (lo + hi) / 2
    pivot = Vector((center.x, center.y, lo.z))
    for o in meshes:
        o.name = f"{piece}_{o.name}"
    root = bpy.data.objects.new(piece, None)
    bpy.context.scene.collection.objects.link(root)
    for o in meshes:
        o.data.transform(Matrix.Translation(-pivot))
        o.data.transform(Matrix.Scale(SCALE, 4))
        o.parent = root
    return root, (hi - lo) * SCALE


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


def bake_ao(meshes):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.cycles.device = "CPU"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("world")
    scene.world.light_settings.distance = AO_DISTANCE
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


for piece, name in PIECES:
    reset()
    meshes = import_piece(name)
    root, size = finish(piece, meshes)
    for o in meshes:
        round_edges(o)
    bake_ao(meshes)
    for o in bpy.context.scene.objects:
        o.select_set(True)
    out = os.path.join(out_dir, piece + ".glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_vertex_color="ACTIVE")
    # 앱 좌표(가로 x, 높이 y, 깊이 z) 크기: Blender의 x·z·y
    print(f"piece {piece} box width={size.x:.3f} height={size.z:.3f} depth={size.y:.3f} bytes={os.path.getsize(out)}")
