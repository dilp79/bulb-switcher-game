class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.level = null;
        this.buttons = [];
        this.bulbs = [];
        this.currentStates = [];
        this.connections = [];
        this.hintsUsed = false;
        this.moveCount = 0;
        this.startTime = 0;
        this.gameTimer = null;
        this.gameCompleted = false;
    }

    init(data) {
        // Получаем данные уровня из параметров сцены
        this.blockName = data.block;
        this.levelIndex = data.levelIndex;
        this.level = levelManager.getLevel(this.blockName, this.levelIndex);
        
        if (!this.level) {
            console.error(`No level found for ${this.blockName} index ${this.levelIndex}`);
            this.scene.start('LevelSelectScene');
            return;
        }
        
        // Инициализируем игровые параметры
        this.currentStates = [...this.level.initial_states];
        this.connections = [...this.level.connections];
        this.hintsUsed = false;
        this.moveCount = 0;
        this.gameCompleted = false;
        this.buttons = [];
        this.bulbs = [];
        this.connectionLines = [];
        this.startTime = 0;
    }

    create() {
        this.startTime = Date.now();
        
        // Создаем фон
        this.createBackground();
        
        // Создаем интерфейс уровня
        this.createUI();
        
        // Создаем игровую зону
        this.createGameArea();
        
        // Создаем лампочки (теперь выше)
        this.createBulbs();
        
        // Создаем кнопки (теперь ниже)
        this.createButtons();
        
        // Запускаем таймер
        this.createTimer();
        
        // Создаем анимацию конфетти
        this.anims.create({
            key: 'confetti_anim',
            frames: this.anims.generateFrameNumbers('confetti_animation', { start: 0, end: 10 }),
            frameRate: 12,
            repeat: -1
        });
        
        // Вызываем resize после полной загрузки
        this.time.delayedCall(100, () => {
            if (typeof resizeGame === 'function' && document.querySelector('canvas')) {
                resizeGame();
            }
        });
    }

    createBackground() {
        // Создаем основной фон
        const bg = this.add.graphics();
        bg.fillStyle(0x1e272e, 1);
        bg.fillRect(0, 0, config.gameWidth, config.gameHeight);
    }

    createGameArea() {
        // Блоки 2 и 3 уже не нуждаются в общих надписях, так как они разделены
        // и имеют собственные фоны
    }

    createUI() {
        // Создаем верхнюю панель (Блок 1)
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1e272e, 1);
        headerBg.fillRect(0, 0, config.gameWidth, 100);
        
        // Добавляем нижнюю границу для шапки
        const headerBorder = this.add.graphics();
        headerBorder.lineStyle(3, 0x4b7bec, 1);
        headerBorder.lineBetween(0, 100, config.gameWidth, 100);
        
        // ===== ЛЕВАЯ ЧАСТЬ ШАПКИ (100 пикселей) =====
        // Кнопка "выбор уровней"
        const levelSelectBtnBg = this.add.graphics();
        levelSelectBtnBg.fillStyle(0x4b7bec, 1);
        levelSelectBtnBg.fillRoundedRect(10, 15, 80, 30, 10);
        
        const levelSelectBtn = this.add.text(50, 30, 'Уровни', config.styles.button)
            .setOrigin(0.5)
            .setFontSize(14)
            .setInteractive()
            .on('pointerup', () => {
                this.sound.play('button_click');
                this.scene.start('LevelSelectScene');
            })
            .on('pointerover', () => {
                levelSelectBtnBg.clear();
                levelSelectBtnBg.fillStyle(0x3867d6, 1);
                levelSelectBtnBg.fillRoundedRect(10, 15, 80, 30, 10);
                levelSelectBtn.setScale(1.05);
            })
            .on('pointerout', () => {
                levelSelectBtnBg.clear();
                levelSelectBtnBg.fillStyle(0x4b7bec, 1);
                levelSelectBtnBg.fillRoundedRect(10, 15, 80, 30, 10);
                levelSelectBtn.setScale(1);
            });
        
        // Кнопка "меню"
        const menuBtnBg = this.add.graphics();
        menuBtnBg.fillStyle(0x4b7bec, 1);
        menuBtnBg.fillRoundedRect(10, 55, 80, 30, 10);
        
        const menuBtn = this.add.text(50, 70, 'Меню', config.styles.button)
            .setOrigin(0.5)
            .setFontSize(14)
            .setInteractive()
            .on('pointerup', () => {
                this.sound.play('button_click');
                this.scene.start('MainMenuScene');
            })
            .on('pointerover', () => {
                menuBtnBg.clear();
                menuBtnBg.fillStyle(0x3867d6, 1);
                menuBtnBg.fillRoundedRect(10, 55, 80, 30, 10);
                menuBtn.setScale(1.05);
            })
            .on('pointerout', () => {
                menuBtnBg.clear();
                menuBtnBg.fillStyle(0x4b7bec, 1);
                menuBtnBg.fillRoundedRect(10, 55, 80, 30, 10);
                menuBtn.setScale(1);
            });
        
        // ===== ЦЕНТРАЛЬНАЯ ЧАСТЬ ШАПКИ (400 пикселей) =====
        // Название уровня и блока
        const blockText = this.add.text(
            config.gameWidth / 2, 
            30, 
            `Блок ${this.blockName} - Уровень ${this.levelIndex + 1}: ${this.level.name}`, 
            config.styles.heading
        ).setOrigin(0.5).setFontSize(20);
        
        // Счетчик ходов с фоном
        const movesCountBg = this.add.graphics();
        movesCountBg.fillStyle(0x2d3436, 0.7);
        movesCountBg.fillRoundedRect(config.gameWidth / 2 - 180, 55, 100, 30, 10);
        
        this.moveCountText = this.add.text(
            config.gameWidth / 2 - 130, 
            70, 
            `Ходов: ${this.moveCount}`, 
            config.styles.text
        ).setOrigin(0.5);
        
        // Таймер с фоном
        const timerBg = this.add.graphics();
        timerBg.fillStyle(0x2d3436, 0.7);
        timerBg.fillRoundedRect(config.gameWidth / 2 - 60, 55, 100, 30, 10);
        
        this.timerText = this.add.text(
            config.gameWidth / 2 - 10, 
            70, 
            '00:00', 
            config.styles.text
        ).setOrigin(0.5);
        
        // Добавляем информацию о предыдущем рекорде
        const previousResult = levelManager.getLevelResult(this.blockName, this.levelIndex);
        if (previousResult) {
            const minutes = Math.floor(previousResult.time / 60);
            const seconds = previousResult.time % 60;
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Фон для рекорда
            const recordBg = this.add.graphics();
            recordBg.fillStyle(0x27ae60, 0.7);
            recordBg.fillRoundedRect(config.gameWidth / 2 + 60, 55, 120, 30, 10);
            
            // Текст рекорда
            this.add.text(
                config.gameWidth / 2 + 120,
                70,
                `Рекорд: ${timeString}`, 
                { ...config.styles.text, fontSize: 12 }
            ).setOrigin(0.5);
        }

        // ===== ПРАВАЯ ЧАСТЬ ШАПКИ (100 пикселей) =====
        // Кнопка подсказки
        const hintBtnBg = this.add.graphics();
        hintBtnBg.fillStyle(0x4b7bec, 1);
        hintBtnBg.fillRoundedRect(config.gameWidth - 90, 15, 80, 30, 10);
        
        this.hintButton = this.add.text(
            config.gameWidth - 50, 
            30, 
            'Подсказка', 
            config.styles.button
        )
        .setOrigin(0.5)
        .setFontSize(14)
        .setInteractive()
        .on('pointerup', () => this.showHint())
        .on('pointerover', () => {
            if (!this.hintsUsed) {
                hintBtnBg.clear();
                hintBtnBg.fillStyle(0x3867d6, 1);
                hintBtnBg.fillRoundedRect(config.gameWidth - 90, 15, 80, 30, 10);
                this.hintButton.setScale(1.05);
            }
        })
        .on('pointerout', () => {
            if (!this.hintsUsed) {
                hintBtnBg.clear();
                hintBtnBg.fillStyle(0x4b7bec, 1);
                hintBtnBg.fillRoundedRect(config.gameWidth - 90, 15, 80, 30, 10);
                this.hintButton.setScale(1);
            }
        });
        
        // Если подсказка уже использована, делаем кнопку неактивной
        if (this.hintsUsed) {
            hintBtnBg.clear();
            hintBtnBg.fillStyle(0x7f8c8d, 0.7);
            hintBtnBg.fillRoundedRect(config.gameWidth - 90, 15, 80, 30, 10);
            this.hintButton.setAlpha(0.5);
            this.hintButton.disableInteractive();
        }
        
        // Кнопка рестарта уровня
        const restartBtnBg = this.add.graphics();
        restartBtnBg.fillStyle(0x4b7bec, 1);
        restartBtnBg.fillRoundedRect(config.gameWidth - 90, 55, 80, 30, 10);
        
        const restartBtn = this.add.text(
            config.gameWidth - 50, 
            70, 
            'Рестарт', 
            config.styles.button
        )
        .setOrigin(0.5)
        .setFontSize(14)
        .setInteractive()
        .on('pointerup', () => {
            this.sound.play('button_click');
            this.scene.restart({ block: this.blockName, levelIndex: this.levelIndex });
        })
        .on('pointerover', () => {
            restartBtnBg.clear();
            restartBtnBg.fillStyle(0x3867d6, 1);
            restartBtnBg.fillRoundedRect(config.gameWidth - 90, 55, 80, 30, 10);
            restartBtn.setScale(1.05);
        })
        .on('pointerout', () => {
            restartBtnBg.clear();
            restartBtnBg.fillStyle(0x4b7bec, 1);
            restartBtnBg.fillRoundedRect(config.gameWidth - 90, 55, 80, 30, 10);
            restartBtn.setScale(1);
        });
    }

    createButtons() {
        const buttonCount = this.level.buttons_count;
        const buttonSpacing = config.gameElements.elementSpacing;
        const startX = (config.gameWidth - (buttonCount - 1) * buttonSpacing) / 2;
        const buttonY = 550; // Середина блока 3 (100 + 300 + 300/2 = 550)
        
        // Создаем игровую панель для кнопок (Блок 3)
        const buttonsPanelBg = this.add.graphics();
        buttonsPanelBg.fillStyle(0x2d3436, 0.3);
        buttonsPanelBg.fillRoundedRect(
            50, 
            400, 
            config.gameWidth - 100, 
            300, 
            15
        );
        
        // Добавляем подпись "Кнопки"
        this.add.text(
            70, 
            420, 
            'Кнопки:', 
            { ...config.styles.text, fontSize: 20 }
        );
        
        for (let i = 0; i < buttonCount; i++) {
            const x = startX + i * buttonSpacing;
            
            // Создаем спрайт кнопки
            const button = this.add.image(x, buttonY, 'button');
            button.setScale(config.gameElements.buttonScale);
            
            // Добавляем эффект тени
            const buttonShadow = this.add.image(x + 5, buttonY + 5, 'button');
            buttonShadow.setScale(config.gameElements.buttonScale);
            buttonShadow.setAlpha(0.3);
            buttonShadow.setTint(0x000000);
            this.add.existing(buttonShadow);
            this.add.existing(button);
            
            // Делаем кнопку интерактивной
            button.setInteractive();
            
            // Добавляем обработчики событий
            button.on('pointerdown', () => {
                // Анимация нажатия
                button.setScale(config.gameElements.buttonScale * 0.9);
            });
            
            button.on('pointerup', () => {
                // Анимация отпускания
                button.setScale(config.gameElements.buttonScale);
                
                // Воспроизводим звук
                this.sound.play('button_click');
                
                // Обрабатываем нажатие
                this.handleButtonClick(i);
            });
            
            button.on('pointerout', () => {
                // Возвращаем исходный размер, если курсор ушел
                button.setScale(config.gameElements.buttonScale);
            });
            
            // Сохраняем кнопку
            this.buttons.push({ 
                sprite: button, 
                shadow: buttonShadow,
                index: i 
            });
        }
    }

    createBulbs() {
        const bulbCount = this.level.bulbs_count;
        const colorsCount = this.level.colors_count;
        const bulbSpacing = config.gameElements.elementSpacing;
        const startX = (config.gameWidth - (bulbCount - 1) * bulbSpacing) / 2;
        const bulbY = 250; // Середина блока 2 (100 + 300/2 = 250)
        
        // Создаем игровую панель для лампочек (Блок 2)
        const bulbsPanelBg = this.add.graphics();
        bulbsPanelBg.fillStyle(0x2d3436, 0.3);
        bulbsPanelBg.fillRoundedRect(
            50, 
            100, 
            config.gameWidth - 100, 
            300, 
            15
        );
        
        // Добавляем подпись "Лампочки"
        this.add.text(
            70, 
            120, 
            'Лампочки:', 
            { ...config.styles.text, fontSize: 20 }
        );
        
        // Цвета лампочек
        const bulbColors = ['bulb_off', 'bulb_green', 'bulb_yellow', 'bulb_red'];
        
        for (let i = 0; i < bulbCount; i++) {
            const x = startX + i * bulbSpacing;
            
            // Получаем текущее состояние лампочки
            const state = this.currentStates[i];
            
            // Создаем спрайт лампочки
            const bulb = this.add.image(x, bulbY, bulbColors[state]);
            bulb.setScale(config.gameElements.bulbScale);
            
            // Сохраняем лампочку
            this.bulbs.push({ sprite: bulb, index: i, state: state, x, y: bulbY });
        }
    }

    createTimer() {
        // Обновление таймера каждую секунду
        this.gameTimer = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
    }

    updateTimer() {
        if (this.gameCompleted) return;
        
        const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        
        this.timerText.setText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }

    handleButtonClick(buttonIndex) {
        if (this.gameCompleted) return;
        
        // Увеличиваем счетчик ходов
        this.moveCount++;
        this.moveCountText.setText(`Ходов: ${this.moveCount}`);
        
        // Находим все лампочки, связанные с этой кнопкой
        const affectedBulbs = this.connections.filter(conn => conn[0] === buttonIndex).map(conn => conn[1]);
        
        // Меняем состояние каждой лампочки
        affectedBulbs.forEach(bulbIndex => {
            this.toggleBulbState(bulbIndex);
        });
        
        // Проверяем, выиграл ли игрок
        this.checkWinCondition();
    }

    toggleBulbState(bulbIndex) {
        // Получаем текущее состояние
        let currentState = this.currentStates[bulbIndex];
        
        // Меняем на следующее состояние (циклически)
        currentState = (currentState + 1) % (this.level.colors_count + 1);
        
        // Обновляем состояние
        this.currentStates[bulbIndex] = currentState;
        
        // Обновляем изображение
        const bulbColors = ['bulb_off', 'bulb_green', 'bulb_yellow', 'bulb_red'];
        this.bulbs[bulbIndex].sprite.setTexture(bulbColors[currentState]);
        this.bulbs[bulbIndex].state = currentState;
        
        // Добавляем анимацию смены состояния
        this.tweens.add({
            targets: this.bulbs[bulbIndex].sprite,
            scale: { from: config.gameElements.bulbScale * 1.1, to: config.gameElements.bulbScale },
            duration: 200,
            ease: 'Sine.easeOut'
        });
    }

    checkWinCondition() {
        // Проверяем, все ли лампочки выключены
        const allOff = this.currentStates.every(state => state === 0);
        
        if (allOff) {
            this.gameCompleted = true;
            
            // Останавливаем таймер
            if (this.gameTimer) {
                this.gameTimer.remove();
            }
            
            // Вычисляем время прохождения
            const totalTime = Math.floor((Date.now() - this.startTime) / 1000);
            
            // Сохраняем результат
            levelManager.saveLevelResult(this.blockName, this.levelIndex, totalTime, this.moveCount);
            
            // Показываем победное сообщение
            this.showVictory(totalTime);
        }
    }

    showVictory(time) {
        // Воспроизводим звук победы
        this.sound.play('victory');
        
        // Создаем затемнение
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, config.gameWidth, config.gameHeight);
        
        // Показываем сообщение о победе
        const victoryBox = this.add.graphics();
        victoryBox.fillStyle(0x3867d6, 1);
        victoryBox.fillRoundedRect(
            config.gameWidth / 2 - 200,
            config.gameHeight / 2 - 150,
            400,
            300,
            16
        );
        
        // Добавляем рамку для окна победы
        const victoryBorder = this.add.graphics();
        victoryBorder.lineStyle(3, 0x4b7bec, 1);
        victoryBorder.strokeRoundedRect(
            config.gameWidth / 2 - 200,
            config.gameHeight / 2 - 150,
            400,
            300,
            16
        );
        
        // Создаем анимированные конфетти на заднем плане (на весь экран)
        const confettiSprites = [];
        
        // Создаем статичные большие конфетти по всему экрану
        for (let i = 0; i < 15; i++) {
            const x = Phaser.Math.Between(50, config.gameWidth - 50);
            const y = Phaser.Math.Between(50, config.gameHeight - 50);
            
            // Создаем спрайт с анимацией конфетти
            const confetti = this.add.sprite(x, y, 'confetti_animation');
            confetti.setScale(3); // Увеличиваем размер в 3 раза
            confetti.setTint(0xffffff); // Делаем ярче
            confetti.setDepth(50); // Не самый передний план, но перед фоном
            
            // Запускаем анимацию
            confetti.play('confetti_anim');
            
            // Добавляем плавную анимацию прозрачности вместо вращения
            this.tweens.add({
                targets: confetti,
                alpha: { from: 0.7, to: 1 },
                duration: 2000 + Phaser.Math.Between(0, 1000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            confettiSprites.push(confetti);
        }
        
        // Текст сообщения
        this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 - 100,
            'Уровень пройден!',
            { ...config.styles.heading, fontSize: 32 }
        ).setOrigin(0.5).setDepth(101);
        
        // Статистика
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 - 30,
            `Время: ${timeString}`,
            config.styles.text
        ).setOrigin(0.5).setDepth(101);
        
        this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 + 10,
            `Ходов: ${this.moveCount}`,
            config.styles.text
        ).setOrigin(0.5).setDepth(101);
        
        // Добавляем информацию о предыдущем рекорде, если он был
        const previousResult = levelManager.getLevelResult(this.blockName, this.levelIndex);
        if (previousResult && (previousResult.time !== time || previousResult.moves !== this.moveCount)) {
            const prevMinutes = Math.floor(previousResult.time / 60);
            const prevSeconds = previousResult.time % 60;
            const prevTimeString = `${prevMinutes}:${prevSeconds.toString().padStart(2, '0')}`;
            
            // Сравниваем текущий результат с предыдущим
            let recordText = 'Предыдущий результат: ';
            let recordColor = '#ffffff';
            
            if (time < previousResult.time || (time === previousResult.time && this.moveCount < previousResult.moves)) {
                recordText = 'Новый рекорд! Предыдущий: ';
                recordColor = '#4cd137';
            }
            
            this.add.text(
                config.gameWidth / 2,
                config.gameHeight / 2 + 40,
                `${recordText}${prevTimeString}, ${previousResult.moves} ходов`,
                { ...config.styles.text, fontSize: 14, color: recordColor }
            ).setOrigin(0.5).setDepth(101);
        }
        
        // Проверяем наличие следующего уровня
        const nextLevelIndex = this.levelIndex + 1;
        const levels = levelManager.levels[this.blockName];
        const hasNextLevel = levels && nextLevelIndex < levels.length;
        
        // Кнопка следующего уровня с фоном (всегда показываем)
        const nextBtnBg = this.add.graphics();
        nextBtnBg.fillStyle(0x4cd137, 1);
        nextBtnBg.fillRoundedRect(
            config.gameWidth / 2 - 150,
            config.gameHeight / 2 + 80 - 20,
            300,
            40,
            10
        );
        nextBtnBg.setDepth(101);
        
        const nextButton = this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 + 80,
            hasNextLevel ? 'Следующий уровень' : 'Вернуться к выбору уровня',
            config.styles.button
        )
        .setOrigin(0.5)
        .setInteractive()
        .setDepth(101)
        .on('pointerup', () => {
            this.sound.play('button_click');
            if (hasNextLevel) {
                this.scene.restart({ block: this.blockName, levelIndex: nextLevelIndex });
            } else {
                this.scene.start('LevelSelectScene');
            }
        })
        .on('pointerover', () => {
            nextBtnBg.clear();
            nextBtnBg.fillStyle(0x44bd32, 1);
            nextBtnBg.fillRoundedRect(
                config.gameWidth / 2 - 150,
                config.gameHeight / 2 + 80 - 20,
                300,
                40,
                10
            );
            nextButton.setScale(1.05);
        })
        .on('pointerout', () => {
            nextBtnBg.clear();
            nextBtnBg.fillStyle(0x4cd137, 1);
            nextBtnBg.fillRoundedRect(
                config.gameWidth / 2 - 150,
                config.gameHeight / 2 + 80 - 20,
                300,
                40,
                10
            );
            nextButton.setScale(1);
        });
        
        // Кнопка меню с фоном
        const menuBtnBg = this.add.graphics();
        menuBtnBg.fillStyle(0x4b7bec, 1);
        menuBtnBg.fillRoundedRect(
            config.gameWidth / 2 - 150,
            config.gameHeight / 2 + 130 - 20,
            300,
            40,
            10
        );
        menuBtnBg.setDepth(101);
        
        const menuButton = this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 + 130,
            'Выбор уровня',
            config.styles.button
        )
        .setOrigin(0.5)
        .setInteractive()
        .setDepth(101)
        .on('pointerup', () => {
            this.sound.play('button_click');
            this.scene.start('LevelSelectScene');
        })
        .on('pointerover', () => {
            menuBtnBg.clear();
            menuBtnBg.fillStyle(0x3867d6, 1);
            menuBtnBg.fillRoundedRect(
                config.gameWidth / 2 - 150,
                config.gameHeight / 2 + 130 - 20,
                300,
                40,
                10
            );
            menuButton.setScale(1.05);
        })
        .on('pointerout', () => {
            menuBtnBg.clear();
            menuBtnBg.fillStyle(0x4b7bec, 1);
            menuBtnBg.fillRoundedRect(
                config.gameWidth / 2 - 150,
                config.gameHeight / 2 + 130 - 20,
                300,
                40,
                10
            );
            menuButton.setScale(1);
        });
        
        // Автоматически переходим к следующему уровню через 3 секунды, если он есть
        if (hasNextLevel) {
            const countdown = this.add.text(
                config.gameWidth / 2,
                config.gameHeight / 2 + 170,
                'Автопереход через 3...',
                { ...config.styles.text, fontSize: 18 }
            ).setOrigin(0.5).setDepth(101);
            
            let timeLeft = 3;
            const countdownTimer = this.time.addEvent({
                delay: 1000,
                callback: () => {
                    timeLeft--;
                    countdown.setText(`Автопереход через ${timeLeft}...`);
                    
                    if (timeLeft <= 0) {
                        this.scene.restart({ block: this.blockName, levelIndex: nextLevelIndex });
                    }
                },
                callbackScope: this,
                repeat: 2
            });
            
            // Останавливаем автопереход при взаимодействии с кнопками
            nextButton.on('pointerdown', () => {
                countdownTimer.remove();
                countdown.destroy();
                
                // Удаляем спрайты конфетти
                confettiSprites.forEach(sprite => sprite.destroy());
            });
            
            menuButton.on('pointerdown', () => {
                countdownTimer.remove();
                countdown.destroy();
                
                // Удаляем спрайты конфетти
                confettiSprites.forEach(sprite => sprite.destroy());
            });
        }
        
        // Удаляем спрайты конфетти через 5 секунд после перехода к следующему уровню
        this.time.delayedCall(5000, () => {
            confettiSprites.forEach(sprite => {
                // Плавно скрываем спрайт
                this.tweens.add({
                    targets: sprite,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => sprite.destroy()
                });
            });
        });
    }

    showHint() {
        if (this.hintsUsed || this.gameCompleted) return;
        
        // Воспроизводим звук подсказки
        this.sound.play('hint');
        
        // Отмечаем, что подсказка использована
        this.hintsUsed = true;
        this.hintButton.setAlpha(0.5);
        this.hintButton.disableInteractive();
        
        // Создаем фон для подсказки
        const hintBoxBg = this.add.graphics();
        hintBoxBg.fillStyle(0x3498db, 0.9);
        hintBoxBg.fillRoundedRect(
            config.gameWidth / 2 - 250,
            650,
            500,
            50,
            10
        );
        
        // Просим пользователя выбрать кнопку для подсказки
        const helpText = this.add.text(
            config.gameWidth / 2,
            675,
            'Выберите кнопку, чтобы увидеть её связи с лампочками',
            { ...config.styles.text, fontSize: 18 }
        ).setOrigin(0.5);
        
        // Делаем кнопки мигающими для подсказки
        this.buttons.forEach(button => {
            this.tweens.add({
                targets: button.sprite,
                scale: { from: config.gameElements.buttonScale, to: config.gameElements.buttonScale * 1.15 },
                duration: 500,
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                    button.sprite.setScale(config.gameElements.buttonScale);
                }
            });
            
            // Меняем обработчик нажатия на режим подсказки
            button.sprite.off('pointerup');
            button.sprite.on('pointerup', () => {
                // Воспроизводим звук
                this.sound.play('button_click');
                
                // Показываем связи этой кнопки
                this.showButtonConnections(button.index);
                
                // Удаляем текст подсказки и фон
                helpText.destroy();
                hintBoxBg.destroy();
                
                // Восстанавливаем обработчики кнопок
                this.restoreButtonHandlers();
            });
        });
    }

    showButtonConnections(buttonIndex) {
        // Находим все лампочки, связанные с этой кнопкой
        const affectedBulbs = this.connections.filter(conn => conn[0] === buttonIndex).map(conn => conn[1]);
        
        // Отображаем связи линиями
        this.connectionLines = [];
        
        const buttonObj = this.buttons.find(btn => btn.index === buttonIndex);
        
        // Выделяем выбранную кнопку
        buttonObj.sprite.setTint(0xf39c12);
        
        affectedBulbs.forEach(bulbIndex => {
            const bulbObj = this.bulbs.find(bulb => bulb.index === bulbIndex);
            
            // Рисуем линию от кнопки к лампочке
            const line = this.add.graphics();
            line.lineStyle(4, 0xff0000, 0.8);
            line.beginPath();
            line.moveTo(buttonObj.sprite.x, buttonObj.sprite.y);
            line.lineTo(bulbObj.sprite.x, bulbObj.sprite.y);
            line.strokePath();
            
            // Добавляем светящийся эффект
            const glowLine = this.add.graphics();
            glowLine.lineStyle(8, 0xff0000, 0.3);
            glowLine.beginPath();
            glowLine.moveTo(buttonObj.sprite.x, buttonObj.sprite.y);
            glowLine.lineTo(bulbObj.sprite.x, bulbObj.sprite.y);
            glowLine.strokePath();
            
            this.connectionLines.push(line);
            this.connectionLines.push(glowLine);
            
            // Добавляем мигание для связанных лампочек
            this.tweens.add({
                targets: bulbObj.sprite,
                scale: { from: config.gameElements.bulbScale, to: config.gameElements.bulbScale * 1.15 },
                duration: 500,
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                    bulbObj.sprite.setScale(config.gameElements.bulbScale);
                }
            });
            
            // Добавим выделение для лампочек
            bulbObj.sprite.setTint(0xff9500);
        });
        
        // Удаляем линии и подсветку через 3 секунды
        this.time.delayedCall(3000, () => {
            this.connectionLines.forEach(line => line.destroy());
            this.connectionLines = [];
            
            // Снимаем подсветку с кнопки
            buttonObj.sprite.clearTint();
            
            // Снимаем подсветку с лампочек
            affectedBulbs.forEach(bulbIndex => {
                const bulbObj = this.bulbs.find(bulb => bulb.index === bulbIndex);
                bulbObj.sprite.clearTint();
            });
        });
    }

    restoreButtonHandlers() {
        // Восстанавливаем обработчики нажатия на кнопки
        this.buttons.forEach(button => {
            button.sprite.off('pointerup');
            button.sprite.on('pointerup', () => {
                button.sprite.setScale(config.gameElements.buttonScale);
                this.sound.play('button_click');
                this.handleButtonClick(button.index);
            });
        });
    }
} 