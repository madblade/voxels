/**
 *
 */

'use strict';

import RigidBodies from './rigid_bodies/rigid_bodies';
import Orderer from './rigid_bodies/orderer';

class FrontEnd {

    constructor(physicsEngine) {
        // Model access.
        this._physicsEngine = physicsEngine;
        
        // Internals.
        this._rigidBodies   = new RigidBodies();
        this._orderer       = new Orderer(physicsEngine.entityModel, physicsEngine.xModel);
        this._stamp         = process.hrtime();
    }

    solve() {
        
        let physicsEngine = this._physicsEngine,
            rigidBodies = this._rigidBodies,
            orderer = this._orderer;
        
        let em = physicsEngine.entityModel,
            wm = physicsEngine.worldModel,
            xm = physicsEngine.xModel,
            ob = physicsEngine.outputBuffer;
        
        let Δt = process.hrtime(this._stamp)[1];
        
        rigidBodies.solve(orderer, em, wm, xm, ob, Δt);
        
        // RigidBodies.solve(this, Δt);
        this._stamp = process.hrtime();
    
    }

    // Can be triggered to change physics behaviour.
    shuffleGravity() {
        let rigidBodies = this._rigidBodies;
        let g = rigidBodies.gravity;
        rigidBodies.gravity = [g[2], g[0], g[1]];   
        //let g = RigidBodies.gravity;
        //RigidBodies.gravity = [g[2], g[0], g[1]];
    }

}

export default FrontEnd;
