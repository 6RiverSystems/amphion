import _ from 'lodash';
import * as TransformUtils from '../utils/transform';
import { DEFAULT_COLOR_LINE } from '../utils/defaults';

const { THREE } = window;

class LineSegments extends THREE.LineSegments {
  constructor(color = DEFAULT_COLOR_LINE, linewidth = 5) {
    super();
    this.geometry = new THREE.Geometry();
    this.material = new THREE.LineBasicMaterial({ color, linewidth });
  }

  setColor(colors) {
    TransformUtils.setColor(this, colors);
  }

  updatePoints(points) {
    this.geometry.vertices = _.map(points, ({ x, y, z }) => new THREE.Vector3(x, y, z));
    this.geometry.verticesNeedUpdate = true;
  }

  setTransform(transform) {
    TransformUtils.setTransform(this, transform);
  }
}

export default LineSegments;
