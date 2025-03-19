class LevelSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelSelectScene' });
        this.currentBlock = 'block1';
    }

    create() {
        this.add.text(
            config.gameWidth / 2, 
            50, 
            'Выбор уровня', 
            config.styles.heading
        ).setOrigin(0.5);

        // Кнопка возврата в меню
        this.createBackButton();
        
        // Создаем вкладки для блоков уровней
        this.createBlockTabs();
        
        // Отображаем уровни текущего блока
        this.showLevelsForBlock(this.currentBlock);
    }

    createBackButton() {
        const backButton = this.add.text(50, 50, '← Назад', config.styles.button)
            .setInteractive()
            .on('pointerup', () => {
                this.sound.play('button_click');
                this.scene.start('MainMenuScene');
            })
            .on('pointerover', () => backButton.setScale(1.1))
            .on('pointerout', () => backButton.setScale(1));
    }

    createBlockTabs() {
        const tabWidth = 150;
        const tabHeight = 40;
        const tabSpacing = 10;
        const startX = (config.gameWidth - (tabWidth * 4 + tabSpacing * 3)) / 2;
        const tabY = 120;
        
        // Создаем массив блоков для вкладок
        const blocks = [
            { key: 'block1', name: 'Блок 1' },
            { key: 'block2', name: 'Блок 2' },
            { key: 'block3', name: 'Блок 3' },
            { key: 'userLevels', name: 'Мои уровни' }
        ];
        
        this.blockTabs = {};
        
        // Создаем вкладку для каждого блока
        blocks.forEach((block, index) => {
            const x = startX + index * (tabWidth + tabSpacing);
            
            // Создаем фон вкладки
            const tabBg = this.add.graphics();
            const isActive = block.key === this.currentBlock;
            
            tabBg.fillStyle(isActive ? 0x3867d6 : 0x4b7bec, 1);
            tabBg.fillRoundedRect(x, tabY, tabWidth, tabHeight, 8);
            
            // Создаем текст вкладки
            const tabText = this.add.text(
                x + tabWidth / 2,
                tabY + tabHeight / 2,
                block.name,
                config.styles.button
            ).setOrigin(0.5);
            
            // Создаем интерактивную зону
            const hitArea = this.add.zone(x + tabWidth / 2, tabY + tabHeight / 2, tabWidth, tabHeight)
                .setInteractive()
                .on('pointerover', () => {
                    if (block.key !== this.currentBlock) {
                        tabBg.clear();
                        tabBg.fillStyle(0x3867d6, 0.8);
                        tabBg.fillRoundedRect(x, tabY, tabWidth, tabHeight, 8);
                    }
                })
                .on('pointerout', () => {
                    if (block.key !== this.currentBlock) {
                        tabBg.clear();
                        tabBg.fillStyle(0x4b7bec, 1);
                        tabBg.fillRoundedRect(x, tabY, tabWidth, tabHeight, 8);
                    }
                })
                .on('pointerup', () => {
                    this.sound.play('button_click');
                    this.changeBlock(block.key);
                });
            
            // Сохраняем вкладку
            this.blockTabs[block.key] = { background: tabBg, text: tabText, hitArea };
        });
    }

    // Изменение активного блока уровней
    changeBlock(blockKey) {
        // Если блок уже активен, ничего не делаем
        if (blockKey === this.currentBlock) return;
        
        // Деактивируем текущую вкладку
        const currentTab = this.blockTabs[this.currentBlock];
        const tabWidth = 150;
        const tabHeight = 40;
        const tabSpacing = 10;
        const startX = (config.gameWidth - (tabWidth * 4 + tabSpacing * 3)) / 2;
        const tabY = 120;
        
        // Находим индекс текущего и нового блока
        const blocks = ['block1', 'block2', 'block3', 'userLevels'];
        const currentIndex = blocks.indexOf(this.currentBlock);
        
        currentTab.background.clear();
        currentTab.background.fillStyle(0x4b7bec, 1);
        currentTab.background.fillRoundedRect(
            startX + currentIndex * (tabWidth + tabSpacing), 
            tabY, 
            tabWidth, 
            tabHeight, 
            8
        );
        
        // Активируем новую вкладку
        const newIndex = blocks.indexOf(blockKey);
        const newTab = this.blockTabs[blockKey];
        
        newTab.background.clear();
        newTab.background.fillStyle(0x3867d6, 1);
        newTab.background.fillRoundedRect(
            startX + newIndex * (tabWidth + tabSpacing), 
            tabY, 
            tabWidth, 
            tabHeight, 
            8
        );
        
        // Обновляем текущий блок
        this.currentBlock = blockKey;
        
        // Отображаем уровни нового блока
        this.showLevelsForBlock(blockKey);
    }

    // Отображение уровней выбранного блока
    showLevelsForBlock(blockKey) {
        // Очищаем предыдущие уровни, если они были
        if (this.levelButtons) {
            this.levelButtons.forEach(button => {
                button.background.destroy();
                button.text.destroy();
                button.hitArea.destroy();
                button.completedIcon?.destroy();
            });
        }
        
        this.levelButtons = [];
        
        const levels = levelManager.levels[blockKey];
        if (!levels || levels.length === 0) {
            // Если уровней нет, показываем сообщение
            this.add.text(
                config.gameWidth / 2,
                300,
                'В этом блоке нет уровней',
                config.styles.text
            ).setOrigin(0.5);
            return;
        }
        
        // Параметры сетки уровней
        const buttonSize = 70;
        const spacing = 20;
        const columns = 5;
        const startX = (config.gameWidth - (buttonSize * columns + spacing * (columns - 1))) / 2;
        const startY = 200;
        
        // Создаем кнопку для каждого уровня
        levels.forEach((level, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            
            const x = startX + col * (buttonSize + spacing) + buttonSize / 2;
            const y = startY + row * (buttonSize + spacing) + buttonSize / 2;
            
            // Создаем кнопку уровня
            const button = this.createLevelButton(x, y, index + 1, () => {
                this.sound.play('button_click');
                this.scene.start('GameScene', { block: blockKey, levelIndex: index });
            }, buttonSize);
            
            // Если уровень пройден, добавляем иконку
            if (levelManager.isLevelCompleted(blockKey, index)) {
                const completedIcon = this.add.graphics();
                completedIcon.fillStyle(0x4cd137, 1);
                completedIcon.fillCircle(x + buttonSize / 3, y - buttonSize / 3, 12);
                
                button.completedIcon = completedIcon;
            }
            
            this.levelButtons.push(button);
        });
    }

    createLevelButton(x, y, levelNumber, callback, size = 60) {
        // Создаем фон кнопки
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x4b7bec, 1);
        buttonBg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 10);
        
        // Создаем текст кнопки
        const buttonText = this.add.text(
            x,
            y,
            levelNumber.toString(),
            { ...config.styles.button, fontSize: 28 }
        ).setOrigin(0.5);
        
        // Создаем интерактивную зону
        const hitArea = this.add.zone(x, y, size, size)
            .setInteractive()
            .on('pointerover', () => {
                buttonBg.clear();
                buttonBg.fillStyle(0x3867d6, 1);
                buttonBg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 10);
                buttonText.setScale(1.05);
            })
            .on('pointerout', () => {
                buttonBg.clear();
                buttonBg.fillStyle(0x4b7bec, 1);
                buttonBg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 10);
                buttonText.setScale(1);
            })
            .on('pointerdown', () => {
                buttonBg.clear();
                buttonBg.fillStyle(0x2d3436, 1);
                buttonBg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 10);
                buttonText.setScale(0.95);
            })
            .on('pointerup', callback);
        
        return { background: buttonBg, text: buttonText, hitArea };
    }
} 