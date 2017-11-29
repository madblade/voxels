/**
 * Event processing.
 * Applies forces to or accelerates entities.
 * Compute entity desires.
 */

import EventOrderer from './orderer_events';
import Entity from '../../../model_entity/entity';

class RigidBodiesPhase1 {

    static processLocalEvents(
        eventOrderer,
        entities,
        events,
        worldId,
        eventWorldAxes,
        oxAxis)
    {
        let exAxis = eventWorldAxes[0];
        // TODO [MEDIUM] use other axes for faster solving.
        // let eyAxis = eventWorldAxes[1];
        // let ezAxis = eventWorldAxes[2];
        let lastEX = 0;
        // let lastEY;
        // let lastEZ;
        let eventIndex; let entityIndex; let currentEvent;
        let op; let ep;
        let ox; let oy; let oz; let ex; let range;
        let wx; let wy; let wz;
        let maxRange = EventOrderer.maxRange;
        let maxWidth = Entity.maxWidth;

        // For all entities.
        for (let oi = 0, ol = oxAxis.length; oi < ol; ++oi)
        {
            let currentObject = oxAxis[oi];
            if (!currentObject) {
                console.log('Current object empty.');
                console.log(`Expected number of objects ${oxAxis.length}`);
                console.log(`Queried object index ${oi}`);
                console.log('oxAxis:');
                console.log(oxAxis);
            }

            if (!currentObject || currentObject.kind !== 'e') continue;
            entityIndex = oxAxis[oi].id;
            let currentEntity = entities[entityIndex];
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
                    const dx = ep[0] - op[0];
                    const dy = ep[1] - op[1];
                    const dz = ep[2] - op[2];
                    const rat = Math.sqrt(a / (dx * dx + dy * dy + dz * dz));
                    let a1 = currentEntity.a1;
                    a1[0] += rat * dx;
                    a1[1] += rat * dy;
                    a1[2] += rat * dz;
                }
            }
        }

        // Decrease event counters.
        eventOrderer.applyEventsInWorld(worldId);
    }

    /**
     * Integrates with leapfrog.
     */
    static processGlobalEvents(
        entities,
        worldId,
        relativeDt,
        oxAxis,
        leapfrogArray,
        passId,
        rigidBodiesSolver)
    {
        for (let oi = 0, ol = oxAxis.length; oi < ol; ++oi)
        {
            let currentObject = oxAxis[oi];
            if (!currentObject || currentObject.kind !== 'e') continue;

            let entityIndex = oxAxis[oi].id;
            let currentEntity = entities[entityIndex];
            let p0 = currentEntity.p0; let p1 = currentEntity.p1;
            let v0 = currentEntity.v0; let v1 = currentEntity.v1;
            let a0 = currentEntity.a0; let a1 = currentEntity.a1;
            let nu = currentEntity.nu; // Instantaneous speed.

            let localTimeDilatation = rigidBodiesSolver.getTimeDilatation(worldId, p0[0], p0[1], p0[2]);
            // const dta = absoluteDt * localTimeDilatation;
            const dtr = relativeDt * localTimeDilatation;
            currentEntity.dtr = localTimeDilatation; // dtr;

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
            const factor = Math.sqrt(maxV * 1.05);
            let g = rigidBodiesSolver.getGravity(worldId, p0[0], p0[1], p0[2]);
            //let vector = RigidBodiesPhase1.getEntityForwardVector(d, r, factor, false); // 3D
            let vector = RigidBodiesPhase1.getEntityForwardVector(d, r, factor, true); // Project 2D
            // console.log(vector);
            // let abs = Math.abs;
            // let sgn = Math.sign;
            let adh = currentEntity.adherence;

            // TODO [CRIT] compute acc.: impulses with speed constraints, gravity.
            // Compute the exact acceleration which is necessary
            // to get to the cap speed at the next iteration.
            for (let i = 0; i < 3; ++i)
            {
                let vi = vector[i];
                if (adh[i] && vi > 0.05 && g[i] < 0) {
                    console.log(`jump ${passId}`);
                    //vi = 0.1;
                    a1[i] += 0.22;
                    adh[i] = false; // TODO [CRIT] FIX ADHERENCE SETUP
                }
                else if (adh[3 + i] && vi < -0.05 && g[i] > 0) {
                    console.log('antijump');
                    //vi = -.1;
                    a1[i] -= 0.22;
                    adh[3 + i] = false;
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
                sum += v1i * v1i;
            }

            // Velocity correction.
            // if (sum > maxSpeed * dtr)
            //     for (let i = 0; i < 3; ++i) v1[i] *= (maxSpeed * dtr / sum);
        }
    }

    static getEntityForwardVector(d, rotation, factor, project2D)
    {
        let PI  = Math.PI;
        let cos = Math.cos;
        let sin = Math.sin;
        let acos = Math.acos;
        // let abs = Math.abs;
        let sgn = Math.sign;
        // let atan = Math.atan;
        let sqrt = Math.sqrt;
        let square = x => x * x;
        let PI2 = PI / 2;
        let PI4 = PI / 4;
        let PI34 = 3 * PI4;

        let relTheta0 = rotation[0]; let relTheta1 = rotation[1];
        let absTheta0 = rotation[2]; let absTheta1 = rotation[3];

        //if (absTheta0 != 0 || absTheta1 != 0)
        //    console.log(relTheta0.toFixed(4) + ', ' + relTheta1.toFixed(4) + ' ; ' +
        //       absTheta0.toFixed(4) + ', ' + absTheta1.toFixed(4));

        // d[0], d[1]: fw, bw
        // d[2], d[3]: rg, lf
        // d[4], d[5]: up, dn

        let fw = d[0] && !d[1]; let bw = !d[0] && d[1];
        let rg = d[2] && !d[3]; let lf = !d[2] && d[3];
        let up = d[4] && !d[5]; let dn = !d[4] && d[5];

        if (project2D) {
            relTheta1 = PI2;
            // TODO [CRIT] THIS IS WRONG!!!!!!!!!!!!!!!!!!!!!!!
        }

        let nb0 = (fw || bw) + (rg || lf) + (up || dn);
        if (nb0 === 0) return [0, 0, 0];

        let getPsy1 = function(theta0, theta1, phi0, phi1) {
            let st0 = sin(theta0); let st1 = sin(theta1); let ct0 = cos(theta0);
            let ct1 = cos(theta1);
            let sp0 = sin(phi0); let sp1 = sin(phi1); let cp0 = cos(phi0);
            let cp1 = cos(phi1);
            return acos((ct1 + cp1) /
                sqrt(square(st1 * st0 + sp1 * sp0) + square(st1 * ct0 + sp1 * cp0) + square(ct1 + cp1))
            );
        };

        let getPsy0 = function(theta0, theta1, phi0, phi1) {
            let st0 = sin(theta0); let st1 = sin(theta1);
            let ct0 = cos(theta0); // ct1 = cos(theta1),
            let sp0 = sin(phi0); let sp1 = sin(phi1);
            let cp0 = cos(phi0); // , cp1 = cos(phi1);

            let s = sgn(st1 * st0 + sp1 * sp0);
            return s *
                acos((st1 * ct0 + sp1 * cp0) /
                    sqrt(square(st1 * st0 + sp1 * sp0) + square(st1 * ct0 + sp1 * cp0))
                );
        };

        // TODO [HIGH] refactor
        // let getPsy = function() {
        // };

        if (nb0 === 1)
        {
            if (fw); // {}
            else if (bw)  relTheta1 += PI;
            else if (up)  relTheta1 += PI2;
            else if (dn)  relTheta1 -= PI2;
            else if (rg) {relTheta0 -= PI2; relTheta1 = PI2;}
            else if (lf) {relTheta0 += PI2; relTheta1 = PI2;}
            else {
                console.log('[RigidBodies] Undefined direction (1).');
                return [0, 0, 0];
            }
        }
        else if (nb0 === 2)
        {
            let t0 = relTheta0;
            let t1 = relTheta1;

            switch (true) {

                case fw && up: relTheta1 += PI4; break;
                case fw && dn: relTheta1 -= PI4; break;
                case bw && up: relTheta1 += PI34; break;
                case bw && dn: relTheta1 -= PI34; break;

                // TODO Debug send forward arrow object
                case fw && rg:
                    // Faster.
                    //relTheta0 = relTheta0 - (PI2 - PI4*sin(relTheta1));
                    //relTheta1 = PI2 - PI4*cos(relTheta1);

                    // More accurate.
                    relTheta0 = getPsy0(t0, t1, t0 - PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1, t0 - PI2, PI2) || 0;
                    break;
                case fw && lf:
                    relTheta0 = getPsy0(t0, t1, t0 + PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1, t0 + PI2, PI2) || 0;
                    break;

                case bw && rg:
                    relTheta0 = getPsy0(t0, t1 + PI, t0 - PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 + PI, t0 - PI2, PI2) || 0;
                    break;

                case bw && lf:
                    relTheta0 = getPsy0(t0, t1 + PI, t0 + PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 + PI, t0 + PI2, PI2) || 0;
                    break;

                case rg && up:
                    relTheta0 = getPsy0(t0, t1 + PI2, t0 - PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 + PI2, t0 - PI2, PI2) || 0;
                    break;

                case rg && dn:
                    relTheta0 = getPsy0(t0, t1 - PI2, t0 - PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 - PI2, t0 - PI2, PI2) || 0;
                    break;

                case lf && up:
                    relTheta0 = getPsy0(t0, t1 + PI2, t0 + PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 + PI2, t0 + PI2, PI2) || 0;
                    break;

                case lf && dn:
                    relTheta0 = getPsy0(t0, t1 - PI2, t0 + PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 - PI2, t0 + PI2, PI2) || 0;
                    break;

                default:
                    console.log('[RigidBodies] Undefined direction (2).');
                    return [0, 0, 0];
            }
        }
        else if (nb0 === 3)
        {
            let t0 = relTheta0;
            let t1 = relTheta1;

            switch (true) {

                case fw && up && rg:
                    relTheta0 = getPsy0(t0, t1 + PI4, t0 - PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 + PI4, t0 - PI2, PI2) || 0;
                    break;
                case fw && dn && rg:
                    relTheta0 = getPsy0(t0, t1 - PI4, t0 - PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 - PI4, t0 - PI2, PI2) || 0;
                    break;

                case fw && up && lf:
                    relTheta0 = getPsy0(t0, t1 + PI4, t0 + PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 + PI4, t0 + PI2, PI2) || 0;
                    break;
                case fw && dn && lf:
                    relTheta0 = getPsy0(t0, t1 - PI4, t0 + PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 - PI4, t0 + PI2, PI2) || 0;
                    break;

                case bw && up && rg:
                    relTheta0 = getPsy0(t0, t1 + PI34, t0 - PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 + PI34, t0 - PI2, PI2) || 0;
                    break;
                case bw && dn && rg:
                    relTheta0 = getPsy0(t0, t1 - PI34, t0 - PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 - PI34, t0 - PI2, PI2) || 0;
                    break;

                case bw && up && lf:
                    relTheta0 = getPsy0(t0, t1 + PI34, t0 + PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 + PI34, t0 + PI2, PI2) || 0;
                    break;
                case bw && dn && lf:
                    relTheta0 = getPsy0(t0, t1 - PI34, t0 + PI2, PI2) || 0;
                    relTheta1 = getPsy1(t0, t1 - PI34, t0 + PI2, PI2) || 0;
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
            -sinRel1 * sinRel0 * cosAbs0   -   sinRel1 * cosRel0 * sinAbs0 * cosAbs1   -   cosRel1 * sinAbs0 * sinAbs1,
            -sinRel1 * sinRel0 * sinAbs0   +   sinRel1 * cosRel0 * cosAbs0 * cosAbs1   +   cosRel1 * cosAbs0 * sinAbs1,
            /**/                               sinRel1 * cosRel0 * sinAbs1             -   cosRel1 * cosAbs1
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
            sq += c * c;
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

}

export default RigidBodiesPhase1;