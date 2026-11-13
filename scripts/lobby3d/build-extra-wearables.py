# 앱에 넣지 않고 서버 아이템 목록으로만 더하는 옷 모델을 모델 하나씩의 glb로 만든다(build-wearables.py와 같은 방식).
# 쓰는 법: blender -b -P scripts/lobby3d/build-extra-wearables.py -- <라룹이 glb> <출력 폴더>
#   (Blender 5.2에서 확인. 라룹이 glb는 apps/mobile/assets/models/writeloop.glb, 출력 폴더는 apps/backend/src/main/resources/catalog/files/.
#    아이콘은 render-wearable-icons.py에 이 glb를 넘겨 찍는다)
# 뼈대로 휘는 껍질은 라룹이 몸에서 그 부위(뼈 무게가 가장 큰 뼈로 가름)를 떠서 법선 쪽으로 살짝 부풀린다.
# 라룹이 뼈대(뼈 이름·쉬는 자세)와 함께 내보내고, 앱이 라룹이 뼈대에 뼈 이름으로 다시 묶는다.
# 옷을 더하면 아래 SHELLS에 (파일 이름, 모델 이름, 남길 뼈, 부풀리는 정도, 색)을 더하고, 목록 파일(items.json)에 draw와 files를 적는다.
import os
import sys

import bmesh
import bpy

char_path, out_dir = (os.path.abspath(p) for p in sys.argv[sys.argv.index("--") + 1 :][:2])

# (파일 이름, 모델 이름, 남길 뼈, 부풀리는 정도, 색)
SHELLS = [
    # 조끼: 몸통만(팔은 뺀다). 상의(wear-top)와 같은 부위라 부풀리는 정도도 같다
    ("wear-vest.glb", "wear-vest", {"spine"}, 0.02, "#5E7F4F"),
]


def solid_material(name, hex_color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    rgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in rgb]
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lin, 1)
    m.diffuse_color = (*lin, 1)
    return m


for file_name, name, keep, offset, color in SHELLS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=char_path)
    arm = next(o for o in scene.objects if o.type == "ARMATURE")
    body = next(o for o in scene.objects if o.type == "MESH" and o.find_armature() == arm)
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

    o = body.copy()
    o.data = body.data.copy()
    o.name = name
    scene.collection.objects.link(o)
    # 라룹이 몸의 모양 변형(고글 끄기 등)은 옷에 쓰지 않는다
    if o.data.shape_keys:
        o.shape_key_clear()
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
    for attr in list(o.data.attributes):
        if attr.name.startswith("_outline"):
            o.data.attributes.remove(attr)

    # 라룹이 몸은 빼고 뼈대와 옷만 내보낸다
    bpy.data.objects.remove(body, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for x in scene.objects:
        x.select_set(True)
    out = os.path.join(out_dir, file_name)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_apply=False, export_animations=False, export_skins=True, export_morph=False)
    print("wearable", name, "bytes", os.path.getsize(out))
