const config = {
    // Основные параметры игры
    gameWidth: 800,
    gameHeight: 700,
    
    // Настройки для файловой системы
    levelDirs: {
        block1: 'levels/block_1',
        block2: 'levels/block_2',
        block3: 'levels/block_3',
        userLevels: 'levels/user_levels'
    },
    
    // Параметры для генератора уровней
    levelGenerator: {
        maxButtons: 8,
        maxBulbs: 8,
        maxColors: 4
    },
    
    // Размеры и смещения игровых элементов
    gameElements: {
        headerHeight: 80,
        bulbY: 200,         // Y-координата ряда лампочек
        buttonY: 400,       // Y-координата ряда кнопок
        bulbScale: 0.25,    // Масштаб лампочек (учитывая размер 512x512, масштаб 0.25 даст 128x128)
        buttonScale: 0.3,   // Масштаб кнопок 
        elementSpacing: 180, // Расстояние между элементами (увеличил для лучшего распределения)
        buttonHitArea: 80,  // Область нажатия кнопок
        bulbHitArea: 120    // Область нажатия лампочек
    },
    
    // Стили для элементов интерфейса
    styles: {
        text: {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#fff',
            align: 'center'
        },
        button: {
            fontFamily: 'Arial',
            fontSize: 16,
            color: '#fff',
            align: 'center'
        },
        heading: {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#fff',
            align: 'center'
        },
        gameHeader: {
            height: 70,
            bgColor: 0x1e272e
        },
        controlPanel: {
            backgroundColor: '#2d3436',
            height: 60,
            borderBottom: '2px solid #4b7bec'
        },
        levelButton: {
            normalColor: '#4b7bec',
            hoverColor: '#3867d6',
            activeColor: '#2d3436',
            completedColor: '#4cd137',
            borderRadius: 10
        },
        connectionLine: {
            color: 0x3498db,
            width: 3,
            alpha: 0.7
        }
    }
};

// Экспорт конфигурации
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
} 