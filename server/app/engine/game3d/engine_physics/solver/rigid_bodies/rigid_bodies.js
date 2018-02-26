/**
 *
 */

'use strict';

import Integrator from './integrator';

import Searcher from '../collision/searcher';

import Phase1 from './rigid_bodies_phase_1';
import Phase2 from './rigid_bodies_phase_2';
import Phase3 from './rigid_bodies_phase_3';
import Phase4 from './rigid_bodies_phase_4';
import Phase5 from './rigid_bodies_phase_5';

class RigidBodies {

    static eps = .00000001;// .00001;

    constructor(refreshRate)
    {
        //
        this._gravity = [0, 0, 2 * -0.00980665];
        //this._gravity = [0, 0, 0];
        this._globalTimeDilatation = 25;
        //this._globalTimeDilatation = 0.05;
        this._refreshRate = refreshRate;

        this._variableGravity = false;
        this._worldCenter = [0, 0, -100];
        //
    }

    get gravity() { return this._gravity; }
    set gravity(g) { this._gravity = g; }
    get globalTimeDilatation() { return this._globalTimeDilatation; }
    get refreshRate() { return this._refreshRate; }

    // Advanced gravity management.
    getGravity(worldId, x, y, z) {
        if (this._variableGravity && parseInt(worldId, 10) === -1)
        {
            let direction = [0, 0, 0];
            let distance = 0;
            let center = this._worldCenter;

            direction[0] = center[0] - x;
            direction[1] = center[1] - y;
            direction[2] = center[2] - z;

            // TODO [LOW] compute attractor mass and force intensity
            // Keep in mind Gauss' Flow Theorem which states that
            // it should integrate over the radius from the center
            // to the min of (object position, attractor surface)
            // yielding 4/3 PI min(center-pos, attr radius)^3

            distance += (x - center[0]) * (x - center[0]);
            distance += (y - center[1]) * (y - center[1]);
            distance += (z - center[2]) * (z - center[2]);

            if (distance === 0)
                return [0, 0, 0];

            for (let i = 0; i < 3; ++i)
                direction[i] /= distance * distance; // Affectation occurs last.

            return direction;
        }
        return this._gravity;
    }

    // Advanced time flow customization.
    getTimeDilatation(worldId, x, y, z) {
        if (worldId === 666) {
            return 1 + Math.abs(x * y * z);
        }
        return 1;
    }

    solve(objectOrderer, eventOrderer, em, wm, xm, o, relativeDtMs)
    {
        // TODO [HIGH] solve several times according to delta timestep

        // const epsilon = RigidBodies.eps;

        const passId = Math.random();
        let timeDilatation = this.globalTimeDilatation;
        let absoluteDt = this.refreshRate / timeDilatation;
        let relativeDt = relativeDtMs / timeDilatation;
        //if (relativeDt !== 0.64) console.log(relativeDt);
        //let relativeDt = absoluteDt;
        // let maxSpeed = Entity.maxSpeed;
        // let maxSpeed2 = maxSpeed * maxSpeed;

        if (relativeDt > 3 * absoluteDt) {
            console.log('Warn: lagging at ' +
                `${Math.floor(100 * relativeDt / absoluteDt)}%.`);
            relativeDt = 3 * absoluteDt;
        }

        // Decouple entities from worlds.
        // A given entity can span across multiple worlds.
        let entities = em.entities;
        let events = eventOrderer.events;
        let abs = Math.abs;

        // TODO [HIGH] fill islands spanning in several worlds
        // TODO keep islands on place with double map (join/split islands)
        // let crossWorldIslands = new Map();

        // For each world,
        let eventUniverseAxes = eventOrderer.axes;
        let objectUniverseAxes = objectOrderer.axes;
        objectUniverseAxes.forEach((objectWorldAxes, worldId) => {
            let world = wm.getWorld(worldId);
            let eventWorldAxes = eventUniverseAxes.get(world);
            let oxAxis = objectWorldAxes[0];
            let oyAxis = objectWorldAxes[1];
            let ozAxis = objectWorldAxes[2];
            let searcher = new Searcher(entities, oxAxis, oyAxis, ozAxis);

            if (oxAxis.length !== oyAxis.length || oxAxis.length !== ozAxis.length)
                throw Error('Inconsistent lengths among axes.');

            // 1. Sum inputs/impulses, fields.

            // 2. Compute (x_i+1, a_i+1, v_i+1), order Leapfrog's incremental term.
            //    Computation takes into account local time dilatation.
            // Summing constraints is done by summing globals (i.e. global gravity)
            // with local functional events (i.e. position-dependant gravity)
            // with local custom events (applied from the events array).

            // LOCAL EVENTS.
            if (eventWorldAxes)
                Phase1.processLocalEvents(eventOrderer, entities, events, worldId, eventWorldAxes, oxAxis);

            // GLOBAL EVENTS, INPUTS & COMPUTATIONS.
            let leapfrogArray = new Array(oxAxis.length);
            Phase1.processGlobalEvents(entities, worldId, relativeDt, oxAxis, leapfrogArray, passId, this);

            // Sort entities according to incremental term.
            // TODO [OPT] ideally, use states
            // TODO [OPT] ignore leapfrog == 0
            // Remember leapfrogs within objects, reordering them within islands
            // is probably better than sorting a potentially huge array.
            let inf = x => Math.max(abs(x[0]), abs(x[1]), abs(x[2]));
            leapfrogArray.sort((a, b) =>
                inf(b) - inf(a)
            );
            // Note: a - b natural order, b - a reverse order
            // abs(b[0]) + abs(b[1]) + abs(b[2]) - abs(a[0]) - abs(a[1]) - abs(a[2])

            // Rebuild mapping after having sorted leapfrogs.
            let reverseLeapfrogArray = new Int32Array(leapfrogArray.length);
            for (let i = 0, l = leapfrogArray.length; i < l; ++i)
                reverseLeapfrogArray[leapfrogArray[i][3]] = i;

            // 4. Compute islands, cross world, by axis order.
            let numberOfEntities = leapfrogArray.length;
            let oxToIslandIndex = new Int32Array(numberOfEntities);
            let islands = [];

            Phase2.computeIslands(leapfrogArray, searcher, oxToIslandIndex, islands);
            //console.log(numberOfEntities + ' entities');
            // console.log(islands);
            //console.log(oxToIslandIndex);

            // 3. Snap x_i+1 with terrain collide, save non-integrated residuals
            // as bounce components with coefficient & threshold (heat).
            Phase2.collideLonelyIslandsWithTerrain(oxAxis, entities, oxToIslandIndex, world);

            // TODO [MEDIUM] crossWorldIslands;
            // add leapfrog term
            // get array of all xs sorted by axis

            // 5. Broad phase: in every island, recurse from highest to lowest leapfrog's term
            //    check neighbours for min distance in linearized trajectory
            //    detect and push PROBABLY COLLIDING PAIRS.

            // 6. Narrow phase, part 1: for all probably colliding pairs,
            //    solve X² leapfrog, save first all valid Ts
            //    keep list of ordered Ts across pairs.
            if (islands.length > 0) {
                //console.log('Islands: ');
                // console.log(islands);
            }

            islands.forEach(island => {
                // island.sort((a,b) => reverseLeapfrogArray[b] - reverseLeapfrogArray[a]);
                let mapCollidingPossible = [];
                // let bannedPairs = [];

                // 1. Sort colliding possible.

                // Solve leapfrog and sort according to time.
                Phase3.solveLeapfrogQuadratic(
                    island,
                    oxAxis, entities, relativeDt,
                    mapCollidingPossible);
                // TODO [MEDIUM think order by mass

                // if (mapCollidingPossible.length > 0) console.log(mapCollidingPossible);

                // Narrow phase, part 2: for all Ts in order,
                //    set bodies as 'in contact' or 'terminal' (terrain),
                //    compute new paths (which )are not more than common two previous) while compensating forces
                //    so as to project the result into directions that are not occluded
                //      -> bouncing will be done in next iteration to ensure convergence
                //      -> possible to keep track of the energy as unsatisfied work of forces
                //    solve X² leapfrog for impacted trajectories and insert new Ts in the list (map?)
                //    End when there is no more collision to be solved.
                mapCollidingPossible.sort((a, b) => a[2] - b[2]);

                // TODO [CRIT] iterate
                // 2. First colliding ->
                //      join
                //      move to collision point
                //      compute new trajectory (leapfrog²)
                //      collide again with terrain
                //      compute colliding possible with all others
                //      (invalidate collision with others) -> optional (discarded afterwards anyway)

                let subIslandsX = []; // For sub-sampled physics, must be sorted and
                let subIslandsY = []; // kept coherent before every pass in the I/J collider.
                let subIslandsZ = [];

                let objectIndexInIslandToSubIslandXIndex = new Int16Array(island.length);
                let objectIndexInIslandToSubIslandYIndex = new Int16Array(island.length);
                let objectIndexInIslandToSubIslandZIndex = new Int16Array(island.length);

                objectIndexInIslandToSubIslandXIndex.fill(-1);
                objectIndexInIslandToSubIslandYIndex.fill(-1);
                objectIndexInIslandToSubIslandZIndex.fill(-1);

                // TODO [remember] displace from extreme position towards + to avoid terrain intercollision
                // TODO [remember] no tunneling: use a temporary position for successively adjusting collisions
                // TODO [remember] increase island widths with a possible displacement from a w-width impact object
                // TODO [CRIT] account for last point!!!!!!!!

                // Pour chaque entité dans l'île courante:
                // console.log(mapCollidingPossible);
                while (mapCollidingPossible.length > 0)
                {
                    // TODO [MEDIUM] study island caching.
                    let debuguette = '';
                    debuguette = `\tPass ${mapCollidingPossible.length} `;
                    for (let m = 0; m < mapCollidingPossible.length; ++m) {
                        debuguette += `(${mapCollidingPossible[m][0]}, ${mapCollidingPossible[m][1]}) ; `;
                    }
                    //console.log(debuguette);
                    // \DEBUG

                    let i = mapCollidingPossible[0][0];     // island 1 index
                    let j = mapCollidingPossible[0][1];     // island 2 index
                    let r = mapCollidingPossible[0][2];     // time got by solver
                    let axis = mapCollidingPossible[0][3];  // 'x', 'y', 'z' or 'none'

                    let subIslandI = Phase3.getSubIsland(i, axis,
                        objectIndexInIslandToSubIslandXIndex,
                        objectIndexInIslandToSubIslandYIndex,
                        objectIndexInIslandToSubIslandZIndex,
                        subIslandsX, subIslandsY, subIslandsZ);

                    let subIslandJ = Phase3.getSubIsland(j, axis,
                        objectIndexInIslandToSubIslandXIndex,
                        objectIndexInIslandToSubIslandYIndex,
                        objectIndexInIslandToSubIslandZIndex,
                        subIslandsX, subIslandsY, subIslandsZ);

                    let newSubIsland = Phase3.mergeSubIslands(
                        i, j, subIslandI, subIslandJ,
                        objectIndexInIslandToSubIslandXIndex,
                        objectIndexInIslandToSubIslandYIndex,
                        objectIndexInIslandToSubIslandZIndex,
                        subIslandsX, subIslandsY, subIslandsZ, axis);

                    Phase3.applyCollision(
                        i, j, r, axis,
                        island, oxAxis, entities, relativeDt, 0);

                    // 1. apply step to newSubIsland
                    // 2.1. invalidate for each (newSubIslandMember)
                    // 2.2. resolve for each (newSubIslandMember x anyother)
                    // 3. update mapCollidingPossible

                    // Warn: account for numerical errors.


                    // TODO [CRIT] extract routine for Leapfrog computaiton.
                    // TODO [CRIT] changer applyCollision (p1 juste changé) pour mettre p0 = p1(c)
                    // TODO [CRIT] et p1 = solve(dt = dt0-r, entité).
                    // Si dt0-r = 0
                    // TODO [CRIT] calculer dx(i),dy(i),dz(i) et dx(j),dy(j),dz(j)
                    // puis pour tout x€Sub(i), y€Sub(j), appliquer le même différentiel.
                    // -> optimisation dans le cas où d(dt) = 0.
                    // sinon, si pour un certain (x,y,z), d(dt)(x,y,z) != 0, alors utiliser
                    // la formule Leapfrog.

                    // (*) On calcule v_newIsland et a_newIsland (additif).
                    // (*) à t0 + r, toutes les entités dans island1 + island2
                    // sont mises à p0(entité) = p0(entité) + solve(r, v_entité, a_entité).
                    // (*) puis, p1(entité) = p0(entité) + solve(t1-r, v_newIsland, a_newIsland).
                    // (*) enfin, v0(entité) = v_newIsland et a0(entité) = a_newIsland
                    // (*) retirer tout membre appartenant à newIsland de mapCollidingPossible
                    // (*) effectuer un leapfrog sur NewIsland \cross Complementaire(NewIsland)
                    // et stocker le résultat avec r inchangé dans mapCollidingPossible.
                    Phase4.solveIslandStepLinear(
                        mapCollidingPossible,
                        i, j, r, axis, subIslandI, subIslandJ, newSubIsland, entities,
                        objectIndexInIslandToSubIslandXIndex,
                        objectIndexInIslandToSubIslandYIndex,
                        objectIndexInIslandToSubIslandZIndex,
                        oxAxis, island, world, relativeDt);
                }
                // console.log('Solveth!');
            });

            // 7. Apply new positions, correct (v_i+1, a_i+1) and resulting constraints,
            //    smoothly slice along constrained boundaries until component is extinct.

            // Integration.
            Phase5.applyIntegration(
                entities, worldId, oxAxis, world,
                xm, objectOrderer, searcher, o);

            // 8. Perform updates in optimization structures.
            //    Perform updates in consistency maps.

            // Legacy.
            // for (let i = 0, l = oxAxis.length; i < l; ++i)
            // {
            //     let entityId = oxAxis[i].id;
            //     let entity = entities[entityId];
            //     if (!entity) throw Error('[Physics/Rigid bodies]: ' +
            //         'processing undefined entities, abort.');
            //     const entityUpdated = this.linearSolve(objectOrderer, entity, em, wm, xm, world, relativeDt);
            //     if (entityUpdated) o.entityUpdated(entityId);
            // }
        });
    }

    // Legacy.
    linearSolve(orderer, entity, em, wm, xm, world, dt) {
        if (!entity || !entity.rotation) return;
        const theta = entity.rotation[0];
        const ds = entity.directions;
        const pos = entity.position;
        let impulseSpeed = [0, 0, 0];
        let force = [0, 0, 0];
        this.computeDesiredSpeed(entity, impulseSpeed, theta, ds, dt);
        this.sumGlobalFields(force, pos, entity);
        // RigidBodies.sumLocalFields(force, pos, EM);
        let hasUpdated = Integrator.updatePosition(orderer, dt, impulseSpeed, force, entity, em, wm, xm, world);
        return hasUpdated;
    }

    quadraticSolve(entity, em, wm, xm, world, dt) {
        const theta = entity.rotation[0];
        const ds = entity.directions;
        const pos = entity.position;
        let impulseSpeed = [0, 0, 0];
        let force = [0, 0, 0];
        let hasUpdated = false;
        this.computeDesiredSpeed(entity, impulseSpeed, theta, ds, dt);
        this.sumGlobalFields(force, pos, entity);
        this.sumLocalFields(force, pos, em);
        // TODO [TEST] n^2 engine
        hasUpdated = Integrator.updatePosition(dt, impulseSpeed, force, entity, em, world, xm);
        return hasUpdated;
    }

    static add(result, toAdd) {
        result[0] += toAdd[0];
        result[1] += toAdd[1];
        result[2] += toAdd[2];
    }

    // TODO [CRIT] rename to FreeForwardVector
    // TODO [CRIT] implement constrained 2D-3D rotation need vector.

    computeDesiredSpeed(entity, speed, theta, ds, dt) {
        let desiredSpeed = [0, 0, 0];
        const gravity = this.gravity;
        const pi4 = Math.PI / 4;

        if (ds[0] && !ds[3]) // forward quarter
        {
            let theta2 = theta;
            if (ds[1] && !ds[2]) // right
                theta2 -= pi4;
            else if (ds[2] && !ds[1]) // left
                theta2 += pi4;
            desiredSpeed[0] = -Math.sin(theta2);
            desiredSpeed[1] = Math.cos(theta2);
        }
        else if (ds[3] && !ds[0]) // backward quarter
        {
            let theta2 = theta;
            if (ds[1] && !ds[2]) // right
                theta2 += pi4;
            else if (ds[2] && !ds[1]) // left
                theta2 -= pi4;
            desiredSpeed[0] = Math.sin(theta2);
            desiredSpeed[1] = -Math.cos(theta2);
        }
        else if (ds[1] && !ds[2]) // exact right
        {
            desiredSpeed[0] = Math.cos(theta);
            desiredSpeed[1] = Math.sin(theta);
        }
        else if (ds[2] && !ds[1]) // exact left
        {
            desiredSpeed[0] = -Math.cos(theta);
            desiredSpeed[1] = -Math.sin(theta);
        }

        let godMode = false;
        if (godMode) {
            desiredSpeed[2] = ds[4] && !ds[5] ?
                1 :
                ds[5] && !ds[4] ? -1 : 0;
        } else
            if (ds[4] && !ds[5]) {
                for (let i = 0; i < 3; ++i) {
                    if (gravity[i] < 0 && entity.adherence[i]) {
                        entity.acceleration[i] = 3.3 / dt;
                        entity.jump(i); // In which direction I jump
                    }
                }
                for (let i = 3; i < 6; ++i) {
                    if (gravity[i - 3] > 0 && entity.adherence[i]) {
                        entity.acceleration[i - 3] = -3.3 / dt;
                        entity.jump(i); // In which direction I jump
                    }
                }
            }

        desiredSpeed[0] *= 0.65;
        desiredSpeed[1] *= 0.65;
        desiredSpeed[2] *= 0.65;

        RigidBodies.add(speed, desiredSpeed);
    }

    sumGlobalFields(force, pos, entity) {
        // Gravity
        let g = this.gravity;
        let m = entity.mass;
        let sum = [g[0] * m, g[1] * m, g[2] * m];

        // sum[2] = 0; // ignore grav

        RigidBodies.add(force, sum);
    }

    sumLocalFields(force/*, pos, EM*/) {
        let sum = [0, 0, 0];
        RigidBodies.add(force, sum);
    }

}

export default RigidBodies;
