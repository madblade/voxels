/**
 *
 */


'use strict';

import { WorldType, BlockType, HillType } from '../../model_world/model';

class SimplePerlin {

    constructor() {
        this.p = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194,
            233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10,
            23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
            203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87,
            174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48,
            27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211,
            133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
            65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208,
            89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109,
            198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5,
            202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16,
            58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119,
            248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172,
            9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232,
            178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238,
            210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249,
            14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84,
            204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205,
            93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];

        for (let i = 0; i < 256; ++i)
            this.p[256 + i] = this.p[i];
    }

    static fade(t)
    {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    static lerp(t, a, b)
    {
        return a + t * (b - a);
    }

    static grad(hash, x, y, z)
    {
        let h = hash & 15;
        let u = h < 8 ? x : y;
        let v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y, z)
    {
        let fade = SimplePerlin.fade;
        let lerp = SimplePerlin.lerp;
        let grad = SimplePerlin.grad;
        let p = this.p;

        let floorX = Math.floor(x);
        let floorY = Math.floor(y);
        let floorZ = Math.floor(z);

        let X = floorX & 255;
        let Y = floorY & 255;
        let Z = floorZ & 255;

        x -= floorX;
        y -= floorY;
        z -= floorZ;

        let xMinus1 = x - 1;
        let yMinus1 = y - 1;
        let zMinus1 = z - 1;

        let u = fade(x);
        let v = fade(y);
        let w = fade(z);

        let A = p[X] + Y;
        let AA = p[A] + Z;
        let AB = p[A + 1] + Z;

        let B = p[X + 1] + Y;
        let BA = p[B] + Z;
        let BB = p[B + 1] + Z;

        return lerp(w,
            lerp(v,
                lerp(u, grad(p[AA], x, y, z), grad(p[BA], xMinus1, y, z)),
                lerp(u, grad(p[AB], x, yMinus1, z), grad(p[BB], xMinus1, yMinus1, z))),

            lerp(v,
                lerp(u, grad(p[AA + 1], x, y, zMinus1), grad(p[BA + 1], xMinus1, y, z - 1)),
                lerp(u, grad(p[AB + 1], x, yMinus1, zMinus1), grad(p[BB + 1], xMinus1, yMinus1, zMinus1)))
        );
    }

    static simplePerlinGeneration(chunk, shuffleChunks, worldId, worldInfo) {
        let dims = chunk.dimensions;
        const dx = dims[0];
        const dy = dims[1];
        const dz = dims[2];
        const ci = chunk.chunkI;
        const cj = chunk.chunkJ;
        const ck = chunk.chunkK;
        const offsetX = dx * ci;
        const offsetY = dy * cj;
        const offsetZ = dz * ck;

        const abs = Math.abs;

        // Create blocks.
        let blocks = new Uint8Array(dx * dy * dz);

        const air = BlockType.AIR;
        const stone = BlockType.STONE;
        const grass = BlockType.GRASS;
        const iron = BlockType.IRON;
        const sand = BlockType.SAND;
        const planks = BlockType.PLANKS;
        let worldType = worldInfo.type;
        let hillsType = worldInfo.hills;

        // Detect cube or flat world.
        let directions = [];
        switch (worldType) {
            case WorldType.FLAT:
                directions.push(3); // === z (starting at 1 for signa)
                // 1: x, 2: y, 3: z, 4: full, 5: empty
                break;
            case WorldType.CUBE:
                let center = worldInfo.center;
                const radius = worldInfo.radius;

                const deltaX = center.x - parseInt(ci, 10);
                const deltaY = center.y - parseInt(cj, 10);
                const deltaZ = center.z - parseInt(ck, 10);

                if (abs(deltaX) > radius || abs(deltaY) > radius || abs(deltaZ) > radius)
                {
                    blocks.fill(air);
                    chunk.blocks = blocks;
                    return; // Blocks are filled with zeros.
                }

                // full stone inside the cubeworld
                if (abs(deltaX) < radius && abs(deltaY) < radius && abs(deltaZ) < radius) {
                    if (abs(deltaX) < abs(deltaZ) && abs(deltaY) < abs(deltaZ) && abs(deltaZ) > 0) {
                        directions.push(ck > center.z ? 3 : -3);
                    } else if (abs(deltaX) < abs(deltaY) && abs(deltaZ) < abs(deltaY) && abs(deltaY) > 0) {
                        directions.push(cj > center.y ? 2 : -2);
                    } else if (abs(deltaY) < abs(deltaX) && abs(deltaZ) < abs(deltaX) && abs(deltaX) > 0) {
                        directions.push(ci > center.x ? 1 : -1);
                    } else {
                        blocks.fill(stone);
                        chunk.blocks = blocks;
                        return;
                    }
                }

                // TODO [CRIT] manage empty chunks

                // Debug
                // blocks.fill(air);
                // chunk.blocks = blocks;
                // if (true) return;

                if (abs(deltaX) === radius)
                    directions.push(ci > center.x ? 1 : -1);
                if (abs(deltaY) === radius)
                    directions.push(cj > center.y ? 2 : -2);
                if (abs(deltaZ) === radius)
                    directions.push(ck > center.z ? 3 : -3);

                break;
            default:
                console.error('[Generator Simple Perlin] Unknown world type.');
        }

        // Fill with grass on main world, sand everywhere else.
        const mainBlockId = parseInt(worldId, 10) === -1 ? grass : sand;
        const ijS = dx * dy;

        if (directions.length === 3) {
            // Eighth-full generation.
            for (let lx = dx / 2, i = directions[0] > 0 ? 0 : lx, cx = 0; cx < lx; ++cx, ++i) {
                for (let ly = dy / 2, j = directions[1] > 0 ? 0 : ly, cy = 0; cy < ly; ++cy, ++j)
                    for (let lz = dz / 2, k = directions[2] > 0 ? 0 : lz, cz = 0; cz < lz; ++cz, ++k)
                        blocks[i + j * dx + k * ijS] = planks;
            }
        }

        if (directions.length === 2) {
            // Quarter-full generation.
            // 1 or 2, then 2 or 3!
            for (let a1 = abs(directions[0]), l1 = a1 === 1 ? dx / 2 : dy / 2, ij = directions[0] > 0 ? 0 : l1, c1 = 0; c1 < l1; ++c1, ++ij)
                for (let a2 = abs(directions[1]), l2 = a2 === 2 ? dy / 2 : dz / 2, jk = directions[1] > 0 ? 0 : l2, c2 = 0; c2 < l2; ++c2, ++jk)
                {
                    if (a1 > 1) {
                        const ijk = ij * dx + jk * ijS;
                        for (let x = 0; x < dx; ++x)
                            blocks[x + ijk] = planks;
                    }
                    else if (a2 > 2) {
                        const ijk = ij + jk * ijS;
                        for (let y = 0; y < dy; ++y)
                            blocks[ijk + y * dx] = planks;
                    }
                    else {
                        const ijk = ij + jk * dx;
                        for (let z = 0; z < dz; ++z)
                            blocks[ijk + z * ijS] = planks;
                    }
                }
        }

        if (directions.length === 1) {
            // Perlin generation.
            let perlin = new SimplePerlin();

            const v1 = directions[0]; // For signum & value.
            const a1 = abs(v1);
            let [d1, d2, d3, normalSize, offset1, offset2, offset3, perm] = a1 > 2 ?
                [dx, dy, dz, dx * dy, offsetX, offsetY, offsetZ, 0] : a1 > 1 ?
                    [dx, dz, dy, dx * dz, offsetX, offsetZ, offsetY, 1] :
                    [dy, dz, dx, dy * dz, offsetY, offsetZ, offsetX, 2]; // Can factor normalSize outside.

            // let normalSize = a1 > 2 ? dx * dy : a1 > 1 ? dx * dz : dy * dz;

            let data = [];
            let quality = 2;
            // const z = shuffleChunks ? Math.random() * 100 : 50;
            const z = 4 * (shuffleChunks ? Math.random() * d3 : Math.floor(d3 / 2));

            for (let i = 0; i < normalSize; ++i) data[i] = 0;
            for (let iteration = 0; iteration < 4; ++iteration)
            {
                for (let i = 0; i < normalSize; ++i) {
                    let x = offset1 + i % d1;
                    let y = offset2 + (i / d1 | 0); // / priority > | priority
                    data[i] += perlin.noise(x / quality, y / quality, z) * quality;
                }

                quality *= 4;
            }

            // let getY = function(x, y) {
            //     return data[x + y * d1] * 0.2 | 0; // * priority > | priority
            // };

            // Get vertical generation direction.
            let fz = v1 > 0 ?
                (
                    perm === 0 ? (xy => zed => xy + normalSize * zed) :
                        perm === 1 ? (xy => zed => xy + zed * d1) : (xy => zed => xy + zed)
                ) : (
                    perm === 0 ? (xy => zed => xy + normalSize * (d3 - zed - 1)) :
                        perm === 1 ? (xy => zed => xy + (d3 - zed - 1) * d1) : (xy => zed => xy + (d3 - zed - 1))
                );

            if (worldType === WorldType.CUBE) {
                let r = parseInt(worldInfo.radius, 10);
                switch (v1) {
                    case 1:  offset3 = (-worldInfo.center.x - r + parseInt(ci, 10)) * d1; break;
                    case -1: offset3 = (worldInfo.center.x - r - parseInt(ci, 10)) * d1; break;
                    case 2:  offset3 = (-worldInfo.center.y - r + parseInt(cj, 10)) * d2; break;
                    case -2: offset3 = (worldInfo.center.y - r - parseInt(cj, 10)) * d2; break;
                    case 3:  offset3 = (-worldInfo.center.z - r + parseInt(ck, 10)) * d3; break;
                    case -3: offset3 = (worldInfo.center.z - r - parseInt(ck, 10)) * d3; break;
                }
            }

            let perlinIntensity;
            switch (hillsType) {
                case HillType.NO_HILLS: perlinIntensity = 0; break;
                case HillType.REGULAR_HILLS: perlinIntensity = 0.2; break;
                case HillType.GIANT_HILLS: perlinIntensity = 1.0; break;
                default: perlinIntensity = 0.1; break;
            }

            for (let x = 0; x < d1; ++x) {
                for (let y = 0; y < d2; ++y) {
                    let h = d3 / 2 + (data[x + y * d1] * perlinIntensity | 0); // getY(x, y);
                    let rockLevel = Math.floor(5 * h / 6);
                    let xy = perm === 0 ? x + y * d1 :
                        perm === 1 ? x + y * d1 * d2 :
                            x * d1 + y * d1 * d2;
                    let ffz = fz(xy);

                    h -= offset3;
                    rockLevel -= offset3;
                    let rl = Math.max(0, Math.min(rockLevel, d3));
                    for (let zz = 0; zz < rl; ++zz) {
                        const currentBlock = ffz(zz); // ijS * zz + xy;

                        // Rock.
                        blocks[currentBlock] = stone;

                        // Iron.
                        if (Math.random() > 0.99) blocks[currentBlock] = iron;
                    }

                    let bl = Math.max(0, Math.min(h, d3));
                    for (let zz = rl; zz < bl; ++zz) {
                        // Grass or sand.
                        const currentBlock = ffz(zz);
                        blocks[currentBlock] = mainBlockId; // ijS * zz + xy
                    }
                }
            }
        }

        chunk.blocks = blocks;
    }

}

export default SimplePerlin;
