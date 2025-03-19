class LevelManager {
    constructor() {
        this.levels = {
            block1: [],
            block2: [],
            block3: [],
            userLevels: []
        };
        this.progress = this.loadProgress();
    }

    // Загрузить все уровни из JSON файлов
    async loadAllLevels() {
        // Загрузка стандартных уровней
        await this.loadBlockLevels('block1', config.levelDirs.block1);
        await this.loadBlockLevels('block2', config.levelDirs.block2);
        await this.loadBlockLevels('block3', config.levelDirs.block3);
        
        // Загрузка пользовательских уровней из localStorage
        this.loadUserLevels();
        
        return this.levels;
    }

    // Загрузить уровни из указанного блока
    async loadBlockLevels(blockName, directory) {
        try {
            const response = await fetch(`${directory}/index.json`);
            if (!response.ok) {
                // Если индексного файла нет, пробуем получить список файлов динамически
                console.warn(`No index file found for ${blockName}, trying to load levels directly`);
                await this.loadLevelsWithoutIndex(blockName, directory);
                return;
            }
            
            const levelIndex = await response.json();
            const levelPromises = levelIndex.map(levelFile => 
                fetch(`${directory}/${levelFile}`).then(res => res.json())
            );
            
            this.levels[blockName] = await Promise.all(levelPromises);
        } catch (error) {
            console.error(`Error loading levels for ${blockName}:`, error);
            // В случае ошибки пробуем загрузить уровни напрямую
            await this.loadLevelsWithoutIndex(blockName, directory);
        }
    }

    // Загрузка уровней без индексного файла (прямое чтение директории не работает в браузере)
    // Это запасной вариант для тестирования
    async loadLevelsWithoutIndex(blockName, directory) {
        // Для веб-версии просто создаем тестовые уровни, если не смогли загрузить
        if (blockName === 'block1' && this.levels.block1.length === 0) {
            // Создаем базовый тестовый уровень
            const testLevel = {
                name: "Тестовый уровень",
                buttons_count: 2,
                bulbs_count: 2,
                colors_count: 2,
                connections: [[0, 0], [1, 1]],
                target_states: [0, 0],
                initial_states: [1, 1],
                complexity: 1.5,
                block: 1
            };
            this.levels.block1.push(testLevel);
        }
    }

    // Загрузить пользовательские уровни из localStorage
    loadUserLevels() {
        try {
            const userLevelsData = localStorage.getItem('userLevels');
            if (userLevelsData) {
                this.levels.userLevels = JSON.parse(userLevelsData);
            }
        } catch (error) {
            console.error('Error loading user levels:', error);
            this.levels.userLevels = [];
        }
    }

    // Сохранить пользовательский уровень
    saveUserLevel(level) {
        this.levels.userLevels.push(level);
        this.saveUserLevelsToStorage();
        return this.levels.userLevels.length - 1; // Возвращаем индекс нового уровня
    }

    // Удалить пользовательский уровень
    deleteUserLevel(index) {
        if (index >= 0 && index < this.levels.userLevels.length) {
            this.levels.userLevels.splice(index, 1);
            this.saveUserLevelsToStorage();
            return true;
        }
        return false;
    }

    // Сохранить пользовательские уровни в localStorage
    saveUserLevelsToStorage() {
        localStorage.setItem('userLevels', JSON.stringify(this.levels.userLevels));
    }

    // Получить уровень по блоку и индексу
    getLevel(blockName, levelIndex) {
        if (this.levels[blockName] && this.levels[blockName][levelIndex]) {
            return this.levels[blockName][levelIndex];
        }
        return null;
    }

    // Загрузить прогресс игрока
    loadProgress() {
        try {
            const savedProgress = localStorage.getItem('gameProgress');
            if (savedProgress) {
                return JSON.parse(savedProgress);
            }
        } catch (error) {
            console.error('Error loading game progress:', error);
        }
        
        // Если прогресса нет или произошла ошибка, создаем пустой прогресс
        return {
            lastLevel: { block: 'block1', index: 0 },
            completedLevels: {},
            levelResults: {}
        };
    }

    // Сохранить прогресс игрока
    saveProgress() {
        localStorage.setItem('gameProgress', JSON.stringify(this.progress));
    }

    // Сохранить результат прохождения уровня
    saveLevelResult(blockName, levelIndex, time, moves) {
        const levelKey = `${blockName}_${levelIndex}`;
        
        // Если результата ещё нет, или новый результат лучше
        const currentResult = this.progress.levelResults[levelKey];
        if (!currentResult || time < currentResult.time || (time === currentResult.time && moves < currentResult.moves)) {
            this.progress.levelResults[levelKey] = { time, moves };
        }
        
        // Отмечаем уровень как пройденный
        if (!this.progress.completedLevels[blockName]) {
            this.progress.completedLevels[blockName] = [];
        }
        
        if (!this.progress.completedLevels[blockName].includes(levelIndex)) {
            this.progress.completedLevels[blockName].push(levelIndex);
        }
        
        // Обновляем последний уровень
        this.progress.lastLevel = { block: blockName, index: levelIndex };
        
        this.saveProgress();
    }

    // Проверить, пройден ли уровень
    isLevelCompleted(blockName, levelIndex) {
        return (
            this.progress.completedLevels[blockName] && 
            this.progress.completedLevels[blockName].includes(levelIndex)
        );
    }

    // Получить результат прохождения уровня
    getLevelResult(blockName, levelIndex) {
        const levelKey = `${blockName}_${levelIndex}`;
        return this.progress.levelResults[levelKey] || null;
    }

    // Получить последний играемый уровень
    getLastLevel() {
        return this.progress.lastLevel;
    }
}

// Создаем глобальный экземпляр менеджера уровней
const levelManager = new LevelManager(); 