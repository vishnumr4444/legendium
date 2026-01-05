/**
 * Traverse a hierarchy and return the first child whose `name` matches `targetMesh`.
 *
 * @param {THREE.Object3D} parent
 * @param {string} targetMesh
 * @returns {THREE.Object3D|null}
 */
export default function getChildrenMesh(parent, targetMesh) {
  let mesh = null;
  parent.traverse((child) => {
    if (child.name === targetMesh) {
      mesh = child;
    }
  });
  return mesh;
}
