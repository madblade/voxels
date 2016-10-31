/**
 *
 */

'use strict';

class TerrainCollider {

    /**
     * @returns 'has collided'
     */
    static linearCollide(entity, WM, position, newPosition, dt) {

        // Intersect on first Non-Free Block
        if (TerrainCollider.intersectAmanditesWoo(position, newPosition, WM, entity,
            (WM, entity,                 // objects
                i, j, k,                    // next voxel coordinates
                tMaxX, tMaxY, tMaxZ,        // current value of t at which p1p2 crosses (x,y,z) orth. comp.
                tDeltaX, tDeltaY, tDeltaZ,  // delta between crosses on orth. comp.
                dx, dy, dz,                 // orth. directions of p1p2
                x1, y1, z1,                 // starting point
                x2, y2, z2,                 // ending point
                ntx, nty, ntz               // last orth. to be updated (current shift coordinate)
            ) => {

            if (WM.isFree([i, j, k])) return false;

            // Collision
            // Damping on first encountered NFB (collision later on)

            const tol = .00001;
            const nx0 = dx > 0 ? i-tol : i+1+tol;
            const ny0 = dy > 0 ? j-tol : j+1+tol;
            const nz0 = dz > 0 ? k-tol : k+1+tol;

            if (ntx) {
                const t = tMaxX-tDeltaX;
                const ddx = dx < 0 ? 1 : -1;

                // Projections
                let ny = y1+(y2-y1);
                let nyt = y1+(y2-y1)*t;
                let dby = Math.abs(Math.floor(ny)-Math.floor(nyt));
                if (dby < 2) {
                    if (dy < 0) if (dby < 1 || WM.isFree([i+ddx, j-1, k])) { nyt = ny; }
                    //else { nyt = ny0-1; }
                    if (dy > 0) if (dby < 1 || WM.isFree([i+ddx, j+1, k])) { nyt = ny; }
                    //else { nyt = ny0+1; }
                }

                let nz = z1+(z2-z1);
                let nzt = z1+(z2-z1)*t;
                let dbz = Math.abs(Math.floor(nz)-Math.floor(nzt));
                if (dbz < 2) {
                    if (dz < 0) if (dbz < 1 || WM.isFree([i+ddx, j, k-1])) { nzt = nz; }
                    //else { nzt = nz0-1; }
                    if (dz > 0) if (dbz < 1 || WM.isFree([i+ddx, j, k+1])) { nzt = nz; }
                    //else { nzt = nz0+1; }
                }

                entity.position = [nx0, nyt, nzt];
                entity.acceleration[0] = 0;
                entity.speed[0] = 0;
                entity.speed[1] = entity._impulseSpeed[1];
            }

            else if (nty) {
                const t = tMaxY-tDeltaY;
                const ddy = dy < 0 ? 1 : -1;

                let nx = x1+(x2-x1);
                let nxt = x1+(x2-x1)*t;
                let dbx = Math.abs(Math.floor(nx)-Math.floor(nxt));
                if (dbx < 2) {
                    if (dx < 0) if (dbx < 1 || WM.isFree([i-1, j+ddy, k])) { nxt = nx; }
                    //else { nxt = nx0-1; }
                    if (dx > 0) if (dbx < 1 || WM.isFree([i+1, j+ddy, k])) { nxt = nx; }
                    //else { nxt = nx0+1; }
                }

                let nz = z1+(z2-z1);
                let nzt = z1+(z2-z1)*t;
                let dbz = Math.abs(Math.floor(nz)-Math.floor(nzt));
                if (dbz < 2) {
                    if (dz < 0) if (dbz < 1 || WM.isFree([i, j+ddy, k-1])) { nzt = nz; }
                    //else { nzt = nz0-1; }
                    if (dz > 0) if (dbz < 1 || WM.isFree([i, j+ddy, k+1])) { nzt = nz; }
                    //else { nzt = nz0+1; }
                }

                entity.position = [nxt, ny0, nzt];
                entity.acceleration[1] = 0;
                entity.speed[0] = entity._impulseSpeed[0];
                entity.speed[1] = 0;
            }

            else if (ntz) {
                const t = tMaxZ-tDeltaZ;
                const ddz = dz < 0 ? 1 : -1;

                let nx = x1+(x2-x1);
                let nxt = x1+(x2-x1)*t;
                let dbx = Math.abs(Math.floor(nx)-Math.floor(nxt));
                if (dbx < 2) {
                    if (dx < 0)
                        if (dbx < 1 || WM.isFree([i-1, j, k+ddz])) { nxt = nx; }
                        else { nxt = nx0-1; }
                    if (dx > 0)
                        if (dbx < 1 || WM.isFree([i+1, j, k+ddz])) { nxt = nx; }
                        else { nxt = nx0+1; }
                }

                let ny = y1+(y2-y1);
                let nyt = y1+(y2-y1)*t;
                let dby = Math.abs(Math.floor(ny)-Math.floor(nyt));
                if (dby < 2) {
                    if (dy < 0)
                        if (dby < 1 || WM.isFree([i, j-1, k+ddz])) { nyt = ny; }
                        else { nyt = ny0-1; }
                    if (dy > 0)
                        if (dby < 1 || WM.isFree([i, j+1, k+ddz])) { nyt = ny; }
                        else { nyt = ny0+1; }
                }

                entity.adherence[2] = true; // One impulse allowed

                entity.position = [nxt, nyt, nz0];
                entity.acceleration[2] = 0;
                entity.speed = entity._impulseSpeed;
                entity.speed[2] = 0;
            }

            // Bounce
            // entity.speed[2] = -(entity.speed[2]-entity._impulseSpeed[2]);
            // entity.acceleration = [0, 0, 0]; // Use Euler with collisions

            return true;

        })) return true;

        // Update entity position.
        entity.position = newPosition;
        return false;
    }

    static intersectAmanditesWoo(p1, p2, WM, entity, callback) {

        let sgn = x => (x > 0 ? 1 : (x < 0 ? -1 : 0));
        let frac0 = x => x - Math.floor(x);
        let frac1 = x => 1.0 - x + Math.floor(x);
        let min = (x, y) => Math.min(x, y);

        let x1 = p1[0]; let x2 = p2[0];
        let y1 = p1[1]; let y2 = p2[1];
        let z1 = p1[2]; let z2 = p2[2];

        // p1p2 is parametrized as p(t) = p1 + (p2-p1)*t
        // tDeltaX def. how far one has to move, in units of t, s. t. the horiz. comp. of the mvt. eq. the wdth. of a v.
        // tMaxX def. the value of t at which (p1p2) crosses the first (then nth) vertical boundary.
        let tMaxX, tMaxY, tMaxZ,
            tDeltaX, tDeltaY, tDeltaZ;
        let ntx = false, nty = false, ntz = false;

        const threshold = 10000000.0;

        let dx = sgn(x2-x1);
        let i = Math.floor(x1);
        if (dx != 0) tDeltaX = min(dx / (x2 - x1), threshold); else tDeltaX = threshold;
        if (dx > 0) tMaxX = tDeltaX * frac1(x1); else tMaxX = tDeltaX * frac0(x1);

        let dy = sgn(y2-y1);
        let j = Math.floor(y1);
        if (dy != 0) tDeltaY = min(dy / (y2 - y1), threshold); else tDeltaY = threshold;
        if (dy > 0) tMaxY = tDeltaY * frac1(y1); else tMaxY = tDeltaY * frac0(y1);

        let dz = sgn(z2-z1);
        let k = Math.floor(z1);
        if (dz != 0) tDeltaZ = min(dz / (z2 - z1), threshold); else tDeltaZ = threshold;
        if (dz > 0) tMaxZ = tDeltaZ * frac1(z1); else tMaxZ = tDeltaZ * frac0(z1);

        while (tMaxX <= 1 || tMaxY <= 1 || tMaxZ <= 1) {
            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    i += dx;
                    tMaxX += tDeltaX;
                    ntx = true; nty = false; ntz = false;
                } else {
                    k += dz;
                    tMaxZ += tDeltaZ;
                    ntx = false; nty = false; ntz = true;
                }
            } else {
                if (tMaxY < tMaxZ) {
                    j += dy;
                    tMaxY += tDeltaY;
                    ntx = false; nty = true; ntz = false;
                } else {
                    k += dz;
                    tMaxZ += tDeltaZ;
                    ntx = false; nty = false; ntz = true;
                }
            }

            if (callback(
                WM, entity,                 // objects
                i, j, k,                    // next voxel coordinates
                tMaxX, tMaxY, tMaxZ,        // current value of t at which p1p2 crosses (x,y,z) orth. comp.
                tDeltaX, tDeltaY, tDeltaZ,  // delta between crosses on orth. comp.
                dx, dy, dz,                 // orth. directions of p1p2
                x1, y1, z1,                 // starting point
                x2, y2, z2,                 // ending point
                ntx, nty, ntz               // last orth. to be updated (current shift coordinate)
            )) return true;

        }

        // No collision
        return false;
    }

}

export default TerrainCollider;
