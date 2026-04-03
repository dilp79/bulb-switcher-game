import { DEFAULT_PROGRESS, DEFAULT_SETTINGS, STORAGE_KEYS } from './constants.js';

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
        return {
            lastLevelRef: raw?.lastLevelRef ?? DEFAULT_PROGRESS.lastLevelRef,
            completed: raw?.completed ?? {},
            results: raw?.results ?? {}
        };
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

    recordLevelCompletion(levelRef, time, moves) {
        const key = serializeLevelRef(levelRef);
        const current = this.progress.results[key];

        if (!current || time < current.time || (time === current.time && moves < current.moves)) {
            this.progress.results[key] = { time, moves };
        }

        this.progress.completed[key] = true;
        this.progress.lastLevelRef = { ...levelRef };
        this.saveProgress();

        return this.progress.results[key];
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
}
