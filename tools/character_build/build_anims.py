import bpy, sys, math, json
argv=sys.argv[sys.argv.index('--')+1:]
ual1, ual2, mapping_json, outdir = argv
mapping=json.loads(open(mapping_json).read())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ual1)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
keep=set([arm])
bpy.ops.import_scene.gltf(filepath=ual2)
for o in list(bpy.data.objects):
    if o.type=='ARMATURE' and o is not arm: bpy.data.objects.remove(o)
for o in list(bpy.data.objects):
    if o.type!='ARMATURE': bpy.data.objects.remove(o)
arm.name='Armature'; arm.data.name='Armature'
if arm.animation_data is None: arm.animation_data_create()
def act(n):
    a=bpy.data.actions.get(n+'_Armature') or bpy.data.actions.get(n+'_Armature.001')
    if a is None: raise Exception('missing '+n)
    return a
LOWER=('thigh','calf','foot','ball')
# pelvis local axis that is world-up (keep), others are horizontal (flatten)
pb=arm.data.bones['pelvis']
m=pb.matrix_local.to_3x3()
up_idx=max(range(3), key=lambda i: abs(m.col[i].z))
print("pelvis up axis",up_idx)
def bone_of(fc):
    p=fc.data_path
    return p.split('"')[1] if '"' in p else None
def sample(a, frame):
    """pose values {data_path,index: value} at frame"""
    return {(fc.data_path,fc.array_index): fc.evaluate(frame) for fc in a.fcurves}
def new_action(name):
    a=bpy.data.actions.new(name); return a
def key(a, path, idx, frame, val, group=None):
    fc=a.fcurves.find(path,index=idx) or a.fcurves.new(path,index=idx,action_group=group or '')
    fc.keyframe_points.insert(frame,val,options={'FAST'})
def build(spec):
    t=spec['type']; src=spec.get('src')
    if t=='copy':
        a=act(src).copy(); a.name=spec['key']
        f0,f1=act(src).frame_range
        if 'range' in spec:
            r0,r1=spec['range']; f0,f1=f0+(f1-f0)*r0, f0+(f1-f0)*r1
            # trim by re-sampling
            b=new_action(spec['key']+'_t'); n=int(round(f1-f0))
            for fc in act(src).fcurves:
                for i in range(n+1): key(b,fc.data_path,fc.array_index,i,fc.evaluate(f0+i))
            bpy.data.actions.remove(a); a=b; a.name=spec['key']
    elif t=='concat':
        a=new_action(spec['key']); off=0
        for nm in spec['srcs']:
            s=act(nm); f0,f1=s.frame_range; n=int(round(f1-f0))
            for fc in s.fcurves:
                for i in range(n+1): key(a,fc.data_path,fc.array_index,off+i,fc.evaluate(f0+i))
            off+=n+1
    elif t=='hold':   # breathing stance loop from one frame of a clip
        s=act(src); f0,f1=s.frame_range; fr=f0+(f1-f0)*spec.get('at',0)
        base=sample(s,fr); a=new_action(spec['key']); L=60
        for (p,i),v in base.items():
            for f in (0,30,60):
                val=v
                b=p.split('"')[1] if '"' in p else ''
                if f==30 and p.endswith('location') and b=='pelvis' and i==up_idx: val=v-0.012*(1 if m.col[i].z>0 else -1)
                if f==30 and p.endswith('rotation_quaternion') and b in ('spine_02','spine_03') and i==1: val=v+0.012
                key(a,p,i,f,val)
    elif t=='layer':  # legs (+pelvis bob) from a walk, upper body from a stance frame
        w=act(src); s=act(spec['upper']); sf=s.frame_range[0]+(s.frame_range[1]-s.frame_range[0])*spec.get('at',0)
        f0,f1=w.frame_range; n=int(round(f1-f0)); a=new_action(spec['key'])
        stance=sample(s,sf)
        paths=set((fc.data_path,fc.array_index) for fc in w.fcurves)|set(stance.keys())
        for (p,i) in paths:
            b=p.split('"')[1] if '"' in p else ''
            fromwalk = b.startswith(LOWER) or b in ('root',) or (b=='pelvis')
            fc=w.fcurves.find(p,index=i)
            for k in range(0,n+1,2):
                if fromwalk and fc is not None: v=fc.evaluate(f0+k)
                else: v=stance.get((p,i), fc.evaluate(f0+k) if fc else 0)
                key(a,p,i,k,v)
    # strip horizontal travel (the game moves the fighter); keep height
    for fc in list(a.fcurves):
        b=bone_of(fc)
        if b=='root' or (b=='pelvis' and fc.data_path.endswith('location') and fc.array_index!=up_idx):
            v=fc.evaluate(a.frame_range[0]) if b=='pelvis' else fc.evaluate(a.frame_range[0])
            for kp in fc.keyframe_points: kp.co.y=v; kp.handle_left.y=v; kp.handle_right.y=v
    return a
for spec in mapping['clips']:
    a=build(spec)
    arm.animation_data.action=a
    f0,f1=a.frame_range
    sc=bpy.context.scene; sc.frame_start=int(f0); sc.frame_end=int(max(f1,f0+1)); sc.render.fps=30
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active=arm
    for d in spec['dest']:
        path=f"{outdir}/{d}/{spec['key']}.fbx"
        import os; os.makedirs(os.path.dirname(path),exist_ok=True)
        bpy.ops.export_scene.fbx(filepath=path, use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
            bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False, bake_anim_force_startend_keying=True,
            bake_anim_simplify_factor=0.5, apply_scale_options='FBX_SCALE_ALL')
    print("CLIP",spec['key'],int(f0),int(f1),spec['dest'])
