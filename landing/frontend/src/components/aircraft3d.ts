import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = '/nasa-dc8.glb';

/** Load the NASA DC-8 and point its nose toward the flight path. */
export const loadAirliner = async (): Promise<THREE.Group> => {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const aircraft = new THREE.Group();
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI;
  pivot.scale.setScalar(7.8 / Math.max(size.x, size.z));
  gltf.scene.position.copy(center.multiplyScalar(-1));
  pivot.add(gltf.scene);
  aircraft.add(pivot);
  return aircraft;
};

export const disposeAirliner = (aircraft: THREE.Group) => {
  aircraft.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    });
  });
};
