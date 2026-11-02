# 出發航廈：Blender 建模 → 併網格 → 歸零 → 渲染 → 匯出 GLB。
# 在 Blender 裡跑：runpy.run_path(r"D:\Git\roll-abroad\tools\blender\build-airport.py", run_name="__main__")
# 座標原點＝底座中心，-Y 是正面、+Z 是上。造型對照 docs/art-direction.md 的參考圖。
import bpy, bmesh, math, os
from mathutils import Vector

PFX, MPFX = "RA_APT_", "RA_A_"
GLB = r"D:/Git/roll-abroad/assets/art/airport-terminal.glb"
SHOTS = r"C:/Users/office/AppData/Local/Temp/opencode/blender"
PARK = (0.0, 90.0, 0.0)

for ob in list(bpy.data.objects):
    if ob.name.startswith(PFX) or ob.name == "RA_Airport":
        bpy.data.objects.remove(ob, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith(MPFX):
        bpy.data.materials.remove(m)
col = bpy.data.collections.get("RA_Airport")
if col is None:
    col = bpy.data.collections.new("RA_Airport")
    bpy.context.scene.collection.children.link(col)
for ob in list(col.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

def s2l(x):
    return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4

def M(name, hexcol, rough=0.8, metal=0.0):
    mat = bpy.data.materials.new(MPFX + name); mat.use_nodes = True
    b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    c = tuple(int(hexcol[i:i+2], 16) / 255 for i in (0, 2, 4))
    b.inputs["Base Color"].default_value = tuple(s2l(v) for v in c) + (1.0,)
    b.inputs["Roughness"].default_value = rough
    if "Metallic" in b.inputs:
        b.inputs["Metallic"].default_value = metal
    return mat

CREAM = M("Cream", "FFF6E3", 0.85)
CREAMD = M("CreamDark", "EEDFC2", 0.9)
GOLD = M("Gold", "FFC33C", 0.3, 0.4)
GOLDD = M("GoldDeep", "E39A15", 0.4, 0.35)
GLASS = M("Glass", "2BAFEE", 0.1)
GLASSP = M("GlassPale", "BFE9FF", 0.18)
WHITE = M("White", "FFFFFF", 0.55)
BLUE = M("Banner", "1E7BD0", 0.65)
LEAF = M("Leaf", "2F9C55", 0.85)
LEAFL = M("LeafLite", "6FC94A", 0.85)
FLOW = M("Flower", "FFD33C", 0.8)
PAVE = M("Paving", "F8F1E0", 0.95)
PLINTH = M("Plinth", "E6D8BC", 0.95)
CBAG = M("CaseBlue", "2F7FD0", 0.55)
CAYE = M("CaseYellow", "FFBE22", 0.55)
POT = M("Pot", "D08A55", 0.8)

def own(o, mat, bevel=0.0):
    o.name = PFX + o.name
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o); o.data.materials.append(mat)
    if bevel > 0:
        md = o.modifiers.new("Bevel", 'BEVEL')
        md.width = bevel; md.segments = 3; md.limit_method = 'ANGLE'
    return o

def box(name, size, loc, mat, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return own(o, mat, bevel)

def cyl(name, r, depth, loc, mat, verts=24, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    return own(o, mat, bevel)

def cone(name, r1, r2, depth, loc, mat, verts=20):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2,
                                    depth=depth, location=loc)
    o = bpy.context.active_object; o.name = name
    return own(o, mat)

def ball(name, r, loc, mat, seg=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(4, seg // 2),
                                         radius=r, location=loc)
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.shade_smooth()
    return own(o, mat)

def half_cyl(name, R, depth, loc, mat, n=26):
    """半圓筒，軸沿 Y、留上半部（桶頂、半圓金板）"""
    bm = bmesh.new(); y0, y1 = -depth / 2, depth / 2; rows = []
    for i in range(n + 1):
        a = math.pi * i / n
        rows.append((bm.verts.new((R * math.cos(a), y0, R * math.sin(a))),
                     bm.verts.new((R * math.cos(a), y1, R * math.sin(a)))))
    for i in range(n):
        p, q = rows[i]; r, s = rows[i + 1]
        bm.faces.new((p, q, s, r))
    bm.faces.new(list(reversed([p for p, q in rows])))
    bm.faces.new([q for p, q in rows])
    bm.faces.new((rows[0][0], rows[-1][0], rows[-1][1], rows[0][1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(PFX + name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o); o.location = loc; o.data.materials.append(mat)
    return o

def archXZ(name, R, minor, loc, mat, n=26):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(n)
    for i in range(n + 1):
        a = math.pi * i / n
        sp.points[i].co = (R * math.cos(a), 0.0, R * math.sin(a), 1.0)
    cu.bevel_depth = minor; cu.bevel_resolution = 3
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o); o.location = loc
    bpy.context.view_layer.objects.active = o
    for x in list(bpy.context.selected_objects):
        x.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return own(bpy.context.active_object, mat)

def plate(name, loc, mat, w, h, thick, notch=0.0):
    pts = [(-w/2, h/2), (w/2, h/2), (w/2, -h/2 + notch), (0, -h/2), (-w/2, -h/2 + notch)]
    bm = bmesh.new(); vs = [bm.verts.new((x, 0, z)) for (x, z) in pts]; bm.faces.new(vs)
    me = bpy.data.meshes.new(PFX + name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o); o.location = loc; o.data.materials.append(mat)
    md = o.modifiers.new("Sol", 'SOLIDIFY'); md.thickness = thick; md.offset = 0
    return o

def plane_mark(name, loc, scale, thick, mat):
    """白色飛機剪影薄板（立在 XZ 面，機頭朝 +Z）"""
    pts = [(0.00, 0.34), (0.035, 0.26), (0.045, 0.08), (0.30, -0.02), (0.30, -0.09),
           (0.055, -0.05), (0.050, -0.17), (0.135, -0.235), (0.135, -0.30), (0.00, -0.275)]
    pts = pts + [(-x, z) for (x, z) in reversed(pts[1:-1])]
    bm = bmesh.new(); vs = [bm.verts.new((x * scale, -thick / 2, z * scale)) for (x, z) in pts]
    bm.faces.new(vs)
    me = bpy.data.meshes.new(PFX + name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o); o.location = loc; o.data.materials.append(mat)
    md = o.modifiers.new("Sol", 'SOLIDIFY'); md.thickness = thick; md.offset = 0
    return o

# ── 底座與舖面 ──────────────────────────────────────────────────────
box("Base", (2.24, 1.44, 0.10), (0, 0.02, 0.05), PLINTH, bevel=0.05)
box("Plaza", (2.04, 1.26, 0.06), (0, 0.02, 0.13), PAVE, bevel=0.03)
box("Walk", (0.80, 0.42, 0.03), (0, -0.68, 0.175), PAVE, bevel=0.02)

# 主體航廈、Golden 檐口、玻璃帷幕
box("Hall", (1.60, 0.80, 0.70), (0, -0.02, 0.50), CREAM, bevel=0.03)
box("Cornice", (1.78, 0.98, 0.13), (0, -0.02, 0.885), GOLD)
box("GlassFront", (1.34, 0.05, 0.46), (0, -0.41, 0.48), GLASS)
for i in range(4):
    box("Mullion%d" % i, (0.05, 0.06, 0.46), (-0.505 + i * 0.337, -0.435, 0.48), WHITE)
box("Transom", (1.34, 0.06, 0.05), (0, -0.435, 0.63), WHITE)
for sx in (-1, 1):
    box("SideGlass%d" % sx, (0.05, 0.52, 0.36), (sx * 0.825, 0.0, 0.52), GLASS)
    box("SFa%d" % sx, (0.06, 0.05, 0.36), (sx * 0.83, -0.27, 0.52), WHITE)
    box("SFb%d" % sx, (0.06, 0.05, 0.36), (sx * 0.83, 0.27, 0.52), WHITE)
    box("SFm%d" % sx, (0.06, 0.52, 0.05), (sx * 0.83, 0.0, 0.52), WHITE)

# 玻璃桶狀拱頂＋金肋＋縱向金條
VR, VZ, VLEN, VY = 0.62, 0.95, 0.92, -0.02
half_cyl("Vault", VR, VLEN, (0, VY, VZ), GLASS)
for i, yy in enumerate((-0.34, -0.12, 0.12, 0.34)):
    archXZ("Rib%d" % i, VR + 0.02, 0.032, (0, VY + yy, VZ), GOLD)
for a_deg in (30, 60, 90, 120, 150):
    a = math.radians(a_deg)
    cyl("Long%d" % a_deg, 0.022, VLEN, (VR * math.cos(a), VY, VZ + VR * math.sin(a)),
        GOLD, verts=8, rot=(math.pi / 2, 0, 0))

# 正立面：金拱框＋金半圓底板＋白飛機（參考圖是金底白飛機）
half_cyl("Gable", 0.60, 0.06, (0, -0.47, VZ), GOLD, n=26)
archXZ("FacadeArch", 0.665, 0.085, (0, -0.475, VZ), GOLD)
box("GableSill", (1.42, 0.12, 0.07), (0, -0.47, VZ + 0.01), GOLD)
plane_mark("Emblem", (0, -0.52, VZ + 0.30), 0.60, 0.06, WHITE)

# 入口：薄片雨遮＋燈＋金拱＋玻璃門
box("Canopy", (1.06, 0.40, 0.055), (0, -0.60, 0.70), GOLD, bevel=0.02, rot=(-math.radians(9), 0, 0))
box("Fascia", (1.06, 0.05, 0.10), (0, -0.785, 0.665), GOLDD)
for i in range(3):
    ball("Lamp%d" % i, 0.028, (-0.28 + i * 0.28, -0.66, 0.655), WHITE, seg=10)
archXZ("DoorArch", 0.44, 0.045, (0, -0.455, 0.62), GOLD)
box("DoorGlass", (0.66, 0.05, 0.52), (0, -0.435, 0.36), GLASSP)
box("DoorMid", (0.045, 0.07, 0.52), (0, -0.45, 0.36), GOLD)
for sx in (-1, 1):
    box("DoorFrame%d" % sx, (0.06, 0.07, 0.56), (sx * 0.35, -0.45, 0.36), GOLD)
box("Step", (0.92, 0.22, 0.05), (0, -0.58, 0.185), CREAMD, bevel=0.02)

# 管制塔（粗短、寬玻璃艙、金簷）
TX, TY = -0.80, 0.16
cyl("TowerShaft", 0.28, 1.00, (TX, TY, 0.72), CREAM, verts=20)
box("TowerWin", (0.15, 0.04, 0.26), (TX, -0.06, 0.46), GLASS)
cyl("TowerBand", 0.32, 0.08, (TX, TY, 1.06), GOLD, verts=20)
cone("TowerFlare", 0.46, 0.34, 0.14, (TX, TY, 1.29), CREAM, verts=20)
cone("TowerCab", 0.44, 0.32, 0.30, (TX, TY, 1.50), GLASS, verts=20)
for i in range(6):
    a = math.radians(i * 60)
    box("TowerMull%d" % i, (0.026, 0.05, 0.30),
        (TX + 0.40 * math.cos(a), TY + 0.40 * math.sin(a), 1.50), GOLD, rot=(0, 0, a + math.pi / 2))
cone("TowerEaves", 0.52, 0.34, 0.12, (TX, TY, 1.70), GOLD, verts=20)
cone("TowerCap", 0.32, 0.12, 0.16, (TX, TY, 1.84), CREAM, verts=20)
ball("TowerBall", 0.065, (TX, TY, 1.98), GOLD)
cyl("TowerAnt", 0.016, 0.22, (TX, TY, 2.11), GOLDD, verts=8)
ball("TowerTip", 0.026, (TX, TY, 2.24), GOLD, seg=10)

# 掛在立面金橫桿上的布旗（白飛機）
for sx in (-1, 1):
    x = sx * 0.76
    cyl("Rod%d" % sx, 0.020, 0.32, (x, -0.50, 1.32), GOLD, verts=8, rot=(0, math.pi / 2, 0))
    ball("RodL%d" % sx, 0.034, (x - 0.17, -0.50, 1.32), GOLD, seg=10)
    ball("RodR%d" % sx, 0.034, (x + 0.17, -0.50, 1.32), GOLD, seg=10)
    plate("Banner%d" % sx, (x, -0.52, 1.12), BLUE, 0.24, 0.36, 0.025, notch=0.08)
    plane_mark("Mark%d" % sx, (x, -0.545, 1.12), 0.28, 0.03, WHITE)

# 綠籬帶＋黃花、陶盆植栽
for sx in (-1, 1):
    box("HedgeCurb%d" % sx, (0.78, 0.30, 0.10), (sx * 0.62, -0.46, 0.19), CREAMD, bevel=0.02)
    box("Hedge%d" % sx, (0.74, 0.26, 0.22), (sx * 0.62, -0.46, 0.34), LEAF, bevel=0.06)
    for j in range(3):
        ball("Flower%d_%d" % (sx, j), 0.032, (sx * 0.62 - 0.22 + j * 0.22, -0.46, 0.47), FLOW, seg=8)
cyl("Pot", 0.13, 0.16, (0.52, -0.62, 0.24), POT, verts=14)
ball("PotBush", 0.13, (0.52, -0.62, 0.42), LEAFL, seg=12)

# 行李箱
box("CaseA", (0.21, 0.13, 0.30), (0.72, -0.66, 0.32), CBAG, bevel=0.035)
box("CaseAStrip", (0.225, 0.145, 0.035), (0.72, -0.66, 0.30), GOLDD)
cyl("CaseAHandle", 0.05, 0.02, (0.72, -0.66, 0.49), GOLDD, verts=12, rot=(math.pi / 2, 0, 0))
box("CaseB", (0.18, 0.11, 0.24), (0.92, -0.60, 0.29), CAYE, bevel=0.035)
cyl("CaseBHandle", 0.042, 0.02, (0.92, -0.60, 0.435), GOLDD, verts=12, rot=(math.pi / 2, 0, 0))

# ── 併成一張 mesh、歸零 ─────────────────────────────────────────────
meshes = [o for o in col.objects if o.type == 'MESH']
for o in bpy.context.selected_objects:
    o.select_set(False)
for o in meshes:
    o.hide_set(False); o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.convert(target='MESH')
for o in bpy.context.selected_objects:
    o.select_set(False)
meshes = [o for o in col.objects if o.type == 'MESH']
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
model = bpy.context.active_object
model.name = "RA_Airport"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = model.data
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
model.location = (-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))
bpy.context.view_layer.update()
bpy.ops.object.transform_apply(location=True)

# ── 渲染檢查 ────────────────────────────────────────────────────────
os.makedirs(SHOTS, exist_ok=True)
sc = bpy.context.scene
cam = bpy.data.objects.get("RA_Cam")
if cam is None:
    cu = bpy.data.cameras.new("RA_Cam"); cu.lens = 50
    cam = bpy.data.objects.new("RA_Cam", cu)
    sc.collection.objects.link(cam)
old_cam = sc.camera.name if sc.camera else ""
sc.camera = cam
def shot(eye, center, name, lens=50):
    cam.data.lens = lens; cam.location = eye
    cam.rotation_euler = (Vector(center) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(SHOTS, name)
    bpy.ops.render.render(write_still=True)
model.location = PARK
bpy.context.view_layer.update()
C = (PARK[0], PARK[1], 1.0)
shot((PARK[0] - 2.7, PARK[1] - 3.3, 2.7), C, "apt-1.png")
shot((PARK[0] + 3.1, PARK[1] - 3.4, 2.1), C, "apt-2.png")
shot((PARK[0], PARK[1] - 4.3, 1.9), (PARK[0], PARK[1], 1.05), "apt-3.png", lens=55)
model.location = (0, 0, 0)
bpy.context.view_layer.update()

bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True,
                          export_cameras=False, export_lights=False, export_yup=True,
                          use_mesh_edges=False)
if old_cam and bpy.data.objects.get(old_cam):
    sc.camera = bpy.data.objects[old_cam]
me = model.data
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
print("airport: %d 材質, x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f, GLB %d bytes"
      % (len(model.material_slots), min(xs), max(xs), min(ys), max(ys), min(zs), max(zs), os.path.getsize(GLB)))
