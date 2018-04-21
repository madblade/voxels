/**
 *
 */

'use strict';

class World {

    constructor(id, worldType, worldModel)
    {
        this._worldId = id; // Identifier
        this._worldModel = worldModel;
        // this._worldType = worldType;
        this._worldInfo = {
            type: worldType,
            center: {x: 0, y: 0, z: -2},
            radius: 2
        };

        // Chunk id (i+','+j+','+k) -> chunk
        this._chunks = new Map();

        // Keep same generation method
        this._generationMethod = 'flat';

        // Constants
        this._xSize = 16; // MUST BE EVEN (ideally a power of two)
        this._ySize = 16; // MUST BE EVEN (ideally a power of two)
        this._zSize = 16; // MUST BE EVEN (ideally a power of two)
    }

    get worldId() { return this._worldId; }
    // get worldType() { return this._worldType; }
    get worldInfo() { return this._worldInfo; }

    get xSize() { return this._xSize; }
    get ySize() { return this._ySize; }
    get zSize() { return this._zSize; }

    get allChunks() { return this._chunks; }
    set allChunks(newChunks) { this._chunks = newChunks; }

    get generationMethod() { return this._generationMethod; }
    set generationMethod(newGenerationMethod) { this._generationMethod = newGenerationMethod; }

    addChunk(id, chunk) {
        this._chunks.set(id, chunk);
    }

    getChunkCoordinates(x, y, z) {
        let f = Math.floor;
        const dx = this.xSize;
        const dy = this.ySize;
        const dz = this.zSize;
        return [f(x / dx), f(y / dy), f(z / dz)];
    }

    getChunkByCoordinates(x, y, z) {
        let c = this.getChunkCoordinates(x, y, z);
        return this.getChunk(...c);
    }

    whatBlock(x, y, z) {
        let coords = this.getChunkCoordinates(x, y, z);

        const dx = this.xSize;
        const dy = this.ySize;
        const dz = this.zSize;
        const i = coords[0];
        const j = coords[1];
        const k = coords[2];

        const chunkX = x - i * dx;
        const chunkY = y - j * dy;
        const chunkZ = z - k * dz;

        const chunkId = `${i},${j},${k}`;
        let chunk = this._chunks.get(chunkId);
        if (!chunk || chunk === undefined) {
            console.log(`ChkMgr@whatBlock: could not find chunk ${chunkId} from (${x},${y},${z})!`);
            // TODO [MEDIUM] load concerned chunk.
            // TODO [MEDIUM] check minus
            return;
        }

        return chunk.what(chunkX, chunkY, chunkZ);
    }

    getFreePosition() {
        let zLimit = this._zSize;
        let z = zLimit - 2;
        while (this.whatBlock(6, 6, z) !== 0 &&
            this.whatBlock(6, 6, z + 1) !== 0 && z + 1 < zLimit) ++z;
        return [6.5, 6.5, z];
    }

    getChunk(iCoordinate, jCoordinate, kCoordinate) {
        let id = `${iCoordinate},${jCoordinate},${kCoordinate}`;
        return this._chunks.get(id);
    }

    getChunkById(chunkId) {
        return this._chunks.get(chunkId);
    }

    hasChunkById(chunkId) {
        return this._chunks.has(chunkId);
    }

    hasChunk(i, j, k) {
        return !!this.getChunk(i, j, k);
    }

    isFree(p) {
        return this.whatBlock(p[0], p[1], p[2]) === 0;
        // && this.whatBlock(p[0], p[1], p[2]+1) === 0;
    }

}

export default World;
