/**
 *
 */

'use strict';

import $ from 'jquery';

let ListenerModule = {
    /**
     * Keyboard behaviour when a key is pressed.
     */
    registerKeyDown() {
        let app = this.app;

        $(window).keydown(function(event) {
            event.preventDefault();
            if (!event.keyCode) { return; }
            if (app.getState() !== 'ingame') return;

            let k = this.keyControls;
            let clientModel = app.model.client;
            let graphics = app.engine.graphics;

            switch (event.keyCode) {
                case k.arrowUp:
                case k.leftHandUp:
                    clientModel.triggerEvent('m', 'f');
                    break;
                case k.arrowRight:
                case k.leftHandRight:
                    clientModel.triggerEvent('m', 'r');
                    break;
                case k.arrowLeft:
                case k.leftHandLeft:
                    clientModel.triggerEvent('m', 'l');
                    break;
                case k.arrowDown:
                case k.leftHandDown:
                    clientModel.triggerEvent('m', 'b');
                    break;
                case k.shift:
                    clientModel.triggerEvent('m', 'd');
                    break;
                case k.space:
                    clientModel.triggerEvent('m', 'u');
                    break;
                case k.leftHandEast2: // F
                    clientModel.triggerChange('camera', ['toggle']);
                    break;
                case k.leftHandNorthEast2: // R
                    clientModel.triggerChange('interaction', ['toggle']);
                    break;
                case k.pageUp: // Change item orientation
                case k.pageDown: // Same as there are only 2 possible item orientation ATM.
                    clientModel.triggerChange('interaction', ['itemOrientation', 1]);
                    break;
                case k.leftHandEast3: // (G)ravity.
                    clientModel.triggerEvent('a', 'g');
                    break;

                case k.leftHandNorthWest: // A
                    // TODO debug here
                    break;

                // TODO [HIGH] up rotation testing
                case k.padFour:     // Left
                    graphics.cameraManager.addCameraRotationEvent(0, 0, Math.PI / 2, 0);
                    break;
                case k.padSix:      // Right
                    graphics.cameraManager.addCameraRotationEvent(0, 0, -Math.PI / 2, 0);
                    break;
                case k.padFive:     // Down
                    graphics.cameraManager.addCameraRotationEvent(0, 0, 0, -Math.PI / 2);
                    break;
                case k.padEight:    // Up
                    graphics.cameraManager.addCameraRotationEvent(0, 0, 0, Math.PI / 2);
                    break;

                case k.enter:
                    /*
                     TODO for chat:
                     1. remove keyboard and mouse listeners until the user has finished typing.
                     2. show AOE-like dialog for chat messages
                     3. on validate, send message to server via chat module
                     Maybe a better option: create a new 'chatting' state using stateManager, that takes care of
                     key, mouse (and other like touch) listeners.
                     */
                    break;

                default:
                // this.stopKeyboardInteraction();
            }
        }.bind(this));
    },

    // Manage alt-tab like border effects
    stopKeyboardInteraction() {
        let clientModel = this.app.model.client;
        clientModel.triggerEvent('m', 'xx');
    },

    /**
     * Keyboard behaviour when a key is released.
     */
    registerKeyUp() {
        let app = this.app;
        // let graphics = app.engine.graphics;

        // TODO [CRIT] 3Dize
        $(window).keyup(function(event) {
            event.preventDefault();
            if (!event.keyCode) return;
            if (app.getState() !== 'ingame') return;

            let k = this.keyControls;
            let clientModel = app.model.client;

            switch (event.keyCode) {
                case k.arrowUp:
                case k.leftHandUp:
                    clientModel.triggerEvent('m', 'fx');
                    break;
                case k.arrowRight:
                case k.leftHandRight:
                    clientModel.triggerEvent('m', 'rx');
                    break;
                case k.arrowLeft:
                case k.leftHandLeft:
                    clientModel.triggerEvent('m', 'lx');
                    break;
                case k.arrowDown:
                case k.leftHandDown:
                    clientModel.triggerEvent('m', 'bx');
                    break;
                case k.shift:
                    clientModel.triggerEvent('m', 'dx');
                    break;
                case k.space:
                    clientModel.triggerEvent('m', 'ux');
                    break;
                default:
            }
        }.bind(this));
    },

    unregisterKeyDown() {
        $(window).off('keydown');
    },

    unregisterKeyUp() {
        $(window).off('keyup');
    }

};

export { ListenerModule };