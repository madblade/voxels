/**
 *
 */

'use strict';

import Game from '../../model/game/game';
import Flat3Factory from './factory';

class Flat3 extends Game {

    constructor(gameId, connector) {
        super(gameId, connector);

        // Utility parameters
        this._kind = 'flat3';
        this._refreshRate = 100;

        // Setup managers
        this._inputman = Flat3Factory.createUserInput();
        this._outputman = Flat3Factory.createUserOutput(this, this._playerman);
        this._physics = Flat3Factory.createPhysics();
        this._ai = Flat3Factory.createAI();
        this._objectman = Flat3Factory.createObjectManager();
        // super:_playerman

        // Setup behaviours
        this.configurePlayerManager();
    }

    configurePlayerManager() {
        this._playerman.setAddPlayerBehaviour((p) => {

        });

        this._playerman.setRemovePlayerBehaviour((p) => {

        });
    }

    // Model
    get playerman() { return this._playerman; }

    //^
    update() {
        this._inputman.update();    // First, update inputs
        this._physics.update();     // Update physical simulation
        this._objectman.update();   // Update board objects
        this._ai.update();          // Update perceptions, intents

        this._outputman.update();   // Send updates

        var n = this._playerman.nbPlayers;
        console.log("There " + (n>1?"are ":"is ") + n + " player" + (n>1?"s":"") + " connected.");
    }

}

export default Flat3;
