class HelpScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HelpScene' });
    }

    create() {
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
        
        // Заголовок сцены
        this.add.text(
            config.gameWidth / 2,
            50,
            'Как играть',
            { ...config.styles.heading, fontSize: 36 }
        ).setOrigin(0.5);

        // Содержимое справки
        const contentBg = this.add.graphics();
        contentBg.fillStyle(0x2d3436, 0.8);
        contentBg.fillRoundedRect(50, 120, config.gameWidth - 100, config.gameHeight - 200, 15);
        
        // Текст инструкции
        const instructionText = [
            'Правила игры:',
            '',
            '1. Цель игры — выключить все лампочки (перевести их в состояние "выключено")',
            '',
            '2. При нажатии на кнопку меняется состояние всех лампочек, связанных с ней',
            '',
            '3. Состояния лампочек циклически переключаются между:',
            '   • Выключено (серый цвет)',
            '   • Зеленый',
            '   • Желтый',
            '   • Красный',
            '',
            '4. Если вы не знаете, какие лампочки связаны с кнопкой,',
            '   используйте кнопку "Подсказка" (доступна один раз за уровень)',
            '',
            '5. Сложность уровней постепенно возрастает:',
            '   • Увеличивается количество лампочек и кнопок',
            '   • Усложняются связи между ними',
            '   • Добавляются дополнительные цвета',
            '',
            '6. Ваша задача — найти правильную последовательность нажатий',
            '   на кнопки, чтобы перевести все лампочки в выключенное состояние',
            '',
            'Удачи в прохождении всех уровней!'
        ];
        
        let yOffset = 150;
        instructionText.forEach(line => {
            this.add.text(
                70,
                yOffset,
                line,
                { ...config.styles.text, fontSize: 18 }
            );
            yOffset += 24;
        });
        
        // Кнопка "Назад в меню"
        const backBtnBg = this.add.graphics();
        backBtnBg.fillStyle(0x4b7bec, 1);
        backBtnBg.fillRoundedRect(config.gameWidth / 2 - 150, config.gameHeight - 60, 300, 40, 15);
        
        const backBtn = this.add.text(
            config.gameWidth / 2,
            config.gameHeight - 40,
            'Вернуться в меню',
            { ...config.styles.button, fontSize: 20 }
        ).setOrigin(0.5);
        
        // Создаем интерактивную зону и назначаем обработчики событий
        const hitArea = this.add.zone(config.gameWidth / 2, config.gameHeight - 40, 300, 40);
        hitArea.setInteractive();
        
        hitArea.on('pointerover', () => {
            backBtnBg.clear();
            backBtnBg.fillStyle(0x3867d6, 1);
            backBtnBg.fillRoundedRect(config.gameWidth / 2 - 150, config.gameHeight - 60, 300, 40, 15);
            backBtn.setScale(1.05);
        });
        
        hitArea.on('pointerout', () => {
            backBtnBg.clear();
            backBtnBg.fillStyle(0x4b7bec, 1);
            backBtnBg.fillRoundedRect(config.gameWidth / 2 - 150, config.gameHeight - 60, 300, 40, 15);
            backBtn.setScale(1);
        });
        
        hitArea.on('pointerdown', () => {
            backBtnBg.clear();
            backBtnBg.fillStyle(0x2d3436, 1);
            backBtnBg.fillRoundedRect(config.gameWidth / 2 - 150, config.gameHeight - 60, 300, 40, 15);
            backBtn.setScale(0.95);
            
            // Воспроизводим звук нажатия кнопки
            this.sound.play('button_click');
        });
        
        hitArea.on('pointerup', () => {
            this.scene.start('MainMenuScene');
        });
        
        // Добавляем декоративные лампочки по краям
        this.createDecoLamps();
        
        // Вызываем resize после полной загрузки
        if (typeof resizeGame === 'function') {
            resizeGame();
        }
    }
    
    createDecoLamps() {
        // Создаем несколько декоративных лампочек разных цветов вокруг экрана
        const colors = ['bulb_off', 'bulb_green', 'bulb_yellow', 'bulb_red'];
        const positions = [
            { x: 70, y: 150 },
            { x: config.gameWidth - 70, y: 150 },
            { x: 70, y: config.gameHeight - 100 },
            { x: config.gameWidth - 70, y: config.gameHeight - 100 }
        ];
        
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const colorIndex = i % colors.length;
            
            const lamp = this.add.image(pos.x, pos.y, colors[colorIndex]);
            lamp.setScale(0.2);
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
} 