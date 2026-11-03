# 旅人棋子：Blender 建模 → 按材質併網格 → 歸零 → 渲染檢查 → 匯出 GLB。
# 在 Blender 裡跑：runpy.run_path(r"D:\Git\roll-abroad\tools\blender\build-traveler.py", run_name="__main__")
# 造型依據 Jean 給的旅人插畫：捲髮男孩、綠外套白襯衫、識別證、黃書、黃背包、卡其褲反折、
# 棕鞋、青綠圓底座。原點＝底座中心、底部 z=0、正面朝 −Y。
# 兩個節點：RA_TravelerBody（含底座）與 RA_TravelerHead（board3d.js 用頭做「左右看」idle 動畫）。
import bpy, math, os
from mathutils import Vector, Matrix, Euler

PFX, MPFX = "RA_TRAV_", "RA_TR_"
GLB = r"D:/Git/roll-abroad/assets/art/traveler.glb"
SHOTS = r"C:/Users/office/AppData/Local/Temp/opencode/blender"
PARK = (0.0, 90.0, 0.0)
S = 0.82            # 整體縮放到跟原本 box 棋子差不多高（1.2 上下），棋子不能高過卡牌

for ob in list(bpy.data.objects):
    if ob.name.startswith(PFX) or ob.name in ("RA_TravelerBody", "RA_TravelerHead",
                                              "RA_TravelerCase",
                                              "RA_TSun", "RA_TFill", "RA_TWorldBack"):
        bpy.data.objects.remove(ob, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith(MPFX):
        bpy.data.materials.remove(m)
col = bpy.data.collections.get("RA_Traveler")
if col is None:
    col = bpy.data.collections.new("RA_Traveler")
    bpy.context.scene.collection.children.link(col)
for ob in list(col.objects):
    bpy.data.objects.remove(ob, do_unlink=True)


def s2l(x):
    return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4


def M(name, hexcol, rough=0.8, metal=0.0):
    mat = bpy.data.materials.new(MPFX + name)
    mat.use_nodes = True
    b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    c = tuple(int(hexcol[i:i + 2], 16) / 255 for i in (0, 2, 4))
    b.inputs["Base Color"].default_value = tuple(s2l(v) for v in c) + (1.0,)
    b.inputs["Roughness"].default_value = rough
    if "Metallic" in b.inputs:
        b.inputs["Metallic"].default_value = metal
    return mat


SKIN = M("Skin", "F8C88C", 0.75)
SKIND = M("SkinShade", "E0A870", 0.8)
HAIR = M("Hair", "4A2C18", 0.85)
COAT = M("Coat", "1B8A87", 0.75)
COATD = M("CoatShade", "13706E", 0.8)
SHIRT = M("Shirt", "FFF6E3", 0.85)
PANT = M("Pants", "B98A52", 0.85)
PANTD = M("PantsShade", "96693C", 0.9)
CUFF = M("Cuff", "EFD9B4", 0.85)
SHOE = M("Shoe", "5A341E", 0.7)
SOLE = M("Sole", "E8D2AC", 0.8)
BAG = M("Bag", "E8A317", 0.65)
BAGD = M("BagShade", "C57F0C", 0.7)
BOOK = M("Book", "F2B33D", 0.6)
PAPER = M("Paper", "FFF9E8", 0.8)
LANYARD = M("Lanyard", "2A5FBF", 0.7)
BADGE = M("Badge", "FFFFFF", 0.5)
BADGELINE = M("BadgeLine", "3F7FD8", 0.6)
MOUTH = M("Mouth", "8C3A3A", 0.7)
EYE = M("Eye", "2B1B10", 0.4)
BASE = M("Base", "2E9AA0", 0.7)
BASED = M("BaseShade", "1F7377", 0.8)
CASE = M("Case", "E0673A", 0.7)
CASED = M("CaseShade", "B84A26", 0.75)


def own(o, mat, bevel=0.0, head=False, case=False):
    o.name = ("HEAD_" if head else "CASE_" if case else "") + PFX + o.name
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    o.data.materials.append(mat)
    if bevel > 0:
        md = o.modifiers.new("Bevel", 'BEVEL')
        md.width = bevel * S
        md.segments = 2
        md.limit_method = 'ANGLE'
    return o


def P(v):                                       # 座標統一走縮放
    return (v[0] * S, v[1] * S, v[2] * S)


def Z(v):                                       # 尺寸統一走縮放
    return (v[0] * S, v[1] * S, v[2] * S)


def box(name, size, loc, mat, bevel=0.0, rot=(0, 0, 0), head=False, case=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(loc), rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = Z(size)
    bpy.ops.object.transform_apply(scale=True)
    return own(o, mat, bevel, head, case)


def cyl(name, r, depth, loc, mat, verts=16, rot=(0, 0, 0), head=False, case=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r * S, depth=depth * S,
                                        location=P(loc), rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return own(o, mat, 0.0, head, case)


def ball(name, r, loc, mat, sub=1, scale=(1, 1, 1), head=False):
    """ico sphere：sub=1 只有 80 面；縮圖下夠圓又省面。"""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r * S, location=P(loc))
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    return own(o, mat, 0.0, head)


def capsule(name, r, depth, loc, mat, rot=(0, 0, 0), verts=12, head=False):
    """Blender 5.2 沒有 primitive_capsule_add，自己用圓柱＋兩端球拼。"""
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r * S, depth=depth * S,
                                        location=P(loc), rotation=rot)
    body = bpy.context.active_object
    body.name = name
    parts.append(body)
    m = Euler(rot).to_matrix() if any(rot) else Matrix.Identity(3)
    for dz in (-depth / 2, depth / 2):
        off = (m @ Vector((0, 0, dz))) * S
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r * S,
                                              location=Vector(P(loc)) + Vector(off))
        parts.append(bpy.context.active_object)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    bpy.ops.object.shade_smooth()
    return own(bpy.context.active_object, mat, 0.0, head)


# ── 底座（跟插畫一樣的青綠圓台）───────────────────────────────────
cyl("Base", 0.36, 0.09, (0, 0, 0.045), BASED, verts=28)
cyl("BaseTop", 0.31, 0.028, (0, 0, 0.10), BASE, verts=28)

# ── 褲子、反折褲口、鞋 ─────────────────────────────────────────────
for sx in (-1, 1):
    capsule("Leg%d" % sx, 0.072, 0.26, (sx * 0.088, 0.0, 0.33), PANT)
    box("Cuff%d" % sx, (0.175, 0.175, 0.055), (sx * 0.088, 0.0, 0.205), CUFF, bevel=0.018)
    box("Shoe%d" % sx, (0.145, 0.33, 0.085), (sx * 0.088, -0.075, 0.145), SHOE, bevel=0.03)
    box("Sole%d" % sx, (0.155, 0.34, 0.028), (sx * 0.088, -0.075, 0.108), SOLE, bevel=0.01)
    box("Lace%d" % sx, (0.088, 0.018, 0.016), (sx * 0.088, -0.15, 0.19), SOLE)
box("Hip", (0.30, 0.215, 0.17), (0, 0, 0.505), PANTD, bevel=0.045)

# ── 上身：白襯衫只留中間一條＋綠外套（縮圖下要讀成「綠外套＋白襟」）──
box("Shirt", (0.175, 0.13, 0.375), (0, -0.045, 0.755), SHIRT, bevel=0.03)
for sx in (-1, 1):
    box("Coat%d" % sx, (0.165, 0.16, 0.40), (sx * 0.148, -0.005, 0.745), COAT, bevel=0.035)
    box("CoatHem%d" % sx, (0.175, 0.17, 0.045), (sx * 0.148, -0.005, 0.545), COATD, bevel=0.015)
box("Collar", (0.215, 0.09, 0.05), (0, -0.038, 0.95), SHIRT, bevel=0.015)

# 識別證：藍掛繩 V 字＋白卡（插畫裡很搶眼，縮圖下也要看得出來）
for sx in (-1, 1):
    box("Lanyard%d" % sx, (0.03, 0.018, 0.215), (sx * 0.058, -0.105, 0.865), LANYARD,
        rot=(math.radians(-5), 0, math.radians(sx * 8)))
box("Badge", (0.105, 0.018, 0.13), (0, -0.122, 0.715), BADGE, bevel=0.012)
box("BadgeLine", (0.068, 0.02, 0.016), (0, -0.128, 0.745), BADGELINE)

# ── 背包：背後黃包＋蓋＋前肩帶（黃帶是識別「這小鬼是旅客」的關鍵）────
box("Pack", (0.36, 0.19, 0.38), (0, 0.16, 0.745), BAG, bevel=0.07)
box("PackFlap", (0.375, 0.075, 0.145), (0, 0.052, 0.895), BAGD, bevel=0.03)
box("PackPocket", (0.21, 0.06, 0.135), (0, 0.048, 0.61), BAGD, bevel=0.03)
for sx in (-1, 1):
    box("Strap%d" % sx, (0.05, 0.028, 0.30), (sx * 0.10, -0.078, 0.80), BAG,
        rot=(math.radians(7), 0, 0))

# ── 手臂：綠袖＋白袖口＋膚色手（左手抓背包帶、右手扶書）────────────
capsule("ArmL", 0.058, 0.20, (-0.235, -0.012, 0.80), COAT,
        rot=(math.radians(16), 0, math.radians(28)))
capsule("ForeL", 0.052, 0.10, (-0.252, -0.09, 0.668), COAT,
        rot=(math.radians(80), 0, math.radians(16)))
box("CuffL", (0.082, 0.082, 0.04), (-0.258, -0.135, 0.655), SHIRT, bevel=0.014,
    rot=(math.radians(16), 0, 0))
ball("HandL", 0.062, (-0.243, -0.158, 0.648), SKIN, sub=1)
capsule("ArmR", 0.058, 0.19, (0.232, -0.02, 0.80), COAT,
        rot=(math.radians(22), 0, math.radians(-13)))
capsule("ForeR", 0.052, 0.06, (0.243, -0.10, 0.672), COAT, rot=(math.radians(86), 0, 0))
box("CuffR", (0.082, 0.082, 0.04), (0.243, -0.148, 0.655), SHIRT, bevel=0.014,
    rot=(math.radians(22), 0, 0))
ball("HandR", 0.068, (0.246, -0.205, 0.615), SKIN, sub=1)   # 手要在書前面，才不像綠手套

# 書：夾在右腋下。轉角不能大，否則書頁會從黃封面旁邊露出來、縮圖下變成一個相框。
box("Book", (0.175, 0.05, 0.235), (0.225, -0.14, 0.61), BOOK, bevel=0.012,
    rot=(math.radians(-6), math.radians(8), 0))
box("BookPages", (0.155, 0.02, 0.205), (0.225, -0.10, 0.612), PAPER,
    rot=(math.radians(-6), math.radians(8), 0))
box("BookBand", (0.18, 0.018, 0.028), (0.225, -0.168, 0.555), BAGD,
    rot=(math.radians(-6), math.radians(8), 0))

# ── 頭（獨立節點 RA_TravelerHead）──────────────────────────────────
# 遊戲鏡頭是 56° 俯角：頭不能太大、頭髮不能太蓬，否則整顆讀成一坨毛球。
HEADZ = 1.09
ball("Head", 0.185, (0, 0, HEADZ), SKIN, sub=2, scale=(1, 0.95, 1.0), head=True)
for sx in (-1, 1):
    ball("Ear%d" % sx, 0.04, (sx * 0.18, 0.012, HEADZ - 0.02), SKIND, sub=1, head=True)
    box("Brow%d" % sx, (0.065, 0.018, 0.02), (sx * 0.07, -0.158, HEADZ + 0.068), HAIR,
        rot=(0, 0, math.radians(sx * -9)), head=True)
    ball("Eye%d" % sx, 0.026, (sx * 0.068, -0.165, HEADZ + 0.018), EYE, sub=2,
         scale=(1, 0.6, 1.3), head=True)
    ball("Cheek%d" % sx, 0.034, (sx * 0.105, -0.14, HEADZ - 0.05), SKIND, sub=1,
         scale=(1, 0.45, 0.62), head=True)
box("Nose", (0.03, 0.03, 0.026), (0, -0.186, HEADZ - 0.014), SKIND, bevel=0.012, head=True)
ball("Mouth", 0.04, (0, -0.16, HEADZ - 0.07), MOUTH, sub=2,
    scale=(1.15, 0.42, 0.8), head=True)
ball("Tongue", 0.02, (0, -0.166, HEADZ - 0.085), SKIND, sub=1,
    scale=(1.3, 0.4, 0.5), head=True)

# 捲髮：ico 球堆出蓬鬆捲度（插畫是爆炸捲）。
# 重點是「別擋臉」：前面的捲往後退、瀏海抬高到眉毛上方，否則遊戲 56° 俯角一看就是一坨毛球。
for i, (dx, dy, dz, r) in enumerate([
        (0, 0.03, 0.165, 0.14), (-0.125, 0.02, 0.11, 0.118), (0.125, 0.02, 0.11, 0.118),
        (-0.08, 0.115, 0.1, 0.105), (0.09, 0.11, 0.105, 0.105), (0.0, -0.05, 0.145, 0.1),
        (-0.172, 0.05, 0.018, 0.087), (0.172, 0.05, 0.018, 0.087), (0.0, 0.15, 0.028, 0.09),
        (-0.14, -0.045, 0.07, 0.072), (0.14, -0.045, 0.07, 0.072),
        (-0.05, -0.085, 0.125, 0.06)]):
    ball("Curl%d" % i, r, (dx, dy, HEADZ + dz), HAIR, sub=1, scale=(1, 1, 0.88), head=True)
for i, (dx, dz, r) in enumerate([(-0.13, 0.1, 0.062), (-0.062, 0.115, 0.066),
                                 (0.01, 0.12, 0.064), (0.078, 0.115, 0.066),
                                 (0.14, 0.095, 0.06)]):
    ball("Fringe%d" % i, r, (dx, -0.118, HEADZ + dz), HAIR, sub=1,
         scale=(1, 0.8, 1.05), head=True)

# ── 行李箱（獨立節點：跳格時拖後、落地回正）────────────────────────
# 顏色用橘紅不用黃：黃書、黃背包都是黃的，箱子再黃縮圖下會糊成一團。
CXL, CYL, CZL = 0.36, 0.08, 0.20
box("Case", (0.14, 0.26, 0.32), (CXL, CYL, CZL), CASE, bevel=0.025,
    rot=(0, 0, math.radians(9)), case=True)
box("CaseStripe", (0.145, 0.265, 0.05), (CXL, CYL, CZL - 0.09), CASED,
    rot=(0, 0, math.radians(9)), case=True)
box("CaseHandle", (0.09, 0.02, 0.10), (CXL, CYL - 0.15, CZL + 0.2), CUFF,
    rot=(0, 0, math.radians(9)), case=True)
box("CaseTag", (0.05, 0.015, 0.06), (CXL + 0.07, CYL - 0.15, CZL + 0.17), LANYARD,
    rot=(0, 0, math.radians(9)), case=True)   # 吊牌吊在拉把上，不要飄在箱子旁邊
for sx in (-1, 1):
    cyl("CaseWheel%d" % sx, 0.028, 0.02, (CXL + sx * 0.05, CYL + 0.09, CZL - 0.165),
        EYE, verts=10, rot=(0, math.pi / 2, 0), case=True)

# ── 頭、身體各自併成一張 mesh（Head 原點搬到脖子）──────────────────
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')


def bake(o):
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


for o in bpy.context.selected_objects:
    o.select_set(False)
for o in col.objects:
    o.hide_set(False)
    o.select_set(True)
bpy.context.view_layer.objects.active = [o for o in col.objects][0]
bpy.ops.object.convert(target='MESH')                        # 套用 Bevel

for pre, node_name in (("HEAD_", "RA_TravelerHead"),
                       ("CASE_", "RA_TravelerCase"),
                       ("RA_TRAV_", "RA_TravelerBody")):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    parts = [o for o in col.objects if o.name.startswith(pre)]
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    model = bpy.context.active_object
    model.name = node_name
    bake(model)

body = bpy.data.objects["RA_TravelerBody"]
head = bpy.data.objects["RA_TravelerHead"]
case = bpy.data.objects["RA_TravelerCase"]
# 旋轉原點：頭搬到脖子、行李箱搬到箱中心，three 端才不會繞腳底甩
NECK = Vector((0, 0, 0.95 * S))
CORG = Vector(P((CXL, CYL, CZL)))
for ob, pivot in ((head, NECK), (case, CORG)):
    for v in ob.data.vertices:
        v.co -= pivot
    ob.location = pivot

# 歸零：整體 bbox 底座中心為原點、底部 z=0。matrix_world 會等 depsgraph 更新，
# 改完 location 一定要先 update() 再讀，否則會抓到舊值、歸零歸不準。
def bbox():
    bpy.context.view_layer.update()
    vs = [body.matrix_world @ Vector(v.co) for v in body.data.vertices]
    vs += [head.matrix_world @ Vector(v.co) for v in head.data.vertices]
    return ([v.x for v in vs], [v.y for v in vs], [v.z for v in vs])


for _ in range(2):                     # 跑兩次，第二次把殘差清掉
    xs, ys, zs = bbox()                # 只用人身 bbox：行李箱是掛在旁邊的，不能把原點拉歪
    off = Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs)))
    for ob in (body, head, case):
        ob.location += off

# ── 渲染檢查（自帶燈，避免同一檔案裡別人的燈把我方照歪）────────────
os.makedirs(SHOTS, exist_ok=True)
sc = bpy.context.scene
l1 = bpy.data.lights.new("RA_TSun", 'SUN')
l1.energy, l1.angle = 3.4, math.radians(8)
sun = bpy.data.objects.new("RA_TSun", l1)
sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(52), 0, math.radians(-28))
l2 = bpy.data.lights.new("RA_TFill", 'AREA')
l2.energy, l2.size = 120, 2.2
fill = bpy.data.objects.new("RA_TFill", l2)
sc.collection.objects.link(fill)
fill.location = (PARK[0] - 1.2, PARK[1] - 2.0, 2.0)
fill.rotation_euler = (math.radians(48), 0, math.radians(-25))

cam = bpy.data.objects.get("RA_Cam")
if cam is None:
    cu = bpy.data.cameras.new("RA_Cam")
    cu.lens = 50
    cam = bpy.data.objects.new("RA_Cam", cu)
    sc.collection.objects.link(cam)
old_cam = sc.camera.name if sc.camera else ""
sc.camera = cam


def shot(eye, center, name, lens=50):
    cam.data.lens = lens
    cam.location = eye
    cam.rotation_euler = (Vector(center) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(SHOTS, name)
    bpy.ops.render.render(write_still=True)


pk = Vector(PARK)
for ob in (body, head, case):
    ob.location += pk
sun.location = pk
fill.location = pk + Vector((-1.1, -1.9, 1.9))
bpy.context.view_layer.update()
C = pk + Vector((0, 0, 0.60 * S))
shot((pk[0] - 0.75, pk[1] - 1.85, 0.95), C, "paw-1.png", lens=72)          # 正面
shot((pk[0] + 1.45, pk[1] - 1.15, 0.90), C, "paw-2.png", lens=72)          # 側後（看背包）
shot((pk[0] - 0.28, pk[1] - 1.05, 0.72), pk + Vector((0, 0, 0.80 * S)),
     "paw-3.png", lens=85)                                                  # 上半身
shot((pk[0] + 0.45, pk[1] - 1.05, 1.75), C, "paw-4.png", lens=72)          # 俯角（遊戲鏡頭）
for ob in (body, head, case):
    ob.location -= pk
bpy.context.view_layer.update()

bpy.ops.object.select_all(action='DESELECT')
for ob in (body, head, case):
    ob.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True,
                          export_apply=True, export_cameras=False, export_lights=False,
                          export_yup=True, use_mesh_edges=False)
for o in (sun, fill):
    bpy.data.objects.remove(o, do_unlink=True)
if old_cam and bpy.data.objects.get(old_cam):
    sc.camera = bpy.data.objects[old_cam]

allv = [ob.matrix_world @ Vector(v.co) for ob in (body, head, case) for v in ob.data.vertices]
xs, ys, zs = [v.x for v in allv], [v.y for v in allv], [v.z for v in allv]
tris = 0
for ob in (body, head, case):
    ob.data.calc_loop_triangles()
    tris += len(ob.data.loop_triangles)
print("traveler: x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f, %d tris, GLB %d bytes"
      % (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs), tris, os.path.getsize(GLB)))
