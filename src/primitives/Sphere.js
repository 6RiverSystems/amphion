import * as THREE from 'three';

import Mesh from './Mesh';
import { DEFAULT_RADIAL_SEGMENTS } from '../utils/constants';

class Sphere extends Mesh {
  constructor() {
    super();
    // Radius handled through scale
    this.geometry = new THREE.SphereGeometry(
      1,
      DEFAULT_RADIAL_SEGMENTS,
      DEFAULT_RADIAL_SEGMENTS,
    );
    this.material = new THREE.MeshStandardMaterial();
    this.material.transparent = true;
  }
}

export default Sphere;
