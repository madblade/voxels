/**
 *
 */

'use strict';

import Integrator from './integrator';

import ObjectOrderer from './orderer_objects.js';
import EventOrderer from './orderer_events';
import Entity from '../../../model_entity/entity';

import TerrainCollider from '../collision/terrain';
import XCollider from '../collision/x';
import Searcher from '../collision/searcher';

class RigidBodies {

    static eps = 0;// .00001;
    
    constructor(refreshRate) {
        
        // 
        this._gravity = [0, 0, 2 * -0.00980665];
        //this._gravity = [0, 0, 0];
        this._globalTimeDilatation = 25;
        //this._globalTimeDilatation = 0.05;
        this._refreshRate = refreshRate;
        
        //
        
    }

    get gravity() { return this._gravity; }
    set gravity(g) { this._gravity = g; }
    get globalTimeDilatation() { return this._globalTimeDilatation; }
    get refreshRate() { return this._refreshRate; }
    
    // Advanced gravity management.
    getGravity(worldId, x, y, z) {
        return this._gravity;
    }
    
    // Advanced time flow customization.
    getTimeDilatation(worldId, x, y, z) {
        return 1;
    }
    
    solve(objectOrderer, eventOrderer, em, wm, xm, o, relativeDtMs) {

        // TODO [HIGH] solve several times according to delta timestep
        
        const passId = Math.random();
        let timeDilatation = this.globalTimeDilatation;
        let absoluteDt = this.refreshRate / timeDilatation;
        let relativeDt = relativeDtMs / timeDilatation;
        //let relativeDt = absoluteDt;
        let maxSpeed = Entity.maxSpeed;
        let maxSpeed2 = maxSpeed * maxSpeed;
        
        if (relativeDt > 3 * absoluteDt) {
            console.log('Warn: lagging at ' + 
                Math.floor(100 * relativeDt / absoluteDt) + '%.');
            relativeDt = 3 * absoluteDt;
        }
        
        // Decouple entities from worlds.
        // A given entity can span across multiple worlds.
        let entities = em.entities;
        let events = eventOrderer.events;
        let abs = Math.abs;
        
        // TODO [HIGH] fill islands spanning in several worlds
        // TODO keep islands on place with double map (join/split islands)
        let crossWorldIslands = new Map();
        
        // For each world,
        let eventUniverseAxes = eventOrderer.axes;
        let objectUniverseAxes = objectOrderer.axes;
        objectUniverseAxes.forEach((objectWorldAxes, worldId) => {
            
            let world = wm.getWorld(worldId);
            let eventWorldAxes = eventUniverseAxes.get(world);
            let oxAxis = objectWorldAxes[0],
                oyAxis = objectWorldAxes[1],
                ozAxis = objectWorldAxes[2],
                currentEntity;
            let maxWidth = Entity.maxWidth;
            let searcher = new Searcher(entities, oxAxis, oyAxis, ozAxis);
            
            // console.log(worldId + ' : ' + oxAxis.length);
            if (oxAxis.length !== oyAxis.length || oxAxis.length !== ozAxis.length)
                throw Error('Inconsistent lengts among axes.');
            
            // 1. Sum inputs/impulses, fields.
            
            // 2. Compute (x_i+1, a_i+1, v_i+1), order Leapfrog's incremental term.
            //    Computation takes into account local time dilatation.
            // Summing constraints is done by summing globals (i.e. global gravity)
            // with local functional events (i.e. position-dependant gravity)
            // with local custom events (applied from the events array).
            
            // LOCAL EVENTS.
            if (eventWorldAxes) {
                let exAxis = eventWorldAxes[0],
                    // TODO [MEDIUM] use other axes for faster solving.
                    eyAxis = eventWorldAxes[1],
                    ezAxis = eventWorldAxes[2];
                let lastEX = 0, lastEY, lastEZ;
                let eventIndex, entityIndex, currentEvent;
                let op, ep;
                let ox, oy, oz, ex, range;
                let wx, wy, wz;
                let maxRange = EventOrderer.maxRange;
                
                // For all entities.
                for (let oi = 0, ol = oxAxis.length; oi < ol; ++oi) 
                {
                    if (oxAxis[oi].kind !== 'e') continue;
                    entityIndex = oxAxis[oi].id;
                    currentEntity = entities[entityIndex];
                    op = currentEntity.position;
                    ox = op[0]; wx = currentEntity.widthX; 
                    oy = op[1]; wy = currentEntity.widthY;
                    oz = op[2]; wz = currentEntity.widthZ;
                    
                    // Search events.
                    for (let ei = lastEX, el = exAxis.length; ei < el; ++ei) {
                        eventIndex = exAxis[ei];
                        currentEvent = events[eventIndex];
                        ep = currentEvent.position;
                        ex = ep[0];
                        range = currentEntity.range;
                        
                        // Cache for next entities.
                        if (ox + maxWidth <= ex - maxRange) lastEX = ei;
                        
                        if (ox + wx < ex - range) continue; // Not yet.
                        if (ox - wx > ex + range) break; // Too far.
                        
                        // Out of bounds.
                        if (oy + wy < ep[1] - range) continue;
                        if (oz + wy < ep[2] - range) continue;
                        if (oy - wz > ep[1] + range) continue;
                        if (oz - wz > ep[2] + range) continue;
                        
                        // Apply effect to entity.
                        let a = currentEvent.effect.acceleration;
                        if (a) {
                            const dx = (ep[0]-op[0]),
                                  dy = (ep[1]-op[1]),
                                  dz = (ep[2]-op[2]);
                            const rat = Math.sqrt(a/(dx*dx+dy*dy+dz*dz));
                            let a1 = currentEntity.a1;
                            a1[0] += rat*dx;
                            a1[1] += rat*dy;
                            a1[2] += rat*dz;
                        }
                        
                    }
                }

                // Decrease event counters.
                eventOrderer.applyEventsInWorld(worldId);

            }
            
            // GLOBAL EVENTS, INPUTS & COMPUTATIONS.
            let leapfrogArray = new Array(oxAxis.length);
            for (let oi = 0, ol = oxAxis.length; oi < ol; ++oi) 
            {
                if (oxAxis[oi].kind !== 'e') continue;
                let entityIndex = oxAxis[oi].id;
                currentEntity = entities[entityIndex];
                let p0 = currentEntity.p0; let p1 = currentEntity.p1;
                let v0 = currentEntity.v0; let v1 = currentEntity.v1;
                let a0 = currentEntity.a0; let a1 = currentEntity.a1;
                let nu = currentEntity.nu; // Instantaneous speed.
                
                let localTimeDilatation = this.getTimeDilatation(worldId, p0[0], p0[1], p0[2]);
                const dta = absoluteDt * localTimeDilatation;
                const dtr = relativeDt * localTimeDilatation;
                currentEntity.dtr = dtr;
                
                // REAL PHYSICS, PART 1
                // Rules: the only non-gp physics entry point should be
                // acceleration. Speed might be accessed for lookup,
                // but should never be directly modified.
                // New positions are computed internally and cropped
                // should a collision occur with the terrain or another 
                // entity (or x).
                
                // x_i+1 = x_i + v_i*T + (a_i/2)*T²
                let inc = [0, 0, 0, entityIndex];
                let sum = 0;
                for (let i = 0; i < 3; ++i) // Account for server congestion / lag with relative dilatation.
                {
                    let increment = (v0[i] + nu[i]) * dtr + .5 * a0[i] * dtr * dtr;
                    inc[i] = increment;
                    sum += increment * increment;
                }
                
                // Max speed correction.
                // if (sum > maxSpeed2 * dtr)
                //     for (let i = 0; i < 3; ++i) inc[i] *= (maxSpeed * dtr) / sum;
                
                for (let i = 0; i < 3; ++i)
                    p1[i] = p0[i] + inc[i];
                
                // Associate incremental term with entity index.
                leapfrogArray[oi] = [inc[0], inc[1], inc[2], oi];
                
                // Apply globals and inputs.
                // a_i+1 = sum(constraints)
                let d = currentEntity.d; // Directions.
                let r = currentEntity.r; // Rotation.
                const maxV = currentEntity.getVelocity();
                const factor = Math.sqrt(maxV*1.05);
                let g = this.getGravity(worldId, p0[0], p0[1], p0[2]);
                //let vector = RigidBodies.getEntityForwardVector(d, r, factor, false); // 3D
                let vector = RigidBodies.getEntityForwardVector(d, r, factor, true); // Project 2D
                // console.log(vector);
                let abs = Math.abs, sgn = Math.sign;
                let adh = currentEntity.adherence;
                
                // TODO [CRIT] compute acc.: impulses with speed constraints, gravity.
                // Compute the exact acceleration which is necessary
                // to get to the cap speed at the next iteration.
                for (let i = 0; i < 3; ++i)
                {
                    let vi = vector[i];
                    if (adh[i] && vi > 0.05 && g[i] < 0) {
                        console.log("jump " + passId);
                        //vi = 0.1;
                        a1[i] += 0.22;
                        adh[i] = false; // TODO [CRIT] FIX ADHERENCE SETUP
                    }
                    else if (adh[3+i] && vi < -0.05 && g[i] > 0) {
                        console.log("antijump");
                        //vi = -.1;
                        a1[i] -= 0.22;
                        adh[3+i] = false;
                    }
                    
                    nu[i] = vi;
                }
            
                // TODO [HIGH] gp calibration (velocity++, curved jmp, gen3D)
                if (!adh[2] && g[2] < 0) {
                    nu[2] = 0;
                }
                
                for (let i = 0; i < 3; ++i)
                    a1[i] += g[i]; // N.B. f=ma => a=f/m => a=(P=mg)/m => a=g
                
                // Apply velocity formula with absolute time 
                // (lag would undesirably change topologies).
                // v_i+1 = v_i< + T*(a_i + a_i+1)/2
                sum = 0;
                for (let i = 0; i < 3; ++i)
                {
                    let v1i = v0[i] + dtr * .5 * (a0[i] + a1[i]);
                    v1[i] = v1i;
                    sum += (v1i * v1i);
                }
                
                // Velocity correction.
                // if (sum > maxSpeed * dtr)
                //     for (let i = 0; i < 3; ++i) v1[i] *= (maxSpeed * dtr / sum);
            }
            
            // Sort entities according to incremental term.
            // TODO [OPT] ideally, use states
            // Remember leapfrogs within objects, reordering them within islands
            // is probably better than sorting a potentially huge array.
            let inf = (x) => Math.max(abs(x[0]), abs(x[1]), abs(x[2]));
            leapfrogArray.sort((a, b) =>
                inf(b) - inf(a) 
            );
            // Note: a-b natural order, b-a reverse order
            // abs(b[0]) + abs(b[1]) + abs(b[2]) - abs(a[0]) + abs(a[1]) + abs(a[2])
            
            // Rebuild mapping after having sorted leapfrogs.
            let reverseLeapfrogArray = new Int32Array(leapfrogArray.length);
            for (let i = 0, l = leapfrogArray.length; i < l; ++i) {
                reverseLeapfrogArray[leapfrogArray[i][3]] = i;
            }
            
            // 4. Compute islands, cross world, by axis order.
            let numberOfEntities = leapfrogArray.length;
            let oxToIslandIndex = new Int32Array(numberOfEntities);
            oxToIslandIndex.fill(-2); // -2 unaffected, -1 isolated, 0+ index of island
            let islands = [];
            let islandIndex = 0;
            //console.log(numberOfEntities + " entities");
            for (let i = 0; i < numberOfEntities; ++i) {
                //console.log('\t'+i);
                let xIndex = leapfrogArray[i][3];
                let inheritedIslandIndex = oxToIslandIndex[xIndex];
                let newIsland = searcher.computeIsland(leapfrogArray, i);
                let il = newIsland.length;
                
                if (inheritedIslandIndex !== -2) {
                    if (inheritedIslandIndex === -1)
                        throw Error('[RigidBodies] @ islands: I think ' +
                            'no item present in an 1-island should be rediscovered ' +
                            'by the algorithm. (?)');
                    switch (il) {
                        case 0:
                            // throw Error('[RigidBodies] got a 0-length island.');
                            break;
                        case 1:
                            if (oxToIslandIndex[newIsland[0]] !== inheritedIslandIndex)
                                throw Error('[RigidBodies] @ islands: verification failed ' +
                                    'on basic 1-island criterion.');
                            break;
                        default:
                            let toAugmentIsland = islands[inheritedIslandIndex];
                            for (let j = 0; j < il; ++j) {
                                let nij = newIsland[j];
                                if (toAugmentIsland.indexOf(nij) < 0) {
                                    oxToIslandIndex[nij] = inheritedIslandIndex;
                                    toAugmentIsland.push(nij);
                                }
                            }
                            break;
                    }
                    
                } else {
                    switch (il) {
                        case 0:
                            // throw Error('[RigidBodies] got a 0-length island.');
                            break;
                        case 1:
                            oxToIslandIndex[newIsland[0]] = -1; // May move freely.
                            break;
                        default:
                            for (let j = 0; j < il; ++j)
                                oxToIslandIndex[newIsland[j]] = islandIndex;
                            islands.push(newIsland);
                            islandIndex++;
                            break;
                    }
                }
                
                // TODO [DBG] check new island and former for redundancy.
            }
            // console.log(islands);
            //console.log(oxToIslandIndex);
            
            /*
            let mergedIslands = [];
            let isll = islands.length;
            let arrayIslDone = new Uint8Array(isll);
            arrayIslDone.fill(0);
            for (let i = 0; i < isll; ++i) {
                if (arrayIslDone[i]) continue;
                let currentPartialIsland = islands[i];
                var currentIsland = [];
                let stack = [];
                currentPartialIsland.forEach(isl=>stack.push(isl));
                
                // BFS
                while (stack.length > 0) {
                    let currentElement = stack.pop();
                    arrayIslDone[currentElement] = true;
                    let islandIndex = oxToIslandIndex[currentElement];
                    if (islandIndex === -2) 
                        throw Error('[RigidBodies] @ merge islands, got -2 index.');
                    if (islandIndex !== -1) {
                        
                        let otherIsland = islands[islandIndex];
                    }
                    currentIsland.push(currentElement);
                    
                }
                
                mergedIslands.push(currentIsland);   
            }
            */


            // 3. Snap x_i+1 with terrain collide, save non-integrated residuals 
            // as bounce components with coefficient & threshold (heat).
            for (let oi = 0, ol = oxAxis.length; oi < ol; ++oi) {
                if (oxAxis[oi].kind !== 'e') continue;
                let entityIndex = oxAxis[oi].id;
                currentEntity = entities[entityIndex];
                let p0 = currentEntity.p0;
                let p1 = currentEntity.p1;

                // Cast on current world to prevent x crossing through matter.
                const dtr = currentEntity.dtr; //TODO [HIGH] use dtr
                
                let islandId = oxToIslandIndex[oi];
                let doProject = islandId === -1 || islandId === -2;
                let hasCollided = TerrainCollider.linearCollide(currentEntity, world, p0, p1, true);
                // TODO [MEDIUM] report bounce components. 
            }
            
            // TODO [MEDIUM] crossWorldIslands;
            // add leapfrog term
            // get array of all xs sorted by axis
            
            // 5. Broad phase: in every island, recurse from highest to lowest leapfrog's term
            //    check neighbours for min distance in linearized trajectory
            //    detect and push PROBABLY COLLIDING PAIRS.

            // 6. Narrow phase, part 1: for all probably colliding pairs,
            //    solve X² leapfrog, save first all valid Ts
            //    keep list of ordered Ts across pairs.
            let sqrt = Math.sqrt;
            if (islands.length > 0) {
                //console.log('Islands: ');
                //console.log(islands);
            }
            islands.forEach(island => {
                // island.sort((a,b) => reverseLeapfrogArray[b] - reverseLeapfrogArray[a]);
                let nbI = island.length;
                let mapCollidingPossible = []; 
                for (let i = 0; i < nbI; ++i) {
                    let xIndex1 = island[i];
                    // let lfa1 = leapfrogArray[xIndex1];
                    let id1 = oxAxis[xIndex1].id;
                    let e1 = entities[id1];
                    let p1_0 = e1.p0; let p10x = p1_0[0], p10y = p1_0[1], p10z = p1_0[2];
                    let p1_1 = e1.p1; let p11x = p1_1[0], p11y = p1_1[1], p11z = p1_1[2];
                    //e1.p2 = [p11x, p11y, p11z];
                    //let p1_2 = e1.p2;
                    let p1_v0 = e1.v0; let p1_a0 = e1.a0; let p1_n0 = e1.nu;
                    let w1x = e1.widthX, w1y = e1.widthY, w1z = e1.widthZ;
                    let ltd1 = e1.dtr; // this.getTimeDilatation(worldId, p1_0[0], p1_0[1], p1_0[2]);
                    const dta1 = absoluteDt * ltd1;
                    const dtr1 = relativeDt * ltd1;
                    
                    for (let j = i+1; j < nbI; ++j) {
                        let xIndex2 = island[j];
                        //let lfa2 = leapfrogArray[xIndex2];
                        let id2 = oxAxis[xIndex2].id;
                        let e2 = entities[id2];
                        let p2_0 = e2.p0; let p20x = p2_0[0], p20y = p2_0[1], p20z = p2_0[2];
                        let p2_1 = e2.p1; let p21x = p2_1[0], p21y = p2_1[1], p21z = p2_1[2];
                        //e2.p2 = [p21x, p21y, p21z];
                        //let p2_2 = e2.p2;
                        let p2_v0 = e2.v0; let p2_a0 = e2.a0; let p2_n0 = e2.nu;
                        let w2x = e2.widthX, w2y = e2.widthY, w2z = e2.widthZ;
                        let ltd2 = e2.dtr; // this.getTimeDilatation(worldId, p2_0[0], p2_0[1], p2_0[2]);
                        // TODO [OPT] verify integration with time dilatation.
                        const dta2 = absoluteDt * ltd2;
                        const dtr2 = relativeDt * ltd2;

                        //for (let k = 0; k < 3; ++k) {
                            //const cxm = 
                        let x0l = p10x+w1x <= p20x-w2x; let y0l = p10y+w1y <= p20y-w2y; let z0l = p10z+w1z <= p20z-w2z;
                        let x1l = p11x+w1x <= p21x-w2x; let y1l = p11y+w1y <= p21y-w2y; let z1l = p11z+w1z <= p21z-w2z;
                        let x0r = p10x-w1x >= p20x+w2x; let y0r = p10y-w1y >= p20y+w2y; let z0r = p10z-w1z >= p20z+w2z;
                        let x1r = p11x-w1x >= p21x+w2x; let y1r = p11y-w1y >= p21y+w2y; let z1r = p11z-w1z >= p21z+w2z;
                        
                        if (x0l && x1l || x0r && x1r || y0l && y1l || y0r && y1r || z0l && z1l || z0r && z1r)
                        {
                            // console.log('Nope. ' + [x0l, x1l, x0r, x1r, y0l, y1l, y0r, y1r, z0l, z1l, z0r, z1r]);
                            // console.log('\t' + (p11x+w1x) + ',' + (p21x-w2x));
                            continue;
                        }
                        
                        let xl = x0l && !x1l;  let yl = y0l && !y1l;  let zl = z0l && !z1l;
                        let xr = x0r && !x1r;  let yr = y0r && !y1r;  let zr = z0r && !z1r;
                        let xm = !x0l && !x0r; let ym = !y0l && !y0r; let zm = !z0l && !z0r;
                        let xw = !x1l && !x1r; let yw = !y1l && !y1r; let zw = !z1l && !z1r;
                        
                        if (xm && ym && zm) {
                            console.log('[RigidBodies/ComputeIslands] two bodies clipped.');
                            // mapCollidingPossible.push([i, j, 0]);
                            continue;
                        }
                        
                        //if ((xl || xr || xm) && (yl || yr || ym) && (zl || zr || zm)) {
                        if (xw && yw && zw) {
                            // TODO [] push into colliding pairs
                            // console.log('Collision');
                            //let min_dtr1 = dtr1;
                            //let min_dtr2 = dtr2;
                            let rrel = relativeDt;
                            
                            // Quadratic solve thrice
                            if (!xm) {
                                //console.log('colx');
                                let fw = xl ? 1 : -1;
                                let a1 = ltd1*ltd1 * .5 * p1_a0[0];
                                let a2 = ltd2*ltd2 * .5 * p2_a0[0];
                                let b1 = ltd1 * p1_v0[0] + p1_n0[0]; 
                                let b2 = ltd1 * p2_v0[0] + p2_n0[0];
                                
                                let r = 0;
                                if (a1 !== a2) {
                                    let delta = (b1-b2)*(b1-b2)-4*(a1-a2)*(fw*w1x+fw*w2x+p10x-p20x);
                                    if (delta > 0) {
                                        console.log("delta > 0");
                                        let r1 = ((b2-b1)+sqrt(delta))/(2*(a1-a2));
                                        let r2 = ((b2-b1)-sqrt(delta))/(2*(a1-a2));
                                        r = Math.min(Math.max(r1, 0), Math.max(r2, 0));
                                    } else if (delta === 0) {
                                        console.log("delta = 0");
                                        r = (b2-b1)/(2*(a1-a2));
                                    }
                                } else if (b1 !== b2) {
                                    // console.log("deg 1 " + (b2-b1) + ', ' + (fw*w1x + fw*w2x+p10x-p20x));
                                    r = (fw*w1x + fw*w2x+p10x-p20x) / (b2-b1);
                                }
                                
                                // console.log('r=' + r + ', reldt=' + relativeDt);
                                
                                if (r >= 0) {
                                    //min_dtr1 = r * ltd1;
                                    //min_dtr2 = r * ltd2;
                                    if (r < rrel)
                                        rrel = r;
                                }
                            }
                            
                            if (!ym) {
                                //console.log('coly');
                                let fw = yl ? 1 : -1;
                                let a1 = ltd1*ltd1 * .5 * p1_a0[1];
                                let a2 = ltd2*ltd2 * .5 * p2_a0[1];
                                let b1 = ltd1 * p1_v0[1] + p1_n0[1];
                                let b2 = ltd1 * p2_v0[1] + p2_n0[1];

                                // TODO [Refactor] extract method.
                                let r = 0;
                                if (a1 !== a2) {
                                    let delta = (b1-b2)*(b1-b2)-4*(a1-a2)*(fw*w1y+fw*w2y+p10y-p20y);
                                    if (delta > 0) {
                                        let r1 = ((b2-b1)+sqrt(delta))/(2*(a1-a2));
                                        let r2 = ((b2-b1)-sqrt(delta))/(2*(a1-a2));
                                        r = Math.min(Math.max(r1, 0), Math.max(r2, 0));
                                    } else if (delta === 0) {
                                        r = (b2-b1)/(2*(a1-a2));
                                    }
                                } else if (b1 !== b2) {
                                    r = (fw*w1y + fw*w2y+p10y-p20y) / (b2-b1);
                                }
                                
                                // console.log('r=' + r + ', reldt=' + relativeDt);

                                if (r >= 0) {
                                    //let ndtr1 = r * ltd1;
                                    //if (ndtr1 < min_dtr1) min_dtr1 = ndtr1;
                                    //let ndtr2 = r * ltd2;
                                    //if (ndtr2 < min_dtr2) min_dtr2 = ndtr2;
                                    //rrel = r;
                                    if (r < rrel)
                                        rrel = r;
                                }
                            }
                            
                            if (!zm) {
                                //console.log('colz');
                                let fw = zl ? 1 : -1;
                                let a1 = ltd1*ltd1 * .5 * p1_a0[2];
                                let a2 = ltd2*ltd2 * .5 * p2_a0[2];
                                let b1 = ltd1 * p1_v0[2] + p1_n0[2];
                                let b2 = ltd1 * p2_v0[2] + p2_n0[2];

                                // TODO [Refactor] extract method.
                                let r = 0;
                                if (a1 !== a2) {
                                    let delta = (b1-b2)*(b1-b2)-4*(a1-a2)*(fw*w1z+fw*w2z+p10z-p20z);
                                    if (delta > 0) {
                                        let r1 = ((b2-b1)+sqrt(delta))/(2*(a1-a2));
                                        let r2 = ((b2-b1)-sqrt(delta))/(2*(a1-a2));
                                        r = Math.min(Math.max(r1, 0), Math.max(r2, 0));
                                    } else if (delta === 0) {
                                        r = (b2-b1)/(2*(a1-a2));
                                    }
                                } else if (b1 !== b2) {
                                    r = (fw*w1z + fw*w2z+p10z-p20z) / (b2-b1);
                                }

                                if (r >= 0) {
                                    //let ndtr1 = r * ltd1;
                                    //if (ndtr1 < min_dtr1) min_dtr1 = ndtr1;
                                    //let ndtr2 = r * ltd2;
                                    //if (ndtr2 < min_dtr2) min_dtr2 = ndtr2;
                                    if (r < rrel)
                                        rrel = r;
                                    //if (rrel < 0) rrel = r;
                                }
                            }
                            
                            //if (min_dtr1 < dtr1 || min_dtr2 < dtr2)
                            if (rrel < relativeDt)
                                mapCollidingPossible.push([i, j, rrel]);
                        }
                        
                    }
                }
                
                // if (mapCollidingPossible.length > 0) console.log(mapCollidingPossible);

                // 7. Narrow phase, part 2: for all Ts in order,
                //    set bodies as "in contact" or "terminal" (terrain), 
                //    compute new paths (which are not more than common two previous) while compensating forces 
                //    so as to project the result into directions that are not occluded
                //      -> bouncing will be done in next iteration to ensure convergence
                //      -> possible to keep track of the energy as unsatisfied work of forces
                //    solve X² leapfrog for impacted trajectories and insert new Ts in the list (map?)      
                //    End when there is no more collision to be solved.
                mapCollidingPossible.sort((a, b) => a[2] - b[2]);
                for (let k = 0, l = mapCollidingPossible.length; k < l; ++k) {
                    let i = mapCollidingPossible[k][0];
                    let j = mapCollidingPossible[k][1];
                    let r = mapCollidingPossible[k][2];
                    
                    let xIndex1 = island[i];
                    //let lfa1 = leapfrogArray[xIndex1];
                    let id1 = oxAxis[xIndex1].id;
                    let e1 = entities[id1];
                    let p1_0 = e1.p0; let p10x = p1_0[0], p10y = p1_0[1], p10z = p1_0[2];
                    let p1_1 = e1.p1; let p11x = p1_1[0], p11y = p1_1[1], p11z = p1_1[2];
                    //e1.p2 = [p11x, p11y, p11z];
                    //let p1_2 = e1.p2;
                    let p1_v0 = e1.v0; let p1_a0 = e1.a0; let p1_n0 = e1.nu;
                    let w1x = e1.widthX, w1y = e1.widthY, w1z = e1.widthZ;
                    let ltd1 = e1.dtr; // this.getTimeDilatation(worldId, p1_0[0], p1_0[1], p1_0[2]);
                    const dta1 = absoluteDt * ltd1;
                    const dtr1 = relativeDt * ltd1;
                    const sndtr1 = r * ltd1;
                    
                    let xIndex2 = island[j];
                    //let lfa2 = leapfrogArray[xIndex2];
                    let id2 = oxAxis[xIndex2].id;
                    let e2 = entities[id2];
                    let p2_0 = e2.p0; let p20x = p2_0[0], p20y = p2_0[1], p20z = p2_0[2];
                    let p2_1 = e2.p1; let p21x = p2_1[0], p21y = p2_1[1], p21z = p2_1[2];
                    //e2.p2 = [p21x, p21y, p21z];
                    //let p2_2 = e2.p2;
                    let p2_v0 = e2.v0; let p2_a0 = e2.a0; let p2_n0 = e2.nu;
                    let w2x = e2.widthX, w2y = e2.widthY, w2z = e2.widthZ;
                    let ltd2 = e2.dtr; // this.getTimeDilatation(worldId, p2_0[0], p2_0[1], p2_0[2]);
                    const dta2 = absoluteDt * ltd2;
                    const dtr2 = relativeDt * ltd2;
                    const sndtr2 = r * ltd2;
                    
                    // Snap p1.
                    
                    let x0l = p10x+w1x <= p20x-w2x; let y0l = p10y+w1y <= p20y-w2y; let z0l = p10z+w1z <= p20z-w2z;
                    let x1l = p11x+w1x <= p21x-w2x; let y1l = p11y+w1y <= p21y-w2y; let z1l = p11z+w1z <= p21z-w2z;
                    let x0r = p10x-w1x >= p20x+w2x; let y0r = p10y-w1y >= p20y+w2y; let z0r = p10z-w1z >= p20z+w2z;
                    let x1r = p11x-w1x >= p21x+w2x; let y1r = p11y-w1y >= p21y+w2y; let z1r = p11z-w1z >= p21z+w2z;
                    
                    if (x0l && x1l || x0r && x1r || y0l && y1l || y0r && y1r || z0l && z1l || z0r && z1r)
                        continue;
                    
                    let xl = x0l && !x1l;  let yl = y0l && !y1l;  let zl = z0l && !z1l;
                    let xr = x0r && !x1r;  let yr = y0r && !y1r;  let zr = z0r && !z1r;
                    let xm = !x0l && !x0r; let ym = !y0l && !y0r; let zm = !z0l && !z0r;
                    let xw = !x1l && !x1r; let yw = !y1l && !y1r; let zw = !z1l && !z1r;

                    // if ((xl || xr || xm) && (yl || yr || ym) && (zl || zr || zm)) {
                    if (xm && ym && zm) console.log('[RigidBodies/Solve] two bodies clipped.');
                    if (xw && yw && zw) {
                        console.log('[RigidBodies/RPSolve] Solving collision');
                        let m2 = [];
                        let wm1 = [w1x, w1y, w1z];
                        let wm2 = [w2x, w2y, w2z];
                        let nep1 = [];
                        let nep2 = [];
                        for (let m = 0; m < 3; ++m) // Account for server congestion / lag with relative dilatation.
                        {
                            let e1p1i = e1.p1[m];
                            let e1p0i = e1.p0[m];
                            let e1p1n = e1p0i + (p1_v0[m] + p1_n0[m]) * sndtr1 + .5 * p1_a0[m] * sndtr1 * sndtr1;
                            nep1[m] = 
                                (e1p1i < e1p0i && e1p1n < e1p0i && e1p1i < e1p1n) ?
                                    (e1p1n - RigidBodies.eps) :
                                (e1p0i < e1p1i && e1p0i < e1p1n && e1p1n < e1p1i) ?
                                    (e1p1n + RigidBodies.eps) : e1p1i;
                            
                            let e2p1i = e2.p1[m];
                            let e2p0i = e2.p0[m];
                            let e2p1n = e2p0i + (p2_v0[m] + p2_n0[m]) * sndtr2 + .5 * p2_a0[m] * sndtr2 * sndtr2;
                            nep2[m] = (e2p1i < e2p0i && e2p1n < e2p0i && e2p1i < e2p1n) ?
                                (e2p1n - RigidBodies.eps) : 
                                (e2p0i < e2p1i && e2p0i < e2p1n && e2p1n < e2p1i) ?
                                    (e2p1n + RigidBodies.eps) : e2p1i;
                            
                            m2[m] = (nep1[m]+wm1[m] > nep2[m]-wm2[m] && nep1[m]-wm1[m] < nep2[m]+wm2[m]);
                            // !x1l && !x1r
                            // p11x+w1x < p21x-w2x && p11x-w1x > p21x+w2x
                        }
                        // Temporary security measure.
                        // TODO [CRIT] check solver
                        if (m2[0] && m2[1] && m2[2]) {
                            console.log('[RigidBodies]: clipping detected at integration.');
                            for (let m = 0; m < 3; ++m) {
                                e1.p1[m] = e1.p0[m];
                                e2.p1[m] = e2.p0[m];
                            }
                        } else {
                            for (let m = 0; m < 3; ++m) {
                                e1.p1[m] = nep1[m];
                                e2.p1[m] = nep2[m];
                            }
                        }
                        // TODO [CRIT] bug: don't perform projections from within islands.
                        // TODO contact -> force de frottement, accélération à l'impact

                        // Max speed correction.
                        // if (sum > maxSpeed2 * dtr)
                        //     for (let i = 0; i < 3; ++i) inc[i] *= (maxSpeed * dtr) / sum;
                    }
                    
                    // leapfrogarray[ox][i] = (v0[i] + nu[i]) * dtr + .5 * a0[i] * dtr * dtr;
                }
            });
            
            // 7. Apply new positions, correct (v_i+1, a_i+1) and resulting constraints,
            //    smoothly slice along constrained boundaries until component is extinct.

            // Integration.
            //for (let oi = 0, ol = oxAxis.length; oi < ol; ++oi) {
            entities.forEach(currentEntity => {
                if (!currentEntity) return;
                
                let oi = currentEntity.indexX;
                let entityIndex = currentEntity.entityId;
                if (oxAxis[oi].kind !== 'e') return;
                
                // Temporarily discard insulated objects.
                // // if (oxToIslandIndex[oi] !== -1) return; 
                
                //let entityIndex = oxAxis[oi].id;
                //currentEntity = entities[entityIndex];
                let p0 = currentEntity.p0; let p1 = currentEntity.p1;
                let v0 = currentEntity.v0; let v1 = currentEntity.v1;
                let a0 = currentEntity.a0; let a1 = currentEntity.a1;

                // Cast through potential x.
                let xCrossed = XCollider.xCollide(p0, p1, world, xm);
                let oldWorldId = currentEntity.worldId;

                // TODO [CRIT] 1. if free (pyr, terrain) at gate, switch wld, else snap to gate
                // TODO [CRIT] 2. cast from gate to transform(p1)
                // TODO [CRIT] 3. think recursion
                //currentEntity.metaX = xCrossed;
                //let xCrossed = currentEntity.metaX;
                
                let entityUpdated = false;
                
                if (xCrossed) {
                    let newWorldId = xCrossed.worldId;
                    objectOrderer.switchEntityToWorld(currentEntity, newWorldId, p1);

                    // Collide with terrain on the other side (no second x crossing enabled)
                    // TODO [HIGH] translate [p0, p1] to [x.position, x.transform(p1, newWorldId)]
                    //let hasCollidedAfterwards = 
                    //    TerrainCollider.linearCollide(currentEntity, wm.getWorld(newWorldId), p0, p1, dtr);
                    entityUpdated = true;
                }
                
                if (p0[0] !== p1[0] || p0[1] !== p1[1] || p0[2] !== p1[2]) {
                    currentEntity.p0 = currentEntity.p1;
                    if (!xCrossed) {
                        searcher.updateObjectAxis(entityIndex);
                        objectOrderer.moveObject(currentEntity);
                    } else {
                        // TODO [HIGH] objectOrderer.switchEntityToWorld(...)
                    }
                    entityUpdated = true;
                }
                if (v0[0] !== v1[0] || v0[1] !== v1[1] || v0[2] !== v1[2]) {
                    currentEntity.v0 = currentEntity.v1;
                    entityUpdated = true;
                }
                if (a0[0] !== a1[0] || a0[1] !== a1[1] || a0[2] !== a1[2]) {
                    currentEntity.a0 = currentEntity.a1;
                    entityUpdated = true;
                }

                if (entityUpdated)
                {
                    o.entityUpdated(entityIndex);
                }
                
                currentEntity.p1 = [p0[0], p0[1], p0[2]];
                currentEntity.v1 = [0, 0, 0];
                currentEntity.a1 = [0, 0, 0];
                // currentEntity.adherence = [!1, !1, !1, !1, !1, !1];
                currentEntity.metaX = 0;
            });
            
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
        var impulseSpeed = [0, 0, 0];
        var force = [0, 0, 0];
        this.computeDesiredSpeed(entity, impulseSpeed, theta, ds, dt);
        this.sumGlobalFields(force, pos, entity);
        // RigidBodies.sumLocalFields(force, pos, EM);
        var hasUpdated = Integrator.updatePosition(orderer, dt, impulseSpeed, force, entity, em, wm, xm, world);
        return hasUpdated;
    }

    quadraticSolve(entity, em, wm, xm, world, dt) {
        const theta = entity.rotation[0];
        const ds = entity.directions;
        const pos = entity.position;
        var impulseSpeed = [0, 0, 0];
        var force = [0, 0, 0];
        var hasUpdated = false;
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
    
    static getEntityForwardVector(d, rotation, factor, project2D) 
    {
        let PI  = Math.PI,
            cos = Math.cos,
            sin = Math.sin,
            acos = Math.acos,
            abs = Math.abs,
            sgn = Math.sign,
            atan = Math.atan,
            sqrt = Math.sqrt,
            square = x => x*x;
        let PI2 = PI/2;
        let PI4 = PI/4;
        let PI34 = 3*PI4;
        
        let relTheta0 = rotation[0], relTheta1 = rotation[1];
        let absTheta0 = rotation[2], absTheta1 = rotation[3];

        //if (absTheta0 != 0 || absTheta1 != 0)
        //    console.log(relTheta0.toFixed(4) + ', ' + relTheta1.toFixed(4) + ' ; ' + 
        //       absTheta0.toFixed(4) + ', ' + absTheta1.toFixed(4));
        
        // d[0], d[1]: fw, bw
        // d[2], d[3]: rg, lf
        // d[4], d[5]: up, dn
        
        let fw = d[0] && !d[1], bw = !d[0] && d[1],
            rg = d[2] && !d[3], lf = !d[2] && d[3],
            up = d[4] && !d[5], dn = !d[4] && d[5];
        
        if (project2D) {
            relTheta1 = PI2;
            // TODO [CRIT] THIS IS WRONG!!!!!!!!!!!!!!!!!!!!!!!
        }
        
        let nb0 = (fw || bw) + (rg || lf) + (up || dn);
        if (nb0 === 0) return [0, 0, 0];
        
        let getPsy1 = function(theta0, theta1, phi0, phi1) {
            let st0 = sin(theta0), st1 = sin(theta1), ct0 = cos(theta0), 
                ct1 = cos(theta1),
                sp0 = sin(phi0), sp1 = sin(phi1), cp0 = cos(phi0), 
                cp1 = cos(phi1);
            return acos( (ct1 + cp1) / 
                (sqrt(square(st1*st0 + sp1*sp0) + square(st1*ct0 + sp1*cp0) + square(ct1 + cp1))) );
        };
        
        let getPsy0 = function(theta0, theta1, phi0, phi1) {
            let st0 = sin(theta0), st1 = sin(theta1),
                ct0 = cos(theta0), // ct1 = cos(theta1),
                sp0 = sin(phi0), sp1 = sin(phi1),
                cp0 = cos(phi0); // , cp1 = cos(phi1);
            
            let s = sgn(st1*st0 + sp1*sp0);
            return s *
                acos( (st1*ct0 + sp1*cp0) / (sqrt(square(st1*st0 + sp1*sp0) + square(st1*ct0 + sp1*cp0))) );
        };
        
        let getPsy = function() {
            // TODO [HIGH] refactor
        };
        
        if (nb0 === 1) {
            
            if (fw) {}
            else if (bw)  relTheta1 += PI;
            else if (up)  relTheta1 += PI2;
            else if (dn)  relTheta1 -= PI2;
            else if (rg) {relTheta0 -= PI2; relTheta1 = PI2;}
            else if (lf) {relTheta0 += PI2; relTheta1 = PI2;}
            else { 
                console.log('[RigidBodies] Undefined direction (1).');
                return [0, 0, 0];
            }
            
        } else if (nb0 === 2) {

            let t0 = relTheta0;
            let t1 = relTheta1;
            
            switch (true) {
                
                case (fw && up): relTheta1 += PI4; break;
                case (fw && dn): relTheta1 -= PI4; break;
                case (bw && up): relTheta1 += PI34; break;
                case (bw && dn): relTheta1 -= PI34; break;
                
                // TODO Debug send forward arrow object
                case (fw && rg):
                    // Faster.
                    //relTheta0 = relTheta0 - (PI2 - PI4*sin(relTheta1));
                    //relTheta1 = PI2 - PI4*cos(relTheta1);
                    
                    // More accurate.
                    relTheta0 = getPsy0(t0, t1, t0-PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1, t0-PI2, PI2) || 0;
                    break;
                case (fw && lf):
                    relTheta0 = getPsy0(t0, t1, t0+PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1, t0+PI2, PI2) || 0;
                    break;

                case (bw && rg):
                    relTheta0 = getPsy0(t0, t1+PI, t0-PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1+PI, t0-PI2, PI2) || 0;
                    break;
                
                case (bw && lf):
                    relTheta0 = getPsy0(t0, t1+PI, t0+PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1+PI, t0+PI2, PI2) || 0;
                    break; 
                
                case (rg && up):
                    relTheta0 = getPsy0(t0, t1+PI2, t0-PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1+PI2, t0-PI2, PI2) || 0;
                    break;
                
                case (rg && dn):
                    relTheta0 = getPsy0(t0, t1-PI2, t0-PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1-PI2, t0-PI2, PI2) || 0;
                    break;
                
                case (lf && up):
                    relTheta0 = getPsy0(t0, t1+PI2, t0+PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1+PI2, t0+PI2, PI2) || 0;
                    break;
                
                case (lf && dn):
                    relTheta0 = getPsy0(t0, t1-PI2, t0+PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1-PI2, t0+PI2, PI2) || 0;
                    break;
                
                default:
                    console.log('[RigidBodies] Undefined direction (2).'); 
                    return [0, 0, 0];
            }
            
        } else if (nb0 === 3) {

            let t0 = relTheta0;
            let t1 = relTheta1;
            
            switch (true) {
                
                case (fw && up && rg):
                    relTheta0 = getPsy0(t0, t1+PI4, t0-PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1+PI4, t0-PI2, PI2) || 0;
                    break;
                case (fw && dn && rg):
                    relTheta0 = getPsy0(t0, t1-PI4, t0-PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1-PI4, t0-PI2, PI2) || 0;
                    break;
                
                case (fw && up && lf):
                    relTheta0 = getPsy0(t0, t1+PI4, t0+PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1+PI4, t0+PI2, PI2) || 0;
                    break;
                case (fw && dn && lf):
                    relTheta0 = getPsy0(t0, t1-PI4, t0+PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1-PI4, t0+PI2, PI2) || 0;
                    break;
                
                case (bw && up && rg):
                    relTheta0 = getPsy0(t0, t1+PI34, t0-PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1+PI34, t0-PI2, PI2) || 0;
                    break;
                case (bw && dn && rg):
                    relTheta0 = getPsy0(t0, t1-PI34, t0-PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1-PI34, t0-PI2, PI2) || 0;
                    break;
                
                case (bw && up && lf):
                    relTheta0 = getPsy0(t0, t1+PI34, t0+PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1+PI34, t0+PI2, PI2) || 0;
                    break;
                case (bw && dn && lf):
                    relTheta0 = getPsy0(t0, t1-PI34, t0+PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1-PI34, t0+PI2, PI2) || 0;
                    break;
                
                default:
                    console.log('[RigidBodies] Undefined direction (3).');
                    return [0, 0, 0];
            }
            
        }

        let cosAbs0 = cos(absTheta0); let cosRel0 = cos(relTheta0);
        let cosAbs1 = cos(absTheta1); let cosRel1 = cos(relTheta1);
        let sinAbs0 = sin(absTheta0); let sinRel0 = sin(relTheta0);
        let sinAbs1 = sin(absTheta1); let sinRel1 = sin(relTheta1);
        
        // let absUpVector = [sinAbs1 * cosAbs0, sinAbs1 * sinAbs0, cosAbs1];
        // let absFrontVector = [cosAbs1 * cosAbs0, cosAbs1 * sinAbs0, -sinAbs1];
        // let relUpVector =       [sinRel1 * cosRel0, sinRel1 * sinRel0, cosRel1];
        // let relFrontVector =    [- sinRel1 * sinRel0, sinRel1 * cosRel0, -cosRel1];
        
        let relFrontVector;
        
        // Rx(theta1) times Rz(theta0) times Forward [-sinRel1*sinRel0, sinRel1*cosRel0, -cosRel1]
        // N.B. Plane normal is Rx(theta1).Rz(theta0).(0,0,-1).
        // Rx(1)             Rz(0)
        // ( 1   0   0 )     ( c  -s   0 )     ( c0    -s0    0  )
        // ( 0   c  -s )  X  ( s   c   0 )  =  ( c1s0  c1c0  -s1 )
        // ( 0   s   c )     ( 0   0   1 )     ( s1s0  s1c0   c1 )
        // =>
        // ( c0(-S1S0) - s0(S1C0 )
        // ( c1c0(-S1S0) + c1c0(S1C0) + s1C1 )
        // ( s1s0(-S1S0) + s1c0(S1C0) - c1C1 )
        /*
        relFrontVector =    [
            (-sinRel1*sinRel0*cosAbs0         - sinRel1*cosRel0*sinAbs0                          ),
            (-sinRel1*sinRel0*cosAbs1*sinAbs0 + sinRel1*cosRel0*cosAbs1*cosAbs0 + cosRel1*sinAbs1),
            (-sinRel1*sinRel0*sinAbs1*sinAbs0 + sinRel1*cosRel0*sinAbs1*cosAbs0 - cosRel1*cosAbs1)
        ];
        */

        // Rz(theta0) times Rx(theta1) times Forward [-sinRel1*sinRel0, sinRel1*cosRel0, -cosRel1]
        // N.B. Plane normal is Rz(theta0).Rx(theta1).(0,0,-1).
        // Rz(0)             Rx(1)
        // ( c  -s   0 )     ( 1   0   0 )     ( c0   -s0c1   s0s1 )
        // ( s   c   0 )  X  ( 0   c  -s )  =  ( s0    c0c1  -c0s1 )
        // ( 0   0   1 )     ( 0   s   c )     ( 0     s1     c1   )
        // =>
        // ( c0(-S1S0) - s0c1(S1C0) - s0s1C1 )
        // ( s0(-S1S0) + c0c1(S1C0) - c0s1C1 )
        // ( s1(S1C0) - c1C1 )
        relFrontVector =    [
            (-sinRel1*sinRel0*cosAbs0 - sinRel1*cosRel0*sinAbs0*cosAbs1 - cosRel1*sinAbs0*sinAbs1),
            (-sinRel1*sinRel0*sinAbs0 + sinRel1*cosRel0*cosAbs0*cosAbs1 + cosRel1*cosAbs0*sinAbs1),
            (                           sinRel1*cosRel0*sinAbs1         - cosRel1*cosAbs1)
        ];
        
        // TODO [CRIT] compute contributions in relTheta
        // TODO [CRIT] compute plane and project on 2D constrained mode
        // TODO [CRIT] correct verlet
        
        //let relX = relFrontVector[0];
        //let relY = relFrontVector[1];
        //let relZ = relFrontVector[2];
        
        let frontVector3D = []; // [];
        //console.log(relFrontVector[0].toFixed(4) + ', '
        // + relFrontVector[1].toFixed(4) + ', ' +
        // relFrontVector[2].toFixed(4));
        
        let sq = 0;
        for (let i = 0; i < 3; ++i) {
            let c = relFrontVector[i];
            sq += (c*c);
            frontVector3D[i] = relFrontVector[i] * factor;
        }
        // console.log(sqrt(sq)); // Must be 1
        
        // let frontVector2D = [];
        
        //let x, y, z;
        //x = - sin(relTheta1) * sin(relTheta0);
        //y = sin(relTheta1) * cos(relTheta0);
        //z = - cos(relTheta1);
        return frontVector3D;
        //else if (!0) return [0, 0, 0];
    }
    
    computeDesiredSpeed(entity, speed, theta, ds, dt) {
        var desiredSpeed = [0, 0, 0];
        const gravity = this.gravity;
        const pi4 = Math.PI/4;

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
            desiredSpeed[2] = (ds[4]&&!ds[5])?1:(ds[5]&&!ds[4])?-1:0;
        } else {
            if (ds[4]&&!ds[5]) {
                for (let i = 0; i<3; ++i) {
                    if (gravity[i] < 0 && entity.adherence[i]) {
                        entity.acceleration[i] = 3.3/dt;
                        entity.jump(i); // In which direction I jump
                    }
                }
                for (let i = 3; i<6; ++i) {
                    if (gravity[i-3] > 0 && entity.adherence[i]) {
                        entity.acceleration[i-3] = -3.3/dt;
                        entity.jump(i); // In which direction I jump
                    }
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
        var sum = [g[0]*m, g[1]*m, g[2]*m];

        // sum[2] = 0; // ignore grav

        RigidBodies.add(force, sum);
    }

    sumLocalFields(force, pos, EM) {
        var sum = [0, 0, 0];
        RigidBodies.add(force, sum);
    }

}

export default RigidBodies;