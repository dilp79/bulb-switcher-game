import { SOUND_ASSETS } from './constants.js';

export class AudioService {
    constructor(soundEnabled = true) {
        this.soundEnabled = soundEnabled;
        this.cache = new Map();
    }

    setSoundEnabled(enabled) {
        this.soundEnabled = Boolean(enabled);
    }

    preload() {
        Object.values(SOUND_ASSETS).forEach((src) => {
            const audio = new Audio(src);
            audio.preload = 'auto';
            this.cache.set(src, audio);
        });
    }

    play(soundKey) {
        if (!this.soundEnabled) {
            return;
        }

        const src = SOUND_ASSETS[soundKey];
        if (!src) {
            return;
        }

        const cached = this.cache.get(src) ?? new Audio(src);
        const instance = cached.cloneNode();
        instance.volume = soundKey === 'victory' ? 0.8 : 0.65;
        instance.play().catch(() => {
            // Браузер может заблокировать звук до первого пользовательского действия.
        });
    }
}
