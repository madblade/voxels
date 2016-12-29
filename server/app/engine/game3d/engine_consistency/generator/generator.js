/**
 * Create and fill chunks.
 */

'use strict';

import WorldGenerator       from './worldgenerator';
import ChunkBuilder         from '../builder/builder_chunks';

class Generator {

    constructor(consistencyEngine) {
        this._worldModel = consistencyEngine.worldModel;
    }

    generateWorld() {
        // TODO [CRIT] worldify generate other worlds.
        let world = this._worldModel.getWorld(); // TODO [CRIT] worldify

        // TODO [LOW] chrono and time out.
        return new Promise(resolve => {

            // Generate blocks.
            let x = world.xSize, y = world.ySize, z = world.zSize;
            var chunkMap = WorldGenerator.generateFlatWorld(x, y, z, world);

            // Affect chunks.
            world.allChunks = chunkMap; // TODO [CRIT] worldify

            // Finalize chunks (extract surface faces).
            var chunks = new Map(chunkMap); // Shallow copy.
            // Adds chunks in worldModel, so mutable chunkMapCollection does not fit.
            chunks.forEach((chunk, id) => ChunkBuilder.computeChunkFaces(chunk));

            // Notify
            resolve();
        });
    }

}

export default Generator;
