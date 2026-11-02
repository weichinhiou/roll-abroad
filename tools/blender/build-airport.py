# 出發航廈：Blender 建模 → 併網格 → 歸零 → 渲染 → 匯出 GLB。
# 在 Blender 裡跑：runpy.run_path(r"D:\\Git\\roll-abroad\\tools\\blender\\build-airport.py", run_name="__main__")
# 座標原點＝底座中心，-Y 是正面、+Z 是上。造型對照 docs/art-direction.md 的參考圖。
#
# 跟 build-venue.py 同一套「真開窗」做法：牆上挖洞（boolean）、暗部退 8~10 cm、
# 玻璃退 3~5 cm、框料突出 5~8 cm，最後才加線腳。平面貼玻璃會讀成貼圖，這樣才讀成開口的建築。
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
cut = bpy.data.collections.get("RA_AptCut")            # boolean 切口，不進模型
if cut is None:
    cut = bpy.data.collections.new("RA_AptCut")
    bpy.context.scene.collection.children.link(cut)
for ob in list(cut.objects):
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


CREAM = M("Cream", "FFF6E3", 0.85)
CREAMD = M("CreamDark", "EEDFC2", 0.9)
GOLD = M("Gold", "FFC33C", 0.3, 0.4)
GOLDD = M("GoldDeep", "E39A15", 0.4, 0.35)
GLASS = M("Glass", "2BAFEE", 0.1)
GLASSP = M("GlassPale", "BFE9FF", 0.18)
DARK = M("Interior", "16213B", 0.9)          # 窗内暗部：撐出深度的關鍵
STEEL = DARK                                  # 共用暗色，少一個 draw call（欄杆、輪子讀得出來就夠）
BOARD = DARK                                  # 航班看板也用暗色
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
    col.objects.link(o)
    o.data.materials.append(mat)
    if bevel > 0:
        md = o.modifiers.new("Bevel", 'BEVEL')
        md.width = bevel
        md.segments = 2
        md.limit_method = 'ANGLE'
    return o


def box(name, size, loc, mat, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return own(o, mat, bevel)


def cutbox(name, size, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = "CUT_" + name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    for c in o.users_collection:
        c.objects.unlink(o)
    cut.objects.link(o)
    return o


def boolean(host_name, cutter):
    md = bpy.data.objects[PFX + host_name].modifiers.new("Cut", 'BOOLEAN')
    md.solver = 'EXACT'
    md.operation = 'DIFFERENCE'
    md.object = cutter


def cyl(name, r, depth, loc, mat, verts=20, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return own(o, mat, bevel)


def cone(name, r1, r2, depth, loc, mat, verts=18):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2,
                                    depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    return own(o, mat)


def ball(name, r, loc, mat, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    return own(o, mat)


def torus(name, R, minor, loc, mat, rot=(0, 0, 0), mj=20, mi=6):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=minor,
                                     major_segments=mj, minor_segments=mi,
                                     location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    return own(o, mat)


def archXZ(name, R, minor, loc, mat, n=22, rotz=0.0, bres=2):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(n)
    for i in range(n + 1):
        a = math.pi * i / n
        sp.points[i].co = (R * math.cos(a), 0.0, R * math.sin(a), 1.0)
    cu.bevel_depth = minor
    cu.bevel_resolution = bres
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, 0, rotz)
    bpy.context.view_layer.objects.active = o
    for x in list(bpy.context.selected_objects):
        x.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return own(bpy.context.active_object, mat)


def half_cyl(name, R, depth, loc, mat, n=22, rot=(0, 0, 0)):
    bm = bmesh.new()
    y0, y1 = -depth / 2, depth / 2
    rows = []
    for i in range(n + 1):
        a = math.pi * i / n
        rows.append((bm.verts.new((R * math.cos(a), y0, R * math.sin(a))),
                     bm.verts.new((R * math.cos(a), y1, R * math.sin(a)))))
    for i in range(n):
        p, q = rows[i]
        r, s = rows[i + 1]
        bm.faces.new((p, q, s, r))
    bm.faces.new(list(reversed([p for p, q in rows])))
    bm.faces.new([q for p, q in rows])
    bm.faces.new((rows[0][0], rows[-1][0], rows[-1][1], rows[0][1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(PFX + name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(mat)
    return o


def plate(name, loc, mat, w, h, thick, notch=0.0):
    pts = [(-w / 2, h / 2), (w / 2, h / 2), (w / 2, -h / 2 + notch),
           (0, -h / 2), (-w / 2, -h / 2 + notch)]
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0, z)) for (x, z) in pts]
    bm.faces.new(vs)
    me = bpy.data.meshes.new(PFX + name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o)
    o.location = loc
    o.data.materials.append(mat)
    md = o.modifiers.new("Sol", 'SOLIDIFY')
    md.thickness = thick
    md.offset = 0
    return o


def plane_mark(name, loc, scale, thick, mat):
    """白色飛機剪影薄板（立在 XZ 面，機頭朝 +Z）"""
    pts = [(0.00, 0.34), (0.035, 0.26), (0.045, 0.08), (0.30, -0.02), (0.30, -0.09),
           (0.055, -0.05), (0.050, -0.17), (0.135, -0.235), (0.135, -0.30), (0.00, -0.275)]
    pts = pts + [(-x, z) for (x, z) in reversed(pts[1:-1])]
    bm = bmesh.new()
    vs = [bm.verts.new((x * scale, -thick / 2, z * scale)) for (x, z) in pts]
    bm.faces.new(vs)
    me = bpy.data.meshes.new(PFX + name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o)
    o.location = loc
    o.data.materials.append(mat)
    md = o.modifiers.new("Sol", 'SOLIDIFY')
    md.thickness = thick
    md.offset = 0
    return o


# ── 開真窗（跟 build-venue.py 同一層層做法）────────────────────────
def window(name, axis, sgn, wall, u, z, w, h, bars=1, host="Hall"):
    hw = w / 2
    hh = h / 2
    thru = 0.60
    if axis == 'X':
        c1 = cutbox(name + "C", (thru, w, h), (sgn * wall, u, z))
    else:
        c1 = cutbox(name + "C", (w, thru, h), (u, sgn * wall, z))

    def P(lateral, out, zz):
        return ((sgn * (wall + out), lateral, zz) if axis == 'X' else
                (lateral, sgn * (wall + out), zz))

    def S(along, thick, tall):
        return ((thick, along, tall) if axis == 'X' else (along, thick, tall))

    box(name + "Back", S(w + 0.12, 0.02, h + 0.10), P(u, -0.09, z), DARK)
    box(name + "Glass", S(w - 0.05, 0.02, h - 0.05), P(u, -0.03, z), GLASS)
    for s2 in (-1, 1):
        box(name + "Jam%d" % s2, S(0.07, 0.10, h + 0.10),
            P(u + s2 * (hw + 0.035), 0.025, z), CREAMD, bevel=0.01)
    box(name + "Head", S(w + 0.24, 0.10, 0.08), P(u, 0.025, z + hh + 0.09), CREAMD, bevel=0.01)
    box(name + "Sill", S(w + 0.24, 0.15, 0.055), P(u, 0.045, z - hh - 0.05), CREAMD, bevel=0.012)
    box(name + "Drip", S(w + 0.18, 0.06, 0.02), P(u, 0.02, z - hh - 0.095), GOLDD)
    for i in range(bars):
        off = (i + 1) * w / (bars + 1) - hw
        box(name + "Bar%d" % i, S(0.028, 0.05, h - 0.06), P(u + off, -0.005, z), GOLD)
    box(name + "Rail", S(w - 0.05, 0.05, 0.026), P(u, -0.005, z + h * 0.18), GOLD)
    boolean(host, c1)


# ── 底座與舖面 ──────────────────────────────────────────────────────
box("Base", (2.44, 1.44, 0.10), (0, 0.02, 0.05), PLINTH, bevel=0.05)
box("Plaza", (2.24, 1.26, 0.06), (0, 0.02, 0.13), PAVE, bevel=0.03)
box("Walk", (0.86, 0.44, 0.03), (0, -0.68, 0.175), PAVE, bevel=0.02)
box("Mat", (0.60, 0.26, 0.012), (0, -0.66, 0.192), BOARD)          # 門口地墊

# 主體航廈：牆面開真窗，兩側翼也開窗
box("Hall", (1.60, 0.80, 0.70), (0, -0.02, 0.50), CREAM, bevel=0.03)
for sx in (-1, 1):
    box("Wing%d" % sx, (0.42, 0.66, 0.46), (sx * 1.00, 0.02, 0.38), CREAM, bevel=0.03)
    box("WingRoof%d" % sx, (0.48, 0.72, 0.05), (sx * 1.00, 0.02, 0.63), GOLD)
    window("WingWin%d" % sx, 'X', sx, 1.21, 0.02, 0.40, 0.24, 0.22, host="Wing%d" % sx)
for i, x in enumerate((-0.52, 0.52)):                               # 山牆小窗（避免大空牆）
    box("GableWin%d" % i, (0.05, 0.22, 0.22), (x, -0.20, 0.60), GLASS)
    box("GableWinF%d" % i, (0.06, 0.28, 0.28), (x, -0.19, 0.60), GOLD)
box("Cornice", (2.62, 0.98, 0.13), (0, -0.02, 0.885), GOLD)
box("CorniceShadow", (2.56, 0.94, 0.02), (0, -0.02, 0.815), GOLDD)  # 簷下陰影線
# 屋頂面改奶油＋金壓邊：俯角看到的就是這一塊，不要整片金
box("RoofDeck", (2.46, 0.88, 0.04), (0, -0.02, 0.965), CREAM)
box("RoofEdge", (2.52, 0.94, 0.02), (0, -0.02, 0.95), GOLDD)
for i, sx in enumerate((-1, 1)):                                   # 屋頂兩側的設備（中間被玻璃桶頂佔掉）
    box("RoofUnit%d" % i, (0.24, 0.26, 0.13), (sx * 1.02, 0.18, 1.05), CREAMD, bevel=0.02)
    box("RoofUnitGrill%d" % i, (0.18, 0.20, 0.02), (sx * 1.02, 0.18, 1.12), GOLDD)
    box("RoofVent%d" % i, (0.11, 0.11, 0.10), (sx * 0.82, -0.26, 1.03), GOLDD)
    box("RoofPipe%d" % i, (0.05, 0.05, 0.22), (sx * 1.16, -0.10, 1.09), GOLDD)
    ball("RoofDome%d" % i, 0.07, (sx * 0.78, 0.24, 1.00), GLASSP, sub=1)           # 採光罩

# 正面玻璃帷幕：暗部 → 退後玻璃 → 突出的白框架與石柱
box("CurtBack", (1.62, 0.02, 0.52), (0, -0.425, 0.52), DARK)
box("CurtGlass", (1.62, 0.02, 0.52), (0, -0.455, 0.52), GLASS)
for i in range(6):
    x = -0.605 + i * 0.242
    box("Mullion%d" % i, (0.055, 0.075, 0.54), (x, -0.49, 0.52), WHITE)
box("Transom", (1.62, 0.075, 0.055), (0, -0.49, 0.66), WHITE)
box("CurtBase", (1.68, 0.14, 0.12), (0, -0.47, 0.22), CREAMD, bevel=0.02)
box("CurtBaseDrip", (1.64, 0.10, 0.02), (0, -0.49, 0.155), GOLDD)
for i in (0, 1):                                                    # 柱頭金帽
    box("ColCap%d" % i, (0.10, 0.10, 0.05), ((-1) ** i * 0.83, -0.49, 0.815), GOLDD)
    box("Col%d" % i, (0.08, 0.09, 0.60), ((-1) ** i * 0.83, -0.49, 0.50), CREAM)

# 入口：真開洞＋退後玻璃門＋金框＋號誌
cutbox("DoorC", (0.86, 0.60, 0.62), (0, -0.30, 0.47))
boolean("Hall", bpy.data.objects["CUT_DoorC"])
box("DoorBack", (0.90, 0.02, 0.66), (0, -0.28, 0.52), DARK)
for sx in (-1, 1):                                                  # 兩片自動門，退牆面 6 cm
    box("Door%d" % sx, (0.40, 0.04, 0.58), (sx * 0.21, -0.47, 0.47), GLASSP)
    box("DoorFrame%d" % sx, (0.44, 0.05, 0.62), (sx * 0.21, -0.482, 0.47), GOLD)
    box("DoorGlass%d" % sx, (0.30, 0.02, 0.40), (sx * 0.21, -0.505, 0.52), GLASS)
    box("DoorBar%d" % sx, (0.30, 0.03, 0.035), (sx * 0.21, -0.512, 0.40), STEEL)
box("DoorMid", (0.04, 0.08, 0.62), (0, -0.485, 0.47), GOLD)
box("DoorSill", (0.98, 0.24, 0.045), (0, -0.52, 0.175), GOLDD)
archXZ("DoorArch", 0.50, 0.05, (0, -0.50, 0.80), GOLD)
box("DoorArchKey", (0.12, 0.10, 0.14), (0, -0.52, 1.29), GOLD)
box("Board", (0.46, 0.04, 0.26), (0.62, -0.505, 0.74), BOARD)       # 航班看板
for i in range(3):
    box("BoardLine%d" % i, (0.36 - i * 0.06, 0.02, 0.022),
        (0.62, -0.528, 0.82 - i * 0.055), WHITE)
box("BoardFrame", (0.50, 0.03, 0.30), (0.62, -0.515, 0.74), GOLDD)
box("SignL", (0.20, 0.03, 0.14), (-0.62, -0.505, 0.74), BLUE)       # 出發牌
box("SignLBar", (0.14, 0.02, 0.022), (-0.62, -0.522, 0.77), WHITE)
box("SignArrow", (0.11, 0.02, 0.022), (-0.62, -0.522, 0.705), WHITE,
    rot=(0, math.radians(-32), 0))                                 # 出發牌箭頭：小板上比飛機剪影好讀

# 雨遮（有坡度）＋灯＋拉杆
box("Canopy", (1.24, 0.46, 0.06), (0, -0.62, 0.96), GOLD, bevel=0.02, rot=(-math.radians(9), 0, 0))
box("Fascia", (1.24, 0.05, 0.11), (0, -0.835, 0.925), GOLDD)
for i in range(3):
    ball("Lamp%d" % i, 0.028, (-0.32 + i * 0.32, -0.79, 0.905), WHITE, sub=1)
for sx in (-1, 1):                                                  # 雨遮拉杆
    box("Tie%d" % sx, (0.035, 0.30, 0.035), (sx * 0.50, -0.66, 1.03), GOLDD,
        rot=(math.radians(38), 0, 0))

# 玻璃桶狀拱頂：暗部 → 玻璃 → 金肋＋縱向金條＋天窗
VR, VZ, VLEN, VY = 0.62, 0.95, 0.92, -0.02
half_cyl("VaultIn", VR - 0.04, VLEN - 0.04, (0, VY, VZ), DARK)
half_cyl("Vault", VR, VLEN, (0, VY, VZ), GLASS)
for i, yy in enumerate((-0.34, -0.12, 0.12, 0.34)):
    archXZ("Rib%d" % i, VR + 0.02, 0.032, (0, VY + yy, VZ), GOLD)
for a_deg in (30, 60, 120, 150):                                    # 90° 讓給屋脊採光帶
    a = math.radians(a_deg)
    cyl("Long%d" % a_deg, 0.022, VLEN, (VR * math.cos(a), VY, VZ + VR * math.sin(a)),
        GOLD, verts=8, rot=(math.pi / 2, 0, 0))
box("RidgeLight", (0.20, VLEN - 0.06, 0.05), (0, VY, VZ + VR - 0.01), GLASSP)   # 屋脊採光帶
for sx in (-1, 1):
    box("RidgeRail%d" % sx, (0.035, VLEN - 0.02, 0.07), (sx * 0.115, VY, VZ + VR - 0.02), GOLD)
for sx in (-1, 1):                                                  # 天溝與落水口
    box("Gutter%d" % sx, (0.09, VLEN, 0.07), (sx * (VR - 0.02), VY, VZ + 0.02), GOLDD)
    box("Spout%d" % sx, (0.07, 0.07, 0.20), (sx * (VR - 0.02), -0.42, VZ - 0.10), GOLDD)

# 正立面：金半圓山牆＋白飛機（金底白飛機，與參考圖一致）
half_cyl("Gable", 0.60, 0.06, (0, -0.47, VZ), GOLD, n=22)
archXZ("FacadeArch", 0.665, 0.085, (0, -0.475, VZ), GOLD)
box("GableSill", (1.42, 0.12, 0.07), (0, -0.47, VZ + 0.01), GOLD)
plane_mark("Emblem", (0, -0.52, VZ + 0.30), 0.60, 0.06, WHITE)
for sx in (-1, 1):                                                  # 翼樓正面的通風柵（貼在翼樓牆上，不飄在山牆前）
    box("Louver%d" % sx, (0.16, 0.04, 0.14), (sx * 1.00, -0.325, 0.52), GOLDD)
    for k in range(3):
        box("LouverBar%d_%d" % (sx, k), (0.13, 0.02, 0.016),
            (sx * 1.00, -0.348, 0.48 + k * 0.042), STEEL)

# 管制塔（粗短、寬玻璃艙、金簷；艙內給暗部才讀得出玻璃）
TX, TY = -0.80, 0.16
cyl("TowerShaft", 0.28, 1.00, (TX, TY, 0.72), CREAM, verts=20)
box("TowerWin", (0.15, 0.04, 0.26), (TX, -0.06, 0.46), GLASS)
box("TowerWinF", (0.21, 0.05, 0.32), (TX, -0.05, 0.46), GOLD)
box("TowerStripe", (0.10, 0.02, 0.52), (TX, -0.075, 0.80), BLUE)
cyl("TowerBand", 0.32, 0.08, (TX, TY, 1.06), GOLD, verts=20)
cone("TowerFlare", 0.46, 0.34, 0.14, (TX, TY, 1.29), CREAM, verts=20)
cone("TowerCabIn", 0.43, 0.31, 0.30, (TX, TY, 1.50), DARK, verts=20)
cone("TowerCab", 0.44, 0.32, 0.30, (TX, TY, 1.50), GLASS, verts=20)
for i in range(6):
    a = math.radians(i * 60)
    box("TowerMull%d" % i, (0.03, 0.06, 0.30),
        (TX + 0.40 * math.cos(a), TY + 0.40 * math.sin(a), 1.50), GOLD,
        rot=(0, 0, a + math.pi / 2))
torus("TowerRail", 0.50, 0.018, (TX, TY, 1.375), GOLD, rot=(math.pi / 2, 0, 0), mj=18, mi=5)
for i in range(8):
    a = math.radians(i * 45)
    cyl("TowerRailPost%d" % i, 0.012, 0.09,
        (TX + 0.50 * math.cos(a), TY + 0.50 * math.sin(a), 1.33), GOLD, verts=6)
cone("TowerEaves", 0.52, 0.34, 0.12, (TX, TY, 1.70), GOLD, verts=20)
cone("TowerCap", 0.32, 0.12, 0.16, (TX, TY, 1.84), CREAM, verts=20)
ball("TowerBall", 0.065, (TX, TY, 1.98), GOLD, sub=1)
cyl("TowerAnt", 0.016, 0.22, (TX, TY, 2.11), GOLDD, verts=8)
ball("TowerTip", 0.026, (TX, TY, 2.24), GOLD, sub=1)
cyl("RadarMast", 0.016, 0.18, (TX + 0.24, TY + 0.16, 1.45), GOLDD, verts=8)   # 平台上的雷達：有腳才不飄
cone("RadarDish", 0.085, 0.02, 0.05, (TX + 0.24, TY + 0.16, 1.55), STEEL, verts=12)
torus("TowerRadar", 0.085, 0.010, (TX + 0.24, TY + 0.16, 1.58), STEEL,
       rot=(math.radians(65), 0, 0), mj=14, mi=4)

# 掛在立面金橫桿上的布旗（白飛機）
for sx in (-1, 1):
    x = sx * 0.76
    cyl("Rod%d" % sx, 0.020, 0.32, (x, -0.50, 1.32), GOLD, verts=8, rot=(0, math.pi / 2, 0))
    ball("RodL%d" % sx, 0.034, (x - 0.17, -0.50, 1.32), GOLD, sub=1)
    ball("RodR%d" % sx, 0.034, (x + 0.17, -0.50, 1.32), GOLD, sub=1)
    plate("Banner%d" % sx, (x, -0.52, 1.12), BLUE, 0.24, 0.36, 0.025, notch=0.08)
    plane_mark("Mark%d" % sx, (x, -0.545, 1.12), 0.28, 0.03, WHITE)

# 綠籬帶＋黃花、陶盆植栽
for sx in (-1, 1):
    box("HedgeCurb%d" % sx, (0.78, 0.30, 0.10), (sx * 0.62, -0.46, 0.19), CREAMD, bevel=0.02)
    box("Hedge%d" % sx, (0.74, 0.26, 0.09), (sx * 0.62, -0.46, 0.285), LEAF, bevel=0.04)   # 壓低，別擋住玻璃帷幕
    for j in range(3):
        ball("Flower%d_%d" % (sx, j), 0.028, (sx * 0.62 - 0.22 + j * 0.22, -0.46, 0.355),
             FLOW, sub=1)
cyl("Pot", 0.13, 0.16, (0.52, -0.62, 0.24), POT, verts=14)
box("PotRim", (0.28, 0.28, 0.03), (0.52, -0.62, 0.32), POT)
ball("PotBush", 0.13, (0.52, -0.62, 0.42), LEAFL, sub=2)

# 行李箱（加輪子與拉桿才不像方塊）
for i, (x, y, s, m) in enumerate([(0.72, -0.66, 1.00, CBAG), (0.92, -0.60, 0.82, CAYE)]):
    box("Case%d" % i, (0.21 * s, 0.13 * s, 0.30 * s), (x, y, 0.17 + 0.15 * s), m, bevel=0.035)
    box("CaseStrip%d" % i, (0.225 * s, 0.145 * s, 0.035 * s), (x, y, 0.15 + 0.14 * s), GOLDD)
    cyl("CaseHandle%d" % i, 0.05 * s, 0.02, (x, y, 0.17 + 0.31 * s), GOLDD, verts=12,
        rot=(math.pi / 2, 0, 0))
    box("CaseBar%d" % i, (0.03, 0.02, 0.09 * s), (x - 0.05, y, 0.19 + 0.33 * s), STEEL)
    box("CaseBarB%d" % i, (0.03, 0.02, 0.09 * s), (x + 0.05, y, 0.19 + 0.33 * s), STEEL)
    for sx in (-1, 1):
        cyl("CaseWheel%d_%d" % (i, sx), 0.022, 0.02,
            (x + sx * 0.06 * s, y, 0.19), STEEL, verts=8, rot=(0, math.pi / 2, 0))

# ── 併成一張 mesh、歸零 ─────────────────────────────────────────────
meshes = [o for o in col.objects if o.type == 'MESH']
for o in bpy.context.selected_objects:
    o.select_set(False)
for o in meshes:
    o.hide_set(False)
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.convert(target='MESH')            # 套用 Bevel / Solidify / Boolean
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
xs = [v.co.x for v in me.vertices]
ys = [v.co.y for v in me.vertices]
zs = [v.co.z for v in me.vertices]
model.location = (-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))
bpy.context.view_layer.update()
bpy.ops.object.transform_apply(location=True)

# ── 渲染檢查（暫時移開別人的模型）───────────────────────────────────
os.makedirs(SHOTS, exist_ok=True)
sc = bpy.context.scene
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


model.location = PARK
bpy.context.view_layer.update()
C = Vector(PARK) + Vector((0, 0, 1.0))
shot((PARK[0] - 2.7, PARK[1] - 3.3, 2.7), C, "apt-1.png")
shot((PARK[0] + 3.1, PARK[1] - 3.4, 2.1), C, "apt-2.png")
shot((PARK[0], PARK[1] - 4.3, 1.9), (PARK[0], PARK[1], 1.05), "apt-3.png", lens=55)
shot((PARK[0] - 1.6, PARK[1] - 2.6, 1.2), (PARK[0] + 0.1, PARK[1], 0.6), "apt-4.png", lens=70)
shot((PARK[0] + 0.6, PARK[1] - 1.4, 4.4), (PARK[0], PARK[1], 0.6), "apt-5.png", lens=50)  # 俯角
model.location = (0, 0, 0)
bpy.context.view_layer.update()

bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True,
                          export_cameras=False, export_lights=False, export_yup=True,
                          use_mesh_edges=False)
if old_cam and bpy.data.objects.get(old_cam):
    sc.camera = bpy.data.objects[old_cam]
me = model.data
xs = [v.co.x for v in me.vertices]
ys = [v.co.y for v in me.vertices]
zs = [v.co.z for v in me.vertices]
print("airport: %d 材質, x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f, GLB %d bytes"
      % (len(model.material_slots), min(xs), max(xs), min(ys), max(ys),
         min(zs), max(zs), os.path.getsize(GLB)))
