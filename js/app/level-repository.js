import { UI_TEXT } from './constants.js';
import { createLevelId, normalizeLevel } from './logic.js';

export class LevelRepository {
    constructor(storageService) {
        this.storageService = storageService;
        this.builtinBlocks = [];
        this.userLevels = [];
    }

    async load() {
        const manifestResponse = await fetch('levels/manifest.json');
        if (!manifestResponse.ok) {
            throw new Error(`Не удалось загрузить levels/manifest.json: ${manifestResponse.status}`);
        }

        const manifest = await manifestResponse.json();
        const blocks = Array.isArray(manifest.blocks) ? manifest.blocks : [];

        this.builtinBlocks = await Promise.all(
            blocks.map(async (blockMeta) => {
                const indexResponse = await fetch(`${blockMeta.directory}/${blockMeta.index}`);
                if (!indexResponse.ok) {
                    throw new Error(`Не удалось загрузить ${blockMeta.directory}/${blockMeta.index}`);
                }

                const levelFiles = await indexResponse.json();
                const levels = await Promise.all(
                    levelFiles.map(async (fileName, levelIndex) => {
                        const levelResponse = await fetch(`${blockMeta.directory}/${fileName}`);
                        if (!levelResponse.ok) {
                            throw new Error(`Не удалось загрузить ${blockMeta.directory}/${fileName}`);
                        }

                        const rawLevel = await levelResponse.json();
                        return normalizeLevel(rawLevel, {
                            name: `Уровень ${levelIndex + 1}`,
                            block: blockMeta.id
                        });
                    })
                );

                return {
                    id: blockMeta.id,
                    title: blockMeta.title,
                    description: blockMeta.description,
                    source: 'builtin',
                    levels
                };
            })
        );

        this.userLevels = this.storageService.loadUserLevels().map((level) => normalizeUserLevel(level));
    }

    getBuiltInBlocks() {
        return [...this.builtinBlocks];
    }

    getUserBlock() {
        return {
            id: UI_TEXT.userBlockId,
            title: UI_TEXT.userBlockTitle,
            description: UI_TEXT.userBlockDescription,
            source: 'user',
            levels: [...this.userLevels]
        };
    }

    getAllBlocks() {
        return [...this.builtinBlocks, this.getUserBlock()];
    }

    getDefaultLevelRef() {
        if (!this.builtinBlocks.length || !this.builtinBlocks[0].levels.length) {
            return null;
        }

        return {
            type: 'builtin',
            blockId: this.builtinBlocks[0].id,
            levelIndex: 0
        };
    }

    hasLevel(levelRef) {
        return Boolean(this.getLevel(levelRef));
    }

    getLevel(levelRef) {
        if (!levelRef) {
            return null;
        }

        if (levelRef.type === 'user') {
            return this.userLevels.find((level) => level.id === levelRef.id) ?? null;
        }

        const block = this.builtinBlocks.find((item) => item.id === levelRef.blockId);
        if (!block) {
            return null;
        }

        return block.levels[levelRef.levelIndex] ?? null;
    }

    getBlock(blockId) {
        if (blockId === UI_TEXT.userBlockId) {
            return this.getUserBlock();
        }

        return this.builtinBlocks.find((block) => block.id === blockId) ?? null;
    }

    listUserLevels() {
        return [...this.userLevels];
    }

    saveUserLevel(level) {
        const normalized = normalizeUserLevel(level);
        const existingIndex = this.userLevels.findIndex((item) => item.id === normalized.id);

        if (existingIndex >= 0) {
            this.userLevels.splice(existingIndex, 1, normalized);
        } else {
            this.userLevels.push(normalized);
        }

        this.storageService.saveUserLevels(this.userLevels);
        return normalized;
    }

    deleteUserLevel(levelId) {
        const index = this.userLevels.findIndex((level) => level.id === levelId);
        if (index === -1) {
            return false;
        }

        this.userLevels.splice(index, 1);
        this.storageService.saveUserLevels(this.userLevels);
        return true;
    }

    getUserLevelRef(levelId) {
        return {
            type: 'user',
            id: levelId
        };
    }

    getBuiltInLevelRef(blockId, levelIndex) {
        return {
            type: 'builtin',
            blockId,
            levelIndex
        };
    }

    getNextLevelRef(levelRef) {
        if (!levelRef) {
            return null;
        }

        if (levelRef.type === 'user') {
            const currentIndex = this.userLevels.findIndex((level) => level.id === levelRef.id);
            if (currentIndex === -1) {
                return null;
            }

            const nextLevel = this.userLevels[currentIndex + 1];
            return nextLevel ? this.getUserLevelRef(nextLevel.id) : null;
        }

        const blockIndex = this.builtinBlocks.findIndex((block) => block.id === levelRef.blockId);
        if (blockIndex === -1) {
            return null;
        }

        const currentBlock = this.builtinBlocks[blockIndex];
        if (levelRef.levelIndex + 1 < currentBlock.levels.length) {
            return this.getBuiltInLevelRef(currentBlock.id, levelRef.levelIndex + 1);
        }

        const nextBlock = this.builtinBlocks[blockIndex + 1];
        if (!nextBlock || !nextBlock.levels.length) {
            return null;
        }

        return this.getBuiltInLevelRef(nextBlock.id, 0);
    }
}

function normalizeUserLevel(level) {
    return normalizeLevel(
        {
            ...level,
            id: level?.id ?? createLevelId(),
            block: UI_TEXT.userBlockId
        },
        {
            block: UI_TEXT.userBlockId
        }
    );
}
