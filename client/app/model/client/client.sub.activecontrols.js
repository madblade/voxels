/**
 *
 */

'use strict';

App.Model.Client.prototype.getActiveControls = function() {
    return {
        forward: false,
        backwards: false,
        right: false,
        left: false,
        up: false,
        down: false
    };
};
