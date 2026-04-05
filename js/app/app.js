import { APP_TITLE, BULB_ASSETS, BULB_LABELS, LIMITS, STAR_CONFIG, UI_TEXT } from './constants.js';
import { AudioService } from './audio.js';
import {
    applyButtonPress,
    calculateComplexity,
    calculateStars,
    clamp,
    createGeneratedLevel,
    formatTime,
    generateConnections,
    generateInitialState,
    getOptimalMoveCount,
    isSolved,
    normalizeConnections,
    normalizeLevel,
    validateLevel
} from './logic.js';
import { LevelRepository } from './level-repository.js';
import { StorageService } from './storage.js';
import { calculateXpForLevel, getRankProgress } from './player.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function pluralize(count, one, few, many) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;

    if (n > 10 && n < 20) {
        return many;
    }

    if (n1 > 1 && n1 < 5) {
        return few;
    }

    if (n1 === 1) {
        return one;
    }

    return many;
}

export class BulbSwitcherApp {
    constructor(rootElement) {
        this.root = rootElement;
        this.storage = new StorageService();
        this.levelRepository = new LevelRepository(this.storage);
        this.audio = new AudioService(this.storage.getSettings().soundEnabled);
        this.state = {
            screen: 'loading',
            activeBlockId: null,
            notice: null,
            error: null,
            game: null,
            editor: null
        };
        this.gameTimerId = null;
        this.hintTimerId = null;

        this.handleClick = this.handleClick.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
    }

    async init() {
        this.root.addEventListener('click', this.handleClick);
        this.root.addEventListener('input', this.handleInput);
        this.root.addEventListener('change', this.handleChange);
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('keydown', this.handleKeydown);

        this.audio.preload();

        try {
            await this.levelRepository.load();
            this.state.activeBlockId = this.getInitialActiveBlockId();
            this.state.screen = 'home';
            this.render();
        } catch (error) {
            console.error(error);
            this.state.screen = 'error';
            this.state.error = error;
            this.render();
        }
    }

    getInitialActiveBlockId() {
        const lastLevelRef = this.storage.getLastLevelRef();

        if (lastLevelRef?.type === 'builtin' && this.levelRepository.getBlock(lastLevelRef.blockId)) {
            return lastLevelRef.blockId;
        }

        if (lastLevelRef?.type === 'user') {
            return UI_TEXT.userBlockId;
        }

        return this.levelRepository.getDefaultLevelRef()?.blockId ?? UI_TEXT.userBlockId;
    }

    setNotice(type, lines) {
        const normalizedLines = Array.isArray(lines) ? lines : [lines];
        this.state.notice = { type, lines: normalizedLines.filter(Boolean) };
    }

    clearNotice() {
        this.state.notice = null;
    }

    navigate(screen) {
        if (screen !== 'game') {
            this.stopGameTimers();
        }

        this.state.screen = screen;
        this.render();
    }

    openHome() {
        this.navigate('home');
    }

    openLevelSelect(blockId = null) {
        this.stopGameTimers();
        this.state.activeBlockId = blockId ?? this.state.activeBlockId ?? this.getInitialActiveBlockId();
        this.state.screen = 'levels';
        this.render();
    }

    openHelp() {
        this.navigate('help');
    }

    openEditor(levelId = null) {
        this.stopGameTimers();
        let nextEditorState = null;

        if (levelId) {
            const existing = this.levelRepository.listUserLevels().find((level) => level.id === levelId);
            if (existing) {
                nextEditorState = this.createEditorState(existing, 'edit');
            }
        }

        if (!nextEditorState) {
            nextEditorState = this.createEditorState(
                createGeneratedLevel({
                    name: `Пользовательский уровень ${this.levelRepository.listUserLevels().length + 1}`,
                    buttonsCount: 3,
                    bulbsCount: 3,
                    colorsCount: 2,
                    block: UI_TEXT.userBlockId
                }),
                'create'
            );
        }

        this.state.editor = nextEditorState;
        this.state.screen = 'editor';
        this.render();
    }

    createEditorState(level, mode) {
        const normalized = normalizeLevel(level, { block: UI_TEXT.userBlockId });
        return {
            mode,
            selectedButtonIndex: null,
            level: {
                ...normalized,
                target_states: Array(normalized.bulbs_count).fill(0),
                complexity: calculateComplexity(
                    normalized.buttons_count,
                    normalized.bulbs_count,
                    normalized.connections.length
                )
            },
            validationErrors: []
        };
    }

    startGame(levelRef) {
        const level = this.levelRepository.getLevel(levelRef);
        if (!level) {
            this.setNotice('error', 'Не удалось открыть уровень.');
            this.openLevelSelect(this.state.activeBlockId);
            return;
        }

        this.stopGameTimers();
        this.clearNotice();
        this.storage.rememberLastLevel(levelRef);
        this.state.activeBlockId = levelRef.type === 'builtin' ? levelRef.blockId : UI_TEXT.userBlockId;
        this.state.game = {
            levelRef,
            level,
            currentStates: [...level.initial_states],
            moves: 0,
            startedAt: Date.now(),
            elapsedSeconds: 0,
            hintUsed: false,
            hintSelectionMode: false,
            hintPairs: [],
            hintedButtonIndex: null,
            victory: null
        };
        this.state.screen = 'game';
        this.startGameTimer();
        this.render();
    }

    restartGame() {
        if (!this.state.game) {
            return;
        }

        this.startGame(this.state.game.levelRef);
    }

    startGameTimer() {
        this.stopGameTimers();
        this.gameTimerId = window.setInterval(() => {
            if (!this.state.game || this.state.game.victory) {
                return;
            }

            this.state.game.elapsedSeconds = Math.floor((Date.now() - this.state.game.startedAt) / 1000);
            this.updateGameRuntime();
        }, 1000);
    }

    stopGameTimers() {
        if (this.gameTimerId) {
            window.clearInterval(this.gameTimerId);
            this.gameTimerId = null;
        }

        if (this.hintTimerId) {
            window.clearTimeout(this.hintTimerId);
            this.hintTimerId = null;
        }
    }

    updateGameRuntime() {
        if (this.state.screen !== 'game' || !this.state.game || this.state.game.victory) {
            return;
        }

        const movesNode = this.root.querySelector('[data-runtime="moves"]');
        if (movesNode) {
            movesNode.textContent = String(this.state.game.moves);
        }

        const timeNode = this.root.querySelector('[data-runtime="time"]');
        if (timeNode) {
            timeNode.textContent = formatTime(this.state.game.elapsedSeconds);
        }
    }

    pressGameButton(buttonIndex) {
        if (!this.state.game || this.state.game.victory) {
            return;
        }

        if (this.state.game.hintSelectionMode) {
            this.revealHint(buttonIndex);
            return;
        }

        this.audio.play('button');
        this.state.game.currentStates = applyButtonPress(
            this.state.game.level,
            this.state.game.currentStates,
            buttonIndex
        );
        this.state.game.moves += 1;
        this.state.game.elapsedSeconds = Math.floor((Date.now() - this.state.game.startedAt) / 1000);

        if (isSolved(this.state.game.currentStates, this.state.game.level.target_states)) {
            this.completeGame();
            return;
        }

        this.render();
    }

    enableHintMode() {
        if (!this.state.game || this.state.game.hintUsed || this.state.game.victory) {
            return;
        }

        this.state.game.hintSelectionMode = true;
        this.state.game.hintPairs = [];
        this.state.game.hintedButtonIndex = null;
        this.render();
    }

    revealHint(buttonIndex) {
        if (!this.state.game || this.state.game.hintUsed) {
            return;
        }

        const hintPairs = this.state.game.level.connections.filter(([linkedButton]) => linkedButton === buttonIndex);

        this.state.game.hintUsed = true;
        this.state.game.hintSelectionMode = false;
        this.state.game.hintPairs = hintPairs;
        this.state.game.hintedButtonIndex = buttonIndex;
        this.audio.play('hint');

        if (this.hintTimerId) {
            window.clearTimeout(this.hintTimerId);
        }

        this.hintTimerId = window.setTimeout(() => {
            if (!this.state.game) {
                return;
            }

            this.state.game.hintPairs = [];
            this.state.game.hintedButtonIndex = null;
            this.render();
        }, 3000);

        this.render();
    }

    completeGame() {
        const session = this.state.game;
        if (!session) {
            return;
        }

        this.stopGameTimers();

        const totalSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
        session.elapsedSeconds = totalSeconds;

        const optimalMoves = getOptimalMoveCount(session.level);
        const stars = calculateStars({
            optimalMoves,
            actualMoves: session.moves,
            elapsedSeconds: totalSeconds,
            hintUsed: session.hintUsed,
        });

        const isFirstClear = !this.storage.isLevelCompleted(session.levelRef);
        const complexity = session.level.complexity || 1;
        const player = this.storage.loadPlayer();
        const xpEarned = calculateXpForLevel({
            stars,
            complexity,
            isFirstClear,
            streakDays: player.streak.current,
        });

        const result = this.storage.recordLevelCompletion(
            session.levelRef, totalSeconds, session.moves, stars, xpEarned, session.hintUsed
        );

        const updatedPlayer = this.storage.addPlayerXp(xpEarned);
        const rankProgress = getRankProgress(updatedPlayer.xp);
        const previousRankProgress = getRankProgress(updatedPlayer.xp - xpEarned);

        session.victory = {
            totalSeconds,
            moves: session.moves,
            newRecord: result.newRecord,
            stars,
            xpEarned,
            rankProgress,
            previousRank: previousRankProgress.rank,
            nextLevelRef: this.levelRepository.getNextLevelRef(session.levelRef),
        };

        this.audio.play('victory');
        this.render();
    }

    toggleSound() {
        const nextValue = !this.storage.getSettings().soundEnabled;
        this.storage.setSoundEnabled(nextValue);
        this.audio.setSoundEnabled(nextValue);
        this.render();
    }

    updateEditorName(value) {
        if (!this.state.editor) {
            return;
        }

        this.state.editor.level.name = value;
    }

    updateEditorCount(field, delta) {
        if (!this.state.editor) {
            return;
        }

        const level = this.state.editor.level;
        const nextLevel = {
            ...level,
            [field]: clamp(
                Number(level[field]) + delta,
                field === 'colors_count' ? LIMITS.minColors : LIMITS.minButtons,
                field === 'colors_count'
                    ? LIMITS.maxColors
                    : field === 'buttons_count'
                        ? LIMITS.maxButtons
                        : LIMITS.maxBulbs
            )
        };

        nextLevel.connections = normalizeConnections(
            nextLevel.connections,
            nextLevel.buttons_count,
            nextLevel.bulbs_count
        );
        nextLevel.initial_states = normalizeBulbStates(nextLevel.initial_states, nextLevel.bulbs_count, nextLevel.colors_count);
        nextLevel.target_states = Array(nextLevel.bulbs_count).fill(0);

        if (!nextLevel.initial_states.some((state) => state > 0) && nextLevel.connections.length > 0) {
            nextLevel.initial_states = generateInitialState(nextLevel);
        }

        nextLevel.complexity = calculateComplexity(
            nextLevel.buttons_count,
            nextLevel.bulbs_count,
            nextLevel.connections.length
        );

        this.state.editor.level = normalizeLevel(nextLevel, { block: UI_TEXT.userBlockId });

        if (
            this.state.editor.selectedButtonIndex !== null &&
            this.state.editor.selectedButtonIndex >= this.state.editor.level.buttons_count
        ) {
            this.state.editor.selectedButtonIndex = null;
        }

        this.render();
    }

    randomizeEditorConnections() {
        if (!this.state.editor) {
            return;
        }

        const level = this.state.editor.level;
        level.connections = generateConnections(level.buttons_count, level.bulbs_count);
        level.initial_states = generateInitialState(level);
        level.complexity = calculateComplexity(level.buttons_count, level.bulbs_count, level.connections.length);
        this.state.editor.validationErrors = [];
        this.render();
    }

    regenerateEditorInitialState() {
        if (!this.state.editor) {
            return;
        }

        const level = this.state.editor.level;
        level.initial_states = generateInitialState(level);
        this.state.editor.validationErrors = [];
        this.render();
    }

    selectEditorButton(buttonIndex) {
        if (!this.state.editor) {
            return;
        }

        this.state.editor.selectedButtonIndex =
            this.state.editor.selectedButtonIndex === buttonIndex ? null : buttonIndex;
        this.render();
    }

    toggleEditorConnection(buttonIndex, bulbIndex) {
        if (!this.state.editor) {
            return;
        }

        const level = this.state.editor.level;
        const key = `${buttonIndex}:${bulbIndex}`;
        const existing = new Set(level.connections.map(([left, right]) => `${left}:${right}`));

        if (existing.has(key)) {
            existing.delete(key);
        } else {
            existing.add(key);
        }

        level.connections = Array.from(existing, (pair) => pair.split(':').map((value) => Number(value)));
        level.connections = normalizeConnections(level.connections, level.buttons_count, level.bulbs_count);
        level.complexity = calculateComplexity(level.buttons_count, level.bulbs_count, level.connections.length);
        this.state.editor.validationErrors = [];
        this.render();
    }

    cycleEditorBulbState(bulbIndex) {
        if (!this.state.editor) {
            return;
        }

        const level = this.state.editor.level;
        const modulo = level.colors_count;
        level.initial_states[bulbIndex] = (level.initial_states[bulbIndex] + 1) % modulo;
        this.state.editor.validationErrors = [];
        this.render();
    }

    saveEditorLevel({ playAfterSave = false } = {}) {
        if (!this.state.editor) {
            return;
        }

        const level = normalizeLevel(
            {
                ...this.state.editor.level,
                block: UI_TEXT.userBlockId,
                target_states: Array(this.state.editor.level.bulbs_count).fill(0),
                complexity: calculateComplexity(
                    this.state.editor.level.buttons_count,
                    this.state.editor.level.bulbs_count,
                    this.state.editor.level.connections.length
                )
            },
            {
                block: UI_TEXT.userBlockId
            }
        );

        const validation = validateLevel(level);
        if (!validation.valid) {
            this.state.editor.validationErrors = validation.errors;
            this.audio.play('error');
            this.render();
            return;
        }

        const savedLevel = this.levelRepository.saveUserLevel(level);
        this.state.editor = this.createEditorState(savedLevel, 'edit');

        if (playAfterSave) {
            this.startGame(this.levelRepository.getUserLevelRef(savedLevel.id));
            return;
        }

        this.audio.play('button');
        this.setNotice('success', `Уровень «${savedLevel.name}» сохранён.`);
        this.render();
    }

    deleteEditorLevel() {
        if (!this.state.editor?.level.id) {
            return;
        }

        const deleted = this.levelRepository.deleteUserLevel(this.state.editor.level.id);
        if (!deleted) {
            this.setNotice('error', 'Не удалось удалить уровень.');
            this.render();
            return;
        }

        this.audio.play('button');
        this.setNotice('success', 'Пользовательский уровень удалён.');
        this.openLevelSelect(UI_TEXT.userBlockId);
    }

    handleClick(event) {
        const target = event.target.closest('[data-action]');
        if (!target) {
            return;
        }

        const { action } = target.dataset;

        switch (action) {
            case 'nav-home':
                this.openHome();
                break;
            case 'nav-levels':
                this.openLevelSelect(this.state.activeBlockId);
                break;
            case 'nav-editor':
                this.openEditor();
                break;
            case 'nav-help':
                this.openHelp();
                break;
            case 'toggle-sound':
                this.toggleSound();
                break;
            case 'continue-last':
                this.startLastLevel();
                break;
            case 'play-first':
                this.startFirstLevel();
                break;
            case 'select-block':
                this.state.activeBlockId = target.dataset.blockId;
                this.render();
                break;
            case 'open-builtin-level':
                this.startGame(
                    this.levelRepository.getBuiltInLevelRef(
                        target.dataset.blockId,
                        Number(target.dataset.levelIndex)
                    )
                );
                break;
            case 'open-user-level':
                this.startGame(this.levelRepository.getUserLevelRef(target.dataset.levelId));
                break;
            case 'game-button':
                this.pressGameButton(Number(target.dataset.buttonIndex));
                break;
            case 'game-hint':
                this.enableHintMode();
                break;
            case 'game-restart':
                this.restartGame();
                break;
            case 'victory-next':
                this.handleVictoryNext();
                break;
            case 'editor-step':
                this.updateEditorCount(target.dataset.field, Number(target.dataset.delta));
                break;
            case 'editor-randomize':
                this.randomizeEditorConnections();
                break;
            case 'editor-generate-state':
                this.regenerateEditorInitialState();
                break;
            case 'editor-save':
                this.saveEditorLevel();
                break;
            case 'editor-play':
                this.saveEditorLevel({ playAfterSave: true });
                break;
            case 'editor-delete':
                this.deleteEditorLevel();
                break;
            case 'editor-open-existing':
                this.openEditor(target.dataset.levelId);
                break;
            case 'editor-button-select':
                this.selectEditorButton(Number(target.dataset.buttonIndex));
                break;
            case 'editor-bulb-toggle':
                if (this.state.editor?.selectedButtonIndex !== null) {
                    this.toggleEditorConnection(this.state.editor.selectedButtonIndex, Number(target.dataset.bulbIndex));
                }
                break;
            case 'editor-connection-toggle':
                this.toggleEditorConnection(
                    Number(target.dataset.buttonIndex),
                    Number(target.dataset.bulbIndex)
                );
                break;
            case 'editor-cycle-bulb':
                this.cycleEditorBulbState(Number(target.dataset.bulbIndex));
                break;
            case 'dismiss-notice':
                this.clearNotice();
                this.render();
                break;
            default:
                break;
        }
    }

    handleInput(event) {
        const { action } = event.target.dataset;
        if (action === 'editor-name') {
            this.updateEditorName(event.target.value);
        }
    }

    handleChange(event) {
        const { action } = event.target.dataset;
        if (action === 'toggle-sound-checkbox') {
            this.toggleSound();
        }
    }

    handleResize() {
        window.requestAnimationFrame(() => this.drawOverlays());
    }

    handleKeydown(event) {
        if (this.state.screen !== 'game' || !this.state.game || this.state.game.victory) {
            return;
        }

        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }

        if (event.key.toLowerCase() === 'h') {
            event.preventDefault();
            this.enableHintMode();
            return;
        }

        if (event.key.toLowerCase() === 'r') {
            event.preventDefault();
            this.restartGame();
            return;
        }

        const numeric = Number(event.key);
        if (Number.isInteger(numeric) && numeric >= 1 && numeric <= this.state.game.level.buttons_count) {
            event.preventDefault();
            this.pressGameButton(numeric - 1);
        }
    }

    startLastLevel() {
        const lastLevelRef = this.storage.getLastLevelRef();
        if (lastLevelRef && this.levelRepository.hasLevel(lastLevelRef)) {
            this.startGame(lastLevelRef);
            return;
        }

        this.startFirstLevel();
    }

    startFirstLevel() {
        const fallback = this.levelRepository.getDefaultLevelRef();
        if (fallback) {
            this.startGame(fallback);
        }
    }

    handleVictoryNext() {
        const victory = this.state.game?.victory;
        if (!victory) {
            return;
        }

        if (victory.nextLevelRef) {
            this.startGame(victory.nextLevelRef);
            return;
        }

        this.openLevelSelect(this.state.activeBlockId);
    }

    render() {
        this.root.innerHTML = this.renderApp();
        window.requestAnimationFrame(() => this.drawOverlays());
    }

    renderApp() {
        const content = this.renderScreen();

        return `
            <div class="app-shell">
                <div class="ambient ambient-a"></div>
                <div class="ambient ambient-b"></div>
                <header class="app-header">
                    <button class="brand" data-action="nav-home">
                        <span class="brand-mark">●</span>
                        <span>
                            <strong>${APP_TITLE}</strong>
                            <small>Головоломка про скрытые связи</small>
                        </span>
                    </button>
                    <nav class="app-nav">
                        ${this.renderNavButton('Главная', 'nav-home', this.state.screen === 'home')}
                        ${this.renderNavButton('Уровни', 'nav-levels', this.state.screen === 'levels')}
                        ${this.renderNavButton('Редактор', 'nav-editor', this.state.screen === 'editor')}
                        ${this.renderNavButton('Справка', 'nav-help', this.state.screen === 'help')}
                    </nav>
                    <button class="sound-toggle" data-action="toggle-sound">
                        Звук: ${this.storage.getSettings().soundEnabled ? 'вкл' : 'выкл'}
                    </button>
                </header>
                ${this.renderNotice()}
                <main class="app-main">
                    ${content}
                </main>
            </div>
        `;
    }

    renderNavButton(label, action, active) {
        return `
            <button class="nav-chip ${active ? 'is-active' : ''}" data-action="${action}">
                ${label}
            </button>
        `;
    }

    renderNotice() {
        if (!this.state.notice) {
            return '';
        }

        return `
            <section class="notice notice-${this.state.notice.type}">
                <div>
                    ${this.state.notice.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
                </div>
                <button class="ghost-button" data-action="dismiss-notice">Закрыть</button>
            </section>
        `;
    }

    renderScreen() {
        switch (this.state.screen) {
            case 'loading':
                return this.renderLoading();
            case 'error':
                return this.renderError();
            case 'home':
                return this.renderHome();
            case 'levels':
                return this.renderLevels();
            case 'game':
                return this.renderGame();
            case 'editor':
                return this.renderEditor();
            case 'help':
                return this.renderHelp();
            default:
                return this.renderHome();
        }
    }

    renderLoading() {
        return `
            <section class="panel hero-panel">
                <p class="eyebrow">Загрузка</p>
                <h1>Собираю каталог уровней и интерфейс.</h1>
            </section>
        `;
    }

    renderError() {
        return `
            <section class="panel hero-panel">
                <p class="eyebrow">Ошибка запуска</p>
                <h1>Не удалось загрузить проект.</h1>
                <p class="lead">
                    ${escapeHtml(this.state.error?.message ?? 'Проверьте, что игра открыта через локальный сервер или GitHub Pages.')}
                </p>
                <button class="primary-button" data-action="nav-home">Попробовать снова</button>
            </section>
        `;
    }

    renderHome() {
        const lastLevelRef = this.storage.getLastLevelRef();
        const lastLevel = lastLevelRef ? this.levelRepository.getLevel(lastLevelRef) : null;
        const builtInBlocks = this.levelRepository.getBuiltInBlocks();
        const builtInLevelCount = builtInBlocks.reduce((sum, block) => sum + block.levels.length, 0);
        const completedCount = builtInBlocks
            .flatMap((block) => block.levels.map((_, levelIndex) => this.levelRepository.getBuiltInLevelRef(block.id, levelIndex)))
            .filter((levelRef) => this.storage.isLevelCompleted(levelRef)).length;
        const lastLevelSummary = lastLevel
            ? `${this.describeLevelRef(lastLevelRef)} · ${lastLevel.name}`
            : 'Одна подсказка на уровень. Играть можно и мышью, и клавиатурой.';

        return `
            <section class="hero hero-home">
                <div class="hero-copy">
                    <p class="eyebrow">Bulb Switcher</p>
                    <div class="hero-chip-row">
                        <span class="signal-pill">Puzzle console</span>
                        <span class="signal-pill">${builtInLevelCount} уровней</span>
                        <span class="signal-pill">Редактор внутри</span>
                    </div>
                    <h1>Считывайте схему. Находите скрытые связи. Гасите весь щит.</h1>
                    <p class="lead">
                        Каждое нажатие меняет сразу несколько ламп. Красота этой игры в том, что решение
                        выглядит как восстановление скрытой проводки по косвенным сигналам.
                    </p>
                    <div class="hero-actions">
                        <button class="primary-button" data-action="continue-last">
                            ${lastLevel ? 'Продолжить' : 'Начать с первого уровня'}
                        </button>
                        <button class="secondary-button" data-action="nav-levels">Открыть каталог</button>
                    </div>
                    <p class="hero-note">${escapeHtml(lastLevelSummary)}</p>
                    <div class="hero-stats">
                        ${this.renderStatCard('Встроенных уровней', String(builtInLevelCount))}
                        ${this.renderStatCard('Пройдено', `${completedCount}/${builtInLevelCount}`)}
                        ${this.renderStatCard('Пользовательских', String(this.levelRepository.listUserLevels().length))}
                    </div>
                </div>
                <div class="hero-visual hero-board">
                    <div class="hero-board-shell">
                        <div class="hero-board-topline">
                            <span class="board-kicker">Signal map</span>
                            <span class="board-score">${completedCount}/${builtInLevelCount}</span>
                        </div>
                        <div class="hero-wire-layer" aria-hidden="true">
                            <span class="hero-wire wire-1"></span>
                            <span class="hero-wire wire-2"></span>
                            <span class="hero-wire wire-3"></span>
                            <span class="hero-wire wire-4"></span>
                            <span class="hero-wire wire-5"></span>
                        </div>
                        <div class="hero-bulb-rack">
                            ${BULB_ASSETS.map((src, index) => `
                                <div class="hero-bulb-cell bulb-${index}">
                                    <img
                                        class="hero-bulb"
                                        src="${src}"
                                        alt="${BULB_LABELS[index]}"
                                    />
                                    <span>${BULB_LABELS[index]}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="hero-button-rack">
                            <button class="hero-mini-button" type="button">1</button>
                            <button class="hero-mini-button" type="button">2</button>
                            <button class="hero-mini-button" type="button">3</button>
                        </div>
                        <div class="hero-board-footer">
                            <span>1 hint per run</span>
                            <span>4 bulb states</span>
                            <span>local editor</span>
                        </div>
                    </div>
                </div>
            </section>

            <section class="card-grid feature-grid">
                <article class="panel feature-card">
                    <p class="eyebrow">Продолжение</p>
                    <h2>${lastLevel ? escapeHtml(lastLevel.name) : 'Первый встроенный уровень'}</h2>
                    <p>${lastLevel ? this.describeLevelRef(lastLevelRef) : 'Стартовый уровень каталога.'}</p>
                    <button class="secondary-button" data-action="continue-last">
                        ${lastLevel ? 'Вернуться в игру' : 'Играть'}
                    </button>
                </article>
                <article class="panel feature-card">
                    <p class="eyebrow">Каталог</p>
                    <h2>Все блоки и рекорды</h2>
                    <p>Все встроенные блоки на виду. Видно, что закрыто, что новое и где ваш лучший прогон.</p>
                    <button class="secondary-button" data-action="nav-levels">Открыть уровни</button>
                </article>
                <article class="panel feature-card">
                    <p class="eyebrow">Редактор</p>
                    <h2>Соберите свой щит</h2>
                    <p>Меняйте число кнопок, ламп и состояний, собирайте проводку и тут же проверяйте, как она играется.</p>
                    <button class="secondary-button" data-action="nav-editor">Открыть редактор</button>
                </article>
            </section>
        `;
    }

    renderLevels() {
        const block = this.levelRepository.getBlock(this.state.activeBlockId) ?? this.levelRepository.getBuiltInBlocks()[0];
        const completedInBlock = block.levels
            .map((level, index) => {
                if (block.source === 'user') {
                    return this.storage.isLevelCompleted(this.levelRepository.getUserLevelRef(level.id));
                }

                return this.storage.isLevelCompleted(this.levelRepository.getBuiltInLevelRef(block.id, index));
            })
            .filter(Boolean).length;
        const levelCards = block.levels.length
            ? block.levels.map((level, index) => this.renderLevelCard(block, level, index)).join('')
            : `
                <article class="panel empty-state">
                    <h3>Пока пусто</h3>
                    <p>Сохраните свой первый пользовательский уровень, и он появится здесь.</p>
                    <button class="secondary-button" data-action="nav-editor">Создать уровень</button>
                </article>
            `;

        return `
            <section class="panel section-header">
                <div>
                    <p class="eyebrow">Выбор уровня</p>
                    <h1>${escapeHtml(block.title)}</h1>
                    <p class="lead">${escapeHtml(block.description)}</p>
                    <div class="block-summary-strip">
                        <span class="signal-pill">${block.levels.length} уровней</span>
                        <span class="signal-pill">${completedInBlock} пройдено</span>
                        <span class="signal-pill">${block.source === 'user' ? 'Local storage' : 'Built-in block'}</span>
                    </div>
                </div>
                <div class="tab-row">
                    ${this.levelRepository.getAllBlocks().map((item) => `
                        <button
                            class="tab-chip ${item.id === block.id ? 'is-active' : ''}"
                            data-action="select-block"
                            data-block-id="${item.id}"
                        >
                            ${escapeHtml(item.title)}
                        </button>
                    `).join('')}
                </div>
            </section>
            <section class="level-grid">
                ${levelCards}
            </section>
        `;
    }

    renderLevelCard(block, level, index) {
        const levelRef = block.source === 'user'
            ? this.levelRepository.getUserLevelRef(level.id)
            : this.levelRepository.getBuiltInLevelRef(block.id, index);
        const result = this.storage.getLevelResult(levelRef);
        const completed = this.storage.isLevelCompleted(levelRef);
        const isLastPlayed = serializeRef(this.storage.getLastLevelRef()) === serializeRef(levelRef);
        const action = block.source === 'user' ? 'open-user-level' : 'open-builtin-level';
        const targetAttrs = block.source === 'user'
            ? `data-level-id="${level.id}"`
            : `data-block-id="${block.id}" data-level-index="${index}"`;

        return `
            <article class="panel level-card ${completed ? 'is-completed' : ''}">
                <div class="level-card-head">
                    <p class="eyebrow">${block.source === 'user' ? 'Мой уровень' : `Уровень ${index + 1}`}</p>
                    ${completed ? '<span class="level-badge">Пройден</span>' : '<span class="level-badge muted">Новый</span>'}
                </div>
                <h3>${escapeHtml(level.name)}</h3>
                <div class="level-card-number">${block.source === 'user' ? 'U' : index + 1}</div>
                <div class="meta-list">
                    <span>${level.buttons_count} ${pluralize(level.buttons_count, 'кнопка', 'кнопки', 'кнопок')}</span>
                    <span>${level.bulbs_count} ${pluralize(level.bulbs_count, 'лампа', 'лампы', 'ламп')}</span>
                    <span>${level.colors_count} ${pluralize(level.colors_count, 'состояние', 'состояния', 'состояний')}</span>
                    <span>Сложность ${level.complexity.toFixed(2)}</span>
                </div>
                <div class="record-strip">
                    <span>Рекорд: ${result ? formatTime(result.time) : '—'}</span>
                    <span>Ходы: ${result ? result.moves : '—'}</span>
                </div>
                <div class="level-card-actions">
                    <button class="primary-button" data-action="${action}" ${targetAttrs}>Играть</button>
                    ${block.source === 'user' ? `
                        <button class="ghost-button" data-action="editor-open-existing" data-level-id="${level.id}">
                            Править
                        </button>
                    ` : ''}
                </div>
                ${isLastPlayed ? '<p class="subtle">Последний открытый уровень</p>' : ''}
            </article>
        `;
    }

    renderGame() {
        const session = this.state.game;
        if (!session) {
            return '';
        }

        const block = session.levelRef.type === 'builtin'
            ? this.levelRepository.getBlock(session.levelRef.blockId)
            : this.levelRepository.getUserBlock();
        const result = this.storage.getLevelResult(session.levelRef);
        const hintBulbs = new Set(session.hintPairs.map(([, bulbIndex]) => bulbIndex));

        return `
            <section class="panel section-header">
                <div>
                    <p class="eyebrow">${escapeHtml(block?.title ?? 'Уровень')}</p>
                    <h1>${escapeHtml(session.level.name)}</h1>
                    <p class="lead">${this.describeLevel(session.level)}</p>
                </div>
                <div class="stat-row compact">
                        ${this.renderStatCard('Ходы', String(session.moves), 'data-runtime="moves"')}
                        ${this.renderStatCard('Время', formatTime(session.elapsedSeconds), 'data-runtime="time"')}
                        ${this.renderStatCard('Рекорд', result ? `${formatTime(result.time)} / ${result.moves}` : '—')}
                </div>
            </section>

            <section class="game-layout">
                <article class="panel board-panel">
                    <div class="board-toolbar">
                        <div>
                            <h2>Игровое поле</h2>
                            <p class="subtle">
                                ${session.hintSelectionMode
                                    ? 'Подсказка активна: выберите кнопку, чьи связи нужно показать.'
                                    : 'Нажмите на кнопку или используйте клавиши 1-8.'}
                            </p>
                        </div>
                        <div class="toolbar-actions">
                            <button
                                class="secondary-button"
                                data-action="game-hint"
                                ${session.hintUsed ? 'disabled' : ''}
                            >
                                ${session.hintUsed ? 'Подсказка использована' : 'Подсказка'}
                            </button>
                            <button class="ghost-button" data-action="game-restart">Рестарт</button>
                        </div>
                    </div>
                    <div class="board-status-strip">
                        <span class="signal-pill">Цель: погасить всё поле</span>
                        <span class="signal-pill">H: подсказка</span>
                        <span class="signal-pill">R: рестарт</span>
                    </div>
                    <div class="puzzle-stage" id="game-stage">
                        <svg class="connection-overlay" id="game-overlay" aria-hidden="true"></svg>
                        <div class="stage-title stage-title-top">Лампочки</div>
                        <div class="bulb-row">
                            ${Array.from({ length: session.level.bulbs_count }, (_, bulbIndex) => `
                                <div
                                    class="bulb-node ${hintBulbs.has(bulbIndex) ? 'is-highlighted' : ''}"
                                    data-role="bulb"
                                    data-index="${bulbIndex}"
                                >
                                    <img src="${BULB_ASSETS[session.currentStates[bulbIndex]]}" alt="${BULB_LABELS[session.currentStates[bulbIndex]]}" />
                                    <span>Лампа ${bulbIndex + 1}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="stage-title stage-title-bottom">Переключатели</div>
                        <div class="button-row">
                            ${Array.from({ length: session.level.buttons_count }, (_, buttonIndex) => `
                                <button
                                    class="puzzle-button ${session.hintedButtonIndex === buttonIndex ? 'is-selected' : ''}"
                                    data-action="game-button"
                                    data-role="button"
                                    data-button-index="${buttonIndex}"
                                    data-index="${buttonIndex}"
                                >
                                    <img src="assets/images/button.png" alt="" />
                                    <span>${buttonIndex + 1}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    ${session.victory ? this.renderVictoryOverlay(session) : ''}
                </article>
                <aside class="panel side-panel mission-panel">
                    <div class="mission-card">
                        <p class="eyebrow">Задача</p>
                        <h2>Погасить весь щит</h2>
                        <p>Сведите все лампочки к состоянию <strong>выключено</strong>. Лишние клики тут почти всегда мстят.</p>
                    </div>
                    <div class="legend-list">
                        ${BULB_ASSETS.slice(0, session.level.colors_count).map((src, index) => `
                            <div class="legend-item">
                                <img src="${src}" alt="${BULB_LABELS[index]}" />
                                <span>${BULB_LABELS[index]}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="keyboard-card">
                        <p class="eyebrow">Навигация</p>
                        <p><strong>1-8</strong> нажимают кнопки, <strong>H</strong> активирует подсказку, <strong>R</strong> перезапускает уровень.</p>
                    </div>
                    <div class="side-actions">
                        <button class="secondary-button" data-action="nav-levels">К выбору уровней</button>
                        <button class="ghost-button" data-action="nav-home">В меню</button>
                    </div>
                </aside>
            </section>
        `;
    }

    renderVictoryOverlay(session) {
        const victory = session.victory;

        return `
            <div class="victory-overlay">
                <div class="victory-card">
                    <p class="eyebrow">Уровень пройден</p>
                    <h2>${victory.newRecord ? 'Новый лучший результат!' : 'Схема погашена'}</h2>

                    <div class="victory-stars">
                        ${[1, 2, 3].map(i =>
                            `<span class="victory-star ${i <= victory.stars ? 'is-earned' : 'is-empty'}">★</span>`
                        ).join('')}
                    </div>

                    <div class="victory-stats">
                        ${this.renderStatCard('Ходы', String(victory.moves))}
                        ${this.renderStatCard('Время', formatTime(victory.totalSeconds))}
                    </div>

                    <div class="victory-xp">
                        <span class="victory-xp-amount">+${victory.xpEarned} XP</span>
                        ${victory.previousRank < victory.rankProgress.rank
                            ? `<div class="victory-rankup">Новый ранг: ${victory.rankProgress.title}!</div>`
                            : ''
                        }
                    </div>

                    <div class="victory-rank-bar">
                        <div class="victory-rank-label">
                            <span>${victory.rankProgress.title}</span>
                            <span>Ур. ${victory.rankProgress.rank}</span>
                        </div>
                        <div class="victory-rank-track">
                            <div class="victory-rank-fill" style="width: ${Math.round(victory.rankProgress.fraction * 100)}%"></div>
                        </div>
                    </div>

                    ${victory.newRecord ? '<div class="victory-record">🏆 Новый рекорд!</div>' : ''}

                    <div class="hero-actions">
                        <button class="primary-button" data-action="victory-next">
                            ${victory.nextLevelRef ? 'Следующий уровень' : 'К выбору уровней'}
                        </button>
                        <button class="secondary-button" data-action="game-restart">Сыграть ещё раз</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderEditor() {
        const editor = this.state.editor;
        if (!editor) {
            return '';
        }

        const level = editor.level;
        const selectedButtonIndex = editor.selectedButtonIndex;

        return `
            <section class="panel section-header">
                <div>
                    <p class="eyebrow">Редактор уровней</p>
                    <h1>${editor.mode === 'edit' ? 'Редактирование' : 'Новый уровень'}</h1>
                    <p class="lead">
                        Меняйте параметры, связи и стартовое состояние. Сохранение работает через localStorage.
                    </p>
                </div>
                <div class="stat-row compact">
                        ${this.renderStatCard('Кнопки', String(level.buttons_count))}
                        ${this.renderStatCard('Лампы', String(level.bulbs_count))}
                        ${this.renderStatCard('Сложность', level.complexity.toFixed(2))}
                </div>
            </section>

            <section class="editor-layout">
                <article class="panel editor-settings">
                    <label class="field">
                        <span>Название уровня</span>
                        <input
                            type="text"
                            value="${escapeHtml(level.name)}"
                            data-action="editor-name"
                            placeholder="Введите название"
                        />
                    </label>
                    <div class="stepper-grid">
                        ${this.renderStepper('Кнопки', 'buttons_count', level.buttons_count)}
                        ${this.renderStepper('Лампочки', 'bulbs_count', level.bulbs_count)}
                        ${this.renderStepper('Состояния', 'colors_count', level.colors_count)}
                    </div>
                    <div class="stack-actions">
                        <button class="secondary-button" data-action="editor-randomize">Новые связи</button>
                        <button class="secondary-button" data-action="editor-generate-state">Новое стартовое состояние</button>
                        <button class="primary-button" data-action="editor-save">Сохранить</button>
                        <button class="secondary-button" data-action="editor-play">Сохранить и играть</button>
                        ${editor.mode === 'edit'
                            ? '<button class="ghost-button danger" data-action="editor-delete">Удалить уровень</button>'
                            : ''}
                    </div>
                    ${editor.validationErrors.length ? `
                        <div class="validation-box">
                            <h3>Нужно исправить</h3>
                            <ul>
                                ${editor.validationErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : `
                        <div class="validation-box is-neutral">
                            <h3>Как редактировать</h3>
                            <p>1. Выберите кнопку внизу схемы.</p>
                            <p>2. Нажмите на лампочку, чтобы включить или убрать связь.</p>
                            <p>3. Лампочки в стартовом состоянии переключаются по клику.</p>
                        </div>
                    `}
                </article>

                <article class="panel board-panel">
                    <div class="board-toolbar">
                        <div>
                            <h2>Схема уровня</h2>
                            <p class="subtle">
                                ${selectedButtonIndex === null
                                    ? 'Выберите кнопку, чтобы редактировать её связи.'
                                    : `Выбрана кнопка ${selectedButtonIndex + 1}. Теперь нажимайте на лампочки.`}
                            </p>
                        </div>
                    </div>
                    <div class="board-status-strip">
                        <span class="signal-pill">1. Выбери кнопку</span>
                        <span class="signal-pill">2. Проложи связи</span>
                        <span class="signal-pill">3. Проверь старт</span>
                    </div>
                    <div class="puzzle-stage editor-stage" id="editor-stage">
                        <svg class="connection-overlay" id="editor-overlay" aria-hidden="true"></svg>
                        <div class="stage-title stage-title-top">Лампы уровня</div>
                        <div class="bulb-row">
                            ${Array.from({ length: level.bulbs_count }, (_, bulbIndex) => `
                                <button
                                    class="bulb-node interactive"
                                    data-action="editor-bulb-toggle"
                                    data-role="bulb"
                                    data-index="${bulbIndex}"
                                    data-bulb-index="${bulbIndex}"
                                >
                                    <img
                                        src="${BULB_ASSETS[level.initial_states[bulbIndex]]}"
                                        alt="${BULB_LABELS[level.initial_states[bulbIndex]]}"
                                    />
                                    <span>Лампа ${bulbIndex + 1}</span>
                                </button>
                            `).join('')}
                        </div>
                        <div class="stage-title stage-title-bottom">Кнопки уровня</div>
                        <div class="button-row">
                            ${Array.from({ length: level.buttons_count }, (_, buttonIndex) => `
                                <button
                                    class="puzzle-button ${selectedButtonIndex === buttonIndex ? 'is-selected' : ''}"
                                    data-action="editor-button-select"
                                    data-role="button"
                                    data-button-index="${buttonIndex}"
                                    data-index="${buttonIndex}"
                                >
                                    <img src="assets/images/button.png" alt="" />
                                    <span>${buttonIndex + 1}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="editor-subgrid">
                        <section class="matrix-card">
                            <h3>Матрица связей</h3>
                            <div class="connection-matrix">
                                <div
                                    class="matrix-row matrix-head"
                                    style="grid-template-columns: 48px repeat(${level.bulbs_count}, minmax(0, 1fr));"
                                >
                                    <span></span>
                                    ${Array.from({ length: level.bulbs_count }, (_, bulbIndex) => `<span>L${bulbIndex + 1}</span>`).join('')}
                                </div>
                                ${Array.from({ length: level.buttons_count }, (_, buttonIndex) => `
                                    <div
                                        class="matrix-row"
                                        style="grid-template-columns: 48px repeat(${level.bulbs_count}, minmax(0, 1fr));"
                                    >
                                        <span>B${buttonIndex + 1}</span>
                                        ${Array.from({ length: level.bulbs_count }, (_, bulbIndex) => {
                                            const isConnected = level.connections.some(
                                                ([left, right]) => left === buttonIndex && right === bulbIndex
                                            );

                                            return `
                                                <button
                                                    class="matrix-cell ${isConnected ? 'is-linked' : ''}"
                                                    data-action="editor-connection-toggle"
                                                    data-button-index="${buttonIndex}"
                                                    data-bulb-index="${bulbIndex}"
                                                >
                                                    ${isConnected ? '●' : '○'}
                                                </button>
                                            `;
                                        }).join('')}
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                        <section class="matrix-card">
                            <h3>Стартовое состояние</h3>
                            <p class="subtle">Нажмите на лампочку, чтобы переключить её стартовое состояние.</p>
                            <div class="start-state-grid">
                                ${Array.from({ length: level.bulbs_count }, (_, bulbIndex) => `
                                    <button
                                        class="start-state-tile"
                                        data-action="editor-cycle-bulb"
                                        data-bulb-index="${bulbIndex}"
                                    >
                                        <img
                                            src="${BULB_ASSETS[level.initial_states[bulbIndex]]}"
                                            alt="${BULB_LABELS[level.initial_states[bulbIndex]]}"
                                        />
                                        <span>Лампа ${bulbIndex + 1}</span>
                                        <small>${BULB_LABELS[level.initial_states[bulbIndex]]}</small>
                                    </button>
                                `).join('')}
                            </div>
                        </section>
                    </div>
                </article>
            </section>
        `;
    }

    renderStepper(label, field, value) {
        return `
            <div class="stepper-card">
                <span>${label}</span>
                <div class="stepper">
                    <button data-action="editor-step" data-field="${field}" data-delta="-1">−</button>
                    <strong>${value}</strong>
                    <button data-action="editor-step" data-field="${field}" data-delta="1">+</button>
                </div>
            </div>
        `;
    }

    renderHelp() {
        return `
            <section class="panel section-header">
                <div>
                    <p class="eyebrow">Справка</p>
                    <h1>Как играть</h1>
                    <p class="lead">Коротко: кнопки меняют связанные лампы, а ваша цель — погасить всю схему.</p>
                </div>
            </section>

            <section class="help-grid">
                <article class="panel feature-card">
                    <h2>Правила</h2>
                    <ol class="help-list">
                        <li>Каждая кнопка меняет только связанные с ней лампочки.</li>
                        <li>Состояния идут по кругу: выкл, зелёный, жёлтый, красный и снова выкл.</li>
                        <li>Победа наступает только когда все лампочки выключены.</li>
                    </ol>
                </article>
                <article class="panel feature-card">
                    <h2>Подсказка</h2>
                    <ol class="help-list">
                        <li>Нажмите кнопку «Подсказка».</li>
                        <li>Выберите нужную игровую кнопку.</li>
                        <li>На 3 секунды увидите её реальные связи.</li>
                    </ol>
                </article>
                <article class="panel feature-card">
                    <h2>Редактор</h2>
                    <ol class="help-list">
                        <li>Настройте число кнопок, ламп и состояний.</li>
                        <li>Соберите связи и стартовое состояние.</li>
                        <li>Сохраните уровень и сразу запускайте его в игру.</li>
                    </ol>
                </article>
            </section>
        `;
    }

    renderStatCard(label, value, valueAttributes = '') {
        return `
            <div class="stat-card">
                <span>${escapeHtml(label)}</span>
                <strong ${valueAttributes}>${escapeHtml(value)}</strong>
            </div>
        `;
    }

    describeLevel(level) {
        return `${level.buttons_count} ${pluralize(level.buttons_count, 'кнопка', 'кнопки', 'кнопок')}, ${level.bulbs_count} ${pluralize(level.bulbs_count, 'лампа', 'лампы', 'ламп')}, ${level.colors_count} ${pluralize(level.colors_count, 'состояние', 'состояния', 'состояний')}.`;
    }

    describeLevelRef(levelRef) {
        if (!levelRef) {
            return 'Старт каталога.';
        }

        if (levelRef.type === 'user') {
            return 'Пользовательский уровень.';
        }

        const block = this.levelRepository.getBlock(levelRef.blockId);
        return `${block?.title ?? 'Блок'} · уровень ${levelRef.levelIndex + 1}`;
    }

    drawOverlays() {
        if (this.state.screen === 'game' && this.state.game?.hintPairs.length) {
            this.drawConnectionOverlay('game-stage', 'game-overlay', this.state.game.hintPairs);
        }

        if (this.state.screen === 'editor' && this.state.editor) {
            this.drawConnectionOverlay('editor-stage', 'editor-overlay', this.state.editor.level.connections);
        }
    }

    drawConnectionOverlay(stageId, overlayId, pairs) {
        const stage = document.getElementById(stageId);
        const overlay = document.getElementById(overlayId);

        if (!stage || !overlay) {
            return;
        }

        const stageRect = stage.getBoundingClientRect();
        overlay.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);

        const lines = pairs.map(([buttonIndex, bulbIndex]) => {
            const buttonNode = stage.querySelector('[data-role="button"][data-index="' + buttonIndex + '"]');
            const bulbNode = stage.querySelector('[data-role="bulb"][data-index="' + bulbIndex + '"]');

            if (!buttonNode || !bulbNode) {
                return '';
            }

            const buttonRect = buttonNode.getBoundingClientRect();
            const bulbRect = bulbNode.getBoundingClientRect();

            const x1 = buttonRect.left + buttonRect.width / 2 - stageRect.left;
            const y1 = buttonRect.top + buttonRect.height / 2 - stageRect.top;
            const x2 = bulbRect.left + bulbRect.width / 2 - stageRect.left;
            const y2 = bulbRect.top + bulbRect.height / 2 - stageRect.top;

            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
        }).join('');

        overlay.innerHTML = lines;
    }
}

function normalizeBulbStates(states, bulbsCount, colorsCount) {
    const normalized = [];

    for (let index = 0; index < bulbsCount; index += 1) {
        normalized.push(clamp(Number(states[index] ?? 0), 0, Math.max(0, colorsCount - 1)));
    }

    return normalized;
}

function serializeRef(levelRef) {
    if (!levelRef) {
        return '';
    }

    if (levelRef.type === 'user') {
        return `user:${levelRef.id}`;
    }

    return `builtin:${levelRef.blockId}:${levelRef.levelIndex}`;
}
