# 받은 고글 모델을 착용 모델(wear-goggles.glb)로 만든다: 맞춤 변환(안 A)을 마무리된 몸 좌표에 굳히고, 삼각형과 질감을 줄인다.
#   blender -b --factory-startup -P scripts/lobby3d/build-goggles.py -- <고글.glb> <goggles-fit.json> <안 이름> <writeloop.glb.frame.json> <out.glb> [이름=값 ...]
# 이름=값: tris(삼각형 목표, 기본 2400), tex(질감 한 변, 기본 512), fmt(JPEG|PNG, 기본 JPEG), body(확인용 몸 glb)
# 결과: 메시 노드 하나(이름 wear-goggles), 노드 변환 없음. 좌표는 라룹이 쉬는 자세의 몸 좌표(앱 규격: Y 위, 앞 +Z, 키 1, 원점 발 가운데).
#       앱은 이것을 head 뼈에 붙인다(다른 착용 모델과 같은 형식. 참고: 저장소의 catalog/files/wear-sunglasses.glb, wear-hat.glb).
import json
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1 :]
gog_glb, fit_json, fit_name, frame_json, dst = args[:5]
kv = dict(a.split("=", 1) for a in args[5:] if "=" in a)
TRIS = int(kv.get("tris", 2400))
TEX = int(kv.get("tex", 512))
FMT = kv.get("fmt", "JPEG")

fit = json.load(open(fit_json, encoding="utf-8"))["fits"][fit_name]
frame = json.load(open(frame_json, encoding="utf-8"))
C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))  # Blender 축 → glTF 축
M_norm = C.inverted() @ Matrix(fit["matrices_gltf_axes"]["norm"]["matrix_rows"]) @ C  # 고글(Blender 축) → 올린 몸 좌표 N(Blender 축)
F = Matrix(frame["app_blender_from_norm_blender"])  # N → 앱 좌표(Blender 축: 앞 -Y)
M_app = F @ M_norm

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=gog_glb)
sc = bpy.context.scene
obj = next(o for o in sc.objects if o.type == "MESH")
mw = obj.matrix_world.copy()
obj.parent = None
obj.matrix_world = Matrix.Identity(4)
obj.data.transform(mw)
for o in [o for o in sc.objects if o is not obj]:
    bpy.data.objects.remove(o)

# 질감 경계에서 갈라진 꼭짓점을 합치고 파일에 든 법선은 버린다(합친 뒤 그대로 두면 뒤틀린다).
bm = bmesh.new()
bm.from_mesh(obj.data)
n0 = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
bm.to_mesh(obj.data)
bm.free()
cn = obj.data.attributes.get("custom_normal")
if cn:
    obj.data.attributes.remove(cn)
obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
tris0 = sum(len(p.vertices) - 2 for p in obj.data.polygons)
print("goggles verts", n0, "->", len(obj.data.vertices), "tris", tris0)

# 삼각형 줄이기. 렌즈 판(앞쪽, 색 경계가 있는 곳)은 덜 줄이고 단색 띠는 많이 줄인다.
co = np.array([v.co[:] for v in obj.data.vertices])
plate = co[:, 1] < -30  # 고글 좌표: 앞이 -Y. 렌즈 판은 y < -30
zone = obj.vertex_groups.new(name="decimate_zone")
for i in range(len(co)):
    zone.add([i], float(kv.get("plate_weight", 0.45)) if plate[i] else 1.0, "REPLACE")
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
dec = obj.modifiers.new("dec", "DECIMATE")
dec.ratio = TRIS / tris0
dec.vertex_group = "decimate_zone"
dec.vertex_group_factor = 1.0
bpy.ops.object.modifier_apply(modifier="dec")
obj.vertex_groups.remove(obj.vertex_groups["decimate_zone"])
obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))

# 맞춤 변환을 메시에 굳힌다(좌우·앞뒤·위아래 크기가 달라도 노드에는 변환이 남지 않는다).
obj.data.transform(M_app)
obj.data.update()
if M_app.determinant() < 0:
    obj.data.flip_normals()

# 재질: 바탕색 그림 한 장만. 다른 착용 모델처럼 양면, 금속 0.
mat = obj.data.materials[0]
nt = mat.node_tree
bsdf = next(nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED")
todo = [l.from_node for l in bsdf.inputs["Base Color"].links]
tex = None
seen = set()
while todo:
    nd = todo.pop(0)
    if nd in seen:
        continue
    seen.add(nd)
    if nd.type == "TEX_IMAGE" and nd.image:
        tex = nd
        break
    todo += [l.from_node for i in nd.inputs for l in i.links]
img = tex.image
for sock in ("Base Color", "Roughness", "Metallic", "Normal", "Specular Tint", "Specular IOR Level"):
    if sock in bsdf.inputs:
        for l in list(bsdf.inputs[sock].links):
            nt.links.remove(l)
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.9
bsdf.inputs["Metallic"].default_value = 0.0
if "Specular Tint" in bsdf.inputs:
    bsdf.inputs["Specular Tint"].default_value = (1.0, 1.0, 1.0, 1.0)
if "Specular IOR Level" in bsdf.inputs:
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
keep = {bsdf.name, tex.name}
for nm in [nd.name for nd in nt.nodes if nd.name not in keep and nd.type != "OUTPUT_MATERIAL"]:
    nt.nodes.remove(nt.nodes[nm])
for im in list(bpy.data.images):
    if im is not img:
        bpy.data.images.remove(im)
img.scale(TEX, TEX)
img.name = "wear-goggles"
if FMT == "PNG":
    img.file_format = "PNG"
mat.name = "wear-goggles"
mat.use_backface_culling = False  # 양면(다른 착용 모델과 같게)
obj.name = "wear-goggles"
obj.data.name = "wear-goggles"

co = np.array([v.co[:] for v in obj.data.vertices])
tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
print("wear-goggles tris", tris, "verts", len(co), "bbox(app, Blender axes) lo", co.min(0).round(4), "hi", co.max(0).round(4))
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_animations=False,
                          export_image_format="JPEG" if FMT == "JPEG" else "AUTO", export_jpeg_quality=90)
print("exported", dst, os.path.getsize(dst), "bytes")

# 기록: 굳힌 변환(고글 파일 좌표 → 앱 몸 좌표)과 결과 수치.
_Cg = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
with open(dst + ".info.json", "w", encoding="utf-8") as fp:
    json.dump({
        "what": "wear-goggles.glb를 만들 때 메시에 굳힌 변환과 결과. 좌표는 라룹이 쉬는 자세의 몸 좌표(앱 규격)다.",
        "source": gog_glb, "fit": fit_name, "fit_params": fit.get("params"),
        "app_gltf_from_goggles_gltf": [[round(float(v), 8) for v in r] for r in (_Cg @ M_app @ _Cg.inverted())],
        "tris": tris, "texture_px": TEX, "texture_format": FMT,
        "bbox_app_gltf": {"min": [round(float(co[:, 0].min()), 4), round(float(co[:, 2].min()), 4), round(float(-co[:, 1].max()), 4)],
                          "max": [round(float(co[:, 0].max()), 4), round(float(co[:, 2].max()), 4), round(float(-co[:, 1].min()), 4)]},
        "attach": {"bone": "head", "note": "카탈로그의 draw는 다른 머리 착용 모델처럼 attach=bone, bone=head. body(맞춘 몸 판)는 새 몸의 번호를 쓴다."},
    }, fp, ensure_ascii=False, indent=1)
