/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 */

/** *
 Edited from THREE.EditorControls
 Change in this.zoom to adjust camera zoom rather than position
 Change in this.pan to consider camera zoom rather than position
 Change in this.rotate to disable spherical.phi
 Change to this.panSpeed and this.zoomSpeed
 ** */

import {
  Box3,
  EventDispatcher,
  Matrix3,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
} from 'three';

const MapControls2D = function(object, domElement) {
  domElement = domElement !== undefined ? domElement : document;

  // API

  this.enabled = true;
  this.center = new Vector3();
  this.panSpeed = 0.01;
  this.zoomSpeed = 0.05;
  this.rotationSpeed = 0.005;

  // internals

  const scope = this;
  const vector = new Vector3();
  const delta = new Vector3();
  const box = new Box3();

  const STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };
  let state = STATE.NONE;

  const { center } = this;
  const normalMatrix = new Matrix3();
  const pointer = new Vector2();
  const pointerOld = new Vector2();
  const spherical = new Spherical();
  const sphere = new Sphere();

  // events

  const changeEvent = { type: 'change' };

  this.focus = function(target) {
    let distance;

    box.setFromObject(target);

    if (box.isEmpty() === false) {
      box.getCenter(center);
      distance = box.getBoundingSphere(sphere).radius;
    } else {
      // Focusing on an Group, AmbientLight, etc

      center.setFromMatrixPosition(target.matrixWorld);
      distance = 0.1;
    }

    delta.set(0, 0, 1);
    delta.applyQuaternion(object.quaternion);
    delta.multiplyScalar(distance * 4);

    object.position.copy(center).add(delta);

    scope.dispatchEvent(changeEvent);
  };

  this.pan = function(positionDelta) {
    // var distance = object.position.distanceTo( center );

    const { zoom } = object;

    positionDelta.multiplyScalar(scope.panSpeed / zoom);
    positionDelta.applyMatrix3(normalMatrix.getNormalMatrix(object.matrix));

    object.position.add(positionDelta);
    center.add(positionDelta);

    scope.dispatchEvent(changeEvent);
  };

  this.zoom = function(zoomDelta) {
    object.zoom -= (zoomDelta.z || 0) * object.zoom * 0.1;
    object.updateProjectionMatrix();

    scope.dispatchEvent(changeEvent);
  };

  this.rotate = function(rotationDelta) {
    vector.copy(object.position).sub(center);

    // spherical.setFromVector3( vector );
    spherical.setFromCartesianCoords(-1 * vector.x, vector.z, vector.y);

    spherical.theta += rotationDelta.x * scope.rotationSpeed;
    // spherical.phi += rotationDelta.y * scope.rotationSpeed;

    spherical.makeSafe();

    const tempRelPosition = vector.setFromSpherical(spherical);
    vector.set(-1 * tempRelPosition.x, tempRelPosition.z, tempRelPosition.y);

    object.position.copy(center).add(vector);

    object.lookAt(center);

    scope.dispatchEvent(changeEvent);
  };

  // mouse

  function onMouseMove(event) {
    if (scope.enabled === false) return;

    pointer.set(event.clientX, event.clientY);

    const movementX = pointer.x - pointerOld.x;
    const movementY = pointer.y - pointerOld.y;

    if (state === STATE.ROTATE) {
      scope.rotate(delta.set(-movementX, -movementY, 0));
    } else if (state === STATE.ZOOM) {
      scope.zoom(delta.set(0, 0, movementY));
    } else if (state === STATE.PAN) {
      scope.pan(delta.set(-movementX, movementY, 0));
    }

    pointerOld.set(event.clientX, event.clientY);
  }

  function onMouseUp() {
    domElement.removeEventListener('mousemove', onMouseMove, false);
    domElement.removeEventListener('mouseup', onMouseUp, false);
    domElement.removeEventListener('mouseout', onMouseUp, false);
    domElement.removeEventListener('dblclick', onMouseUp, false);

    state = STATE.NONE;
  }

  function onMouseWheel(event) {
    event.preventDefault();

    // Normalize deltaY due to https://bugzilla.mozilla.org/show_bug.cgi?id=1392460
    scope.zoom(delta.set(0, 0, event.deltaY > 0 ? 1 : -1));
  }

  function onMouseDown(event) {
    if (scope.enabled === false) return;

    if (event.button === 0) {
      state = STATE.ROTATE;
    } else if (event.button === 1) {
      state = STATE.ZOOM;
    } else if (event.button === 2) {
      state = STATE.PAN;
    }

    pointerOld.set(event.clientX, event.clientY);

    domElement.addEventListener('mousemove', onMouseMove, false);
    domElement.addEventListener('mouseup', onMouseUp, false);
    domElement.addEventListener('mouseout', onMouseUp, false);
    domElement.addEventListener('dblclick', onMouseUp, false);
  }

  function contextmenu(event) {
    event.preventDefault();
  }

  domElement.addEventListener('contextmenu', contextmenu, false);
  domElement.addEventListener('mousedown', onMouseDown, false);
  domElement.addEventListener('wheel', onMouseWheel, false);

  // touch

  const touches = [new Vector3(), new Vector3(), new Vector3()];
  const prevTouches = [new Vector3(), new Vector3(), new Vector3()];

  let prevDistance = null;

  function touchStart(event) {
    if (scope.enabled === false) return;

    switch (event.touches.length) {
      case 1:
        touches[0]
          .set(event.touches[0].pageX, event.touches[0].pageY, 0)
          .divideScalar(window.devicePixelRatio);
        touches[1]
          .set(event.touches[0].pageX, event.touches[0].pageY, 0)
          .divideScalar(window.devicePixelRatio);
        break;

      case 2:
        touches[0]
          .set(event.touches[0].pageX, event.touches[0].pageY, 0)
          .divideScalar(window.devicePixelRatio);
        touches[1]
          .set(event.touches[1].pageX, event.touches[1].pageY, 0)
          .divideScalar(window.devicePixelRatio);
        prevDistance = touches[0].distanceTo(touches[1]);
        break;
    }

    prevTouches[0].copy(touches[0]);
    prevTouches[1].copy(touches[1]);
  }

  function touchMove(event) {
    if (scope.enabled === false) return;

    event.preventDefault();
    event.stopPropagation();

    function getClosest(touch, allTouches) {
      let closest = allTouches[0];

      for (const i in allTouches) {
        if (closest.distanceTo(touch) > allTouches[i].distanceTo(touch))
          closest = allTouches[i];
      }

      return closest;
    }

    switch (event.touches.length) {
      case 1:
        touches[0]
          .set(event.touches[0].pageX, event.touches[0].pageY, 0)
          .divideScalar(window.devicePixelRatio);
        touches[1]
          .set(event.touches[0].pageX, event.touches[0].pageY, 0)
          .divideScalar(window.devicePixelRatio);
        scope.rotate(
          touches[0]
            .sub(getClosest(touches[0], prevTouches))
            .multiplyScalar(-1),
        );
        break;

      case 2:
        touches[0]
          .set(event.touches[0].pageX, event.touches[0].pageY, 0)
          .divideScalar(window.devicePixelRatio);
        touches[1]
          .set(event.touches[1].pageX, event.touches[1].pageY, 0)
          .divideScalar(window.devicePixelRatio);
        const distance = touches[0].distanceTo(touches[1]);
        scope.zoom(delta.set(0, 0, prevDistance - distance));
        prevDistance = distance;

        const offset0 = touches[0]
          .clone()
          .sub(getClosest(touches[0], prevTouches));
        const offset1 = touches[1]
          .clone()
          .sub(getClosest(touches[1], prevTouches));
        offset0.x = -offset0.x;
        offset1.x = -offset1.x;

        scope.pan(offset0.add(offset1));

        break;
    }

    prevTouches[0].copy(touches[0]);
    prevTouches[1].copy(touches[1]);
  }

  domElement.addEventListener('touchstart', touchStart, false);
  domElement.addEventListener('touchmove', touchMove, false);

  this.dispose = function() {
    domElement.removeEventListener('contextmenu', contextmenu, false);
    domElement.removeEventListener('mousedown', onMouseDown, false);
    domElement.removeEventListener('wheel', onMouseWheel, false);

    domElement.removeEventListener('mousemove', onMouseMove, false);
    domElement.removeEventListener('mouseup', onMouseUp, false);
    domElement.removeEventListener('mouseout', onMouseUp, false);
    domElement.removeEventListener('dblclick', onMouseUp, false);

    domElement.removeEventListener('touchstart', touchStart, false);
    domElement.removeEventListener('touchmove', touchMove, false);
  };
};

MapControls2D.prototype = Object.create(EventDispatcher.prototype);
MapControls2D.prototype.constructor = MapControls2D;

export { MapControls2D };
