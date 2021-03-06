/**
 *
 */

'use strict';

import World from './world';
import CollectionUtils from '../../math/collections';
import { GameType } from '../game';

const BlockType = Object.freeze({
    AIR: 0,
    GRASS: 1,
    STONE: 2,
    DIRT: 3,
    WOOD: 4,
    PLANKS: 5,
    STONEBRICKS: 6,
    BRICKS: 7,
    LEAVES: 8,

    WATER: 16,

    SAND: 17,
    IRON: 18,
    OBSIDIAN: 19,

    ORE_GOLD: 20,
    ORE_COAL: 21,
    ORE_DIAMOND: 22,
    ORE_REDSTONE: 23,

    WOOL_WHITE: 32,
    WOOL_GREY: 33,
    WOOL_CYAN: 34,
    WOOL_ORANGE: 35,
    WOOL_DARK_PURPLE: 36,
    WOOL_LIGHT_PURPLE: 37,
    WOOL_DARK_BLUE: 38,
    WOOL_LIGHT_BLUE: 39,
    WOOL_BROWN: 40,
    WOOL_YELLOW: 41,
    WOOL_DARK_GREEN: 42,
    WOOL_LIGHT_GREEN: 43,
    WOOL_RED: 44,
    WOOL_ROSE: 45,
    WOOL_BLACK: 46,
    WOOL_DARK_GREY: 47,
    LAPIS: 48,
    SPONGE: 49,
    BEDROCK: 50,
    MOSSY_STONE: 51,
    CRACKED_STONE: 52,
    ENDER: 53,
    NETHER: 54,
    DIAMOND: 55,
    GOLD: 56,
});

const WorldType = Object.freeze({
    FLAT: 0,
    CUBE: 1,
    SHRIKE: 2,
    UNSTRUCTURED: 3,
    FANTASY: 4
});

const HillType = Object.freeze({
    NO_HILLS: 0,
    REGULAR_HILLS: 1,
    GIANT_HILLS: 2,
    ERODED: 3,
    SPIKES: 4
});

const TreeType = Object.freeze({
    NO_TREES: 0,
    SOME_TREES: 1
});

const ChunkSizes = Object.freeze({
    CUBE_VERY_SMALL: [2, 2, 2],
    CUBE_SMALL: [4, 4, 4],
    CUBE_REGULAR: [8, 8, 8],
    CUBE_HUGE: [16, 16, 16],
    FLAT_SMALL: [8, 8, 16],
    FLAT_REGULAR: [16, 16, 16],
    FLAT_HUGE: [32, 32, 64]
});

class BlockTypes
{
    static isBlock(id)
    {
        return id !== BlockType.AIR &&
            (id >= BlockType.GRASS && id <= BlockType.BRICKS ||
                id >= BlockType.SAND && id <= BlockType.IRON);
    }
}

class WorldModel
{
    static serverLoadingRadius = 6;

    constructor(game)
    {
        this._game = game;
        this._worlds = new Map();

        let masterWorldInfo = this.generateWorldInfoFromGameInfo(-1);
        this._worlds.set(-1, new World(-1, masterWorldInfo, this));
    }

    get worlds() { return this._worlds; }

    addWorld(worldId)
    {
        let wid  = worldId || CollectionUtils.generateId(this._worlds);
        if (this._worlds.has(wid)) return;

        let newWorldInfo = this.generateWorldInfoFromGameInfo(wid);
        let w = new World(wid, newWorldInfo, this);
        this._worlds.set(wid, w);

        return w;
    }

    getWorld(worldId)
    {
        if (!worldId) worldId = -1;
        return this._worlds.get(worldId);
    }

    getFreeWorld()
    {
        return this.getWorld(-1);
    }

    generateWorldInfoFromGameInfo(worldId)
    {
        let worldInfo = {};
        let gameInfo = this._game.gameInfo;
        let gk = gameInfo.kind;
        let wk = WorldType.FLAT;
        switch (gk) {
            case GameType.DEMO:
                let wid = parseInt(worldId, 10);
                if (wid === 2) {
                    return {
                        kind: WorldType.CUBE,
                        sideSize: 4,
                        hills: HillType.NO_HILLS,
                        trees: TreeType.NO_TREES
                    };
                } else if (wid === 3) {
                    return {
                        kind: WorldType.CUBE,
                        sideSize: 16,
                        hills: HillType.REGULAR_HILLS,
                        trees: TreeType.NO_TREES
                    };
                } else {
                    wk = WorldType.FLAT;
                    gameInfo.trees = TreeType.SOME_TREES;
                }
                break;
            case GameType.FLAT:
                wk = WorldType.FLAT;
                break;
            case GameType.FANTASY:
                wk = WorldType.FANTASY;
                break;
            case GameType.CUBE:
                wk = WorldType.CUBE;
                break;
            case GameType.UNSTRUCTURED:
            default:
                console.error('[Server/Model] Unsupported game type.');
                return;
        }

        worldInfo.kind = wk;
        switch (wk) {
            case WorldType.CUBE:
                switch (gameInfo.threeHillsType) {
                    case 0: worldInfo.hills = HillType.NO_HILLS; break;
                    case 1: worldInfo.hills = HillType.REGULAR_HILLS; break;
                    default: break;
                }
                worldInfo.sideSize = parseInt(gameInfo.size, 10);
                worldInfo.trees = TreeType.NO_TREES;
                worldInfo.chunkSizes = ChunkSizes.CUBE_REGULAR;
                break;
            case WorldType.FLAT:
                worldInfo.kind = WorldType.FLAT;
                switch (gameInfo.flatHillsType) {
                    case 0: worldInfo.hills = HillType.NO_HILLS; break;
                    case 1: worldInfo.hills = HillType.REGULAR_HILLS; break;
                    case 2: worldInfo.hills = HillType.GIANT_HILLS; break;
                    case 3: worldInfo.hills = HillType.ERODED; break;
                    case 4: worldInfo.hills = HillType.SPIKES; break;
                    default: break;
                }
                switch (gameInfo.trees) {
                    case 0: worldInfo.trees = TreeType.NO_TREES; break;
                    case 1: worldInfo.trees = TreeType.SOME_TREES; break;
                    default: break;
                }
                worldInfo.sideSize = -1; // infinite flat world
                worldInfo.chunkSizes = ChunkSizes.FLAT_REGULAR;
                break;
            case WorldType.FANTASY:
                worldInfo.kind = WorldType.FANTASY;
                worldInfo.sideSize = -1; // infinite flat world
                worldInfo.chunkSizes = ChunkSizes.FLAT_REGULAR;
                break;
            case WorldType.SHRIKE:
            case WorldType.UNSTRUCTURED:
            default:
                console.error('[Server/Model] Unsupported world type.');
                return;
        }

        return worldInfo;
    }
}

export {
    WorldModel as default,
    WorldType, BlockType, HillType, TreeType, ChunkSizes,
    BlockTypes
};
