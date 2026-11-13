import bpy, sys, math, bmesh
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:]
ubc, tex, out = argv
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f"{ubc}/female.gltf")
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=f"{ubc}/hair_female.gltf")
for o in list(bpy.data.objects):
    if o.type=='MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
hair=[o for o in bpy.data.objects if o not in before and o.type=='MESH' and o.name.startswith('Hair')][0]
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
arm.name='Armature'; arm.data.name='Armature'
mw=hair.matrix_world.copy(); hair.parent=arm; hair.parent_type='BONE'; hair.parent_bone='Head'; hair.matrix_world=mw; hair.name='Hair'
body=[o for o in bpy.data.objects if o.type=='MESH' and any(s.material and 'Superhero' in s.material.name for s in o.material_slots)][0]
body.name='Body'
H=max((body.matrix_world@v.co).z for v in body.data.vertices); print("HEIGHT",H)

def mat(name,col,rough=0.6):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough
    m.diffuse_color=(*col,1); return m

def shell(name, pred, offset, material):
    # duplicate the body faces matching pred(world verts) into a skinned shell pushed out along the normals
    me=body.data
    bm=bmesh.new(); bm.from_mesh(me)
    mwld=body.matrix_world
    keep=set()
    for f in bm.faces:
        if all(pred(mwld@v.co) for v in f.verts): keep.add(f.index)
    bm.free()
    new=body.copy(); new.data=body.data.copy(); new.name=name
    bpy.context.scene.collection.objects.link(new)
    bm=bmesh.new(); bm.from_mesh(new.data)
    bm.faces.ensure_lookup_table()
    dele=[f for f in bm.faces if f.index not in keep]
    bmesh.ops.delete(bm, geom=dele, context='FACES')
    for v in bm.verts: v.co += v.normal*offset
    bm.to_mesh(new.data); bm.free()
    new.data.materials.clear(); new.data.materials.append(material)
    print("SHELL",name,len(new.data.polygons))
    return new

top=mat("M_Ray_Top",(0.03,0.03,0.035),0.45)
pants=mat("M_Ray_Pants",(0.16,0.015,0.03),0.55)
glove=mat("M_Ray_Gloves",(0.02,0.02,0.02),0.5)
shell("Top", lambda p: 0.665*H < p.z < 0.815*H and abs(p.x) < 0.115*H, 0.006, top)
shell("Pants", lambda p: 0.045*H < p.z < 0.585*H and abs(p.x) < 0.2*H, 0.007, pants)
shell("Gloves", lambda p: abs(p.x) > 0.36*H, 0.004, glove)
shell("ArmBands", lambda p: 0.26*H < abs(p.x) < 0.29*H and p.z > 0.75*H, 0.006, mat("M_Ray_Bands",(0.55,0.03,0.06),0.4))

def img(p): return bpy.data.images.load(p)
for m in bpy.data.materials:
    if not m.use_nodes or not m.node_tree: continue
    b=[n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED']
    if not b: continue
    b=b[0]; nt=m.node_tree
    if 'Superhero' in m.name:
        for l in list(b.inputs['Base Color'].links): nt.links.remove(l)
        t=nt.nodes.new('ShaderNodeTexImage'); t.image=img(f"{tex}/T_Ray_Body.png"); nt.links.new(t.outputs[0],b.inputs['Base Color'])
        m.name="M_Ray_Body"
    elif 'Hair' in m.name: m.name="M_Ray_Hair"
    elif 'Eye' in m.name: m.name="M_Ray_Eyes"
for o in bpy.data.objects:
    if o.type=='MESH' and o.parent is None: o.parent=arm
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.fbx(filepath=out, use_selection=True, object_types={'ARMATURE','MESH'}, add_leaf_bones=False,
    bake_anim=False, path_mode='STRIP', embed_textures=False, apply_scale_options='FBX_SCALE_ALL', mesh_smooth_type='FACE')
print("EXPORTED")
