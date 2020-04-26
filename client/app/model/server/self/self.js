/**
 *
 */

'use strict';

import extend               from '../../../extend.js';

import { InventoryModel }   from './inventory.js';

let SelfModel = function(app) {
    this.app = app;
    this.xModel = null;

    // General.
    this.entityId = '-1';     // Self default
    this.worldId = '-1';      // Overworld default
    this.oldWorldId = null;

    // Model component.
    this.position = null;
    this.rotation = null;
    this.inventoryModel = new InventoryModel();

    // Graphical component.
    // let graphics = app.engine.graphics;
    this.worldNeedsUpdate = false;
    this.needsUpdate = false;
    this.displayAvatar = false;
    this.displayHandItem = true;

    this.avatar = null;
    this.handItem = null;
};

extend(SelfModel.prototype, {

    init() {
        let graphics = this.app.engine.graphics;
        this.loadSelf(graphics);
    },

    refresh() {
        if (!this.needsUpdate) return;

        let register = this.app.register;
        let graphics = this.app.engine.graphics;
        let clientModel = this.app.model.client;

        let avatar = this.avatar;
        let handItem = this.handItem;
        let up = this.position;
        let r = this.rotation;
        let id = this.entityId;

        if (!avatar) return;

        let p = avatar.position;

        if (this.worldNeedsUpdate && this.oldWorldId) {
            console.log('Updating world!');
            console.log(this.worldId);
            let xModel = this.xModel;
            let worldId = this.worldId;
            let oldWorldId = this.oldWorldId;
            let displayAvatar = this.displayAvatar;
            let displayHandItem = this.displayHandItem;

            if (displayAvatar) graphics.removeFromScene(avatar, oldWorldId);
            else if (displayHandItem) graphics.removeFromScene(handItem, oldWorldId);
            graphics.switchToScene(oldWorldId, worldId);
            xModel.switchAvatarToWorld(oldWorldId, worldId);
            if (displayAvatar) graphics.addToScene(avatar, worldId);
            else if (displayHandItem) graphics.addToScene(handItem, worldId);
            xModel.forceUpdate = true;
        }

        if (up !== null && r !== null && p !== null) {
            //console.log('Updating position!');
            //console.log(up);

            let animate = p.x !== up[0] || p.y !== up[1];
            p.x = up[0]; p.y = up[1]; p.z = up[2];

            // Notify modules.
            register.updateSelfState({position: [p.x, p.y, p.z]});

            avatar.rotation.z = r[2];
            avatar.rotation.x = r[3];
            avatar.getWrapper().rotation.y = Math.PI + r[0];

            // let camr = graphics.cameraManager.mainCamera.get3DObject().rotation;
            let theta0 = r[2];
            let theta1 = r[3];
            // let upv = graphics.cameraManager.mainCamera.get3DObject().rotation;
            // let theta0Old = upv.z;
            // let theta1Old = upv.x;
            let cam = graphics.cameraManager.mainCamera;
            // let rotationZ = cam.getZRotation();
            let rotationX = cam.getXRotation();
            graphics.cameraManager.setAbsRotation(theta0, theta1);
            // TODO [HIGH] compute delta transmitted from last time
            graphics.cameraManager.setRelRotation(r[0], rotationX);

            // mainCamera.setUpRotation(theta1, 0, theta0);
            // moveCameraFromMouse(0, 0, newX, newY);

            // Update animation.
            if (animate) graphics.updateAnimation(id);

            // Update camera.
            clientModel.pushForLaterUpdate('camera-position', this.position);
            //clientModel.selfComponent.processChanges();
            graphics.cameraManager.updateCameraPosition(this.position);

            if (handItem) {
                let mc = graphics.cameraManager.mainCamera;
                handItem.position.copy(mc.up.position);
                // handItem.rotation.x = mc.pitch.rotation.x;
                // handItem.rotation.z = mc.yaw.rotation.z;
            }
        }

        this.worldNeedsUpdate = false;
        this.needsUpdate = false;
    },

    cameraMoved(cameraObject) {
        let handItem = this.handItem;
        if (!handItem) return;
        handItem.rotation.x = cameraObject.pitch.rotation.x;
        handItem.rotation.z = cameraObject.yaw.rotation.z;
    },

    updateSelf(p, r, w) {
        w = w.toString();

        let pos = this.position;
        let rot = this.rotation;
        let wid = this.worldId;
        if (!pos || !rot ||
            pos[0] !== p[0] || pos[1] !== p[1] || pos[2] !== p[2] ||
            rot[0] !== r[0] || rot[1] !== r[1])
        {
            this.position = p;
            this.rotation = r;
            this.needsUpdate = true;
        }

        if (!wid || wid !== w) {
            this.worldNeedsUpdate = true;
            this.oldWorldId = this.worldId;
            this.worldId = w;
        }
    },

    loadSelf(graphics) {
        // Player id '-1' never used by any other entity.
        let entityId = this.entityId;
        let worldId = this.worldId;
        let selfModel = this;

        graphics.initializeEntity(entityId, 'steve', function(createdEntity) {
            let object3d = graphics.finalizeEntity(entityId, createdEntity);
            selfModel.avatar = object3d;
            if (selfModel.displayAvatar) graphics.addToScene(object3d, worldId);
        });

        graphics.loadItemMesh('katana', function(gltfObject) {
            selfModel.handItem = gltfObject;
            if (!selfModel.displayAvatar) graphics.addToScene(gltfObject, worldId);
        });
    },

    getSelfPosition() {
        return this.position;
    },

    getHeadPosition() {
        let head = this.avatar.getHead();
        if (!head) return null;
        return head.position;
    },

    getInventory() {
        return this.inventoryModel;
    },

    cleanup() {
        // General
        this.entityId = '-1';
        this.worldId = '-1';
        this.oldWorldId = null;

        // Model component.
        this.position = [0, 0, 0];
        this.rotation = [0, 0, 0];
        this.inventoryModel.reset();

        // Graphical component.
        this.worldNeedsUpdate = false;
        this.needsUpdate = false;
        this.displayAvatar = false;

        this.avatar = null;
        // TODO [LEAK] cleanup graphical component of avatar.
    }

});

export { SelfModel };
