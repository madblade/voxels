/**
 *
 */

'use strict';

import InputBuffer      from './input_buffer';
import OutputBuffer     from './output_buffer';

import FrontEnd         from './solver/frontend';
import Updater          from './updater/updater';

class PhysicsEngine {

    constructor(game) {
        // Models.
        this._entityModel   = game.entityModel;
        this._worldModel    = game.worldModel;
        this._xModel        = game.xModel;

        // Buffers.
        this._inputBuffer   = new InputBuffer();
        this._outputBuffer  = new OutputBuffer();

        // Engine.
        this._updater       = new Updater(this); // Parses input and updates model constraints.
        this._frontend      = new FrontEnd(this);  // Updates physical model.
    }

    get entityModel()   { return this._entityModel; }
    get worldModel()    { return this._worldModel; }
    get outputBuffer()  { return this._outputBuffer; }

    addInput(meta, avatar) {
        this._inputBuffer.addInput(meta, avatar)
    }

    update() {
        this._updater.update(this._inputBuffer.getInput());

        this._frontend.solve();

        this._inputBuffer.flush();
    }

    getOutput() {
        return this._outputBuffer.getOutput();
    }

    flushOutput() {
        this._outputBuffer.flushOutput(this._entityModel.entities);
    }

    shuffleGravity() {
        this._frontend.shuffleGravity();
    }

}

export default PhysicsEngine;
