// Создание конфигурации Phaser для игры
const gameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: config.gameWidth,
    height: config.gameHeight,
    backgroundColor: '#222222',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [
        MainMenuScene,
        LevelSelectScene,
        GameScene,
        LevelEditorScene
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Создание экземпляра игры
let game = new Phaser.Game(gameConfig);

// Создание директории для пользовательских уровней, если её нет
if (!localStorage.getItem('userLevelsCreated')) {
    // В веб-версии мы используем localStorage для хранения уровней
    localStorage.setItem('userLevels', JSON.stringify([]));
    localStorage.setItem('userLevelsCreated', 'true');
}

// Создаём папку для пользовательских уровней (эта функция нужна только для браузера)
function ensureUserLevelsDirectory() {
    if (!localStorage.getItem('userLevelsCreated')) {
        localStorage.setItem('userLevels', JSON.stringify([]));
        localStorage.setItem('userLevelsCreated', 'true');
    }
}

// Функция для правильного изменения размера игры
function resizeGame() {
    if (game && game.canvas) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const ratio = Math.min(width / config.gameWidth, height / config.gameHeight);
        
        game.canvas.style.width = `${config.gameWidth * ratio}px`;
        game.canvas.style.height = `${config.gameHeight * ratio}px`;
    }
}

// Обработка изменения размера окна для адаптивного дизайна
window.addEventListener('resize', resizeGame);

// Мы вызовем resizeGame() из сцены MainMenuScene после полной загрузки игры 