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
        const optimalMoves = getOptimalMoveCount(this.state.game.level);
        this.state.game.optimalMoves = optimalMoves;
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
        const builtInBlocks = this.levelRepository.getBuiltInBlocks();
        const builtInLevelCount = builtInBlocks.reduce((sum, block) => sum + block.levels.length, 0);
        const completedCount = builtInBlocks
            .flatMap((block) => block.levels.map((_, levelIndex) => this.levelRepository.getBuiltInLevelRef(block.id, levelIndex)))
            .filter((levelRef) => this.storage.isLevelCompleted(levelRef)).length;
        const player = this.storage.loadPlayer();
        const rankProgress = getRankProgress(player.xp);
        const content = this.renderScreen();

        return `
            <div class="app-shell">
                <div class="ambient ambient-a"></div>
                <div class="ambient ambient-b"></div>
                <header class="app-header">
                    <div class="header-block brand-block">
                        <button class="brand" data-action="nav-home">
                            <span class="brand-mark" aria-hidden="true">
                                <span></span>
                                <span></span>
                                <span></span>
                            </span>
                            <span class="brand-copy">
                                <strong>${APP_TITLE}</strong>
                                <small>Switchboard logic console</small>
                            </span>
                        </button>
                        <div class="header-inline-status">
                            <span class="signal-pill muted">${completedCount}/${builtInLevelCount} секций погашено</span>
                        </div>
                    </div>
                    <nav class="app-nav header-block">
                        ${this.renderNavButton('Главная', 'nav-home', this.state.screen === 'home')}
                        ${this.renderNavButton('Архив', 'nav-levels', this.state.screen === 'levels')}
                        ${this.renderNavButton('Лаборатория', 'nav-editor', this.state.screen === 'editor')}
                        ${this.renderNavButton('Справка', 'nav-help', this.state.screen === 'help')}
                    </nav>
                    <div class="header-side">
                        <div class="shell-status header-block">
                            <span class="shell-status-label">Оператор</span>
                            <strong>${escapeHtml(rankProgress.title)}</strong>
                            <small>Ранг ${rankProgress.rank} · ${player.xp} XP</small>
                        </div>
                        <button class="sound-toggle header-block" data-action="toggle-sound">
                            <span>Аудио</span>
                            <strong>${this.storage.getSettings().soundEnabled ? 'ON' : 'OFF'}</strong>
                        </button>
                    </div>
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
        const player = this.storage.loadPlayer();
        const rankProgress = getRankProgress(player.xp);
        const lastLevelSummary = lastLevel
            ? `${this.describeLevelRef(lastLevelRef)} · ${lastLevel.name}`
            : 'Одна подсказка на уровень. Играть можно и мышью, и клавиатурой.';

        return `
            <section class="hero hero-home">
                <div class="panel hero-copy">
                    <p class="eyebrow">Bulb Switcher</p>
                    <div class="hero-chip-row">
                        <span class="signal-pill">Campaign ${builtInLevelCount}</span>
                        <span class="signal-pill">1 подсказка за уровень</span>
                        <span class="signal-pill">Local workshop</span>
                    </div>
                    <h1>Гасите секции щита, читая поле как скрытую схему, а не как шум ламп.</h1>
                    <p class="lead">
                        Здесь ценится не скорость клика, а дисциплина наблюдения. Каждое нажатие меняет
                        несколько узлов сразу, и удачный проход ощущается как расшифровка панели управления
                        по косвенным сигналам.
                    </p>
                    <div class="hero-actions">
                        <button class="primary-button" data-action="continue-last">
                            ${lastLevel ? 'Продолжить' : 'Начать с первого уровня'}
                        </button>
                        <button class="secondary-button" data-action="nav-levels">Открыть архив</button>
                    </div>
                    <p class="hero-note">${escapeHtml(lastLevelSummary)}</p>
                    <div class="hero-stats">
                        ${this.renderStatCard('Погашено', `${completedCount}/${builtInLevelCount}`)}
                        ${this.renderStatCard('Оператор', rankProgress.title)}
                        ${this.renderStatCard('Модулей в лаборатории', String(this.levelRepository.listUserLevels().length))}
                    </div>
                </div>
                <div class="panel hero-visual hero-board">
                    <div class="hero-board-shell">
                        <div class="hero-board-topline">
                            <span class="board-kicker">Live console</span>
                            <span class="board-score">${escapeHtml(rankProgress.title)}</span>
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
                            <div class="console-readout">
                                <span>Подсказка</span>
                                <strong>1 на забег</strong>
                            </div>
                            <div class="console-readout">
                                <span>Состояния ламп</span>
                                <strong>до 4</strong>
                            </div>
                            <div class="console-readout">
                                <span>Архив погашений</span>
                                <strong>${completedCount}/${builtInLevelCount}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="card-grid feature-grid">
                <article class="panel feature-card">
                    <p class="eyebrow">Текущая линия</p>
                    <h2>${lastLevel ? escapeHtml(lastLevel.name) : 'Первый контур кампании'}</h2>
                    <p>${lastLevel ? this.describeLevelRef(lastLevelRef) : 'Самый быстрый способ войти в ритм игры и понять поведение панели.'}</p>
                    <div class="meta-list">
                        <span>${lastLevel ? this.describeLevel(lastLevel) : 'Старт каталога'}</span>
                    </div>
                    <button class="secondary-button" data-action="continue-last">
                        ${lastLevel ? 'Вернуться к панели' : 'Запустить контур'}
                    </button>
                </article>
                <article class="panel feature-card">
                    <p class="eyebrow">Архив</p>
                    <h2>Блоки, рекорды и прогресс кампании</h2>
                    <p>Смотрите, какие секции уже погашены, где остались чистые проходы и на каких уровнях можно снять больше звёзд.</p>
                    <div class="meta-list">
                        <span>${builtInLevelCount} уровней</span>
                        <span>${completedCount} очищено</span>
                    </div>
                    <button class="secondary-button" data-action="nav-levels">Открыть архив</button>
                </article>
                <article class="panel feature-card">
                    <p class="eyebrow">Лаборатория</p>
                    <h2>Соберите собственный модуль</h2>
                    <p>Меняйте число кнопок, ламп и состояний, проектируйте скрытую проводку и сразу же запускайте её в тестовый прогон.</p>
                    <div class="meta-list">
                        <span>${this.levelRepository.listUserLevels().length} сохранено</span>
                        <span>${escapeHtml(rankProgress.title)}</span>
                    </div>
                    <button class="secondary-button" data-action="nav-editor">Открыть лабораторию</button>
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
                    <p class="eyebrow">Mission archive</p>
                    <h1>${escapeHtml(block.title)}</h1>
                    <p class="lead">${escapeHtml(block.description)}</p>
                    <div class="block-summary-strip">
                        <span class="signal-pill">${block.levels.length} уровней</span>
                        <span class="signal-pill">${completedInBlock} пройдено</span>
                        <span class="signal-pill">${block.source === 'user' ? 'Local workshop' : 'Campaign block'}</span>
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
                    <p class="eyebrow">${block.source === 'user' ? 'Workshop module' : `Сектор ${index + 1}`}</p>
                    ${completed ? '<span class="level-badge">Погашен</span>' : '<span class="level-badge muted">Новый</span>'}
                </div>
                <div class="level-card-number">${block.source === 'user' ? 'U' : index + 1}</div>
                <h3>${escapeHtml(level.name)}</h3>
                <p class="subtle">${this.describeLevel(level)}</p>
                <div class="meta-list">
                    <span>Сложность ${level.complexity.toFixed(2)}</span>
                    <span>${level.connections.length} ${pluralize(level.connections.length, 'связь', 'связи', 'связей')}</span>
                    ${result?.stars ? `<span class="level-card-stars">${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}</span>` : '<span>★☆☆</span>'}
                </div>
                <div class="record-strip">
                    <span>Рекорд: ${result ? formatTime(result.time) : '—'}</span>
                    <span>Ходы: ${result ? result.moves : '—'}</span>
                    <span>${completed ? 'Маршрут сохранён' : 'Контур не вскрыт'}</span>
                </div>
                <div class="level-card-actions">
                    <button class="primary-button" data-action="${action}" ${targetAttrs}>Запустить</button>
                    ${block.source === 'user' ? `
                        <button class="ghost-button" data-action="editor-open-existing" data-level-id="${level.id}">
                            Править модуль
                        </button>
                    ` : ''}
                </div>
                ${isLastPlayed ? '<p class="subtle">Последняя активная панель</p>' : ''}
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
        const activeBulbs = session.currentStates.filter((state) => state > 0).length;
        const solvedBulbs = session.level.bulbs_count - activeBulbs;
        const blackoutPercent = Math.round((solvedBulbs / session.level.bulbs_count) * 100);
        const optimalMovesHint = session.optimalMoves
            ? `3★ до ${Math.ceil(session.optimalMoves * STAR_CONFIG.moveMultiplier3Star)} ходов · 2★ до ${Math.ceil(session.optimalMoves * STAR_CONFIG.moveMultiplier2Star)}`
            : 'Порог звёзд будет рассчитан автоматически.';
        const scannerStatus = session.hintSelectionMode
            ? 'Сканер: выберите кнопку'
            : session.hintUsed
                ? 'Сканер: израсходован'
                : 'Сканер: готов';

        return `
            <section class="panel section-header">
                <div>
                    <p class="eyebrow">${escapeHtml(block?.title ?? 'Уровень')}</p>
                    <h1>${escapeHtml(session.level.name)}</h1>
                    <p class="lead">
                        ${this.describeLevel(session.level)} Следите за тем, какие узлы ещё светятся после каждого
                        ввода, и держите маршрут коротким.
                    </p>
                </div>
                <div class="section-side">
                    <div class="stat-row compact">
                        ${this.renderStatCard('Ходы', String(session.moves), 'data-runtime="moves"')}
                        ${this.renderStatCard('Время', formatTime(session.elapsedSeconds), 'data-runtime="time"')}
                        ${this.renderStatCard('Активных ламп', String(activeBulbs))}
                        ${this.renderStatCard('Рекорд', result ? `${formatTime(result.time)} / ${result.moves}` : '—')}
                    </div>
                    <div class="block-summary-strip">
                        <span class="signal-pill">${session.hintUsed ? 'Подсказка израсходована' : 'Подсказка доступна'}</span>
                        <span class="signal-pill">${optimalMovesHint}</span>
                    </div>
                </div>
            </section>

            <section class="game-layout">
                <article class="panel board-panel">
                    <div class="board-toolbar">
                        <div>
                            <h2>Живой щит</h2>
                            <p class="subtle">
                                ${session.hintSelectionMode
                                    ? 'Подсказка активна: выберите кнопку и временно вскройте её реальные связи.'
                                    : 'Нажмите на кнопку или используйте клавиши 1-8, чтобы читать панель в динамике.'}
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
                        <span class="signal-pill">${activeBulbs} активных узлов</span>
                        <span class="signal-pill">${scannerStatus}</span>
                        <span class="signal-pill">H: подсказка</span>
                        <span class="signal-pill">R: рестарт</span>
                    </div>
                    <div
                        class="puzzle-stage game-stage ${session.hintSelectionMode ? 'is-arming' : ''} ${session.hintPairs.length ? 'is-revealing' : ''}"
                        id="game-stage"
                    >
                        <svg class="connection-overlay" id="game-overlay" aria-hidden="true"></svg>
                        <div class="stage-diagnostics">
                            <div class="stage-meter">
                                <span>Blackout</span>
                                <strong>${blackoutPercent}%</strong>
                                <div class="stage-meter-track">
                                    <div class="stage-meter-fill" style="width: ${blackoutPercent}%"></div>
                                </div>
                            </div>
                            <div class="stage-diagnostic-chip">
                                <span>Нейтрализовано</span>
                                <strong>${solvedBulbs}/${session.level.bulbs_count}</strong>
                            </div>
                            <div class="stage-diagnostic-chip">
                                <span>Активно</span>
                                <strong>${activeBulbs}</strong>
                            </div>
                        </div>
                        <div class="stage-title stage-title-top">Линия ламп</div>
                        <div class="bulb-row">
                            ${Array.from({ length: session.level.bulbs_count }, (_, bulbIndex) => `
                                <div
                                    class="bulb-node state-${session.currentStates[bulbIndex]} ${session.currentStates[bulbIndex] === 0 ? 'is-off' : 'is-on'} ${hintBulbs.has(bulbIndex) ? 'is-highlighted' : ''}"
                                    data-role="bulb"
                                    data-index="${bulbIndex}"
                                >
                                    <img src="${BULB_ASSETS[session.currentStates[bulbIndex]]}" alt="${BULB_LABELS[session.currentStates[bulbIndex]]}" />
                                    <span>Лампа ${bulbIndex + 1}</span>
                                    <small>${BULB_LABELS[session.currentStates[bulbIndex]]}</small>
                                </div>
                            `).join('')}
                        </div>
                        <div class="stage-title stage-title-bottom">Пульт ввода</div>
                        <div class="button-row command-row">
                            ${Array.from({ length: session.level.buttons_count }, (_, buttonIndex) => `
                                <button
                                    class="puzzle-button ${session.hintedButtonIndex === buttonIndex ? 'is-selected' : ''}"
                                    data-action="game-button"
                                    data-role="button"
                                    data-button-index="${buttonIndex}"
                                    data-index="${buttonIndex}"
                                >
                                    <img src="assets/images/button.png" alt="" />
                                    <span>B${buttonIndex + 1}</span>
                                    <small>Клавиша ${buttonIndex + 1}</small>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    ${session.victory ? this.renderVictoryOverlay(session) : ''}
                </article>
                <aside class="panel side-panel mission-panel tactical-panel">
                    <div class="mission-card tactical-card">
                        <div class="tactical-card-head">
                            <p class="eyebrow">Blackout</p>
                            <strong>${blackoutPercent}%</strong>
                        </div>
                        <h2>Свести панель к нулю</h2>
                        <div class="route-grid">
                            <div class="route-item">
                                <span>Погашено</span>
                                <strong>${solvedBulbs}/${session.level.bulbs_count}</strong>
                            </div>
                            <div class="route-item">
                                <span>Осталось</span>
                                <strong>${activeBulbs}</strong>
                            </div>
                        </div>
                        <div class="stage-meter-track compact">
                            <div class="stage-meter-fill" style="width: ${blackoutPercent}%"></div>
                        </div>
                    </div>

                    <div class="keyboard-card tactical-card">
                        <div class="tactical-card-head">
                            <p class="eyebrow">Сканер</p>
                            <strong>${session.hintUsed ? '0/1' : '1/1'}</strong>
                        </div>
                        <div class="route-grid">
                            <div class="route-item">
                                <span>Статус</span>
                                <strong>${session.hintSelectionMode ? 'Выбор' : session.hintUsed ? 'Пуст' : 'Готов'}</strong>
                            </div>
                            <div class="route-item">
                                <span>Маршрут</span>
                                <strong>${session.optimalMoves ? `${session.optimalMoves}+` : 'Auto'}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="keyboard-card tactical-card">
                        <p class="eyebrow">Горячие клавиши</p>
                        <div class="shortcut-grid">
                            <div class="shortcut-pill"><kbd>1-8</kbd><span>кнопки</span></div>
                            <div class="shortcut-pill"><kbd>H</kbd><span>сканер</span></div>
                            <div class="shortcut-pill"><kbd>R</kbd><span>рестарт</span></div>
                        </div>
                    </div>

                    <div class="keyboard-card tactical-card legend-card">
                        <p class="eyebrow">Состояния</p>
                        <div class="legend-list compact">
                        ${BULB_ASSETS.slice(0, session.level.colors_count).map((src, index) => `
                            <div class="legend-item">
                                <img src="${src}" alt="${BULB_LABELS[index]}" />
                                <span>${BULB_LABELS[index]}</span>
                            </div>
                        `).join('')}
                        </div>
                    </div>

                    <div class="keyboard-card tactical-card">
                        <p class="eyebrow">Порог оценки</p>
                        <p>${optimalMovesHint}</p>
                    </div>

                    <div class="side-actions">
                        <button class="secondary-button" data-action="nav-levels">К архиву</button>
                        <button class="ghost-button" data-action="nav-home">В главное меню</button>
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
                    <p class="eyebrow">Blackout confirmed</p>
                    <h2>${victory.newRecord ? 'Сектор погашен быстрее прежнего' : 'Схема погашена'}</h2>
                    <p class="lead compact">
                        ${session.hintUsed
                            ? 'Проход засчитан, но подсказка уже была потрачена в этой сессии.'
                            : 'Чистый прогон без подсказки. Такой маршрут проще масштабировать на сложные щиты.'}
                    </p>

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
                            <span>${escapeHtml(victory.rankProgress.title)}</span>
                            <span>Ур. ${victory.rankProgress.rank}</span>
                        </div>
                        <div class="victory-rank-track">
                            <div class="victory-rank-fill" style="width: ${Math.round(victory.rankProgress.fraction * 100)}%"></div>
                        </div>
                    </div>

                    <div class="victory-record ${victory.newRecord ? '' : 'subdued'}">
                        ${victory.newRecord ? 'Новый рекорд маршрута' : 'Маршрут сохранён в архиве'}
                    </div>

                    <div class="hero-actions">
                        <button class="primary-button" data-action="victory-next">
                            ${victory.nextLevelRef ? 'Следующий сектор' : 'К архиву уровней'}
                        </button>
                        <button class="secondary-button" data-action="game-restart">Повторить прогон</button>
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
                    <p class="eyebrow">Workshop</p>
                    <h1>${editor.mode === 'edit' ? 'Правка модуля' : 'Сборка нового модуля'}</h1>
                    <p class="lead">
                        Это монтажный стол уровня: меняйте параметры, прокладывайте связи и сразу проверяйте,
                        насколько читается ваша скрытая логика.
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
                    <p class="eyebrow">Паспорт схемы</p>
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
                        <button class="secondary-button" data-action="editor-randomize">Сгенерировать связи</button>
                        <button class="secondary-button" data-action="editor-generate-state">Обновить старт</button>
                        <button class="primary-button" data-action="editor-save">Сохранить модуль</button>
                        <button class="secondary-button" data-action="editor-play">Сохранить и запустить</button>
                        ${editor.mode === 'edit'
                            ? '<button class="ghost-button danger" data-action="editor-delete">Удалить модуль</button>'
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
                            <h3>Режим сборки</h3>
                            <p>1. Выберите кнопку внизу схемы.</p>
                            <p>2. Нажмите на лампу, чтобы добавить или убрать связь.</p>
                            <p>3. Стартовые состояния снизу переключаются по клику.</p>
                        </div>
                    `}
                </article>

                <article class="panel board-panel">
                    <div class="board-toolbar">
                        <div>
                            <h2>Монтажная панель</h2>
                            <p class="subtle">
                                ${selectedButtonIndex === null
                                    ? 'Выберите кнопку, чтобы проектировать её маршруты.'
                                    : `Активна кнопка ${selectedButtonIndex + 1}. Теперь переключайте нужные лампы.`}
                            </p>
                        </div>
                    </div>
                    <div class="board-status-strip">
                        <span class="signal-pill">${selectedButtonIndex === null ? 'Кнопка не выбрана' : `Выбрана B${selectedButtonIndex + 1}`}</span>
                        <span class="signal-pill">Прокладывайте связи кликом по лампам</span>
                        <span class="signal-pill">Проверяйте старт перед запуском</span>
                    </div>
                    <div class="puzzle-stage editor-stage" id="editor-stage">
                        <svg class="connection-overlay" id="editor-overlay" aria-hidden="true"></svg>
                        <div class="stage-title stage-title-top">Линия ламп</div>
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
                        <div class="stage-title stage-title-bottom">Пульт кнопок</div>
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
                            <p class="subtle">Любую ячейку можно щёлкнуть напрямую, если так быстрее собирать схему.</p>
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
                            <p class="subtle">Нажимайте на лампы, чтобы прокрутить стартовое состояние перед тестовым прогоном.</p>
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
                    <p class="eyebrow">Field manual</p>
                    <h1>Как читать эту панель</h1>
                    <p class="lead">Bulb Switcher лучше работает как инженерная головоломка: меньше хаоса, больше наблюдения и гипотез.</p>
                </div>
            </section>

            <section class="help-grid">
                <article class="panel feature-card">
                    <p class="eyebrow">01</p>
                    <h2>Сначала считывайте, потом жмите</h2>
                    <ol class="help-list">
                        <li>Каждая кнопка меняет только связанные с ней лампочки.</li>
                        <li>Состояния идут по кругу: выкл, зелёный, жёлтый, красный и снова выкл.</li>
                        <li>Победа наступает только когда все лампочки выключены.</li>
                    </ol>
                </article>
                <article class="panel feature-card">
                    <p class="eyebrow">02</p>
                    <h2>Используйте подсказку как сканер</h2>
                    <ol class="help-list">
                        <li>Нажмите кнопку «Подсказка».</li>
                        <li>Выберите нужную игровую кнопку.</li>
                        <li>На 3 секунды увидите её реальные связи.</li>
                    </ol>
                </article>
                <article class="panel feature-card">
                    <p class="eyebrow">03</p>
                    <h2>Редактор это лаборатория</h2>
                    <ol class="help-list">
                        <li>Настройте число кнопок, ламп и состояний.</li>
                        <li>Соберите связи и стартовое состояние.</li>
                        <li>Сохраните уровень и сразу запускайте его в игру.</li>
                    </ol>
                </article>
                <article class="panel feature-card">
                    <p class="eyebrow">04</p>
                    <h2>Играйте на коротком маршруте</h2>
                    <ol class="help-list">
                        <li>Чем меньше лишних кликов, тем выше оценка прохождения.</li>
                        <li>Подсказка помогает понять структуру, но не заменяет план.</li>
                        <li>Возвращайтесь к уровням, чтобы снять больше звёзд и улучшить рекорд.</li>
                    </ol>
                </article>
            </section>
        `;
    }

    renderStatCard(label, value, valueAttributes = '') {
        return `
            <div class="stat-card">
                <span class="stat-label">${escapeHtml(label)}</span>
                <strong class="stat-value" ${valueAttributes}>${escapeHtml(value)}</strong>
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
