# 國際會場（紫穹頂）：Blender 建模 → 併網格 → 歸零 → 渲染 → 匯出 GLB。
# 在 Blender 裡跑：runpy.run_path(r"D:\Git\roll-abroad\tools\blender\build-venue.py", run_name="__main__")
# 改造型就改這支再重跑，GLB 是產物；座標原點＝底座中心，-Y 是正面、+Z 是上。
#
# 造型重點（Jean 回饋「門窗像貼上去」）：門窗一律做成有進深的組件——
# 牆上開真洞（boolean）、暗色室內退 8~10 cm、玻璃退 3 cm、石框突出 5 cm、
# 再加窗台＋滴水線＋拱心石，縮圖下才有厚度而不是貼圖。
import bpy, bmesh, math, os
from mathutils import Vector

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
cut = bpy.data.collections.get("RA_VenueCut")          # boolean 用的切口，不進模型
if cut is None:
    cut = bpy.data.collections.new("RA_VenueCut")
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
PURPLE = M("Purple", "6C4FD1", 0.55)
PURPLEL = M("PurpleLite", "8E72E8", 0.5)
LILAC = M("Lilac", "C9A8F0", 0.8)
BLUE = M("Banner", "2A7FD4", 0.6)
GLASS = M("Glass", "2BAFEE", 0.1)
GLASSP = M("GlassPale", "BFE9FF", 0.18)
DARK = M("Interior", "16213B", 0.9)          # 窗内暗部：撐出深度的關鍵
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
    """boolean 切口，放進 RA_VenueCut，不進最終模型。"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = "CUT_" + name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    for c in o.users_collection:
        c.objects.unlink(o)
    cut.objects.link(o)
    return o


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
    """icosphere，面數只有 uv sphere 的三分之一。"""
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
    """立起來的半圓拱（XZ 面）：拱肋、拱框、拱窗罩。"""
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


def half_cyl(name, R, depth, loc, mat, n=18, rot=(0, 0, 0), squash=1.0):
    """半圓筒（軸沿 Y）：桶頂、半圓玻璃、暗部背板。"""
    bm = bmesh.new()
    y0, y1 = -depth / 2, depth / 2
    rows = []
    for i in range(n + 1):
        a = math.pi * i / n
        z = R * math.sin(a)
        rows.append((bm.verts.new((R * math.cos(a), y0, z * squash)),
                     bm.verts.new((R * math.cos(a), y1, z * squash))))
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


def shell(name, R, loc, mat, n=24, m=7):
    """半球穹頂（開口朝下）。"""
    bm = bmesh.new()
    rings = []
    for i in range(m):
        phi = math.pi / 2 * i / m
        ring = []
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
            bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]))
    for j in range(n):
        k = (j + 1) % n
        bm.faces.new((rings[-1][j], rings[-1][k], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(PFX + name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(PFX + name, me)
    col.objects.link(o)
    o.location = loc
    o.data.materials.append(mat)
    return o


def plate(name, loc, mat, w, h, thick, notch=0.0, rot=(0, 0, 0)):
    """立板（XZ 面），可做 V 形下緣的吊旗。"""
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
    o.rotation_euler = rot
    o.data.materials.append(mat)
    md = o.modifiers.new("Sol", 'SOLIDIFY')
    md.thickness = thick
    md.offset = 0
    return o


def boolean(host, cutter):
    md = host.modifiers.new("Cut", 'BOOLEAN')
    md.solver = 'EXACT'
    md.operation = 'DIFFERENCE'
    md.object = cutter
    return md


# ── 開真窗：牆上挖洞，暗部退 9 cm、玻璃退 3 cm、石框突出 5 cm ─────────
# axis: 'X' 側牆（牆面在 x=±wall）、'Y' 前後牆（牆面在 y=±wall）
def window(name, axis, sgn, wall, u, z, w, h, bars=1, host="Hall"):
    """u = 沿牆位置, z = 矩形洞口中心高, w/h = 洞口寬高（上方再加半圓拱頭）。"""
    hw, hh = w / 2, h / 2
    r = hw                                   # 拱半徑
    top = z + hh + r                         # 洞口上緣
    thru = 0.60                              # 切口厚度，跨過牆體兩側
    # 兩個重疊切口（矩形＋拱頭圓柱）分別做 boolean，比合成一個自相交網格穩。
    if axis == 'X':
        c1 = cutbox(name + "C", (thru, w, h), (sgn * wall, u, z))
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r, depth=thru,
                                            location=(sgn * wall, u, z + hh),
                                            rotation=(0, math.pi / 2, 0))
    else:
        c1 = cutbox(name + "C", (w, thru, h), (u, sgn * wall, z))
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r, depth=thru,
                                            location=(u, sgn * wall, z + hh),
                                            rotation=(math.pi / 2, 0, 0))
    cy = bpy.context.active_object
    cy.name = "CUT_" + name + "A"
    for c in cy.users_collection:
        c.objects.unlink(cy)
    cut.objects.link(cy)

    def P(lateral, out, zz):
        """local(沿牆, 突出方向, 高) → 世界座標。out>0 是往外突出。"""
        return ((sgn * (wall + out), lateral, zz) if axis == 'X' else
                (lateral, sgn * (wall + out), zz))

    def S(along, thick, tall):
        return ((thick, along, tall) if axis == 'X' else (along, thick, tall))

    # 1) 洞底暗部（退 9 cm）＋退 3 cm 的玻璃：窗才會有「洞」而不是貼紙
    box(name + "Back", S(w + 0.12, 0.02, h + r + 0.12), P(u, -0.09, z + r / 2), DARK)
    box(name + "Glass", S(w - 0.05, 0.02, h - 0.05), P(u, -0.03, z), GLASS)
    half_cyl(name + "ArchGl", r - 0.02, 0.02, P(u, -0.03, z + hh), GLASS,
             rot=(0, 0, (math.pi / 2 if axis == 'X' else 0.0)))
    # 2) 窗框：左右壁柱＋窗楣，突出牆面 5 cm
    for s2 in (-1, 1):
        box(name + "Jam%d" % s2, S(0.07, 0.10, h + 0.16),
            P(u + s2 * (hw + 0.035), 0.025, z + 0.03), CREAMD, bevel=0.01)
    box(name + "Head", S(w + 0.24, 0.10, 0.09), P(u, 0.025, top + 0.045), CREAMD, bevel=0.01)
    # 3) 窗台（突出 8 cm）＋下方滴水線：陰影線讓窗台讀得出來
    box(name + "Sill", S(w + 0.26, 0.16, 0.06), P(u, 0.05, z - hh - 0.05), CREAMD, bevel=0.012)
    box(name + "Drip", S(w + 0.20, 0.06, 0.02), P(u, 0.02, z - hh - 0.10), GOLDD)
    # 4) 窗心金格線
    for i in range(bars):
        off = (i + 1) * w / (bars + 1) - hw
        box(name + "Bar%d" % i, S(0.028, 0.05, h - 0.06), P(u + off, -0.005, z), GOLD)
    box(name + "Rail", S(w - 0.05, 0.05, 0.028), P(u, -0.005, z + h * 0.16), GOLD)
    # 5) 拱心石＋拱罩（突出的半圓線腳，拱窗的辨識點）
    box(name + "Keystone", S(0.11, 0.09, 0.14), P(u, 0.035, top + 0.03), GOLD)
    archXZ(name + "Hood", r + 0.07, 0.035, P(u, 0.045, z + hh), CREAMD,
           rotz=(math.pi / 2 if axis == 'X' else 0.0))
    boolean(bpy.data.objects[PFX + host], c1)
    boolean(bpy.data.objects[PFX + host], cy)


# ── 建模 ───────────────────────────────────────────────────────────
# 底座、舖面、三階加上紫地毯（金邊）
# 接觸陰影不做在模型裡：遊戲端 renderer 已有 PCFSoftShadowMap，真陰影比較自然
box("Base", (2.34, 1.78, 0.10), (0, 0.02, 0.05), PLINTH, bevel=0.05)
box("Plaza", (2.14, 1.60, 0.06), (0, 0.02, 0.13), PAVE, bevel=0.03)
for i, (w, y, z) in enumerate(((1.44, -0.955, 0.028), (1.24, -0.865, 0.085),
                               (1.04, -0.775, 0.142))):
    box("Step%d" % i, (w, 0.09, 0.055), (0, y, z), CREAMD, bevel=0.012)
    box("StepNose%d" % i, (w, 0.02, 0.02), (0, y - 0.05, z + 0.02), GOLDD)
for i, sx in enumerate((-1, 1)):
    box("Cheek%d" % i, (0.16, 0.34, 0.20), (sx * 0.74, -0.85, 0.10), CREAM, bevel=0.02)
    box("CheekCap%d" % i, (0.20, 0.38, 0.04), (sx * 0.74, -0.85, 0.22), GOLD)
    ball("CheekBall%d" % i, 0.05, (sx * 0.74, -0.85, 0.28), GOLDD, sub=1)
box("Carpet0", (0.60, 0.30, 0.02), (0, -0.82, 0.175), CARPET, bevel=0.005)
box("Carpet1", (0.60, 0.52, 0.02), (0, -0.40, 0.175), CARPET, bevel=0.005)
for nm, y, d in (("Cp0", -0.82, 0.30), ("Cp1", -0.40, 0.52)):
    for sx in (-1, 1):
        box("Trim" + nm + str(sx), (0.05, d, 0.022), (sx * 0.325, y, 0.176), GOLD)

# 主體、紫色飾帶、紫屋頂與金女兒牆
box("Hall", (1.80, 1.12, 0.90), (0, 0.18, 0.60), CREAM, bevel=0.02)
box("Frieze", (1.86, 1.18, 0.10), (0, 0.18, 1.10), PURPLEL)
box("Roof", (1.94, 1.26, 0.09), (0, 0.18, 1.19), PURPLE)
box("RoofField", (1.70, 1.02, 0.02), (0, 0.18, 1.245), PURPLEL)
for i in range(3):                                   # 屋頂金分格（俯角看得到的層次）
    box("RoofGold%d" % i, (0.03, 1.00, 0.02), (-0.45 + i * 0.45, 0.18, 1.256), GOLD)
for i, sx in enumerate((-1, 1)):                     # 屋頂天窗
    box("Skylight%d" % i, (0.30, 0.34, 0.06), (sx * 0.62, -0.16, 1.27), GLASSP, bevel=0.01)
    box("SkylightFrame%d" % i, (0.36, 0.40, 0.03), (sx * 0.62, -0.16, 1.25), GOLD)
    cyl("Vent%d" % i, 0.06, 0.14, (sx * 0.62, 0.52, 1.31), GOLDD, verts=10)
    cyl("VentCap%d" % i, 0.08, 0.025, (sx * 0.62, 0.52, 1.39), GOLD, verts=10)
box("ParapetF", (1.98, 0.06, 0.13), (0, -0.42, 1.28), CREAM, bevel=0.02)
box("ParapetB", (1.98, 0.06, 0.13), (0, 0.78, 1.28), CREAM, bevel=0.02)
box("ParapetGoldF", (2.00, 0.07, 0.035), (0, -0.42, 1.35), GOLD)
box("ParapetGoldB", (2.00, 0.07, 0.035), (0, 0.78, 1.35), GOLD)
for sx in (-1, 1):
    box("ParapetS%d" % sx, (0.06, 1.26, 0.13), (sx * 0.97, 0.18, 1.28), CREAM, bevel=0.02)
    box("ParapetGoldS%d" % sx, (0.075, 1.28, 0.035), (sx * 0.97, 0.18, 1.35), GOLD)

# 鼓座：開 8 個拱窗（暗部＋玻璃＋金框），不是貼一圈藍
cyl("Drum", 0.52, 0.34, (0, 0.18, 1.40), CREAM, verts=28)
cyl("DrumIn", 0.505, 0.22, (0, 0.18, 1.42), DARK, verts=28)
for i in range(8):
    a = math.radians(i * 45 + 22.5)
    x, y = 0.505 * math.cos(a), 0.18 + 0.505 * math.sin(a)
    box("DrumWin%d" % i, (0.03, 0.13, 0.20), (x, y, 1.42), GLASS, rot=(0, 0, a))
    box("DrumWinF%d" % i, (0.03, 0.17, 0.24), (0.517 * math.cos(a), 0.18 + 0.517 * math.sin(a),
                                               1.42), GOLD, rot=(0, 0, a))
cyl("DrumRing", 0.58, 0.08, (0, 0.18, 1.565), GOLD, verts=28, bevel=0.015)
cyl("DrumSill", 0.545, 0.04, (0, 0.18, 1.245), GOLDD, verts=28)

# 紫穹頂、金肋
shell("Dome", 0.58, (0, 0.18, 1.60), PURPLEL)
for i, deg in enumerate((0, 45, 90, 135)):
    archXZ("DomeRib%d" % i, 0.592, 0.021, (0, 0.18, 1.60), GOLD, rotz=math.radians(deg))
cyl("DomeCollar", 0.60, 0.05, (0, 0.18, 1.615), GOLD, verts=28)

# 金線地球儀頂飾
GZ = 2.34
cyl("GlobeStem", 0.022, 0.16, (0, 0.18, 2.22), GOLDD, verts=10)
ball("GlobeCore", 0.055, (0, 0.18, GZ), GOLD, sub=1)
torus("GlobeEq", 0.165, 0.019, (0, 0.18, GZ), GOLD, rot=(math.pi / 2, 0, 0))
torus("GlobeMer1", 0.165, 0.019, (0, 0.18, GZ), GOLD)
torus("GlobeMer2", 0.165, 0.019, (0, 0.18, GZ), GOLD, rot=(0, math.pi / 2, 0))
torus("GlobeRing", 0.205, 0.014, (0, 0.18, GZ), GOLDD, rot=(math.pi / 2, 0, math.radians(28)))
ball("GlobeTip", 0.026, (0, 0.18, GZ + 0.19), GOLD, sub=1)

# 屋頂四角旗桿
for i, (x, m) in enumerate([(-0.78, PURPLE), (-0.52, PURPLE), (0.52, BLUE), (0.78, BLUE)]):
    cyl("RFpole%d" % i, 0.018, 0.46, (x, -0.30, 1.55), GOLD, verts=8)
    ball("RFtop%d" % i, 0.032, (x, -0.30, 1.79), GOLD, sub=1)
    box("RFflag%d" % i, (0.16, 0.02, 0.11), (x + (0.09 if x < 0 else -0.09), -0.30, 1.70),
        m, bevel=0.008)

# 前廊四柱與額枋（柱子往兩邊張開，中軸留給入口，牆面才放得下燈與看板的突出件）
for i, x in enumerate((-0.78, -0.26, 0.26, 0.78)):
    cyl("ColBase%d" % i, 0.10, 0.07, (x, -0.60, 0.235), GOLDD, verts=16)
    cyl("Col%d" % i, 0.072, 0.68, (x, -0.60, 0.61), CREAM, verts=16)
    for k in range(4):                               # 柱凹槽：四条細線就讀得出圓柱
        a = math.radians(45 + k * 90)
        box("Flute%d_%d" % (i, k), (0.014, 0.014, 0.62),
            (x + 0.070 * math.cos(a), -0.60 + 0.070 * math.sin(a), 0.61), CREAMD)
    cyl("ColCap%d" % i, 0.104, 0.075, (x, -0.60, 0.985), GOLD, verts=16)
box("Entablature", (1.86, 0.36, 0.11), (0, -0.60, 1.075), GOLD, bevel=0.02)
box("Architrave", (1.80, 0.30, 0.05), (0, -0.60, 1.015), GOLDD)
for i in range(8):                                   # 簷口齒飾：一行小方塊就有陰影
    box("Dentil%d" % i, (0.05, 0.06, 0.05), (-0.70 + i * 0.20, -0.745, 1.02), CREAMD)

# 立面牆：門洞開真洞，門退 6 cm，門框與壁燈突出
box("Facade", (1.72, 0.12, 0.92), (0, -0.52, 0.61), CREAM, bevel=0.02)
for sx in (-1, 1):        # 牆基線腳分兩段，別把門洞堵死
    box("FacadeBase%d" % sx, (0.50, 0.14, 0.12), (sx * 0.60, -0.52, 0.21), CREAMD, bevel=0.02)
    box("Notice%d" % sx, (0.16, 0.03, 0.30), (sx * 0.52, -0.585, 0.42), PURPLEL)
    box("NoticeBar%d" % sx, (0.12, 0.02, 0.02), (sx * 0.52, -0.60, 0.50), WHITE)
    box("NoticeBar2%d" % sx, (0.12, 0.02, 0.02), (sx * 0.52, -0.60, 0.44), WHITE)
cutbox("DoorC", (0.72, 0.40, 0.66), (0, -0.52, 0.50))     # 真門洞：切穿立面牆
boolean(bpy.data.objects[PFX + "Facade"], bpy.data.objects["CUT_DoorC"])
box("DoorBack", (0.74, 0.02, 0.70), (0, -0.44, 0.52), DARK)          # 門內暗部
for sx in (-1, 1):                                     # 兩片門扇：退牆面 5 cm
    box("DoorLeaf%d" % sx, (0.33, 0.05, 0.62), (sx * 0.175, -0.50, 0.49), PURPLE, bevel=0.01)
    box("DoorGlass%d" % sx, (0.20, 0.02, 0.24), (sx * 0.175, -0.53, 0.62), GLASSP)
    box("DoorRail%d" % sx, (0.26, 0.02, 0.035), (sx * 0.175, -0.548, 0.46), GOLD)
    box("DoorHdl%d" % sx, (0.02, 0.04, 0.12), (sx * 0.045, -0.552, 0.50), GOLDD)
box("DoorMid", (0.03, 0.07, 0.62), (0, -0.52, 0.49), GOLD)
for sx in (-1, 1):                                     # 門框突出牆面 3 cm
    box("DoorJam%d" % sx, (0.09, 0.12, 0.78), (sx * 0.40, -0.55, 0.51), CREAMD, bevel=0.012)
box("DoorHead", (0.92, 0.12, 0.10), (0, -0.55, 0.92), CREAMD, bevel=0.012)
box("DoorKeystone", (0.12, 0.10, 0.14), (0, -0.56, 1.00), GOLD)
box("DoorSill", (0.98, 0.22, 0.05), (0, -0.58, 0.155), GOLDD)
for sx in (-1, 1):                                     # 壁燈：小體積就能把牆面推出去
    cyl("Sconce%d" % sx, 0.022, 0.10, (sx * 0.62, -0.60, 0.66), GOLDD, verts=8,
        rot=(math.pi / 2, 0, 0))
    ball("SconceG%d" % sx, 0.038, (sx * 0.62, -0.64, 0.66), WHITE, sub=1)

# 半圓拱玻璃帷幕：暗部用同形狀的淺碟（不用方板，否則拱外會露黑角）
Z0, R = 1.10, 0.74
half_cyl("ArchBack", R - 0.03, 0.04, (0, -0.42, Z0), DARK)
half_cyl("ArchGlass", R, 0.12, (0, -0.50, Z0), GLASS)
for i, lx in enumerate((-0.54, -0.27, 0.0, 0.27, 0.54)):
    h = max(0.12, math.sqrt(max((R - 0.07) ** 2 - lx * lx, 0.0)) - 0.03)
    box("ArchMull%d" % i, (0.032, 0.075, h), (lx, -0.585, Z0 + h / 2), GOLD)
for j, (z, w) in enumerate(((1.30, 1.22), (1.56, 0.68))):
    box("ArchRail%d" % j, (w, 0.075, 0.034), (0, -0.585, z), GOLD)
archXZ("ArchCream", 0.80, 0.075, (0, -0.55, Z0), CREAM)
archXZ("ArchGold", 0.74, 0.028, (0, -0.615, Z0), GOLD)
box("ArchKeystone", (0.16, 0.12, 0.18), (0, -0.60, Z0 + 0.80), GOLD)
for sx in (-1, 1):                                     # 拱腳垛子（impost）
    box("ArchImpost%d" % sx, (0.16, 0.16, 0.10), (sx * 0.80, -0.56, 1.13), CREAMD, bevel=0.01)
box("ArchSill", (1.80, 0.22, 0.06), (0, -0.50, 1.09), CREAMD)
box("ArchSillDrip", (1.72, 0.16, 0.02), (0, -0.53, 1.055), GOLDD)

# 兩側拱窗（真開洞：暗部退 9 cm、玻璃退 3 cm、石框與窗台突出）
for sx in (-1, 1):
    window("WinA%d" % sx, 'X', sx, 0.90, 0.02, 0.62, 0.30, 0.40)
    window("WinB%d" % sx, 'X', sx, 0.90, 0.50, 0.62, 0.30, 0.40)

# 後牆：服務門＋兩個小窗（背面不空）
cutbox("BackC", (0.50, 0.40, 0.60), (0, 0.76, 0.46))
boolean(bpy.data.objects[PFX + "Hall"], bpy.data.objects["CUT_BackC"])
box("BackDoor", (0.48, 0.04, 0.58), (0, 0.66, 0.45), GOLDD)
box("BackDoorG", (0.30, 0.02, 0.20), (0, 0.635, 0.60), GLASSP)
for sx in (-1, 1):
    box("BackWin%d" % sx, (0.24, 0.04, 0.28), (sx * 0.60, 0.72, 0.66), GLASS)
    box("BackWinF%d" % sx, (0.30, 0.05, 0.34), (sx * 0.60, 0.735, 0.66), GOLD)

# 兩面紫吊旗：金橫桿、V 形下緣、白地球標誌
for sx in (-1, 1):
    x = sx * 1.02
    cyl("BRod%d" % sx, 0.022, 0.34, (x, -0.66, 1.26), GOLD, verts=8, rot=(0, math.pi / 2, 0))
    ball("BRodL%d" % sx, 0.035, (x - 0.18, -0.66, 1.26), GOLD, sub=1)
    ball("BRodR%d" % sx, 0.035, (x + 0.18, -0.66, 1.26), GOLD, sub=1)
    plate("Banner%d" % sx, (x, -0.68, 1.05), PURPLE, 0.28, 0.40, 0.025, notch=0.09)
    box("BannerTop%d" % sx, (0.30, 0.03, 0.035), (x, -0.685, 1.24), GOLD)
    cyl("BGdisc%d" % sx, 0.086, 0.02, (x, -0.695, 1.09), WHITE, verts=18, rot=(math.pi / 2, 0, 0))
    torus("BGlat%d" % sx, 0.070, 0.007, (x, -0.708, 1.09), GOLD, rot=(math.pi / 2, 0, 0), mj=16)
    torus("BGmer%d" % sx, 0.070, 0.007, (x, -0.708, 1.09), GOLD, mj=16)
    torus("BGmer2%d" % sx, 0.042, 0.006, (x, -0.710, 1.09), GOLD, rot=(0, math.pi / 2, 0), mj=16)

# 花圃：矮槽（後側做低，當作窗下花槽不跟窗台打架）、圓錐修頂樹、灌木、繡球花
for i, (x, y, ph) in enumerate([(-1.06, -0.52, 0.20), (1.06, -0.52, 0.20),
                                (-0.98, 0.62, 0.13), (0.98, 0.62, 0.13)]):
    box("Planter%d" % i, (0.40, 0.36, ph), (x, y, 0.16 + ph / 2), CREAM, bevel=0.03)
    box("PlanterRim%d" % i, (0.44, 0.40, 0.03), (x, y, 0.16 + ph), CREAMD)
    box("Soil%d" % i, (0.32, 0.28, 0.03), (x, y, 0.155 + ph), GOLDD)
    cone("Topiary%d" % i, 0.11, 0.02, 0.34, (x - 0.08, y - 0.04, 0.30 + ph), LEAF, verts=12)
    ball("Hedge%d" % i, 0.09, (x + 0.10, y + 0.06, 0.24 + ph), LEAFL, sub=1)
    for j, (dx, dz) in enumerate([(-0.02, 0.24 + ph), (0.06, 0.28 + ph),
                                  (-0.09, 0.28 + ph), (0.0, 0.33 + ph)]):
        ball("Hydra%d_%d" % (i, j), 0.045, (x + dx, y - 0.02, dz), LILAC, sub=1)

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
model.name = "RA_Venue"
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
C = Vector(PARK) + Vector((0, 0, 1.1))
shot((PARK[0] - 2.9, PARK[1] - 3.4, 3.0), C, "venue-1.png")
shot((PARK[0] + 3.2, PARK[1] - 3.3, 2.3), C, "venue-2.png")
shot((PARK[0], PARK[1] - 4.4, 2.0), Vector(PARK) + Vector((0, 0, 1.15)), "venue-3.png", lens=55)
shot((PARK[0] - 2.2, PARK[1] - 2.6, 1.5), C, "venue-4.png", lens=70)     # 入口特寫
shot((PARK[0] + 1.8, PARK[1] - 2.2, 1.4), (PARK[0] - 0.7, PARK[1], 0.7), "venue-5.png", lens=70)
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
print("venue: %d 材質, x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f, GLB %d bytes"
      % (len(model.material_slots), min(xs), max(xs), min(ys), max(ys),
         min(zs), max(zs), os.path.getsize(GLB)))
