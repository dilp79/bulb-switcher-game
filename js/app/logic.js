import { LIMITS } from './constants.js';

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculateComplexity(buttonsCount, bulbsCount, connectionsCount) {
    const safeConnections = Math.max(1, connectionsCount);
    return 1 + Math.log10((buttonsCount + bulbsCount) * safeConnections);
}

export function normalizeConnections(connections, buttonsCount, bulbsCount) {
    const seen = new Set();
    const normalized = [];

    (Array.isArray(connections) ? connections : []).forEach((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) {
            return;
        }

        const buttonIndex = Number(pair[0]);
        const bulbIndex = Number(pair[1]);

        if (!Number.isInteger(buttonIndex) || !Number.isInteger(bulbIndex)) {
            return;
        }

        if (buttonIndex < 0 || buttonIndex >= buttonsCount || bulbIndex < 0 || bulbIndex >= bulbsCount) {
            return;
        }

        const key = `${buttonIndex}:${bulbIndex}`;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        normalized.push([buttonIndex, bulbIndex]);
    });

    return normalized.sort((left, right) => {
        if (left[0] !== right[0]) {
            return left[0] - right[0];
        }
        return left[1] - right[1];
    });
}

export function normalizeStateArray(states, length, maxValue, fillValue = 0) {
    const normalized = Array.from({ length }, (_, index) => {
        const value = Array.isArray(states) ? Number(states[index]) : fillValue;
        return Number.isFinite(value) ? clamp(Math.round(value), 0, maxValue) : fillValue;
    });

    return normalized;
}

export function normalizeLevel(rawLevel, fallback = {}) {
    const buttonsCount = clamp(
        Number(rawLevel?.buttons_count ?? fallback.buttons_count ?? LIMITS.minButtons),
        LIMITS.minButtons,
        LIMITS.maxButtons
    );

    const bulbsCount = clamp(
        Number(rawLevel?.bulbs_count ?? fallback.bulbs_count ?? LIMITS.minBulbs),
        LIMITS.minBulbs,
        LIMITS.maxBulbs
    );

    const colorsCount = clamp(
        Number(rawLevel?.colors_count ?? fallback.colors_count ?? LIMITS.minColors),
        LIMITS.minColors,
        LIMITS.maxColors
    );

    const connections = normalizeConnections(
        rawLevel?.connections ?? fallback.connections ?? [],
        buttonsCount,
        bulbsCount
    );

    const initialStates = normalizeStateArray(
        rawLevel?.initial_states ?? fallback.initial_states,
        bulbsCount,
        colorsCount - 1,
        0
    );

    const targetStates = normalizeStateArray(
        rawLevel?.target_states ?? fallback.target_states,
        bulbsCount,
        colorsCount - 1,
        0
    );

    return {
        id: rawLevel?.id ?? fallback.id ?? null,
        name: String(rawLevel?.name ?? fallback.name ?? 'Без названия'),
        buttons_count: buttonsCount,
        bulbs_count: bulbsCount,
        colors_count: colorsCount,
        connections,
        initial_states: initialStates,
        target_states: targetStates,
        complexity: Number.isFinite(Number(rawLevel?.complexity))
            ? Number(rawLevel.complexity)
            : calculateComplexity(buttonsCount, bulbsCount, connections.length),
        block: rawLevel?.block ?? fallback.block ?? null
    };
}

export function getConnectionCoverage(buttonsCount, bulbsCount, connections) {
    const buttons = new Set();
    const bulbs = new Set();

    connections.forEach(([buttonIndex, bulbIndex]) => {
        buttons.add(buttonIndex);
        bulbs.add(bulbIndex);
    });

    return {
        buttonsCovered: buttons.size,
        bulbsCovered: bulbs.size,
        allButtonsCovered: buttons.size === buttonsCount,
        allBulbsCovered: bulbs.size === bulbsCount
    };
}

export function validateLevel(level) {
    const errors = [];
    const coverage = getConnectionCoverage(level.buttons_count, level.bulbs_count, level.connections);

    if (!coverage.allButtonsCovered) {
        errors.push('Каждая кнопка должна быть связана хотя бы с одной лампочкой.');
    }

    if (!coverage.allBulbsCovered) {
        errors.push('Каждая лампочка должна быть связана хотя бы с одной кнопкой.');
    }

    if (!level.initial_states.some((state) => state > 0)) {
        errors.push('Стартовое состояние должно содержать хотя бы одну включённую лампочку.');
    }

    if (errors.length === 0 && !findLevelSolution(level)) {
        errors.push('Уровень должен иметь хотя бы одно решение.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export function applyButtonPress(level, currentStates, buttonIndex) {
    const nextStates = [...currentStates];
    const stepModulo = Math.max(1, level.colors_count);

    level.connections.forEach(([linkedButton, linkedBulb]) => {
        if (linkedButton === buttonIndex) {
            nextStates[linkedBulb] = (nextStates[linkedBulb] + 1) % stepModulo;
        }
    });

    return nextStates;
}

export function isSolved(states, targetStates) {
    return states.every((state, index) => state === targetStates[index]);
}

export function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function createLevelId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `level-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function generateConnections(buttonsCount, bulbsCount) {
    const pairs = new Set();

    for (let buttonIndex = 0; buttonIndex < buttonsCount; buttonIndex += 1) {
        pairs.add(`${buttonIndex}:${randomInt(0, bulbsCount - 1)}`);
    }

    for (let bulbIndex = 0; bulbIndex < bulbsCount; bulbIndex += 1) {
        pairs.add(`${randomInt(0, buttonsCount - 1)}:${bulbIndex}`);
    }

    const maxConnections = buttonsCount * bulbsCount;
    const targetConnections = clamp(
        Math.ceil((buttonsCount + bulbsCount) * 1.15),
        Math.max(buttonsCount, bulbsCount),
        maxConnections
    );

    while (pairs.size < targetConnections) {
        pairs.add(`${randomInt(0, buttonsCount - 1)}:${randomInt(0, bulbsCount - 1)}`);
    }

    return Array.from(pairs, (pair) => pair.split(':').map((value) => Number(value)))
        .sort((left, right) => {
            if (left[0] !== right[0]) {
                return left[0] - right[0];
            }
            return left[1] - right[1];
        });
}

export function generateInitialState(level) {
    const zeroState = Array(level.bulbs_count).fill(0);
    const maxAttempts = 12;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const pressCounts = Array.from(
            { length: level.buttons_count },
            () => randomInt(0, Math.max(0, level.colors_count - 1))
        );

        if (pressCounts.every((value) => value === 0)) {
            pressCounts[randomInt(0, level.buttons_count - 1)] = 1;
        }

        let nextStates = [...zeroState];

        pressCounts.forEach((count, buttonIndex) => {
            for (let press = 0; press < count; press += 1) {
                nextStates = applyButtonPress(level, nextStates, buttonIndex);
            }
        });

        if (nextStates.some((state) => state > 0)) {
            return nextStates;
        }
    }

    const fallback = [...zeroState];
    fallback[randomInt(0, level.bulbs_count - 1)] = 1;
    return fallback;
}

export function findLevelSolution(level) {
    const modulo = Math.max(1, Number(level.colors_count) || 0);
    const buttonsCount = Number(level.buttons_count) || 0;
    const bulbsCount = Number(level.bulbs_count) || 0;

    if (!buttonsCount || !bulbsCount) {
        return null;
    }

    const delta = Array.from({ length: bulbsCount }, (_, index) => (
        (Number(level.target_states[index] ?? 0) - Number(level.initial_states[index] ?? 0) + modulo) % modulo
    ));

    if (delta.every((value) => value === 0)) {
        return Array(buttonsCount).fill(0);
    }

    const buttonEffects = Array.from({ length: buttonsCount }, () => Array(bulbsCount).fill(0));

    level.connections.forEach(([buttonIndex, bulbIndex]) => {
        if (buttonEffects[buttonIndex]?.[bulbIndex] !== undefined) {
            buttonEffects[buttonIndex][bulbIndex] = (buttonEffects[buttonIndex][bulbIndex] + 1) % modulo;
        }
    });

    const activeDelta = Array(bulbsCount).fill(0);
    const pressCounts = Array(buttonsCount).fill(0);

    function search(buttonIndex) {
        if (buttonIndex >= buttonsCount) {
            return activeDelta.every((value, index) => value === delta[index]) ? [...pressCounts] : null;
        }

        const effect = buttonEffects[buttonIndex];

        for (let count = 0; count < modulo; count += 1) {
            pressCounts[buttonIndex] = count;
            const solution = search(buttonIndex + 1);
            if (solution) {
                return solution;
            }

            for (let bulbIndex = 0; bulbIndex < bulbsCount; bulbIndex += 1) {
                activeDelta[bulbIndex] = (activeDelta[bulbIndex] + effect[bulbIndex]) % modulo;
            }
        }

        pressCounts[buttonIndex] = 0;
        return null;
    }

    return search(0);
}

export function calculateStars({ optimalMoves, actualMoves, elapsedSeconds, hintUsed }) {
    if (hintUsed || optimalMoves === null) {
        return 1;
    }

    const timeTarget = optimalMoves * 5;
    const movesFor3Star = optimalMoves * 1.5;
    const movesFor2Star = optimalMoves * 2;

    if (actualMoves <= movesFor3Star && elapsedSeconds <= timeTarget) {
        return 3;
    }
    if (actualMoves <= movesFor2Star) {
        return 2;
    }
    return 1;
}

export function createGeneratedLevel({
    name,
    buttonsCount,
    bulbsCount,
    colorsCount,
    block = null,
    id = null
}) {
    const buttons = clamp(Number(buttonsCount), LIMITS.minButtons, LIMITS.maxButtons);
    const bulbs = clamp(Number(bulbsCount), LIMITS.minBulbs, LIMITS.maxBulbs);
    const colors = clamp(Number(colorsCount), LIMITS.minColors, LIMITS.maxColors);
    const connections = generateConnections(buttons, bulbs);

    const draft = {
        id,
        name: String(name || 'Новый уровень'),
        buttons_count: buttons,
        bulbs_count: bulbs,
        colors_count: colors,
        connections,
        target_states: Array(bulbs).fill(0),
        block
    };

    return normalizeLevel({
        ...draft,
        initial_states: generateInitialState(draft),
        complexity: calculateComplexity(buttons, bulbs, connections.length)
    });
}
