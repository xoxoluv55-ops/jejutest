import sys, bpy, addon_utils, json, math
from importlib import import_module
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
P="bl_ext.user_default.mpfb.services."
HS=import_module(P+"humanservice").HumanService
TS=import_module(P+"targetservice").TargetService
OS=import_module(P+"objectservice").ObjectService

def build(spec):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    hi=HS._create_default_human_info_dict()
    hi["phenotype"].update(spec["phenotype"])
    hi["targets"]=[{"target":k,"value":v} for k,v in spec.get("targets",{}).items()]
    for k in ["eyes","eyebrows","eyelashes","teeth","tongue","hair"]:
        hi[k]=spec.get(k,"")
    hi["rig"]=spec.get("rig","mixamo_unity")
    hi["skin_mhmat"]=spec["skin"]; hi["skin_material_type"]="MAKESKIN"
    hi["eyes_material_type"]="MAKESKIN"
    hi["name"]=spec["name"]
    ds=HS.get_default_deserialization_settings()
    ds["subdiv_levels"]=0; ds["load_clothes"]=False; ds["material_instances"]=False
    ds["detailed_helpers"]=True
    body=HS.deserialize_from_dict(hi, ds)
    return body

def look(path, objs=None, target=(0,0,1.0), dist=2.6, ortho=None, res=(768,1024), az=0, el=0, samples=24):
    s=bpy.context.scene
    s.render.engine='CYCLES'; s.cycles.samples=samples; s.cycles.device='CPU'
    s.render.resolution_x,s.render.resolution_y=res; s.render.film_transparent=False
    w=s.world or bpy.data.worlds.new("w"); s.world=w; w.use_nodes=True
    w.node_tree.nodes["Background"].inputs[0].default_value=(0.25,0.27,0.32,1)
    w.node_tree.nodes["Background"].inputs[1].default_value=0.6
    from mathutils import Vector, Euler
    for n in ['key','rim','cam']:
        if n in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[n])
    cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera=cam
    t=Vector(target); a=math.radians(az); e=math.radians(el)
    d=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)))
    cam.location=t+d*dist; cam.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler()
    cam.data.lens=85 if dist<1.5 else 50
    for nm,loc,en in [('key',(1.5,-2.5,2.5),900),('rim',(-2,2,2.2),700)]:
        L=bpy.data.objects.new(nm,bpy.data.lights.new(nm,'AREA')); L.data.energy=en; L.data.size=2
        L.location=loc; s.collection.objects.link(L)
        L.rotation_euler=(t-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    s.render.filepath=path; bpy.ops.render.render(write_still=True)

def sym(d):
    out={}
    for k,v in d.items():
        if k.startswith('L-'): out['l-'+k[2:]]=v; out['r-'+k[2:]]=v
        else: out[k]=v
    return out

import numpy as np
def tint_images(obj, rgb, keep_detail=0.35, outdir='/tmp/mp/tex'):
    import os; os.makedirs(outdir,exist_ok=True)
    for slot in obj.material_slots:
        m=slot.material
        if not m or not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type=='TEX_IMAGE' and n.image and 'diffuse' in n.image.name.lower():
                im=n.image; w,h=im.size
                px=np.array(im.pixels[:],dtype=np.float32).reshape(-1,4)
                lum=px[:,:3]@np.array([0.3,0.59,0.11])
                lum=lum/ max(lum.max(),1e-3)
                col=np.array(rgb)[None,:]*((1-keep_detail)+keep_detail*2*lum[:,None])
                px[:,:3]=np.clip(col,0,1)
                new=bpy.data.images.new(obj.name+"_tinted",w,h,alpha=True)
                new.pixels[:]=px.ravel()
                new.filepath_raw=f"{outdir}/{obj.name}_tinted.png"; new.file_format='PNG'; new.save()
                n.image=new

def set_eye_color(obj, mhmat='/tmp/mhassets/eyes/materials/brown_eye.png'):
    for slot in obj.material_slots:
        m=slot.material
        for n in m.node_tree.nodes:
            if n.type=='TEX_IMAGE' and n.image:
                n.image=bpy.data.images.load(mhmat)
