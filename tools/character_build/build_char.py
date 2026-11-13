import bpy, sys, math
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:]
ubc, tex, cid, hairfile, hairtex, hairnorm, bulk, out = argv
bulk=float(bulk)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f"{ubc}/male.gltf")
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=f"{ubc}/{hairfile}")
hair=[o for o in bpy.data.objects if o not in before and o.type=='MESH' and o.name.startswith('Hair')][0]
for o in list(bpy.data.objects):
    if o.type=='MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
arm.name='Armature'; arm.data.name='Armature'
print("OBJS",[(o.name,o.type,o.parent.name if o.parent else None) for o in bpy.data.objects])
# hair follows the head bone
hb=arm.data.bones['Head']
mw=hair.matrix_world.copy()
hair.parent=arm; hair.parent_type='BONE'; hair.parent_bone='Head'
hair.matrix_world=mw
hair.name='Hair'
# body bulk (torso + legs wider/deeper, head untouched)
body=None
for o in bpy.data.objects:
    if o.type=='MESH' and any(s.material and 'Superhero' in s.material.name for s in o.material_slots): body=o
body.name='Body'
zs=[(body.matrix_world@v.co).z for v in body.data.vertices]; top=max(zs)
print("HEIGHT",top)
if abs(bulk-1)>1e-3:
    inv=body.matrix_world.inverted()
    for v in body.data.vertices:
        w=body.matrix_world@v.co
        z=w.z/top
        f=1.0 if z<0.74 else (0.0 if z>0.82 else (0.82-z)/0.08)
        k=1+(bulk-1)*f
        ax=abs(w.x); core=0.17*top
        nx= w.x*k if ax<core else math.copysign(core*k+(ax-core),w.x)
        w2=Vector((nx, w.y*(1+(bulk-1)*1.2*f), w.z))
        v.co=inv@w2
def img(path):
    i=bpy.data.images.load(path); return i
def set_base(mat, path, rough=None):
    nt=mat.node_tree; bsdf=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'][0]
    for l in list(bsdf.inputs['Base Color'].links): nt.links.remove(l)
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=img(path); nt.links.new(t.outputs[0],bsdf.inputs['Base Color'])
    if 'Hair' in mat.name and 'Brows' not in mat.name:
        nt.links.new(t.outputs['Alpha'],bsdf.inputs['Alpha'])
    if rough is not None:
        for l in list(bsdf.inputs['Roughness'].links): nt.links.remove(l)
        bsdf.inputs['Roughness'].default_value=rough
    for l in list(bsdf.inputs['Metallic'].links): nt.links.remove(l)
    bsdf.inputs['Metallic'].default_value=0
def set_normal(mat,path):
    for n in mat.node_tree.nodes:
        if n.type=='TEX_IMAGE' and n.image and 'Normal' in n.image.name: n.image=img(path); n.image.colorspace_settings.name='Non-Color'
for m in bpy.data.materials:
    if not m.use_nodes: continue
    if 'Superhero' in m.name:
        set_base(m,f"{tex}/T_{cid}_Body.png",0.55); set_normal(m,f"{tex}/T_Fighter_Normal.png"); m.name=f"M_{cid}_Body"
    elif 'Hair' in m.name:
        set_base(m,f"{tex}/{hairtex}",0.6); set_normal(m,f"{tex}/{hairnorm}"); m.name=f"M_{cid}_Hair" if m in hair.data.materials.values() else f"M_{cid}_Brows_Hair"
    elif 'Eye' in m.name:
        set_base(m,f"{tex}/T_Eye_Brown.png",0.2); m.name=f"M_{cid}_Eyes"
for o in bpy.data.objects:
    if o.type=='MESH' and o not in (body,hair) and o.parent is None: o.parent=arm
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.fbx(filepath=out, use_selection=True, object_types={'ARMATURE','MESH'}, add_leaf_bones=False,
    bake_anim=False, path_mode='STRIP', embed_textures=False, apply_scale_options='FBX_SCALE_ALL', mesh_smooth_type='FACE')
print("EXPORTED",out)
