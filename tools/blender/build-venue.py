# 國際會場（紫穹頂）：Blender 建模 → 併網格 → 歸零 → 渲染 → 匯出 GLB。
# 在 Blender 裡跑：runpy.run_path(r"D:\Git\roll-abroad\tools\blender\build-venue.py", run_name="__main__")
# 改造型就改這支再重跑，GLB 是產物；座標原點＝底座中心，-Y 是正面、+Z 是上。
import bpy, bmesh, math, os

PFX, MPFX = "RA_VEN_", "RA_V_"
GLB = r"D:/Git/roll-abroad/assets/art/international-venue.glb"
SHOTS = r"C:/Users/office/AppData/Local/Temp/opencode/blender"
PARK = (0.0, 90.0, 0.0)          # 渲染時暫時移到這裡，避開同一檔案裡別人的模型

# ── 清乾淨 ─────────────────────────────────────────────────────────
for ob in list(bpy.data.objects):
    if ob.name.startswith(PFX) or ob.name == "RA_Venue":
        bpy.data.objects.remove(ob, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith(MPFX):
        bpy.data.materials.remove(m)
col = bpy.data.collections.get("RA_Venue")
if col is None:
    col = bpy.data.collections.new("RA_Venue")
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
PURPLE = M("Purple", "6C4FD1", 0.55)
PURPLEL = M("PurpleLite", "8E72E8", 0.5)
LILAC = M("Lilac", "C9A8F0", 0.8)
BLUE = M("Banner", "2A7FD4", 0.6)
GLASS = M("Glass", "2BAFEE", 0.1)
GLASSP = M("GlassPale", "BFE9FF", 0.18)
WHITE = M("White", "FFFFFF", 0.55)
PLINTH = M("Plinth", "E6D8BC", 0.95)
PAVE = M("Paving", "F8F1E0", 0.95)
CARPET = M("Carpet", "7A57E0", 0.85)
LEAF = M("Leaf", "2F9C55", 0.85)
LEAFL = M("LeafLite", "6FC94A", 0.85)

def own(o, mat, bevel=0.0):
    o.name = PFX + o.name
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o); o.data.materials.append(mat)
    if bevel > 0:
        md = o.modifiers.new("Bevel", 'BEVEL')
        md.width = bevel; md.segments = 3; md.limit_method = 'ANGLE'
    return o

def box(name, size, loc, mat, bevel=0.0, rotz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    if rotz:
        o.rotation_euler = (0, 0, rotz)
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

def torus(name, R, minor, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=minor, major_segments=28,
                                     minor_segments=8, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.shade_smooth()
    return own(o, mat)

def shell(name, R, loc, mat, n=32, m=8):
    """半球（開口朝下）"""
    bm = bmesh.new(); rings = []
    for i in range(m):
        phi = math.pi / 2 * i / m; ring = []
        for j in range(n):
            th = 2 * math.pi * j / n
            ring.append(bm.verts.new((R * math.cos(phi) * math.cos(th),
                                      R * math.cos(phi) * math.sin(th),
                                      R * math.sin(phi))))
        rings.append(ring)
    top = bm.verts.new((0, 0, R))
    for i in range(m - 1):
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new((rings[i][j], rings[i][k], rings[i+1][k], rings[i+1][j]))
    for j in range(n):
        k = (j + 1) % n
        bm.faces.new((rings[-1][j], rings[-1][k], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(PFX + name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o); o.location = loc; o.data.materials.append(mat)
    return o

def half_cyl(name, R, depth, loc, mat, n=22):
    """半圓筒，軸沿 Y、留上半部（拱窗、桶頂、半圓玻璃帷幕）"""
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
    """立起來的半圓拱（XZ 面），可做拱肋／拱框"""
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
    """立板（XZ 面），可做 V 形下緣的吊旗"""
    pts = [(-w/2, h/2), (w/2, h/2), (w/2, -h/2 + notch), (0, -h/2), (-w/2, -h/2 + notch)]
    bm = bmesh.new(); vs = [bm.verts.new((x, 0, z)) for (x, z) in pts]; bm.faces.new(vs)
    me = bpy.data.meshes.new(PFX + name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o); o.location = loc; o.data.materials.append(mat)
    md = o.modifiers.new("Sol", 'SOLIDIFY'); md.thickness = thick; md.offset = 0
    return o

# ── 建模 ───────────────────────────────────────────────────────────
# 底座、舖面、兩階加上紫地毯（金邊）
box("Base", (2.34, 1.78, 0.10), (0, 0.02, 0.05), PLINTH, bevel=0.05)
box("Plaza", (2.14, 1.60, 0.06), (0, 0.02, 0.13), PAVE, bevel=0.03)
box("Step0", (1.34, 0.18, 0.055), (0, -0.80, 0.185), CREAMD, bevel=0.015)
box("Step1", (1.10, 0.18, 0.055), (0, -0.64, 0.240), CREAMD, bevel=0.015)
box("Carpet0", (0.62, 0.19, 0.02), (0, -0.80, 0.223), CARPET, bevel=0.005)
box("Carpet1", (0.62, 0.19, 0.02), (0, -0.64, 0.278), CARPET, bevel=0.005)
box("Carpet2", (0.62, 0.30, 0.02), (0, -0.32, 0.170), CARPET, bevel=0.005)
for nm, y, z in (("Carpet0", -0.80, 0.225), ("Carpet1", -0.64, 0.280)):
    for sx in (-1, 1):
        box(nm + "Trim%d" % sx, (0.045, 0.19, 0.022), (sx * 0.33, y, z), GOLD)

# 主體、紫色飾帶、紫屋頂與金女兒牆
box("Hall", (1.80, 1.12, 0.90), (0, 0.18, 0.60), CREAM, bevel=0.03)
box("Frieze", (1.86, 1.18, 0.10), (0, 0.18, 1.10), PURPLEL)
box("Roof", (1.94, 1.26, 0.09), (0, 0.18, 1.19), PURPLE)
for i in range(2):
    box("RoofPanel%d" % i, (0.62, 0.42, 0.02), ((-1) ** i * 0.52, 0.18, 1.245), PURPLEL)
box("ParapetF", (1.98, 0.06, 0.13), (0, -0.42, 1.28), CREAM, bevel=0.02)
box("ParapetB", (1.98, 0.06, 0.13), (0, 0.78, 1.28), CREAM, bevel=0.02)
box("ParapetGoldF", (2.00, 0.07, 0.035), (0, -0.42, 1.35), GOLD)
box("ParapetGoldB", (2.00, 0.07, 0.035), (0, 0.78, 1.35), GOLD)
for sx in (-1, 1):
    box("ParapetS%d" % sx, (0.06, 1.26, 0.13), (sx * 0.97, 0.18, 1.28), CREAM, bevel=0.02)
    box("ParapetGoldS%d" % sx, (0.075, 1.28, 0.035), (sx * 0.97, 0.18, 1.35), GOLD)

# 鼓座、玻璃帶、金環
cyl("Drum", 0.52, 0.34, (0, 0.18, 1.40), CREAM, verts=28)
cyl("DrumGlass", 0.535, 0.20, (0, 0.18, 1.40), GLASSP, verts=28)
for i in range(8):
    a = math.radians(i * 45)
    box("DrumMull%d" % i, (0.028, 0.05, 0.22),
        (0.535 * math.cos(a), 0.18 + 0.535 * math.sin(a), 1.40), GOLD, rotz=a + math.pi / 2)
cyl("DrumRing", 0.58, 0.08, (0, 0.18, 1.565), GOLD, verts=28, bevel=0.015)

# 紫穹頂、金肋
shell("Dome", 0.58, (0, 0.18, 1.60), PURPLEL)
for i, deg in enumerate((0, 45, 90, 135)):
    rib = archXZ("DomeRib%d" % i, 0.592, 0.021, (0, 0.18, 1.60), GOLD)
    rib.rotation_euler = (0, 0, math.radians(deg))
cyl("DomeCollar", 0.60, 0.05, (0, 0.18, 1.615), GOLD, verts=28)

# 金線地球儀頂飾
GZ = 2.34
cyl("GlobeStem", 0.022, 0.16, (0, 0.18, 2.22), GOLDD, verts=10)
ball("GlobeCore", 0.055, (0, 0.18, GZ), GOLD, seg=14)
torus("GlobeEq", 0.165, 0.019, (0, 0.18, GZ), GOLD, rot=(math.pi / 2, 0, 0))
torus("GlobeMer1", 0.165, 0.019, (0, 0.18, GZ), GOLD)
torus("GlobeMer2", 0.165, 0.019, (0, 0.18, GZ), GOLD, rot=(0, math.pi / 2, 0))
torus("GlobeRing", 0.205, 0.014, (0, 0.18, GZ), GOLDD, rot=(math.pi / 2, 0, math.radians(28)))
ball("GlobeTip", 0.026, (0, 0.18, GZ + 0.19), GOLD, seg=10)

# 屋頂四角旗桿
for i, (x, m) in enumerate([(-0.78, PURPLE), (-0.52, PURPLE), (0.52, BLUE), (0.78, BLUE)]):
    cyl("RFpole%d" % i, 0.018, 0.46, (x, -0.30, 1.55), GOLD, verts=8)
    ball("RFtop%d" % i, 0.032, (x, -0.30, 1.79), GOLD, seg=10)
    box("RFflag%d" % i, (0.16, 0.02, 0.11), (x + (0.09 if x < 0 else -0.09), -0.30, 1.70), m, bevel=0.008)

# 前廊四柱與額枋
for i, x in enumerate((-0.74, -0.25, 0.25, 0.74)):
    cyl("ColBase%d" % i, 0.10, 0.07, (x, -0.60, 0.235), GOLDD, verts=16)
    cyl("Col%d" % i, 0.072, 0.68, (x, -0.60, 0.61), CREAM, verts=16)
    cyl("ColNeck%d" % i, 0.076, 0.10, (x, -0.60, 0.61), CREAMD, verts=16)
    cyl("ColCap%d" % i, 0.104, 0.075, (x, -0.60, 0.985), GOLD, verts=16)
box("Entablature", (1.78, 0.36, 0.11), (0, -0.60, 1.075), GOLD, bevel=0.02)
box("Architrave", (1.72, 0.30, 0.05), (0, -0.60, 1.015), GOLDD)

# 立面牆＋玻璃雙開門（門不懸空）
box("Facade", (1.72, 0.12, 0.92), (0, -0.52, 0.61), CREAM, bevel=0.02)
box("FacadeBase", (1.76, 0.14, 0.12), (0, -0.52, 0.21), CREAMD, bevel=0.02)
box("DoorGlass", (0.70, 0.05, 0.60), (0, -0.60, 0.53), GLASSP)
box("DoorMid", (0.045, 0.06, 0.60), (0, -0.63, 0.53), GOLD)
for sx in (-1, 1):
    box("DoorFrame%d" % sx, (0.055, 0.06, 0.64), (sx * 0.375, -0.63, 0.54), GOLD)
box("Fanlight", (0.86, 0.05, 0.09), (0, -0.62, 0.87), GLASSP)
box("DoorHdl", (0.10, 0.03, 0.02), (0.10, -0.66, 0.53), GOLD)

# 半圓拱玻璃帷幕：淺碟狀貼牆，金格線依拱圓裁短
Z0, R = 1.10, 0.74
box("ArchBack", (1.50, 0.06, 0.78), (0, -0.46, 1.44), GLASSP)
half_cyl("ArchGlass", R, 0.13, (0, -0.52, Z0), GLASS)
for i in range(5):
    lx = -0.60 + i * 0.30
    h = max(0.14, math.sqrt(max(R * R - lx * lx, 0.0)) - 0.04)
    box("ArchMull%d" % i, (0.030, 0.045, h), (lx, -0.600, Z0 + h / 2), GOLD)
box("ArchRail0", (1.34, 0.045, 0.032), (0, -0.600, 1.32), GOLD)
box("ArchRail1", (0.82, 0.045, 0.032), (0, -0.600, 1.58), GOLD)
archXZ("ArchCream", 0.80, 0.072, (0, -0.56, Z0), CREAM)
archXZ("ArchGold", 0.74, 0.026, (0, -0.604, Z0), GOLD)
box("ArchSill", (1.80, 0.22, 0.06), (0, -0.50, 1.09), CREAMD)

# 兩側拱窗
for sx in (-1, 1):
    for k, y in enumerate((-0.16, 0.34)):
        x = sx * 0.905
        box("Win%d%d" % (sx, k), (0.05, 0.24, 0.38), (x, y, 0.60), GLASS)
        half_cyl("WinArch%d%d" % (sx, k), 0.12, 0.24, (x, y, 0.79), GLASS, n=14)
        box("WinFrame%d%d" % (sx, k), (0.055, 0.30, 0.05), (x - sx * 0.004, y, 0.41), CREAMD)
        box("WinJamA%d%d" % (sx, k), (0.055, 0.05, 0.46), (x - sx * 0.004, y - 0.14, 0.60), CREAMD)
        box("WinJamB%d%d" % (sx, k), (0.055, 0.05, 0.46), (x - sx * 0.004, y + 0.14, 0.60), CREAMD)

# 兩面紫吊旗：金橫桿、V 形下緣、白地球標誌
for sx in (-1, 1):
    x = sx * 1.02
    cyl("BRod%d" % sx, 0.022, 0.34, (x, -0.66, 1.26), GOLD, verts=8, rot=(0, math.pi / 2, 0))
    ball("BRodL%d" % sx, 0.035, (x - 0.18, -0.66, 1.26), GOLD, seg=10)
    ball("BRodR%d" % sx, 0.035, (x + 0.18, -0.66, 1.26), GOLD, seg=10)
    plate("Banner%d" % sx, (x, -0.68, 1.05), PURPLE, 0.28, 0.40, 0.025, notch=0.09)
    box("BannerTop%d" % sx, (0.30, 0.03, 0.035), (x, -0.685, 1.24), GOLD)
    cyl("BGdisc%d" % sx, 0.086, 0.02, (x, -0.695, 1.09), WHITE, verts=20, rot=(math.pi / 2, 0, 0))
    torus("BGlat%d" % sx, 0.070, 0.007, (x, -0.708, 1.09), GOLD, rot=(math.pi / 2, 0, 0))
    torus("BGmer%d" % sx, 0.070, 0.007, (x, -0.708, 1.09), GOLD)
    torus("BGmer2%d" % sx, 0.042, 0.006, (x, -0.710, 1.09), GOLD, rot=(0, math.pi / 2, 0))

# 花圃：矮槽、圓錐修頂樹、灌木、繡球花
for i, (x, y) in enumerate([(-1.06, -0.52), (1.06, -0.52), (-0.98, 0.62), (0.98, 0.62)]):
    box("Planter%d" % i, (0.40, 0.36, 0.20), (x, y, 0.26), CREAM, bevel=0.03)
    box("Soil%d" % i, (0.32, 0.28, 0.03), (x, y, 0.365), GOLDD)
    cone("Topiary%d" % i, 0.11, 0.02, 0.34, (x - 0.08, y - 0.04, 0.53), LEAF, verts=14)
    ball("Hedge%d" % i, 0.09, (x + 0.10, y + 0.06, 0.46), LEAFL, seg=12)
    for j, (dx, dz) in enumerate([(-0.02, 0.46), (0.06, 0.50), (-0.09, 0.50), (0.0, 0.55)]):
        ball("Hydra%d_%d" % (i, j), 0.045, (x + dx, y - 0.02, dz), LILAC, seg=8)

# ── 併成一張 mesh、歸零 ─────────────────────────────────────────────
meshes = [o for o in col.objects if o.type == 'MESH']
for o in bpy.context.selected_objects:
    o.select_set(False)
for o in meshes:
    o.hide_set(False); o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.convert(target='MESH')            # 套用 Bevel / Solidify
for o in bpy.context.selected_objects:
    o.select_set(False)
meshes = [o for o in col.objects if o.type == 'MESH']
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
model = bpy.context.active_object
model.name = "RA_Venue"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = model.data
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
model.location = (-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))
bpy.context.view_layer.update()
bpy.ops.object.transform_apply(location=True)

# ── 渲染檢查（暫時移開別人的模型）───────────────────────────────────
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
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(SHOTS, name)
    bpy.ops.render.render(write_still=True)
from mathutils import Vector
model.location = PARK
bpy.context.view_layer.update()
C = Vector(PARK) + Vector((0, 0, 1.1))
shot((PARK[0] - 2.9, PARK[1] - 3.4, 3.0), C, "venue-1.png")
shot((PARK[0]+3.2, PARK[1]-3.3, 2.3), C, "venue-2.png")
shot((PARK[0], PARK[1]-4.4, 2.0), Vector(PARK) + Vector((0, 0, 1.15)), "venue-3.png", lens=55)
model.location = (0, 0, 0)
bpy.context.view_layer.update()

bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True,
                          export_cameras=False, export_lights=False, export_yup=True,
                          use_mesh_edges=False)
if old_cam and bpy.data.objects.get(old_cam):
    sc.camera = bpy.data.objects[old_cam]
me = model.data
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
print("venue: %d 材質, x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f, GLB %d bytes"
      % (len(model.material_slots), min(xs), max(xs), min(ys), max(ys), min(zs), max(zs), os.path.getsize(GLB)))
