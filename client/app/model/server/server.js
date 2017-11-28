/**
 * Contains game-specific data structures.
 */

'use strict';

import extend           from '../../extend.js';

import { ChunkModel }   from './chunks.js';
import { EntityModel }  from './entities/entities.js';
import { SelfModel }    from './self/self.js';
import { XModel }       from './x/x.js';

import { UpdateModule } from './updates.js';

var Server = function(app) {
    this.app = app;

    this.selfModel      = new SelfModel(app);
    this.chunkModel     = new ChunkModel(app);
    this.entityModel    = new EntityModel(app);
    this.xModel         = new XModel(app, this.selfModel);
    this.selfModel.xModel = this.xModel;

    this.isRunning = false;
};

extend(Server.prototype, UpdateModule);

extend(Server.prototype, {

    init: function() {
        this.isRunning = true;
        this.selfModel.init();
        this.chunkModel.init();
        this.entityModel.init();
        this.xModel.init();
    },

    stop: function() {
        this.isRunning = false;
    },

    // Update graphics.
    refresh: function() {
        this.selfModel.refresh();
        this.chunkModel.refresh();
        this.entityModel.refresh();
        this.xModel.refresh();
    },

    getSelfModel: function() {
        return this.selfModel;
    }

});

export { Server };
