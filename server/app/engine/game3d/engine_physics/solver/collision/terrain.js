/**
 * Refactoring this thing is not a priority.
 * Some array allocs could be avoided, but diving in this (old) code is clearly a loss of time.
 */

'use strict';

class TerrainCollider
{
    static eps = 1e-8;
    static inveps = 1e8;

    static numericClamp(n) {
        const ie = TerrainCollider.inveps;
        return Math.round(n * ie) / ie;
    }

    /**
     * Network casting:
     * 1. Define a 2D network of 1-spaced points on the entity's 3 forward-moving faces.
     * 2. Parallel cast from seeds using Amandites-Woo's algorithm.
     * 3. Crop to nearest resulting positions.
     *
     * I know (highly suspect) it can be done way more efficiently.
     * The first thing to optimise is the BSP lookup phase: world.isFree([x, y, z]).
     * Suggestion:
     * - XXX [PERF] flag empty chunks and full chunks
     * Think of using octrees if scaling up chunks is an option (might depend on network requirements).
     */
    static collideLinearZ(entity, world, position, newPosition, doProject)
    {
        let p0 = position;
        let p1 = newPosition;
        let x0 = p0[0]; let y0 = p0[1]; let z0 = p0[2];
        let x1 = p1[0]; let y1 = p1[1]; let z1 = p1[2];
        let xW = entity.widthX;
        let yW = entity.widthY;
        let zW = entity.widthZ;

        const epsilon = TerrainCollider.eps;
        let numClamp = TerrainCollider.numericClamp;
        let cropX = x1; let cropY = y1; let cropZ = z1;
        let adx = false; let ady = false; let adz = false;
        const isProjectile = entity._isProjectile;

        let it = 0;
        const itm = 40;
        if (x0 !== x1)
        {
            let xStart = [];
            let xArrival = [];
            if (isProjectile)
            {
                xStart.push([x0, y0, z0]);
                xArrival.push([x1, y1, z1]);
            }
            else
                for (let currentY = numClamp(y0 - yW), lastY = numClamp(y0 + yW); ; it < itm) {
                    for (let currentZ = numClamp(z0 - zW), lastZ = numClamp(z0 + zW); ; it < itm) {
                        xStart.push([
                            x1 < x0 ? numClamp(x0 - xW) : numClamp(x0 + xW),
                            currentY,
                            currentZ
                        ]);
                        xArrival.push([
                            x1 < x0 ? numClamp(x1 - xW) : numClamp(x1 + xW),
                            numClamp(y1 + currentY - y0),
                            numClamp(z1 + currentZ - z0)
                        ]);
                        if (currentZ >= lastZ) break;
                        currentZ = currentZ + 1 > lastZ ? lastZ : currentZ + 1;
                        ++it;
                    }
                    if (currentY >= lastY) break;
                    currentY = currentY + 1 > lastY ? lastY : currentY + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < xStart.length; ++i)
            {
                let newCrops = xArrival[i];
                let net = xStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);
                if (c) {
                    adx = true;
                    if (x1 > x0 && numClamp(newCrops[0] - xW) < numClamp(cropX - epsilon))
                    {
                        cropX = numClamp(newCrops[0] - xW);
                        cropY = numClamp(newCrops[1] + y0 - net[1]);
                        cropZ = numClamp(newCrops[2] + z0 - net[2]);
                    }
                    else if (x1 < x0 && numClamp(newCrops[0] + xW) > numClamp(cropX + epsilon))
                    {
                        cropX = numClamp(newCrops[0] + xW);
                        cropY = numClamp(newCrops[1] + y0 - net[1]);
                        cropZ = numClamp(newCrops[2] + z0 - net[2]);
                    }
                }
            }
        }

        if (y0 !== y1)
        {
            let yStart = [];
            let yArrival = [];

            if (isProjectile)
            {
                yStart.push([x0, y0, z0]);
                yArrival.push([x1, y1, z1]);
            }
            else
                for (let currentX = numClamp(x0 - xW), lastX = numClamp(x0 + xW); ; it < itm) {
                    for (let currentZ = numClamp(z0 - zW), lastZ = numClamp(z0 + zW); ; it < itm) {
                        yStart.push([
                            currentX,
                            y1 < y0 ? numClamp(y0 - yW) : numClamp(y0 + yW),
                            currentZ
                        ]);
                        yArrival.push([
                            numClamp(x1 + currentX - x0),
                            y1 < y0 ? numClamp(y1 - yW) : numClamp(y1 + yW),
                            numClamp(z1 + currentZ - z0)
                        ]);
                        if (currentZ >= lastZ) break;
                        currentZ = currentZ + 1 > lastZ ? lastZ : currentZ + 1;
                        ++it;
                    }
                    if (currentX >= lastX) break;
                    currentX = currentX + 1 > lastX ? lastX : currentX + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < yStart.length; ++i)
            {
                let newCrops = yArrival[i];
                let net = yStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);

                if (c) {
                    ady = true;
                    if (y1 > y0 && numClamp(newCrops[1] - yW) < numClamp(cropY - epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] - yW);
                        const nz = numClamp(newCrops[2] + z0 - net[2]);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        cropY = ny;
                        if (z1 < z0 && z1 < nz && cropZ < nz || z0 < z1 && nz < z1 && nz < cropZ || z0 === z1)
                            cropZ = nz;
                    }
                    else if (y1 < y0 && numClamp(newCrops[1] + yW) > numClamp(cropY + epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + yW);
                        const nz = numClamp(newCrops[2] + z0 - net[2]);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        cropY = ny;
                        if (z1 < z0 && z1 < nz && cropZ < nz || z0 < z1 && nz < z1 && nz < cropZ || z0 === z1)
                            cropZ = nz;
                    }
                }
            }
        }

        if (z0 !== z1)
        {
            let zStart = [];
            let zArrival = [];
            if (isProjectile)
            {
                zStart.push([x0, y0, z0]);
                zArrival.push([cropX, cropY, z1]);
            }
            else
                for (let currentX = x0 - xW, lastX = x0 + xW; ; it < itm) {
                    for (let currentY = y0 - yW, lastY = y0 + yW; ; it < itm) {
                        zStart.push([
                            currentX,
                            currentY,
                            z1 < z0 ? numClamp(z0 - zW + epsilon) : numClamp(z0 + zW)
                        ]);
                        zArrival.push([
                            numClamp(cropX + currentX - x0),
                            numClamp(cropY + currentY - y0),
                            z1 < z0 ? numClamp(z1 - zW) : numClamp(z1 + zW)
                        ]);
                        if (currentY >= lastY) break;
                        currentY = currentY + 1 > lastY ? lastY : currentY + 1;
                        ++it;
                    }
                    if (currentX >= lastX) break;
                    currentX = currentX + 1 > lastX ? lastX : currentX + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < zStart.length; ++i)
            {
                let newCrops = zArrival[i];
                let net = zStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);
                if (c) {
                    adz = true;
                    if (z1 > z0 && numClamp(newCrops[2] - zW) < numClamp(cropZ - epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + y0 - net[1]);
                        const nz = numClamp(newCrops[2] - zW);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        if (y1 < y0 && y1 < ny && cropY < ny || y0 < y1 && ny < y1 && ny < cropY || y0 === y1)
                            cropY = ny;
                        cropZ = nz;
                    }
                    else if (z1 < z0 && numClamp(newCrops[2] + zW) > numClamp(cropZ + epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + y0 - net[1]);
                        const nz = numClamp(newCrops[2] + zW);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        if (y1 < y0 && y1 < ny && cropY < ny || y0 < y1 && ny < y1 && ny < cropY || y0 === y1)
                            cropY = ny;
                        cropZ = nz;
                    }
                }
            }
        }

        if (it === itm)
        {
            console.warn('[Terrain] Invalid hitbox.');
        }

        TerrainCollider.correctAdherence(entity, adx, ady, adz, x0, x1, y0, y1, z0, z1);

        if (cropX !== x1 || cropY !== y1 || cropZ !== z1)
        {
            if (!isProjectile)
            {
                newPosition[0] = cropX;
                newPosition[1] = cropY;
                newPosition[2] = cropZ;
            }
            return true;
        }

        // Intersect on first Non-Free Block
        // if (TerrainCollider.intersectAmanditesWoo(position, newPosition, world, entity)) return true;

        return false;
    }

    static collideLinearY(entity, world, position, newPosition, doProject)
    {
        let p0 = position;
        let p1 = newPosition;
        let x0 = p0[0]; let y0 = p0[1]; let z0 = p0[2];
        let x1 = p1[0]; let y1 = p1[1]; let z1 = p1[2];
        let xW = entity.widthX;
        let yW = entity.widthY;
        let zW = entity.widthZ;

        const epsilon = TerrainCollider.eps;
        let numClamp = TerrainCollider.numericClamp;
        let cropX = x1; let cropY = y1; let cropZ = z1;
        let adx = false; let ady = false; let adz = false;
        const isProjectile = entity._isProjectile;

        let it = 0;
        const itm = 40;

        if (x0 !== x1)
        {
            let xStart = [];
            let xArrival = [];
            if (isProjectile)
            {
                xStart.push([x0, y0, z0]);
                xArrival.push([x1, y1, z1]);
            }
            else
                for (let currentY = numClamp(y0 - yW), lastY = numClamp(y0 + yW); ; it < itm) {
                    for (let currentZ = numClamp(z0 - zW), lastZ = numClamp(z0 + zW); ; it < itm) {
                        xStart.push([
                            x1 < x0 ? numClamp(x0 - xW) : numClamp(x0 + xW),
                            currentY,
                            currentZ
                        ]);
                        xArrival.push([
                            x1 < x0 ? numClamp(x1 - xW) : numClamp(x1 + xW),
                            numClamp(y1 + currentY - y0),
                            numClamp(z1 + currentZ - z0)
                        ]);
                        if (currentZ >= lastZ) break;
                        currentZ = currentZ + 1 > lastZ ? lastZ : currentZ + 1;
                        ++it;
                    }
                    if (currentY >= lastY) break;
                    currentY = currentY + 1 > lastY ? lastY : currentY + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < xStart.length; ++i)
            {
                let newCrops = xArrival[i];
                let net = xStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);
                if (c) {
                    adx = true;
                    if (x1 > x0 && numClamp(newCrops[0] - xW) < numClamp(cropX - epsilon))
                    {
                        cropX = numClamp(newCrops[0] - xW);
                        cropY = numClamp(newCrops[1] + y0 - net[1]);
                        cropZ = numClamp(newCrops[2] + z0 - net[2]);
                    }
                    else if (x1 < x0 && numClamp(newCrops[0] + xW) > numClamp(cropX + epsilon))
                    {
                        cropX = numClamp(newCrops[0] + xW);
                        cropY = numClamp(newCrops[1] + y0 - net[1]);
                        cropZ = numClamp(newCrops[2] + z0 - net[2]);
                    }
                }
            }
        }

        if (z0 !== z1)
        {
            let zStart = [];
            let zArrival = [];

            if (isProjectile)
            {
                zStart.push([x0, y0, z0]);
                zArrival.push([x1, y1, z1]);
            }
            else
                for (let currentX = x0 - xW, lastX = x0 + xW; ; it < itm) {
                    for (let currentY = y0 - yW, lastY = y0 + yW; ; it < itm) {
                        zStart.push([
                            currentX,
                            currentY,
                            z1 < z0 ? numClamp(z0 - zW + epsilon) : numClamp(z0 + zW)
                        ]);
                        zArrival.push([
                            numClamp(x1 + currentX - x0),
                            numClamp(y1 + currentY - y0),
                            z1 < z0 ? numClamp(z1 - zW) : numClamp(z1 + zW)
                        ]);
                        if (currentY >= lastY) break;
                        currentY = currentY + 1 > lastY ? lastY : currentY + 1;
                        ++it;
                    }
                    if (currentX >= lastX) break;
                    currentX = currentX + 1 > lastX ? lastX : currentX + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < zStart.length; ++i)
            {
                let newCrops = zArrival[i];
                let net = zStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);
                if (c) {
                    adz = true;
                    if (z1 > z0 && numClamp(newCrops[2] - zW) < numClamp(cropZ - epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + y0 - net[1]);
                        const nz = numClamp(newCrops[2] - zW);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        if (y1 < y0 && y1 < ny && cropY < ny || y0 < y1 && ny < y1 && ny < cropY || y0 === y1)
                            cropY = ny;
                        cropZ = nz;
                    }
                    else if (z1 < z0 && numClamp(newCrops[2] + zW) > numClamp(cropZ + epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + y0 - net[1]);
                        const nz = numClamp(newCrops[2] + zW);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        if (y1 < y0 && y1 < ny && cropY < ny || y0 < y1 && ny < y1 && ny < cropY || y0 === y1)
                            cropY = ny;
                        cropZ = nz;
                    }
                }
            }
        }

        if (y0 !== y1)
        {
            let yStart = [];
            let yArrival = [];

            if (isProjectile)
            {
                yStart.push([x0, y0, z0]);
                yArrival.push([cropX, y1, cropZ]);
            }
            else
                for (let currentX = numClamp(x0 - xW), lastX = numClamp(x0 + xW); ; it < itm) {
                    for (let currentZ = numClamp(z0 - zW), lastZ = numClamp(z0 + zW); ; it < itm) {
                        yStart.push([
                            currentX,
                            y1 < y0 ? numClamp(y0 - yW) : numClamp(y0 + yW),
                            currentZ
                        ]);
                        yArrival.push([
                            numClamp(cropX + currentX - x0),
                            y1 < y0 ? numClamp(y1 - yW) : numClamp(y1 + yW),
                            numClamp(cropZ + currentZ - z0)
                        ]);
                        if (currentZ >= lastZ) break;
                        currentZ = currentZ + 1 > lastZ ? lastZ : currentZ + 1;
                        ++it;
                    }
                    if (currentX >= lastX) break;
                    currentX = currentX + 1 > lastX ? lastX : currentX + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < yStart.length; ++i)
            {
                let newCrops = yArrival[i];
                let net = yStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);

                if (c) {
                    ady = true;
                    if (y1 > y0 && numClamp(newCrops[1] - yW) < numClamp(cropY - epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] - yW);
                        const nz = numClamp(newCrops[2] + z0 - net[2]);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        cropY = ny;
                        if (z1 < z0 && z1 < nz && cropZ < nz || z0 < z1 && nz < z1 && nz < cropZ || z0 === z1)
                            cropZ = nz;
                    }
                    else if (y1 < y0 && numClamp(newCrops[1] + yW) > numClamp(cropY + epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + yW);
                        const nz = numClamp(newCrops[2] + z0 - net[2]);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        cropY = ny;
                        if (z1 < z0 && z1 < nz && cropZ < nz || z0 < z1 && nz < z1 && nz < cropZ || z0 === z1)
                            cropZ = nz;
                    }
                }
            }
        }

        if (it === itm)
        {
            console.warn('[Terrain] Invalid hitbox.');
        }

        TerrainCollider.correctAdherence(entity, adx, ady, adz, x0, x1, y0, y1, z0, z1);

        if (cropX !== x1 || cropY !== y1 || cropZ !== z1)
        {
            if (!isProjectile)
            {
                newPosition[0] = cropX;
                newPosition[1] = cropY;
                newPosition[2] = cropZ;
            }
            return true;
        }

        return false;
    }

    static collideLinearX(entity, world, position, newPosition, doProject)
    {
        let p0 = position;
        let p1 = newPosition;
        let x0 = p0[0]; let y0 = p0[1]; let z0 = p0[2];
        let x1 = p1[0]; let y1 = p1[1]; let z1 = p1[2];
        let xW = entity.widthX;
        let yW = entity.widthY;
        let zW = entity.widthZ;

        const epsilon = TerrainCollider.eps;
        let numClamp = TerrainCollider.numericClamp;
        let cropX = x1; let cropY = y1; let cropZ = z1;
        let adx = false; let ady = false; let adz = false;
        const isProjectile = entity._isProjectile;

        let it = 0;
        const itm = 40;

        if (y0 !== y1)
        {
            let yStart = [];
            let yArrival = [];

            if (isProjectile)
            {
                yStart.push([x0, y0, z0]);
                yArrival.push([x1, y1, z1]);
            }
            else
                for (let currentX = numClamp(x0 - xW), lastX = numClamp(x0 + xW); ; it < itm) {
                    for (let currentZ = numClamp(z0 - zW), lastZ = numClamp(z0 + zW); ; it < itm) {
                        yStart.push([
                            currentX,
                            y1 < y0 ? numClamp(y0 - yW) : numClamp(y0 + yW),
                            currentZ
                        ]);
                        yArrival.push([
                            numClamp(x1 + currentX - x0),
                            y1 < y0 ? numClamp(y1 - yW) : numClamp(y1 + yW),
                            numClamp(z1 + currentZ - z0)
                        ]);
                        if (currentZ >= lastZ) break;
                        currentZ = currentZ + 1 > lastZ ? lastZ : currentZ + 1;
                        ++it;
                    }
                    if (currentX >= lastX) break;
                    currentX = currentX + 1 > lastX ? lastX : currentX + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < yStart.length; ++i)
            {
                let newCrops = yArrival[i];
                let net = yStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);

                if (c) {
                    ady = true;
                    if (y1 > y0 && numClamp(newCrops[1] - yW) < numClamp(cropY - epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] - yW);
                        const nz = numClamp(newCrops[2] + z0 - net[2]);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        cropY = ny;
                        if (z1 < z0 && z1 < nz && cropZ < nz || z0 < z1 && nz < z1 && nz < cropZ || z0 === z1)
                            cropZ = nz;
                    }
                    else if (y1 < y0 && numClamp(newCrops[1] + yW) > numClamp(cropY + epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + yW);
                        const nz = numClamp(newCrops[2] + z0 - net[2]);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        cropY = ny;
                        if (z1 < z0 && z1 < nz && cropZ < nz || z0 < z1 && nz < z1 && nz < cropZ || z0 === z1)
                            cropZ = nz;
                    }
                }
            }
        }

        if (z0 !== z1)
        {
            let zStart = [];
            let zArrival = [];

            if (isProjectile)
            {
                zStart.push([x0, y0, z0]);
                zArrival.push([x1, y1, z1]);
            }
            else
                for (let currentX = x0 - xW, lastX = x0 + xW; ; it < itm) {
                    for (let currentY = y0 - yW, lastY = y0 + yW; ; it < itm) {
                        zStart.push([
                            currentX,
                            currentY,
                            z1 < z0 ? numClamp(z0 - zW + epsilon) : numClamp(z0 + zW)
                        ]);
                        zArrival.push([
                            numClamp(x1 + currentX - x0),
                            numClamp(y1 + currentY - y0),
                            z1 < z0 ? numClamp(z1 - zW) : numClamp(z1 + zW)
                        ]);
                        if (currentY >= lastY) break;
                        currentY = currentY + 1 > lastY ? lastY : currentY + 1;
                        ++it;
                    }
                    if (currentX >= lastX) break;
                    currentX = currentX + 1 > lastX ? lastX : currentX + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < zStart.length; ++i)
            {
                let newCrops = zArrival[i];
                let net = zStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);
                if (c) {
                    adz = true;
                    if (z1 > z0 && numClamp(newCrops[2] - zW) < numClamp(cropZ - epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + y0 - net[1]);
                        const nz = numClamp(newCrops[2] - zW);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        if (y1 < y0 && y1 < ny && cropY < ny || y0 < y1 && ny < y1 && ny < cropY || y0 === y1)
                            cropY = ny;
                        cropZ = nz;
                    }
                    else if (z1 < z0 && numClamp(newCrops[2] + zW) > numClamp(cropZ + epsilon))
                    {
                        const nx = numClamp(newCrops[0] + x0 - net[0]);
                        const ny = numClamp(newCrops[1] + y0 - net[1]);
                        const nz = numClamp(newCrops[2] + zW);
                        if (x1 < x0 && x1 < nx && cropX < nx || x0 < x1 && nx < x1 && nx < cropX || x0 === x1)
                            cropX = nx;
                        if (y1 < y0 && y1 < ny && cropY < ny || y0 < y1 && ny < y1 && ny < cropY || y0 === y1)
                            cropY = ny;
                        cropZ = nz;
                    }
                }
            }
        }

        if (x0 !== x1)
        {
            let xStart = [];
            let xArrival = [];

            if (isProjectile)
            {
                xStart.push([x0, y0, z0]);
                xArrival.push([x1, cropY, cropZ]);
            }
            else
                for (let currentY = numClamp(y0 - yW), lastY = numClamp(y0 + yW); ; it < itm) {
                    for (let currentZ = numClamp(z0 - zW), lastZ = numClamp(z0 + zW); ; it < itm) {
                        xStart.push([
                            x1 < x0 ? numClamp(x0 - xW) : numClamp(x0 + xW),
                            currentY,
                            currentZ
                        ]);
                        xArrival.push([
                            x1 < x0 ? numClamp(x1 - xW) : numClamp(x1 + xW),
                            numClamp(cropY + currentY - y0),
                            numClamp(cropZ + currentZ - z0)
                        ]);
                        if (currentZ >= lastZ) break;
                        currentZ = currentZ + 1 > lastZ ? lastZ : currentZ + 1;
                        ++it;
                    }
                    if (currentY >= lastY) break;
                    currentY = currentY + 1 > lastY ? lastY : currentY + 1;
                    ++it;
                }

            // Do intersect.
            for (let i = 0; i < xStart.length; ++i)
            {
                let newCrops = xArrival[i];
                let net = xStart[i];
                let c = TerrainCollider.intersectAmanditesWoo(net, newCrops, world, entity, doProject);
                if (c) {
                    adx = true;
                    if (x1 > x0 && numClamp(newCrops[0] - xW) < numClamp(cropX - epsilon))
                    {
                        cropX = numClamp(newCrops[0] - xW);
                        cropY = numClamp(newCrops[1] + y0 - net[1]);
                        cropZ = numClamp(newCrops[2] + z0 - net[2]);
                    }
                    else if (x1 < x0 && numClamp(newCrops[0] + xW) > numClamp(cropX + epsilon))
                    {
                        cropX = numClamp(newCrops[0] + xW);
                        cropY = numClamp(newCrops[1] + y0 - net[1]);
                        cropZ = numClamp(newCrops[2] + z0 - net[2]);
                    }
                }
            }
        }

        if (it === itm)
        {
            console.warn('[Terrain] Invalid hitbox.');
        }

        TerrainCollider.correctAdherence(entity, adx, ady, adz, x0, x1, y0, y1, z0, z1);

        if (cropX !== x1 || cropY !== y1 || cropZ !== z1)
        {
            if (!isProjectile)
            {
                newPosition[0] = cropX;
                newPosition[1] = cropY;
                newPosition[2] = cropZ;
            }
            return true;
        }

        return false;
    }

    static correctAdherence(entity, adx, ady, adz, x0, x1, y0, y1, z0, z1)
    {
        let adh = entity.adherence;
        let acc0 = entity.a0;
        if (adx) {
            adh[x0 > x1 ? 0 : 3] = true;
            adh[x0 > x1 ? 3 : 0] = false;
        } else {
            adh[0] = adh[3] = false;
        }
        if (ady) {
            adh[y0 > y1 ? 1 : 4] = true;
            adh[y0 > y1 ? 4 : 1] = false;
        } else {
            adh[1] = adh[4] = false;
        }
        if (adz) {
            adh[z0 > z1 ? 2 : 5] = true;
            adh[z0 > z1 ? 5 : 2] = false;
        } else {
            adh[2] = adh[5] = false;
        }

        if (adh[2] && acc0[2] < 0 || adh[5] && acc0[2] > 0)
        {
            entity.v1[0] = 0;
            entity.v1[1] = 0;
        }
        if (adh[0] && acc0[0] < 0 || adh[3] && acc0[0] > 0)
        {
            entity.v1[1] = 0;
            entity.v1[2] = 0;
        }
        if (adh[1] && acc0[1] < 0 || adh[4] && acc0[1] > 0)
        {
            entity.v1[0] = 0;
            entity.v1[2] = 0;
        }
    }

    // Warning: linear raycasting.
    // Does not account for exact X² leapfrog integration
    static intersectAmanditesWoo(p1, p2, world, entity, doProject)
    {
        let sgn = function(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; };
        let frac0 = x => x - Math.floor(x);
        let frac1 = x => 1.0 - x + Math.floor(x);
        let min = (x, y) => Math.min(x, y);

        const x1 = p1[0];
        const x2 = p2[0];
        const y1 = p1[1];
        const y2 = p2[1];
        const z1 = p1[2];
        const z2 = p2[2];

        // p1p2 is parametrized as p(t) = p1 + (p2-p1)*t
        // tDeltaX def. how far one has to move, in units of t, s. t. the horiz. comp. of the mvt. eq. the wdth. of a v.
        // tMaxX def. the value of t at which (p1p2) crosses the first (then nth) vertical boundary.
        let tMaxX; let tMaxY; let tMaxZ;
        let tDeltaX; let tDeltaY; let tDeltaZ;
        let ntx = false; let nty = false; let ntz = false;

        const threshold = 10000000.0;

        const dx = sgn(x2 - x1);
        let i = Math.floor(x1);
        if (dx !== 0) tDeltaX = min(dx / (x2 - x1), threshold); else tDeltaX = threshold;
        if (dx > 0) tMaxX = tDeltaX * frac1(x1); else tMaxX = tDeltaX * frac0(x1);

        const dy = sgn(y2 - y1);
        let j = Math.floor(y1);
        if (dy !== 0) tDeltaY = min(dy / (y2 - y1), threshold); else tDeltaY = threshold;
        if (dy > 0) tMaxY = tDeltaY * frac1(y1); else tMaxY = tDeltaY * frac0(y1);

        const dz = sgn(z2 - z1);
        let k = Math.floor(z1);
        if (dz !== 0) tDeltaZ = min(dz / (z2 - z1), threshold); else tDeltaZ = threshold;
        if (dz > 0) tMaxZ = tDeltaZ * frac1(z1); else tMaxZ = tDeltaZ * frac0(z1);

        if (
            typeof tMaxX !== 'number' ||
            typeof tMaxY !== 'number' ||
            typeof tMaxZ !== 'number'
        )
        {
            console.error('[Terrain] Amandites-Woo network error.');
            return;
        }
        while (tMaxX <= 1 || tMaxY <= 1 || tMaxZ <= 1)
        {
            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    i += dx;
                    tMaxX += tDeltaX;
                    ntx = true;  nty = false; ntz = false;
                } else {
                    k += dz;
                    tMaxZ += tDeltaZ;
                    ntx = false; nty = false; ntz = true;
                }
            } else // if (tMaxX >= tMaxY)
            if (tMaxY < tMaxZ) {
                j += dy;
                tMaxY += tDeltaY;
                ntx = false; nty = true;  ntz = false;
            } else {
                k += dz;
                tMaxZ += tDeltaZ;
                ntx = false; nty = false; ntz = true;
            }

            if (TerrainCollider.simpleCollide(
                world, entity,              // objects
                i, j, k,                    // next voxel coordinates
                tMaxX, tMaxY, tMaxZ,        // current value of t at which p1p2 crosses (x,y,z) orth. comp.
                tDeltaX, tDeltaY, tDeltaZ,  // delta between crosses on orth. comp.
                dx, dy, dz,                 // orth. directions of p1p2
                x1, y1, z1,                 // starting point
                x2, y2, z2,                 // ending point
                ntx, nty, ntz,              // last orth. to be updated (current shift coordinate)
                p2,             // Crop arrival position.
                doProject       // apply projection effect (stable if object is not in an island)
            )) return true;
        }

        // No collision
        return false;
    }

    static simpleCollide(
        world, entity,              // objects
        i, j, k,                    // next voxel coordinates
        tMaxX, tMaxY, tMaxZ,        // current value of t at which p1p2 crosses (x,y,z) orth. comp.
        tDeltaX, tDeltaY, tDeltaZ,  // delta between crosses on orth. comp.
        dx, dy, dz,                 // orth. directions of p1p2
        x1, y1, z1,                 // starting point
        x2, y2, z2,                 // ending point
        ntx, nty, ntz,              // last orth. to be updated (current shift coordinate)
        newPosition,    // position to be cropped to
        doProject)      // use free projection for slippin along cubes
    {
        if (world.isFree(i, j, k)) return false;

        // Collision
        // Damping on first encountered NFB (collision later on)

        const tol = TerrainCollider.eps; // .00001;
        const nx0 = dx > 0 ? i - tol : i + 1 + tol;
        const ny0 = dy > 0 ? j - tol : j + 1 + tol;
        const nz0 = dz > 0 ? k - tol : k + 1 + tol;

        if (ntx)
        {
            const t = tMaxX - tDeltaX;
            const ddx = dx < 0 ? 1 : -1;

            // Projections
            let nyt = y1 + (y2 - y1) * t;
            const ny = y1 + (y2 - y1);
            const dby = Math.abs(Math.floor(ny) - Math.floor(nyt));
            if (doProject && dby < 2)
            {
                if (dy < 0) {
                    const free = world.isFree(i + ddx, j - 1, k);
                    if (free || dby < 1 && ny > ny0 - 1) {
                        nyt = ny;
                    } else {
                        nyt = ny0 - 1;
                    }
                }
                if (dy > 0) {
                    const free = world.isFree(i + ddx, j + 1, k);
                    if (free || dby < 1 && ny < ny0 + 1) {
                        nyt = ny;
                    } else {
                        nyt = ny0 + 1;
                    }
                }
            }

            let nzt = z1 + (z2 - z1) * t;
            const nz = z1 + (z2 - z1);
            const dbz = Math.abs(Math.floor(nz) - Math.floor(nzt));
            if (doProject && dbz < 2)
            {
                if (dz < 0) {
                    const free = world.isFree(i + ddx, j, k - 1);
                    if (free || dbz < 1 && nz > nz0 - 1) {
                        nzt = nz;
                    }
                    else {
                        nzt = nz0 - 1;
                    }
                }
                if (dz > 0) {
                    const free = world.isFree(i + ddx, j, k + 1);
                    if (free || dbz < 1 && nz < nz0 + 1) {
                        nzt = nz;
                    }
                    else {
                        nzt = nz0 + 1;
                    }
                }
            }

            newPosition[0] = nx0;
            entity.v1[0] = 0;
            newPosition[1] = nyt;
            newPosition[2] = nzt;
        }
        else if (nty)
        {
            const t = tMaxY - tDeltaY;
            const ddy = dy < 0 ? 1 : -1;

            // Projections
            let nxt = x1 + (x2 - x1) * t;
            const nx = x1 + (x2 - x1);
            const dbx = Math.abs(Math.floor(nx) - Math.floor(nxt));
            if (doProject && dbx < 2)
            {
                if (dx < 0) {
                    const free = world.isFree(i - 1, j + ddy, k);
                    if (free || dbx < 1 && nx > nx0 - 1) {
                        nxt = nx;
                    }
                    else {
                        nxt = nx0 - 1;
                    }
                }
                if (dx > 0) {
                    const free = world.isFree(i + 1, j + ddy, k);
                    if (free || dbx < 1 && nx < nx0 + 1) {
                        nxt = nx;
                    }
                    else {
                        nxt = nx0 + 1;
                    }
                }
            }

            let nzt = z1 + (z2 - z1) * t;
            const nz = z1 + (z2 - z1);
            const dbz = Math.abs(Math.floor(nz) - Math.floor(nzt));
            if (doProject && dbz < 2)
            {
                if (dz < 0) {
                    const free = world.isFree(i, j + ddy, k - 1);
                    if (free || dbz < 1 && nz > nz0 - 1) {
                        nzt = nz;
                    }
                    else {
                        nzt = nz0 - 1;
                    }
                }
                if (dz > 0) {
                    const free = world.isFree(i, j + ddy, k + 1);
                    if (free || dbz < 1 && nz < nz0 + 1) {
                        nzt = nz;
                    }
                    else {
                        nzt = nz0 + 1;
                    }
                }
            }

            newPosition[0] = nxt;
            newPosition[1] = ny0;
            entity.v1[1] = 0;
            newPosition[2] = nzt;
        }
        else if (ntz)
        {
            const t = tMaxZ - tDeltaZ;
            const ddz = dz < 0 ? 1 : -1;

            // Projections
            let nxt = x1 + (x2 - x1) * t;
            const nx = x1 + (x2 - x1);
            const dbx = Math.abs(Math.floor(nx) - Math.floor(nxt));
            if (doProject && dbx < 2)
            {
                if (dx < 0) {
                    const free = world.isFree(i - 1, j, k + ddz);
                    if (free || dbx < 1 && nx > nx0 - 1) {
                        nxt = nx;
                    }
                    else {
                        nxt = nx0 - 1;
                    }
                }
                if (dx > 0) {
                    const free = world.isFree(i + 1, j, k + ddz);
                    if (free || dbx < 1 && nx < nx0 + 1) {
                        nxt = nx;
                    }
                    else {
                        nxt = nx0 + 1;
                    }
                }
            }

            let nyt = y1 + (y2 - y1) * t;
            const ny = y1 + (y2 - y1);
            const dby = Math.abs(Math.floor(ny) - Math.floor(nyt));
            if (doProject && dby < 2)
            {
                if (dy < 0) {
                    const free = world.isFree(i, j - 1, k + ddz);
                    if (free || dby < 1 && ny > ny0 - 1) {
                        nyt = ny;
                    }
                    else {
                        nyt = ny0 - 1;
                    }
                }
                if (dy > 0) {
                    const free = world.isFree(i, j + 1, k + ddz);
                    if (free || dby < 1 && ny < ny0 + 1) { // || is done last
                        nyt = ny;
                    }
                    else {
                        nyt = ny0 + 1;
                    }
                }
            }

            newPosition[0] = nxt;
            newPosition[1] = nyt;
            newPosition[2] = nz0;
            entity.v1[2] = 0;
        }

        // Bounce
        // entity.speed[2] = -(entity.speed[2]-entity._impulseSpeed[2]);
        // entity.acceleration = [0, 0, 0]; // Use Euler with collisions

        return true;
    }
}

export default TerrainCollider;
