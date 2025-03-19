class LevelEditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelEditorScene' });
        
        this.buttons = [];
        this.bulbs = [];
        this.connectionLines = [];
        this.selectedButton = -1;
        this.selectedBulb = -1;
        this.isConnectionMode = false;
        this.currentLevel = null;
    }

    create() {
        // Создаем заголовок
        this.add.text(
            config.gameWidth / 2, 
            25, 
            'Редактор уровней', 
            config.styles.heading
        ).setOrigin(0.5);
        
        // Кнопка возврата в меню
        this.createBackButton();
        
        // Создаем новый уровень, если нет текущего
        if (!this.currentLevel) {
            this.currentLevel = levelEditor.createNewLevel();
        }
        
        // Создаем панель управления параметрами
        this.createControlPanel();
        
        // Рисуем кнопки и лампочки
        this.createButtons();
        this.createBulbs();
        
        // Рисуем связи
        this.drawConnections();
    }

    createBackButton() {
        const backButton = this.add.text(50, 25, '← Назад', config.styles.button)
            .setInteractive()
            .on('pointerup', () => {
                this.sound.play('button_click');
                this.scene.start('MainMenuScene');
            })
            .on('pointerover', () => backButton.setScale(1.1))
            .on('pointerout', () => backButton.setScale(1));
    }

    createControlPanel() {
        // Фон панели управления
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x2d3436, 0.8);
        panelBg.fillRect(0, 70, config.gameWidth, 60);
        
        // Создаем элементы управления
        this.createParameterInputs();
        
        // Создаем управляющие кнопки
        this.createActionButtons();
    }

    createParameterInputs() {
        const startX = 50;
        const y = 100;
        const spacing = 180;
        
        // Текст для количества кнопок
        this.add.text(startX, y - 20, 'Кнопки:', config.styles.button);
        
        // Кнопки +/- для количества кнопок
        this.createNumberControl(
            startX + 80, 
            y, 
            levelEditor.buttonsCount,
            (value) => {
                levelEditor.updateParameters(value, levelEditor.bulbsCount, levelEditor.colorsCount);
                this.refreshAll();
            },
            1,
            config.levelGenerator.maxButtons
        );
        
        // Текст для количества лампочек
        this.add.text(startX + spacing, y - 20, 'Лампочки:', config.styles.button);
        
        // Кнопки +/- для количества лампочек
        this.createNumberControl(
            startX + spacing + 100, 
            y, 
            levelEditor.bulbsCount,
            (value) => {
                levelEditor.updateParameters(levelEditor.buttonsCount, value, levelEditor.colorsCount);
                this.refreshAll();
            },
            1,
            config.levelGenerator.maxBulbs
        );
        
        // Текст для количества цветов
        this.add.text(startX + spacing * 2, y - 20, 'Цвета:', config.styles.button);
        
        // Кнопки +/- для количества цветов
        this.createNumberControl(
            startX + spacing * 2 + 80, 
            y, 
            levelEditor.colorsCount,
            (value) => {
                levelEditor.updateParameters(levelEditor.buttonsCount, levelEditor.bulbsCount, value);
                this.refreshAll();
            },
            2,
            config.levelGenerator.maxColors
        );
    }

    createNumberControl(x, y, initialValue, callback, min = 1, max = 8) {
        // Кнопка уменьшения
        const minusBtn = this.add.text(x - 30, y, '-', {
            ...config.styles.button,
            fontSize: 28,
            backgroundColor: '#e74c3c'
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerup', () => {
            const newValue = Math.max(min, initialValue - 1);
            if (newValue !== initialValue) {
                this.sound.play('button_click');
                callback(newValue);
            }
        });
        
        // Значение
        const valueText = this.add.text(x, y, initialValue.toString(), {
            ...config.styles.button,
            fontSize: 24
        }).setOrigin(0.5);
        
        // Кнопка увеличения
        const plusBtn = this.add.text(x + 30, y, '+', {
            ...config.styles.button,
            fontSize: 28,
            backgroundColor: '#27ae60'
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerup', () => {
            const newValue = Math.min(max, initialValue + 1);
            if (newValue !== initialValue) {
                this.sound.play('button_click');
                callback(newValue);
            }
        });
        
        return { minusBtn, valueText, plusBtn };
    }

    createActionButtons() {
        const buttonsData = [
            {
                text: 'Новые связи',
                x: config.gameWidth - 350,
                y: 100,
                callback: () => {
                    this.sound.play('button_click');
                    levelEditor.recreateConnections();
                    this.refreshConnections();
                }
            },
            {
                text: 'Новое состояние',
                x: config.gameWidth - 200,
                y: 100,
                callback: () => {
                    this.sound.play('button_click');
                    levelEditor.generateInitialState();
                    this.refreshBulbs();
                }
            },
            {
                text: 'Сохранить',
                x: config.gameWidth - 80,
                y: 100,
                callback: () => {
                    if (levelEditor.validateLevel()) {
                        this.sound.play('button_click');
                        const levelIndex = levelEditor.saveLevel();
                        this.showSaveConfirmation(levelIndex);
                    } else {
                        this.sound.play('error');
                        this.showValidationError();
                    }
                }
            }
        ];
        
        buttonsData.forEach(data => {
            const button = this.add.text(data.x, data.y, data.text, config.styles.button)
                .setOrigin(0.5)
                .setInteractive()
                .on('pointerup', data.callback)
                .on('pointerover', () => button.setScale(1.1))
                .on('pointerout', () => button.setScale(1));
        });
    }

    createButtons() {
        const buttonCount = levelEditor.buttonsCount;
        const buttonSpacing = 80;
        const startX = (config.gameWidth - (buttonCount - 1) * buttonSpacing) / 2;
        const buttonY = 200;
        
        // Сначала удаляем старые кнопки, если они есть
        this.buttons.forEach(button => {
            button.sprite.destroy();
            button.text.destroy();
        });
        this.buttons = [];
        
        // Текст-подсказка
        this.connectionModeText = this.add.text(
            config.gameWidth / 2,
            160,
            'Нажмите на кнопку и лампочку, чтобы создать/удалить связь',
            config.styles.text
        ).setOrigin(0.5);
        this.connectionModeText.setVisible(false);
        
        // Создаем новые кнопки
        for (let i = 0; i < buttonCount; i++) {
            const x = startX + i * buttonSpacing;
            
            // Создаем спрайт кнопки
            const button = this.add.image(x, buttonY, 'button');
            button.setScale(0.5);
            button.setInteractive();
            
            // Номер кнопки
            const buttonText = this.add.text(
                x,
                buttonY,
                (i + 1).toString(),
                { ...config.styles.button, fontSize: 28 }
            ).setOrigin(0.5);
            
            // Добавляем обработчики событий
            button.on('pointerdown', () => {
                button.setScale(0.45);
            });
            
            button.on('pointerup', () => {
                button.setScale(0.5);
                this.sound.play('button_click');
                
                // Если мы уже в режиме связи и выбрана другая кнопка
                if (this.isConnectionMode && this.selectedButton !== i) {
                    // Отменяем режим связи и снимаем выделение
                    this.exitConnectionMode();
                } else if (this.isConnectionMode && this.selectedButton === i) {
                    // Отменяем режим связи, если нажали на ту же кнопку
                    this.exitConnectionMode();
                } else {
                    // Входим в режим связи
                    this.enterConnectionMode(i);
                }
            });
            
            button.on('pointerout', () => {
                button.setScale(0.5);
            });
            
            this.buttons.push({ sprite: button, text: buttonText, index: i });
        }
    }

    createBulbs() {
        const bulbCount = levelEditor.bulbsCount;
        const colorsCount = levelEditor.colorsCount;
        const bulbSpacing = 80;
        const startX = (config.gameWidth - (bulbCount - 1) * bulbSpacing) / 2;
        const bulbY = 320;
        
        // Удаляем старые лампочки
        this.bulbs.forEach(bulb => {
            bulb.sprite.destroy();
        });
        this.bulbs = [];
        
        // Цвета лампочек
        const bulbColors = ['bulb_off', 'bulb_green', 'bulb_yellow', 'bulb_red'];
        
        // Создаем новые лампочки
        for (let i = 0; i < bulbCount; i++) {
            const x = startX + i * bulbSpacing;
            
            // Получаем текущее состояние лампочки из редактора
            const state = levelEditor.initialStates[i];
            
            // Создаем спрайт лампочки
            const bulb = this.add.image(x, bulbY, bulbColors[state]);
            bulb.setScale(0.5);
            bulb.setInteractive();
            
            // Добавляем обработчики событий
            bulb.on('pointerup', () => {
                this.sound.play('button_click');
                
                // Если мы в режиме связи
                if (this.isConnectionMode) {
                    // Создаем или удаляем связь
                    levelEditor.toggleConnection(this.selectedButton, i);
                    this.refreshConnections();
                    this.exitConnectionMode();
                } else {
                    // Если не в режиме связи, меняем состояние лампочки
                    const newState = (state + 1) % (colorsCount + 1);
                    levelEditor.initialStates[i] = newState;
                    levelEditor.updateCurrentLevel();
                    
                    // Обновляем визуально
                    bulb.setTexture(bulbColors[newState]);
                }
            });
            
            this.bulbs.push({ sprite: bulb, index: i, state: state, x, y: bulbY });
        }
    }

    drawConnections() {
        // Удаляем старые линии связей
        this.connectionLines.forEach(line => line.destroy());
        this.connectionLines = [];
        
        // Рисуем линии связей
        levelEditor.connections.forEach(conn => {
            const buttonIndex = conn[0];
            const bulbIndex = conn[1];
            
            // Находим кнопку и лампочку
            const button = this.buttons.find(btn => btn.index === buttonIndex);
            const bulb = this.bulbs.find(b => b.index === bulbIndex);
            
            if (button && bulb) {
                // Рисуем линию
                const line = this.add.graphics();
                line.lineStyle(2, 0x3498db, 0.5);
                line.beginPath();
                line.moveTo(button.sprite.x, button.sprite.y);
                line.lineTo(bulb.sprite.x, bulb.sprite.y);
                line.strokePath();
                
                this.connectionLines.push(line);
            }
        });
    }

    refreshAll() {
        this.createButtons();
        this.createBulbs();
        this.drawConnections();
    }

    refreshConnections() {
        this.drawConnections();
    }

    refreshBulbs() {
        this.createBulbs();
    }

    enterConnectionMode(buttonIndex) {
        this.isConnectionMode = true;
        this.selectedButton = buttonIndex;
        
        // Показываем текст подсказки
        this.connectionModeText.setVisible(true);
        
        // Подсвечиваем выбранную кнопку
        const selectedButton = this.buttons.find(btn => btn.index === buttonIndex);
        selectedButton.sprite.setTint(0xf39c12);
        
        // Делаем все лампочки мигающими
        this.bulbs.forEach(bulb => {
            this.tweens.add({
                targets: bulb.sprite,
                alpha: { from: 1, to: 0.7 },
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        });
    }

    exitConnectionMode() {
        if (!this.isConnectionMode) return;
        
        this.isConnectionMode = false;
        
        // Скрываем текст подсказки
        this.connectionModeText.setVisible(false);
        
        // Убираем подсветку кнопки
        const selectedButton = this.buttons.find(btn => btn.index === this.selectedButton);
        if (selectedButton) {
            selectedButton.sprite.clearTint();
        }
        
        // Останавливаем мигание лампочек
        this.bulbs.forEach(bulb => {
            this.tweens.killTweensOf(bulb.sprite);
            bulb.sprite.alpha = 1;
        });
        
        this.selectedButton = -1;
    }

    showSaveConfirmation(levelIndex) {
        // Создаем затемнение
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, config.gameWidth, config.gameHeight);
        
        // Показываем сообщение
        const messageBox = this.add.graphics();
        messageBox.fillStyle(0x3867d6, 1);
        messageBox.fillRoundedRect(
            config.gameWidth / 2 - 200,
            config.gameHeight / 2 - 100,
            400,
            200,
            16
        );
        
        // Текст сообщения
        this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 - 50,
            'Уровень сохранен!',
            { ...config.styles.heading, fontSize: 28 }
        ).setOrigin(0.5);
        
        // Кнопки действий
        const playButton = this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 + 20,
            'Играть',
            config.styles.button
        )
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerup', () => {
            this.sound.play('button_click');
            this.scene.start('GameScene', { block: 'userLevels', levelIndex });
        });
        
        const closeButton = this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 + 70,
            'Закрыть',
            config.styles.button
        )
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerup', () => {
            this.sound.play('button_click');
            overlay.destroy();
            messageBox.destroy();
            playButton.destroy();
            closeButton.destroy();
        });
    }

    showValidationError() {
        // Создаем затемнение
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, config.gameWidth, config.gameHeight);
        
        // Показываем сообщение об ошибке
        const errorBox = this.add.graphics();
        errorBox.fillStyle(0xe74c3c, 1);
        errorBox.fillRoundedRect(
            config.gameWidth / 2 - 200,
            config.gameHeight / 2 - 100,
            400,
            200,
            16
        );
        
        // Текст сообщения
        this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 - 50,
            'Ошибка валидации!',
            { ...config.styles.heading, fontSize: 28 }
        ).setOrigin(0.5);
        
        this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2,
            'Каждая кнопка и лампочка должна\nиметь минимум одну связь.\nХотя бы одна лампочка должна\nбыть включена.',
            { ...config.styles.text, align: 'center' }
        ).setOrigin(0.5);
        
        // Кнопка закрытия
        const closeButton = this.add.text(
            config.gameWidth / 2,
            config.gameHeight / 2 + 70,
            'Закрыть',
            config.styles.button
        )
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerup', () => {
            this.sound.play('button_click');
            overlay.destroy();
            errorBox.destroy();
            closeButton.destroy();
        });
    }
} 