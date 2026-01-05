// Utility to find a direct child mesh by name within a parent object3D hierarchy.
// Used by lesson scripts to grab specific pins or components from loaded GLTF models.
export default function getChildrenMesh(parent, targetMesh) {
  let mesh = null;
  parent.traverse((child) => {
    if (child.name === targetMesh) {
      mesh = child;
    }
  });
  return mesh;
}
