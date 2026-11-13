import sys; sys.path.insert(0,'/tmp/mp')
from common import look
import bpy
bf=sys.argv[1]; tag=sys.argv[2]
bpy.ops.wm.open_mainfile(filepath=bf)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
hb=arm.data.bones['mixamorig:Head']; hz=arm.matrix_world@hb.head_local
look(f'/tmp/mp/{tag}_f.png', target=(0,0,hz.z*0.55), dist=3.3, res=(560,900), az=10)
s=bpy.context.scene
s.render.engine='BLENDER_WORKBENCH'; sh=s.display.shading; sh.light='FLAT'; sh.color_type='TEXTURE'
s.render.filepath=f'/tmp/mp/{tag}_b.png'
from mathutils import Vector
import math
cam=s.camera; cam.location=Vector((0.6,-3.2,hz.z*0.55)); cam.rotation_euler=(math.radians(90),0,math.radians(10))
bpy.ops.render.render(write_still=True)
s.render.engine='CYCLES'
look(f'/tmp/mp/{tag}_bk.png', target=(0,0,hz.z*0.55), dist=3.3, res=(560,900), az=200)
look(f'/tmp/mp/{tag}_h.png', target=(0,hz.y,hz.z+0.08), dist=0.85, res=(560,560), az=15)
from PIL import Image
c=Image.new('RGB',(1680,900),'gray')
for i,s in enumerate(['f','bk','h']): c.paste(Image.open(f'/tmp/mp/{tag}_{s}.png').convert('RGB'),(560*i,0))
c.save(f'/tmp/mp/{tag}_sheet.jpg')
