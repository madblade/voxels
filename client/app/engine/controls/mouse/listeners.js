/**
 *
 */

'use strict';

import { $ }                from '../../../modules/polyfills/dom.js';

let ListenerModule = {

    registerMouseDown() {
        let scope = this;
        let app = this.app;

        $(window).mousedown(function(event) {
            if (app.getState() !== 'ingame') return;
            switch (event.which) {
                case scope.buttons.left:
                    /*
                     There is a bug with some laptop touch pads that prevents the browser from triggering
                     the LEFT click when a 'keydown' event was fired in the near past (~200ms?).
                     In this case, it will be impossible to move and add a block at the same time with basic controls.
                     Everything works OK with the right and middle click (i.e. both on touch pads), so just
                     make the user reassign the 'left click' control key if he is in such a case.
                     */
                    scope.onLeftMouseDown();
                    break;
                case scope.buttons.middle:
                    scope.onMiddleMouseDown();
                    break;
                case scope.buttons.right:
                    scope.onRightMouseDown();
                    break;
                default:
            }
        });
    },

    onLeftMouseDown() {
        let clientModel = this.app.model.client;
        //let serverModel = this.app.model.server;
        let graphicsEngine = this.app.engine.graphics;

        // Perform intersection.
        let intersects = graphicsEngine.cameraManager.performRaycast();
        if (intersects.length <= 0) {
            console.log('[LeftMouse] Nothing intersected.');
            return;
        }
        intersects.sort(function(a, b) { return a.distance > b.distance; });
        let point = intersects[0].point;

        // Compute blocks.
        let flo = Math.floor;
        let abs = Math.abs;
        //let p1 = serverModel.getSelfModel().getSelfPosition();
        //let p2 = serverModel.getSelfModel().getHeadPosition();
        //let px = p1[0]+p2.x, py = p1[1]+p2.y, pz = p1[2]+p2.z;
        let p = graphicsEngine.getCameraCoordinates();
        let px = p.x; let py = p.y; let pz = p.z;

        let rx = point.x; let ry = point.y; let rz = point.z;
        let dx = abs(abs(flo(rx)) - abs(rx));
        let dy = abs(abs(flo(ry)) - abs(ry));
        let dz = abs(abs(flo(rz)) - abs(rz));
        let ex = dx < 0.0000001; let ey = dy < 0.0000001; let ez = dz < 0.0000001;

        if (ex + ey + ez !== 1) {
            // TODO [HIGH] how do I remove an X?
            console.warn('[OnLeftMouse] Error: precision on intersection @addBlock');
            return;
        }

        let fx1; let fy1; let fz1;
        let positiveIsFree = true; // direct + axis is empty
        if (ex) {
            positiveIsFree = px > rx;
            if (positiveIsFree) {
                fx1 = rx; fy1 = flo(ry); fz1 = flo(rz);
            } else if (px < rx) {
                fx1 = rx - 1; fy1 = flo(ry); fz1 = flo(rz);
            }
        } else if (ey) {
            positiveIsFree = py > ry;
            if (positiveIsFree) {
                fx1 = flo(rx); fy1 = ry; fz1 = flo(rz);
            } else if (py < ry) {
                fx1 = flo(rx); fy1 = ry - 1; fz1 = flo(rz);
            }
        } else if (ez) {
            positiveIsFree = pz > rz;
            if (positiveIsFree) {
                fx1 = flo(rx); fy1 = flo(ry); fz1 = rz;
            } else if (pz < rz) {
                fx1 = flo(rx); fy1 = flo(ry); fz1 = rz - 1;
            }
        }

        let fx2; let fy2; let fz2;
        let cameraPosition = graphicsEngine.cameraManager.mainCamera.getCameraPosition();
        let angle = 0;
        if (ex) {
            fx2 = positiveIsFree ? fx1 + 1 : fx1 - 1;
            fy2 = fy1;
            fz2 = fz1;
            angle = Math.atan2(fz2 + 0.5 - cameraPosition.z, fy2 + 0.5 - cameraPosition.y);
        } else if (ey) {
            fx2 = fx1;
            fy2 = positiveIsFree ? fy1 + 1 : fy1 - 1;
            fz2 = fz1;
            angle = Math.atan2(fz2 + 0.5 - cameraPosition.z, fx2 + 0.5 - cameraPosition.x);
        } else if (ez) {
            fx2 = fx1;
            fy2 = fy1;
            fz2 = positiveIsFree ? fz1 + 1 : fz1 - 1;
            angle = Math.atan2(fy2 + 0.5 - cameraPosition.y, fx2 + 0.5 - cameraPosition.x);
        }
        clientModel.selfComponent.setAngleFromIntersectionPoint(angle.toFixed(4));

        clientModel.triggerEvent('ray', ['add', fx1, fy1, fz1, fx2, fy2, fz2]);
    },

    onRightMouseDown() {
        let clientModel = this.app.model.client;
        // let serverModel = this.app.model.server;
        let graphicsEngine = this.app.engine.graphics;

        let intersects = graphicsEngine.cameraManager.performRaycast();
        if (intersects.length <= 0) {
            console.log('[RightMouse] Nothing intersected.');
            return;
        }
        intersects.sort(function(a, b) { return a.distance > b.distance; });
        let point = intersects[0].point;

        // Compute blocks.
        let flo = Math.floor;
        let abs = Math.abs;
        let p = graphicsEngine.getCameraCoordinates();
        let px = p.x; let py = p.y; let pz = p.z;

        let rx = point.x; let ry = point.y; let rz = point.z;
        let dx = abs(abs(flo(rx)) - abs(rx));
        let dy = abs(abs(flo(ry)) - abs(ry));
        let dz = abs(abs(flo(rz)) - abs(rz));
        let ex = dx < 0.0000001; let ey = dy < 0.0000001; let ez = dz < 0.0000001;

        if (ex + ey + ez !== 1) {
            console.warn('[OnRightMouse] Error: precision on intersection @addBlock');
            return;
        }

        let fx; let fy; let fz;
        if (ex) {
            if (px < rx) {
                fx = rx; fy = flo(ry); fz = flo(rz);
            } else if (px > rx) {
                fx = rx - 1; fy = flo(ry); fz = flo(rz);
            }
        } else if (ey) {
            if (py < ry) {
                fx = flo(rx); fy = ry; fz = flo(rz);
            } else if (py > ry) {
                fx = flo(rx); fy = ry - 1; fz = flo(rz);
            }
        } else if (ez) {
            if (pz < rz) {
                fx = flo(rx); fy = flo(ry); fz = rz;
            } else if (pz > rz) {
                fx = flo(rx); fy = flo(ry); fz = rz - 1;
            }
        }

        clientModel.triggerEvent('ray', ['del', fx, fy, fz]);
    },

    onMiddleMouseDown() {
    },

    registerMouseWheel() {
        let clientModel = this.app.model.client;

        $(window).mousewheel(function(event) {
            // let ex = event.deltaX;
            let ey = event.deltaY;
            // let df = event.deltaFactor;

            clientModel.triggerChange('interaction', ['itemOffset', ey]);
        });
    },

    unregisterMouseDown() {
        $(window).off('mousedown');
    },

    unregisterMouseWheel() {
        $(window).off('mousewheel');
    }

};

export { ListenerModule };
