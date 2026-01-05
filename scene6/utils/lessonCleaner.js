// Utility class to remove lesson-specific models and dispose their resources
// from the shared Scene 6 environment (especially from the main table).
export default class LessonCleaner {
  constructor(scene) {
    console.log("LessonCleaner constructor: scene =", scene);
    this.nonRemovableObjects =[];
    this.scene = scene;
  }

  removeObjects() {
    if (!this.scene) {
      console.error("LessonCleaner: scene is undefined in removeObjects");
      return;
    }
    const objectsToRemove = [];

    this.scene.traverse((child) => {
      if (child.name === "mainModel") {
        child.traverse((innerChild) => {
          if (innerChild.name === "table2") {
            const childrenToRemove = innerChild.children.filter(
              (obj) => !this.nonRemovableObjects.includes(obj.name)
            );
            childrenToRemove.forEach((obj) => {
              this.disposeObject(obj);
              innerChild.remove(obj);
            });
          }
        });
      }
      if (child.name.startsWith("jstPin")) {
        objectsToRemove.push(child);
      }
    });

    // Remove jstPin objects after traversal
    objectsToRemove.forEach((child) => {
      this.disposeObject(child);
      if (child.parent) {
        child.parent.remove(child);
      }
    });
  }

  disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
        if (child.material.map) {
          child.material.map.dispose();
        }
      }
    });
  }
}
