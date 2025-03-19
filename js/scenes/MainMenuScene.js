class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    preload() {
        // Загружаем изображения
        this.load.image('bulb_off', 'assets/images/bulb_off.png');
        this.load.image('bulb_green', 'assets/images/bulb_green.png');
        this.load.image('bulb_yellow', 'assets/images/bulb_yellow.png');
        this.load.image('bulb_red', 'assets/images/bulb_red.png');
        this.load.image('button', 'assets/images/button.png');
        this.load.image('confetti', 'assets/images/confetti.png');
        
        // Загружаем звуки
        this.load.audio('button_click', 'assets/sounds/button_click.mp3');
        this.load.audio('victory', 'assets/sounds/victory.mp3');
        this.load.audio('hint', 'assets/sounds/hint.mp3');
        this.load.audio('error', 'assets/sounds/error.mp3');
        
        // Загружаем спрайтлист для анимации конфетти
        this.load.spritesheet('confetti_animation', 'assets/images/confetti.gif', { 
            frameWidth: 64, 
            frameHeight: 64 
        });
    }

    async create() {
        // Загружаем уровни
        await levelManager.loadAllLevels();
        
        // Добавляем фон
        const bg = this.add.graphics();
        bg.fillStyle(0x1e272e, 1);
        bg.fillRect(0, 0, config.gameWidth, config.gameHeight);
        
        // Добавляем заголовок с рамкой
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x2d3436, 1);
        headerBg.fillRect(0, 0, config.gameWidth, 100);
        
        const headerBorder = this.add.graphics();
        headerBorder.lineStyle(3, 0x4b7bec, 1);
        headerBorder.lineBetween(0, 100, config.gameWidth, 100);
        
        // Заголовок игры
        this.add.text(
            config.gameWidth / 2,
            50,
            'Угадай переключатели лампочек',
            { ...config.styles.heading, fontSize: 36 }
        ).setOrigin(0.5);

        // Создаем декоративные лампочки вокруг меню
        this.createDecoLamps();
        
        // Создаем поле с описанием игры
        this.createGameDescription();
        
        // Кнопки меню
        this.createMenuButtons();
        
        // Вызываем resize после полной загрузки
        if (typeof resizeGame === 'function') {
            resizeGame();
        }
    }

    createDecoLamps() {
        // Создаем несколько декоративных лампочек разных цветов вокруг экрана
        const colors = ['bulb_off', 'bulb_green', 'bulb_yellow', 'bulb_red'];
        const positions = [
            { x: 100, y: 170 },
            { x: config.gameWidth - 100, y: 170 },
            { x: 150, y: 450 },
            { x: config.gameWidth - 150, y: 450 },
            { x: config.gameWidth / 2 - 200, y: 200 },
            { x: config.gameWidth / 2 + 200, y: 200 }
        ];
        
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const colorIndex = i % colors.length;
            
            const lamp = this.add.image(pos.x, pos.y, colors[colorIndex]);
            lamp.setScale(0.3);
            lamp.setAlpha(0.3);
            
            // Добавляем анимацию мерцания
            this.tweens.add({
                targets: lamp,
                alpha: { from: 0.3, to: 0.6 },
                duration: 1000 + Phaser.Math.Between(0, 2000),
                yoyo: true,
                repeat: -1
            });
        }
    }
    
    createGameDescription() {
        const descBg = this.add.graphics();
        descBg.fillStyle(0x2d3436, 0.8);
        descBg.fillRoundedRect(config.gameWidth / 2 - 300, 130, 600, 80, 10);
        
        this.add.text(
            config.gameWidth / 2,
            170,
            'Нажимайте на кнопки, чтобы привести\nвсе лампочки в выключенное состояние',
            { ...config.styles.text, fontSize: 20, align: 'center' }
        ).setOrigin(0.5);
    }

    createMenuButtons() {
        const buttonWidth = 300;
        const buttonHeight = 70;
        const buttonSpacing = 25;
        const startY = 270;
        
        // Получаем последний играемый уровень
        const lastLevel = levelManager.getLastLevel();
        
        // Кнопка продолжения игры (последний уровень)
        this.createButton(
            config.gameWidth / 2,
            startY,
            'Продолжить игру',
            () => {
                this.scene.start('GameScene', { 
                    block: lastLevel.block, 
                    levelIndex: lastLevel.index 
                });
            },
            buttonWidth,
            buttonHeight
        );
        
        // Кнопка выбора уровня
        this.createButton(
            config.gameWidth / 2,
            startY + buttonHeight + buttonSpacing,
            'Выбрать уровень',
            () => {
                this.scene.start('LevelSelectScene');
            },
            buttonWidth,
            buttonHeight
        );
        
        // Кнопка редактора уровней
        this.createButton(
            config.gameWidth / 2,
            startY + (buttonHeight + buttonSpacing) * 2,
            'Редактор уровней',
            () => {
                this.scene.start('LevelEditorScene');
            },
            buttonWidth,
            buttonHeight
        );
        
        // Версия
        this.add.text(
            config.gameWidth - 10,
            config.gameHeight - 10,
            'Версия 1.0',
            { ...config.styles.text, fontSize: 14, color: '#999999' }
        ).setOrigin(1, 1);
    }

    createButton(x, y, text, callback, width, height) {
        // Создаем графический объект для кнопки
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x4b7bec, 1);
        buttonBg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 15);
        
        // Создаем рамку кнопки
        const buttonBorder = this.add.graphics();
        buttonBorder.lineStyle(2, 0x3867d6, 1);
        buttonBorder.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 15);
        
        // Создаем текст кнопки
        const buttonText = this.add.text(
            x,
            y,
            text,
            { ...config.styles.button, fontSize: 24 }
        ).setOrigin(0.5);
        
        // Создаем интерактивную зону и назначаем обработчики событий
        const hitArea = this.add.zone(x, y, width, height);
        hitArea.setInteractive();
        
        hitArea.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x3867d6, 1);
            buttonBg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 15);
            buttonText.setScale(1.05);
        });
        
        hitArea.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x4b7bec, 1);
            buttonBg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 15);
            buttonText.setScale(1);
        });
        
        hitArea.on('pointerdown', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x2d3436, 1);
            buttonBg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 15);
            buttonText.setScale(0.95);
            
            // Воспроизводим звук нажатия кнопки
            this.sound.play('button_click');
        });
        
        hitArea.on('pointerup', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x3867d6, 1);
            buttonBg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 15);
            buttonText.setScale(1);
            
            // Вызываем callback функцию
            callback();
        });
        
        return { background: buttonBg, border: buttonBorder, text: buttonText, hitArea };
    }
} 