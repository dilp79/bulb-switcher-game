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

export const RANKS = [
    { minLevel: 1,  maxLevel: 3,  title: 'Spark',           color: '#6f849e' },
    { minLevel: 4,  maxLevel: 6,  title: 'Filament',        color: '#42d6d2' },
    { minLevel: 7,  maxLevel: 9,  title: 'Circuit Breaker', color: '#7ef0ac' },
    { minLevel: 10, maxLevel: 13, title: 'Surge Master',    color: '#ffb300' },
    { minLevel: 14, maxLevel: 17, title: 'Arc Welder',      color: '#ffcc40' },
    { minLevel: 18, maxLevel: 21, title: 'Dynamo',          color: '#ff9800' },
    { minLevel: 22, maxLevel: 25, title: 'Tesla',           color: '#ff7e7e' },
    { minLevel: 26, maxLevel: 99, title: 'Luminary',        color: '#e040fb' },
];

export const XP_CONFIG = {
    baseCompletion: 100,
    starMultipliers: { 1: 1, 2: 1.5, 3: 2 },
    firstClearBonus: 0.5,
    dailyChallengeBase: 200,
};

export const STAR_CONFIG = {
    moveMultiplier2Star: 2.0,
    moveMultiplier3Star: 1.5,
    timePerMove: 5,
};

export const DEFAULT_PLAYER = {
    xp: 0,
    rank: 1,
    streak: {
        current: 0,
        lastPlayedDate: null,
        freezesAvailable: 0,
    },
    achievements: [],
    cosmetics: {
        activeBulbTheme: 'classic',
        activeBoardStyle: 'deep-space',
        activeButtonStyle: 'classic',
        unlocked: ['classic', 'deep-space'],
    },
    dailyChallenge: {
        lastCompletedDate: null,
        completedCount: 0,
        calendar: {},
    },
};
