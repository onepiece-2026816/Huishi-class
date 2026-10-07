"""Blender-only renderer: preserve imported meshes/materials, never re-model."""
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

source, destination = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and not obj.hide_render]
if not meshes:
    raise ValueError('The model has no visible meshes')
bpy.context.view_layer.update()
corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
low = Vector(tuple(min(point[i] for point in corners) for i in range(3)))
high = Vector(tuple(max(point[i] for point in corners) for i in range(3)))
center = (low + high) / 2
extent = max(high - low)
if extent <= 0:
    raise ValueError('The model has no spatial extent')
# Transform root objects together, retaining child, skin and material relationships.
transform = Matrix.Scale(1 / extent, 4) @ Matrix.Translation(-center)
for obj in list(bpy.context.scene.objects):
    if obj.parent is None:
        obj.matrix_world = transform @ obj.matrix_world
for obj in list(bpy.context.scene.objects):
    if obj.type in {'CAMERA', 'LIGHT'}:
        bpy.data.objects.remove(obj, do_unlink=True)
scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.world = bpy.data.worlds.new('View lighting')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.45, .45, .45, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
for location in ((3, -4, 5), (-4, 2, 3), (2, 4, 4)):
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy = 450
    light.data.shape = 'DISK'
    light.data.size = 5
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.25
scene.camera = camera
for name, direction in {'front': (0, -4, 0), 'left': (-4, 0, 0), 'right': (4, 0, 0), 'back': (0, 4, 0)}.items():
    camera.location = Vector(direction)
    camera.rotation_euler = (-camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(Path(destination) / (name + '.png'))
    bpy.ops.render.render(write_still=True)
