import * as THREE from 'three';
import debounce from 'lodash.debounce';
import FreeformControls, { RAYCASTER_EVENTS } from 'three-freeform-controls';
import Core from '../core';
import {
  DEFAULT_OPTIONS_INTERACTIVE_MARKER,
  MESSAGE_TYPE_INTERACTIVEMARKER,
} from '../utils/constants';
import Group from '../primitives/Group';
import InteractiveMarkerManager from '../utils/interactiveMarkerManager';
import {
  makeInteractiveMarkerFeedbackMessage,
  makeInteractiveMarkerFeedbackTopic,
} from '../utils/ros';

class InteractiveMarkers extends Core {
  constructor(
    ros,
    topicName,
    utils,
    options = DEFAULT_OPTIONS_INTERACTIVE_MARKER,
  ) {
    super(ros, topicName, MESSAGE_TYPE_INTERACTIVEMARKER, {
      ...DEFAULT_OPTIONS_INTERACTIVE_MARKER,
      ...options,
    });

    this.object = new Group();
    this.utils = utils;

    const { queueSize } = options;
    this.interactiveMarkerManager = new InteractiveMarkerManager(this.object);
    this.queueSize = queueSize;
    this.updateOptions({
      ...DEFAULT_OPTIONS_INTERACTIVE_MARKER,
      ...options,
    });

    this.interactiveMarkers = [];
    this.objectDraggedWorldPosition = new THREE.Vector3();
    this.objectDraggedWorldQuaternion = new THREE.Quaternion();
    this.objectDraggedWorldScale = new THREE.Vector3();
    this.clientId = `amphion-${Math.round(Math.random() * 10 ** 8)}`;
    this.messageSequence = 0;
    this.feedbackTopic = null;

    this.debouncedPublish = debounce(this.publish.bind(this), 30);
    this.initFreeformControls();
  }

  hide() {
    super.hide();
    this.interactiveMarkerManager.setVisible(false);
  }

  show() {
    super.show();
    this.interactiveMarkerManager.setVisible(true);
  }

  destroy() {
    super.destroy();
    this.freeformControls.destroy();
    this.freeformControls = null;
    this.interactiveMarkers = [];
  }

  initFreeformControls() {
    const { camera, controls, renderer, scene } = this.utils;
    this.freeformControls = new FreeformControls(camera, renderer.domElement);
    scene.add(this.freeformControls);

    this.freeformControls.listen(RAYCASTER_EVENTS.DRAG_START, () => {
      controls.enabled = false;
    });

    this.freeformControls.listen(RAYCASTER_EVENTS.DRAG, this.debouncedPublish);

    this.freeformControls.listen(RAYCASTER_EVENTS.DRAG_STOP, () => {
      controls.enabled = true;
    });
  }

  publish(object, handleName) {
    object.matrixWorld.decompose(
      this.objectDraggedWorldPosition,
      this.objectDraggedWorldQuaternion,
      this.objectDraggedWorldScale,
    );

    const { frameId, markerName } = object.userData.control;
    const controlName = '';

    const message = makeInteractiveMarkerFeedbackMessage({
      seq: this.messageSequence,
      client_id: this.clientId,
      frame_id: frameId,
      marker_name: markerName,
      control_name: controlName,
      position: this.objectDraggedWorldPosition,
      quaternion: this.objectDraggedWorldQuaternion,
    });

    if (this.feedbackTopic !== null) {
      this.feedbackTopic.publish(message);
    }

    this.messageSequence++;
  }

  updateOptions(options) {
    if (options.feedbackTopicName !== undefined) {
      this.feedbackTopic = makeInteractiveMarkerFeedbackTopic(
        this.ros,
        options.feedbackTopicName.name,
      );
    } else {
      this.feedbackTopic = null;
    }
    // need a better way to handle interdependent topics
    const shouldSubscriptionChange =
      this.options.updateTopicName !== options.topicName && this.init;
    const guardAgainstOtherOptionsChange =
      this.topicName === this.options.updateTopicName;

    if (shouldSubscriptionChange && options.updateTopicName !== undefined) {
      const { messageType, name } = options.updateTopicName;
      this.changeTopic(name, messageType, true, true);
    } else if (shouldSubscriptionChange && guardAgainstOtherOptionsChange) {
      this.unsubscribe();
    }

    super.updateOptions(options);
    this.interactiveMarkerManager.updateOptions(this.options, this);
  }

  update(message) {
    super.update(message);
    if (message.markers.length > 0) {
      message.markers.forEach(interactiveMarker => {
        this.interactiveMarkers.push(interactiveMarker);
        this.interactiveMarkerManager.initMarkers(
          interactiveMarker,
          this.freeformControls,
          this.options.visible,
        );
      });
      // need a better way to handle interdependent topics
      if (!this.init) {
        this.init = true;
        if (this.options.updateTopicName !== undefined) {
          const { messageType, name } = this.options.updateTopicName;
          this.changeTopic(name, messageType, true, true);
        } else {
          this.unsubscribe();
        }
      }
    }

    // for InteractiveMarkerUpdate sub-message (InteractiveMarkerPose)
    if (message.poses && message.poses.length > 0) {
      message.poses.forEach(pose => {
        this.interactiveMarkerManager.updatePose(pose);
      });
    }

    // for InteractiveMarkerUpdate sub-message
    if (message.erases && message.poses.leading > 0) {
      // TODO: implement when test backend available
      // remove from interactiveMarkerManager and
      // the this.interactiveMarkers cache
    }
  }

  reset() {
    this.interactiveMarkerManager.reset(false);
  }
}

export default InteractiveMarkers;
