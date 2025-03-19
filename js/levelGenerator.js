class LevelGenerator {
    constructor() {
        this.maxButtons = config.levelGenerator.maxButtons;
        this.maxBulbs = config.levelGenerator.maxBulbs;
        this.maxColors = config.levelGenerator.maxColors;
    }

    // Генерация уровня с заданными параметрами
    generateLevel(name, buttonsCount, bulbsCount, colorsCount, blockNumber = 0) {
        // Проверяем, что параметры в допустимых пределах
        buttonsCount = Math.min(Math.max(1, buttonsCount), this.maxButtons);
        bulbsCount = Math.min(Math.max(1, bulbsCount), this.maxBulbs);
        colorsCount = Math.min(Math.max(2, colorsCount), this.maxColors);

        // Генерируем связи между кнопками и лампочками
        const connections = this.generateConnections(buttonsCount, bulbsCount);
        
        // Генерируем начальное состояние
        const initialStates = this.generateInitialState(bulbsCount, colorsCount);
        
        // Целевое состояние всегда "все лампочки выключены" (состояние 0)
        const targetStates = Array(bulbsCount).fill(0);
        
        // Рассчитываем сложность уровня
        const complexity = this.calculateComplexity(buttonsCount, bulbsCount, connections.length);
        
        // Формируем объект уровня
        return {
            name: name,
            buttons_count: buttonsCount,
            bulbs_count: bulbsCount,
            colors_count: colorsCount,
            connections: connections,
            target_states: targetStates,
            initial_states: initialStates,
            complexity: complexity,
            block: blockNumber
        };
    }

    // Генерация связей между кнопками и лампочками
    generateConnections(buttonsCount, bulbsCount) {
        const connections = [];
        const maxConnections = buttonsCount * bulbsCount;
        
        // Минимальное количество связей - чтобы каждая кнопка и лампочка имели хотя бы одну связь
        const minConnections = Math.max(buttonsCount, bulbsCount);
        
        // Количество дополнительных связей зависит от размеров сетки
        const baseConnectionCount = Math.max(minConnections, Math.min(buttonsCount + bulbsCount, maxConnections / 2));
        
        // Добавляем сначала базовые связи (минимум по одной на каждую кнопку и лампочку)
        for (let i = 0; i < buttonsCount; i++) {
            connections.push([i, i % bulbsCount]);
        }
        
        // Если нужно больше связей, добавляем случайные
        while (connections.length < baseConnectionCount) {
            const button = Math.floor(Math.random() * buttonsCount);
            const bulb = Math.floor(Math.random() * bulbsCount);
            
            // Проверяем, что такой связи еще нет
            const connectionExists = connections.some(conn => 
                conn[0] === button && conn[1] === bulb
            );
            
            if (!connectionExists) {
                connections.push([button, bulb]);
            }
        }
        
        return connections;
    }

    // Генерация начального состояния (чтобы как минимум одна лампочка была включена)
    generateInitialState(bulbsCount, colorsCount) {
        const states = Array(bulbsCount).fill(0);
        
        // Определяем, сколько лампочек будет включено изначально (минимум 1)
        const onBulbsCount = 1 + Math.floor(Math.random() * bulbsCount);
        
        // Включаем случайные лампочки
        for (let i = 0; i < onBulbsCount; i++) {
            const bulbIndex = Math.floor(Math.random() * bulbsCount);
            // Состояние от 1 до colorsCount (цвета)
            states[bulbIndex] = 1 + Math.floor(Math.random() * (colorsCount - 1));
        }
        
        return states;
    }

    // Расчет сложности уровня по формуле
    calculateComplexity(buttonsCount, bulbsCount, connectionsCount) {
        return 1 + Math.log10((buttonsCount + bulbsCount) * connectionsCount);
    }

    // Обновление связей между кнопками и лампочками (для редактора)
    updateConnections(connections, buttonIndex, bulbIndex) {
        // Проверяем, есть ли уже такая связь
        const connectionIndex = connections.findIndex(conn => 
            conn[0] === buttonIndex && conn[1] === bulbIndex
        );
        
        if (connectionIndex !== -1) {
            // Если связь уже есть, удаляем её
            connections.splice(connectionIndex, 1);
        } else {
            // Если связи нет, добавляем
            connections.push([buttonIndex, bulbIndex]);
        }
        
        return connections;
    }
}

// Создаем глобальный экземпляр генератора уровней
const levelGenerator = new LevelGenerator(); 