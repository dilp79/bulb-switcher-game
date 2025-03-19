class LevelEditor {
    constructor() {
        this.currentLevel = null;
        this.buttonsCount = 3;
        this.bulbsCount = 3;
        this.colorsCount = 2;
        this.connections = [];
        this.initialStates = [];
        this.targetStates = [];
        this.isConnectionMode = false;
        this.selectedButton = -1;
        this.selectedBulb = -1;
    }

    // Создание нового уровня с текущими параметрами
    createNewLevel() {
        const name = `Пользовательский уровень ${levelManager.levels.userLevels.length + 1}`;
        this.currentLevel = levelGenerator.generateLevel(
            name, 
            this.buttonsCount, 
            this.bulbsCount, 
            this.colorsCount
        );
        
        this.updateFromCurrentLevel();
        
        return this.currentLevel;
    }

    // Загрузка существующего уровня для редактирования
    loadLevel(level) {
        this.currentLevel = JSON.parse(JSON.stringify(level)); // глубокое копирование
        this.updateFromCurrentLevel();
        return this.currentLevel;
    }

    // Обновить свойства редактора из загруженного уровня
    updateFromCurrentLevel() {
        if (!this.currentLevel) return;
        
        this.buttonsCount = this.currentLevel.buttons_count;
        this.bulbsCount = this.currentLevel.bulbs_count;
        this.colorsCount = this.currentLevel.colors_count;
        this.connections = [...this.currentLevel.connections];
        this.initialStates = [...this.currentLevel.initial_states];
        this.targetStates = [...this.currentLevel.target_states];
    }

    // Обновить параметры уровня
    updateParameters(buttonsCount, bulbsCount, colorsCount) {
        // Сохраняем старые значения
        const oldButtonsCount = this.buttonsCount;
        const oldBulbsCount = this.bulbsCount;
        
        // Обновляем значения
        this.buttonsCount = Math.min(Math.max(1, buttonsCount), config.levelGenerator.maxButtons);
        this.bulbsCount = Math.min(Math.max(1, bulbsCount), config.levelGenerator.maxBulbs);
        this.colorsCount = Math.min(Math.max(2, colorsCount), config.levelGenerator.maxColors);
        
        // Обновляем связи, если изменилось количество кнопок или лампочек
        if (oldButtonsCount !== this.buttonsCount || oldBulbsCount !== this.bulbsCount) {
            // Фильтруем связи, убирая недействительные
            this.connections = this.connections.filter(conn => 
                conn[0] < this.buttonsCount && conn[1] < this.bulbsCount
            );
            
            // Обновляем начальные состояния
            this.generateInitialState();
        }
        
        // Обновляем уровень
        this.updateCurrentLevel();
    }

    // Генерировать новые случайные связи
    recreateConnections() {
        this.connections = levelGenerator.generateConnections(this.buttonsCount, this.bulbsCount);
        this.updateCurrentLevel();
    }

    // Генерировать новое начальное состояние
    generateInitialState() {
        this.initialStates = levelGenerator.generateInitialState(this.bulbsCount, this.colorsCount);
        this.targetStates = Array(this.bulbsCount).fill(0); // Целевое состояние всегда "все выключены"
        this.updateCurrentLevel();
    }

    // Переключить связь между кнопкой и лампочкой
    toggleConnection(buttonIndex, bulbIndex) {
        this.connections = levelGenerator.updateConnections(this.connections, buttonIndex, bulbIndex);
        this.updateCurrentLevel();
    }

    // Обновить объект уровня
    updateCurrentLevel() {
        if (!this.currentLevel) {
            this.createNewLevel();
            return;
        }
        
        const complexity = levelGenerator.calculateComplexity(
            this.buttonsCount, 
            this.bulbsCount, 
            this.connections.length
        );
        
        this.currentLevel = {
            ...this.currentLevel,
            buttons_count: this.buttonsCount,
            bulbs_count: this.bulbsCount,
            colors_count: this.colorsCount,
            connections: [...this.connections],
            initial_states: [...this.initialStates],
            target_states: [...this.targetStates],
            complexity: complexity
        };
    }

    // Сохранить текущий уровень
    saveLevel() {
        if (!this.currentLevel) return -1;
        
        // Обновляем название, если это новый уровень
        if (!this.currentLevel.name || this.currentLevel.name.includes('Пользовательский уровень')) {
            this.currentLevel.name = `Пользовательский уровень ${levelManager.levels.userLevels.length + 1}`;
        }
        
        // Сохраняем уровень в менеджере
        return levelManager.saveUserLevel(this.currentLevel);
    }

    // Проверить, что уровень корректный (мин. 1 связь для каждой кнопки и лампочки)
    validateLevel() {
        if (!this.currentLevel) return false;
        
        // Проверяем, что каждая кнопка связана хотя бы с одной лампочкой
        const buttonsWithConnections = new Set(this.connections.map(conn => conn[0]));
        if (buttonsWithConnections.size < this.buttonsCount) return false;
        
        // Проверяем, что каждая лампочка связана хотя бы с одной кнопкой
        const bulbsWithConnections = new Set(this.connections.map(conn => conn[1]));
        if (bulbsWithConnections.size < this.bulbsCount) return false;
        
        // Проверяем, что хотя бы одна лампочка включена в начальном состоянии
        if (!this.initialStates.some(state => state > 0)) return false;
        
        return true;
    }
}

// Создаем глобальный экземпляр редактора уровней
const levelEditor = new LevelEditor(); 