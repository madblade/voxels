'use strict';

import extend           from '../../../extend.js';
import { Vector3 } from 'three';

let Entity = function(id, graphicalComponent, worldId)
{
    this.id = id;
    this.graphicalComponent = graphicalComponent;
    this.worldId = worldId;

    // Interpolation routines
    this.position = new Vector3(0, 0, 0);
    this.rotation = new Vector3(0, 0, 0);
    this.lastUpdateTime = this.getTime();
    this.lastPFromServer = new Vector3(0, 0, 0);
    this.currentPFromServer = new Vector3(0, 0, 0);
    this.interpolatingP = new Vector3(0, 0, 0);
    this.lastRFromServer = new Vector3(0, 0, 0);
    this.currentRFromServer = new Vector3(0, 0, 0);
    this.interpolatingR = new Vector3(0, 0, 0);
    this.needsUpdate = true;
};

extend(Entity.prototype, {

    getObject3D() {
        return this.graphicalComponent;
    },

    getWorldId() {
        return this.worldId;
    },

    setWorldId(worldId) {
        this.worldId = worldId;
    },

    getTime() {
        return window.performance.now();
    }

});

export { Entity };
