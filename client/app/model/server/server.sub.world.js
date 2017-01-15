/**
 *
 */

'use strict';

App.Model.Server.WorldModel = function(app) {
    this.app = app;

    // Model component

    // Graphical component
    var graphics = app.engine.graphics;
    this.needsUpdate = false;

    this.light = graphics.createLight('hemisphere');
    this.light.position.set(0.5, 1, 0.75);

};

App.Model.Server.WorldModel.prototype.init = function() {
    var graphics = this.app.engine.graphics;
    var selfModel = this.app.model.server.selfModel;
    var worldId = selfModel.worldId;

    // TODO [CRIT] couple with knot model.
    // graphics.addToScene(this.light, worldId);
};

App.Model.Server.WorldModel.prototype.refresh = function() {
    if (!this.needsUpdate) return;
    var graphics = this.app.engine.graphics;
    this.needsUpdate = false;
};

App.Model.Server.WorldModel.prototype.updateWorld = function() {
    this.needsUpdate = true;
};
