export const APP_TITLE = 'Bulb Switcher';

export const STORAGE_KEYS = {
    progress: 'bulb-switcher.progress.v2',
    userLevels: 'bulb-switcher.user-levels.v2',
    settings: 'bulb-switcher.settings.v2'
};

export const LIMITS = {
    minButtons: 1,
    maxButtons: 8,
    minBulbs: 1,
    maxBulbs: 8,
    minColors: 2,
    maxColors: 4
};

export const BULB_ASSETS = [
    'assets/images/bulb_off.png',
    'assets/images/bulb_green.png',
    'assets/images/bulb_yellow.png',
    'assets/images/bulb_red.png'
];

export const BULB_LABELS = [
    'Выкл',
    'Зелёный',
    'Жёлтый',
    'Красный'
];

export const SOUND_ASSETS = {
    button: 'assets/sounds/button_click.mp3',
    hint: 'assets/sounds/hint.mp3',
    error: 'assets/sounds/error.mp3',
    victory: 'assets/sounds/victory.mp3'
};

export const UI_TEXT = {
    userBlockId: 'user_levels',
    userBlockTitle: 'Мои уровни',
    userBlockDescription: 'Уровни, которые вы создали и сохранили в браузере.'
};

export const DEFAULT_PROGRESS = {
    lastLevelRef: null,
    completed: {},
    results: {}
};

export const DEFAULT_SETTINGS = {
    soundEnabled: true
};
