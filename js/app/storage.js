import { DEFAULT_PLAYER, DEFAULT_PROGRESS, DEFAULT_SETTINGS, STORAGE_KEYS } from './constants.js';
import { getRankForXp } from './player.js';

const PLAYER_KEY = 'bulb-switcher.player.v1';

function safeParse(value, fallback) {
    if (!value) {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        console.warn('Failed to parse stored value:', error);
        return fallback;
    }
}

function safeClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createMemoryStorage() {
    const cache = new Map();

    return {
        getItem(key) {
            return cache.has(key) ? cache.get(key) : null;
        },
        setItem(key, value) {
            cache.set(key, value);
        }
    };
}

export function serializeLevelRef(levelRef) {
    if (!levelRef) {
        return '';
    }

    if (levelRef.type === 'user') {
        return `user:${levelRef.id}`;
    }

    return `builtin:${levelRef.blockId}:${levelRef.levelIndex}`;
}

export class StorageService {
    constructor(storage = typeof window !== 'undefined' ? window.localStorage : null) {
        this.storage = this.resolveStorage(storage);
        this.progress = this.loadProgress();
        this.settings = this.loadSettings();
    }

    resolveStorage(storage) {
        try {
            if (storage) {
                const probeKey = '__bulb_switcher_probe__';
                storage.setItem(probeKey, '1');
                if (typeof storage.removeItem === 'function') {
                    storage.removeItem(probeKey);
                }
                return storage;
            }
        } catch (error) {
            console.warn('localStorage is unavailable, using memory storage instead.', error);
        }

        return createMemoryStorage();
    }

    loadProgress() {
        const raw = safeParse(this.storage.getItem(STORAGE_KEYS.progress), DEFAULT_PROGRESS);
        const progress = {
            lastLevelRef: raw?.lastLevelRef ?? DEFAULT_PROGRESS.lastLevelRef,
            completed: raw?.completed ?? {},
            results: raw?.results ?? {}
        };

        // Migrate old results that lack stars field
        if (progress.results) {
            for (const key of Object.keys(progress.results)) {
                const result = progress.results[key];
                if (result && typeof result.stars === 'undefined') {
                    result.stars = 1; // Existing completions get 1 star by default
                    result.xpEarned = 0;
                    result.hintUsed = false;
                }
            }
        }

        return progress;
    }

    saveProgress() {
        this.storage.setItem(STORAGE_KEYS.progress, JSON.stringify(this.progress));
    }

    getProgress() {
        return safeClone(this.progress);
    }

    getLastLevelRef() {
        return this.progress.lastLevelRef;
    }

    rememberLastLevel(levelRef) {
        this.progress.lastLevelRef = levelRef ? { ...levelRef } : null;
        this.saveProgress();
    }

    recordLevelCompletion(levelRef, time, moves, stars, xpEarned, hintUsed) {
        const key = serializeLevelRef(levelRef);
        const prev = this.progress.results[key];

        const bestMoves = prev ? Math.min(prev.moves, moves) : moves;
        const bestTime = prev ? Math.min(prev.time, time) : time;
        const bestStars = prev ? Math.max(prev.stars || 0, stars) : stars;
        const newRecord = !prev || moves < prev.moves || time < prev.time;

        this.progress.results[key] = {
            moves: bestMoves,
            time: bestTime,
            stars: bestStars,
            xpEarned: (prev?.xpEarned || 0) + xpEarned,
            // "Best run" semantics: hintUsed is false if ANY attempt was hint-free
            hintUsed: prev ? (prev.hintUsed && hintUsed) : hintUsed,
        };
        this.progress.completed[key] = true;
        this.progress.lastLevelRef = { ...levelRef };
        this.saveProgress();

        return { newRecord, bestStars };
    }

    getLevelResult(levelRef) {
        return this.progress.results[serializeLevelRef(levelRef)] ?? null;
    }

    isLevelCompleted(levelRef) {
        return Boolean(this.progress.completed[serializeLevelRef(levelRef)]);
    }

    loadUserLevels() {
        const raw = safeParse(this.storage.getItem(STORAGE_KEYS.userLevels), []);
        return Array.isArray(raw) ? raw : [];
    }

    saveUserLevels(levels) {
        this.storage.setItem(STORAGE_KEYS.userLevels, JSON.stringify(levels));
    }

    loadSettings() {
        const raw = safeParse(this.storage.getItem(STORAGE_KEYS.settings), DEFAULT_SETTINGS);
        return {
            ...DEFAULT_SETTINGS,
            ...raw
        };
    }

    saveSettings() {
        this.storage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.settings));
    }

    setSoundEnabled(enabled) {
        this.settings.soundEnabled = Boolean(enabled);
        this.saveSettings();
    }

    getSettings() {
        return { ...this.settings };
    }

    loadPlayer() {
        try {
            const raw = this.storage.getItem(PLAYER_KEY);
            if (!raw) return { ...DEFAULT_PLAYER };
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_PLAYER, ...parsed };
        } catch {
            return { ...DEFAULT_PLAYER };
        }
    }

    savePlayer(player) {
        try {
            this.storage.setItem(PLAYER_KEY, JSON.stringify(player));
        } catch {
            // Storage full or unavailable — silent fail
        }
    }

    addPlayerXp(amount) {
        const player = this.loadPlayer();
        player.xp += amount;
        player.rank = getRankForXp(player.xp);
        this.savePlayer(player);
        return player;
    }
}
