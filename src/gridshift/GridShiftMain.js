export class GridShiftMain {
    constructor(model, audio, containerElement) {
        this.model = model;
        this.audio = audio;
        this.container = containerElement;
        this.width = 720;
        this.height = 1280;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.screen = 'home';
        this.modal = '';
        this.mode = 'classic';
        this.secondsLeft = 120;
        this.crystals = 0;
        this.crystalsEarned = 0;
        this.bestScores = { classic: 0, fever: 0 };
        this.islandLevels = [0, 0, 0];
        this.muted = false;
        this.runFinalized = false;
        this.dragIndex = -1;
        this.dragPosition = { x: 0, y: 0 };
        this.boardRect = { x: 0, y: 0, width: 0, height: 0 };
        this.cellSize = 0;
        this.trayRects = [];
        this.buttonHits = {};
        this.statusMessage = '';
        this.statusTimer = 0;
        this.shiftArmed = false;
        this.selectedDirection = { axis: 'row', direction: -1, button: 'shift_left' };
        this.clock = 0;
        this.clearFlash = 0;
        this.assets = {};
        this.loadAssets();
        this.initCanvasSize();
        this.bindEvents();
        this.loadProfile();
        this.audio.setMuted(this.muted);
    }

    loadAssets() {
        const files = {
            plate: './assets/runtime/board_plate.webp',
            tile0: './assets/runtime/tile_cyan.webp',
            tile1: './assets/runtime/tile_pink.webp',
            tile2: './assets/runtime/tile_violet.webp',
            tile3: './assets/runtime/tile_gold.webp',
            tile4: './assets/runtime/tile_lime.webp',
            tile5: './assets/runtime/tile_blue.webp',
            arrowLeft: './assets/runtime/arrow_left.webp',
            arrowRight: './assets/runtime/arrow_right.webp',
            arrowUp: './assets/runtime/arrow_up.webp',
            arrowDown: './assets/runtime/arrow_down.webp',
            special1: './assets/runtime/special_bomb.webp',
            special2: './assets/runtime/special_lightning.webp',
            special3: './assets/runtime/special_prism.webp',
            burst: './assets/runtime/clear_burst.webp',
            island0: './assets/islands/sky_haven.webp',
            island1: './assets/islands/prismatic_falls.webp',
            island2: './assets/islands/neon_cyber_city.webp'
        };
        for (const [key, src] of Object.entries(files)) {
            const image = new Image();
            image.onload = () => { this.assets[key] = image; };
            image.src = src;
        }
    }

    initCanvasSize() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.touchAction = 'none';
    }

    bindEvents() {
        const getPos = (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const point = event.changedTouches?.[0] || event;
            return {
                x: (point.clientX - rect.left) * this.width / rect.width,
                y: (point.clientY - rect.top) * this.height / rect.height
            };
        };
        this.canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            this.canvas.setPointerCapture?.(event.pointerId);
            this.pointerDown(getPos(event));
        });
        this.canvas.addEventListener('pointermove', (event) => {
            this.dragPosition = getPos(event);
        });
        this.canvas.addEventListener('pointerup', (event) => {
            event.preventDefault();
            this.pointerUp(getPos(event));
        });
        this.canvas.addEventListener('pointercancel', () => { this.dragIndex = -1; });
        window.addEventListener('resize', () => this.initCanvasSize());
    }

    pointerDown(pos) {
        if (this.screen === 'game' && !this.modal && !this.shiftArmed) {
            const slot = this.pieceAt(pos);
            if (slot >= 0) {
                this.dragIndex = slot;
                this.dragPosition = pos;
            }
        }
    }

    pointerUp(pos) {
        if (this.dragIndex >= 0) {
            const slot = this.dragIndex;
            this.dragIndex = -1;
            if (this.screen === 'game' && !this.modal && this.isInsideBoard(pos)) {
                this.placeFromTray(slot, this.boardCellAt(pos));
            }
            return;
        }
        const button = this.buttonAt(pos);
        if (button) {
            this.handleButton(button);
            return;
        }
        if (this.screen === 'game' && !this.modal && this.shiftArmed && this.isInsideBoard(pos)) {
            this.shiftAt(this.boardCellAt(pos));
        }
    }

    pieceAt(pos) {
        for (let i = 0; i < this.trayRects.length; i++) {
            const r = this.trayRects[i];
            if (pos.x >= r.x && pos.x <= r.x + r.width && pos.y >= r.y && pos.y <= r.y + r.height) {
                if (this.model.tray[i] && !this.model.tray[i].used) return i;
            }
        }
        return -1;
    }

    buttonAt(pos) {
        for (const [name, rect] of Object.entries(this.buttonHits)) {
            if (pos.x >= rect.x && pos.x <= rect.x + rect.width && pos.y >= rect.y && pos.y <= rect.y + rect.height) return name;
        }
        return '';
    }

    isInsideBoard(pos) {
        return pos.x >= this.boardRect.x && pos.x <= this.boardRect.x + this.boardRect.width &&
            pos.y >= this.boardRect.y && pos.y <= this.boardRect.y + this.boardRect.height;
    }

    boardCellAt(pos) {
        return {
            x: Math.max(0, Math.min(Math.floor((pos.x - this.boardRect.x) / this.cellSize), 7)),
            y: Math.max(0, Math.min(Math.floor((pos.y - this.boardRect.y) / this.cellSize), 7))
        };
    }

    handleButton(name) {
        this.audio.playButton();
        if (name === 'sound_toggle') {
            this.toggleSound();
            return;
        }
        if (this.modal) {
            if (name === 'modal_resume') this.modal = '';
            if (name === 'modal_restart') this.startRun(this.mode);
            if (name === 'modal_home') this.goHome();
            return;
        }
        if (name === 'start_classic') this.startRun('classic');
        else if (name === 'start_fever') this.startRun('fever');
        else if (name === 'open_islands') this.screen = 'islands';
        else if (name === 'back_home' || name === 'islands_home') this.goHome();
        else if (name === 'undo_move') {
            this.handleUndo();
        } else if (name === 'pause') {
            this.modal = 'paused';
            this.shiftArmed = false;
            this.audio.pauseMusic();
        } else if (name === 'shift_toggle') {
            if (this.model.shiftCharges <= 0) {
                this.setStatus('Clear a line to earn a Shift Charge.', 1.8);
            } else {
                this.shiftArmed = !this.shiftArmed;
                this.setStatus(this.shiftArmed ? 'Choose a direction, then tap a row or column.' : 'Shift cancelled.', 1.8);
            }
        } else if (name.startsWith('shift_')) {
            const directions = {
                shift_left: { axis: 'row', direction: -1, button: name },
                shift_right: { axis: 'row', direction: 1, button: name },
                shift_up: { axis: 'col', direction: -1, button: name },
                shift_down: { axis: 'col', direction: 1, button: name }
            };
            if (directions[name]) {
                this.selectedDirection = directions[name];
                this.shiftArmed = true;
                this.setStatus('Tap a cell in the line you want to shift.', 1.8);
            }
        } else if (name.startsWith('restore_')) {
            this.restoreIsland(Number(name.slice(-1)));
        }
    }

    handleUndo() {
        if (this.model.history.length === 0) {
            this.setStatus('No moves to undo.', 1.5);
            return;
        }
        const cost = 2;
        if (this.crystals < cost) {
            this.setStatus(`Need ${cost} Aether Crystals to Undo!`, 2.0);
            return;
        }
        if (this.model.undo()) {
            this.crystals -= cost;
            this.saveProfile();
            this.audio.playShift();
            this.vibrate(40);
            this.setStatus('Move undone! (-2 Crystals)', 1.8);
        }
    }

    placeFromTray(slot, origin) {
        const outcome = this.model.placePiece(slot, origin, this.mode === 'fever');
        if (!outcome.ok) {
            this.audio.playInvalid();
            this.vibrate(20);
            this.setStatus('That shape needs empty cells inside the board.', 1.8);
            return;
        }
        this.audio.unlockAndPlay();
        this.audio.playPlacement();
        this.vibrate(30);
        if (outcome.special) {
            this.audio.playSpecial(outcome.special);
            this.vibrate([50, 30, 50]);
        }
        if (outcome.lines > 0) {
            this.audio.playClear(outcome.combo, outcome.lines);
            this.vibrate([40, 50, 40]);
            this.clearFlash = 0.45;
            this.setStatus(`${outcome.lines} line${outcome.lines === 1 ? '' : 's'} cleared`, 1.5);
        } else {
            this.audio.setComboIntensity(0);
            this.setStatus('Nice placement. Find the next clear.', 1.5);
        }
        if (this.model.isStuck()) this.finishRun('stuck');
    }

    shiftAt(cell) {
        const { axis, direction } = this.selectedDirection;
        const index = axis === 'row' ? cell.y : cell.x;
        const result = this.model.shiftLine(axis === 'row' ? 'row' : 'col', index, direction, this.mode === 'fever');
        if (!result.ok) {
            this.setStatus('No Shift Charges available.', 1.5);
            this.shiftArmed = false;
            this.vibrate(20);
            return;
        }
        this.audio.unlockAndPlay();
        this.audio.playShift();
        this.vibrate([30, 30]);
        if (result.lines > 0) {
            this.audio.playClear(result.combo, result.lines);
            this.vibrate([40, 50, 40]);
            this.clearFlash = 0.45;
            this.setStatus(`Shift cleared ${result.lines} line${result.lines === 1 ? '' : 's'}!`, 1.5);
        } else {
            this.audio.setComboIntensity(0);
            this.setStatus('Line shifted. Keep building.', 1.5);
        }
        this.shiftArmed = false;

        // Neon Cyber-City Perk: 5% chance per stage to refund the shift charge used
        const cyberLevel = this.islandLevels[2] || 0;
        if (cyberLevel > 0 && Math.random() < cyberLevel * 0.05) {
            this.model.shiftCharges = Math.min(3, this.model.shiftCharges + 1);
            this.setStatus(`Cyber-City perk refunded a Shift Charge!`, 2.0);
        }

        if (this.model.isStuck()) this.finishRun('stuck');
    }

    startRun(mode) {
        this.mode = mode;
        this.model.reset(mode);
        this.secondsLeft = 120;
        
        // Prismatic Falls Perk: +150 starting score per restored stage
        const prismaticLevel = this.islandLevels[1] || 0;
        if (prismaticLevel > 0) {
            this.model.score = prismaticLevel * 150;
        }

        this.crystalsEarned = 0;
        this.runFinalized = false;
        this.shiftArmed = false;
        this.screen = 'game';
        this.modal = '';
        this.audio.unlockAndPlay();
        this.audio.setComboIntensity(0);
        this.setStatus('Drag a piece onto the board. Clear lines to earn shifts.', 3.2);
    }

    finishRun(reason) {
        if (this.runFinalized) return;
        this.runFinalized = true;
        
        const baseCrystals = this.model.score <= 0 ? 0 : Math.min(50, Math.max(1, Math.floor(this.model.score / 650)));
        // Sky Haven Perk: +1 bonus crystal per restored stage
        const skyHavenBonus = this.islandLevels[0] || 0;
        this.crystalsEarned = baseCrystals > 0 ? baseCrystals + skyHavenBonus : 0;
        
        this.crystals += this.crystalsEarned;
        this.bestScores[this.mode] = Math.max(this.bestScores[this.mode] || 0, this.model.score);
        this.saveProfile();
        this.modal = 'results';
        this.shiftArmed = false;
        this.endReason = reason;
        this.audio.setComboIntensity(0);
    }

    restoreIsland(index) {
        const level = this.islandLevels[index] || 0;
        if (level >= 5) {
            this.setStatus('That island is fully restored.', 1.8);
            return;
        }
        const cost = this.islandCost(level);
        if (this.crystals < cost) {
            this.setStatus(`You need ${cost} crystals for the next stage.`, 2);
            return;
        }
        this.crystals -= cost;
        this.islandLevels[index] = level + 1;
        this.saveProfile();
        this.setStatus('Island restored. Your progress is saved.', 2);
    }

    islandCost(level) { return 3 + level * 2; }

    goHome() {
        this.screen = 'home';
        this.modal = '';
        this.shiftArmed = false;
        this.audio.unlockAndPlay();
    }

    vibrate(pattern) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Ignore if permissions/device block vibration
            }
        }
    }

    toggleSound() {
        this.muted = !this.muted;
        this.audio.setMuted(this.muted);
        this.saveProfile();
    }

    setStatus(message, seconds = 1.8) {
        this.statusMessage = message;
        this.statusTimer = seconds;
    }

    loadProfile() {
        try {
            const raw = localStorage.getItem('gridshift_profile');
            if (!raw) return;
            const data = JSON.parse(raw);
            this.crystals = Number(data.crystals) || 0;
            this.muted = Boolean(data.muted);
            this.bestScores = { classic: 0, fever: 0, ...(data.bestScores || {}) };
            this.islandLevels = Array.isArray(data.islandLevels) ? data.islandLevels.slice(0, 3) : [0, 0, 0];
            while (this.islandLevels.length < 3) this.islandLevels.push(0);
        } catch (error) {
            console.warn('Could not load GridShift profile:', error);
        }
    }

    saveProfile() {
        try {
            localStorage.setItem('gridshift_profile', JSON.stringify({
                crystals: this.crystals,
                muted: this.muted,
                bestScores: this.bestScores,
                islandLevels: this.islandLevels
            }));
        } catch (error) {
            console.warn('Could not save GridShift profile:', error);
        }
    }

    update(delta) {
        this.clock += delta;
        this.statusTimer = Math.max(0, this.statusTimer - delta);
        this.clearFlash = Math.max(0, this.clearFlash - delta);
        if (this.screen === 'game' && !this.modal && this.mode === 'fever') {
            this.secondsLeft = Math.max(0, this.secondsLeft - delta);
            if (this.secondsLeft <= 0) this.finishRun('time');
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.buttonHits = {};
        this.trayRects = [];
        this.ctx.fillStyle = '#071326';
        this.ctx.fillRect(0, 0, this.width, this.height);
        if (this.screen === 'home') this.renderHome();
        else if (this.screen === 'game') this.renderGame();
        else this.renderIslands();
        if (this.modal) this.renderModal();
    }

    drawImageCover(image, x, y, width, height) {
        if (!image) return;
        const scale = Math.max(width / image.width, height / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        this.ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    drawBackdrop(image, alpha = 0.34) {
        if (!image) return;
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.drawImageCover(image, 0, 0, this.width, this.height);
        this.ctx.restore();
    }

    renderHome() {
        this.drawBackdrop(this.assets.island2, 0.32);
        this.ctx.fillStyle = 'rgba(3, 11, 27, 0.52)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#f4f7ff';
        this.ctx.font = '800 66px system-ui, sans-serif';
        this.ctx.shadowColor = '#37dff6';
        this.ctx.shadowBlur = 24;
        this.ctx.fillText('GRIDSHIFT', 360, 220);
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#77f2ed';
        this.ctx.font = '700 21px system-ui, sans-serif';
        this.ctx.fillText('BREAK  •  BUILD  •  SHIFT', 360, 264);
        this.ctx.fillStyle = '#d6e6f7';
        this.ctx.font = '20px system-ui, sans-serif';
        this.ctx.fillText('Place neon-glass shapes. Clear lines. Reshape the board.', 360, 326);
        this.drawButton('start_classic', { x: 145, y: 440, width: 430, height: 82 }, 'CLASSIC ENDLESS', '#54e5df');
        this.drawButton('start_fever', { x: 145, y: 544, width: 430, height: 82 }, 'FEVER RUSH · 2 MIN', '#ff76b5');
        this.drawButton('open_islands', { x: 145, y: 648, width: 430, height: 72 }, 'ISLAND BUILDER', '#927cff');
        this.drawButton('sound_toggle', { x: 250, y: 758, width: 220, height: 54 }, this.muted ? 'SOUND OFF' : 'SOUND ON', '#284b75');
        this.ctx.fillStyle = '#d7e5fa';
        this.ctx.font = '18px system-ui, sans-serif';
        this.ctx.fillText(`Best Classic  ${this.bestScores.classic || 0}     ·     Best Fever  ${this.bestScores.fever || 0}`, 360, 890);
        this.ctx.fillStyle = '#72f0dc';
        this.ctx.fillText(`Aether Crystals: ${this.crystals}`, 360, 930);
        this.ctx.fillStyle = '#a4b7d0';
        this.ctx.font = '16px system-ui, sans-serif';
        this.ctx.fillText('Tap a game mode to play. Progress is saved on this device.', 360, 1015);
    }

    renderGame() {
        this.ctx.fillStyle = '#f1f5ff';
        this.ctx.textAlign = 'left';
        this.ctx.font = '700 26px system-ui, sans-serif';
        this.ctx.fillText(this.mode === 'fever' ? 'FEVER RUSH' : 'CLASSIC ENDLESS', 34, 66);
        this.ctx.fillStyle = '#b8c9df';
        this.ctx.font = '17px system-ui, sans-serif';
        this.ctx.fillText(`SCORE  ${this.model.score}`, 34, 103);
        if (this.mode === 'fever') this.ctx.fillText(`TIME  ${Math.ceil(this.secondsLeft)}s`, 34, 133);
        else this.ctx.fillText(`BEST  ${this.bestScores.classic || 0}`, 34, 133);
        const canUndo = this.model.history.length > 0 && this.crystals >= 2;
        this.drawButton('undo_move', { x: 474, y: 44, width: 104, height: 50 }, 'UNDO ↺', canUndo ? '#e68a36' : '#324259');
        this.drawButton('pause', { x: 590, y: 44, width: 96, height: 50 }, 'PAUSE', '#657c9d');

        const boardSize = 560;
        const frame = { x: 80, y: 185, width: boardSize, height: boardSize };
        if (this.assets.plate) this.ctx.drawImage(this.assets.plate, frame.x, frame.y, frame.width, frame.height);
        else {
            this.ctx.fillStyle = '#122342';
            this.ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
        }
        const inset = 31;
        const activeSize = boardSize - inset * 2;
        this.boardRect = { x: frame.x + inset, y: frame.y + inset, width: activeSize, height: activeSize };
        this.cellSize = activeSize / 8;
        this.ctx.fillStyle = 'rgba(5, 15, 35, 0.88)';
        this.ctx.fillRect(this.boardRect.x, this.boardRect.y, activeSize, activeSize);
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const px = this.boardRect.x + x * this.cellSize;
                const py = this.boardRect.y + y * this.cellSize;
                const val = this.model.board[y][x];
                if (val >= 0) {
                    const tile = this.assets[`tile${val % 6}`];
                    if (tile) this.ctx.drawImage(tile, px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);
                    else {
                        this.ctx.fillStyle = '#58e5dc';
                        this.ctx.fillRect(px + 4, py + 4, this.cellSize - 8, this.cellSize - 8);
                    }
                } else {
                    this.ctx.strokeStyle = 'rgba(148, 185, 223, 0.14)';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);
                }
            }
        }

        // Render Ghost Preview when dragging a piece over the board
        if (this.dragIndex >= 0 && this.isInsideBoard(this.dragPosition)) {
            const piece = this.model.tray[this.dragIndex];
            const origin = this.boardCellAt(this.dragPosition);
            const canFit = piece && this.model.canPlace(piece.cells, origin);
            if (piece) {
                this.ctx.save();
                this.ctx.globalAlpha = canFit ? 0.45 : 0.2;
                const ghostTile = this.assets[`tile${piece.color % 6}`];
                for (const cell of piece.cells) {
                    const gx = origin.x + cell.x;
                    const gy = origin.y + cell.y;
                    if (gx >= 0 && gx < 8 && gy >= 0 && gy < 8) {
                        const px = this.boardRect.x + gx * this.cellSize;
                        const py = this.boardRect.y + gy * this.cellSize;
                        if (ghostTile) {
                            this.ctx.drawImage(ghostTile, px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);
                        } else {
                            this.ctx.fillStyle = canFit ? '#58e5dc' : '#ff4a7c';
                            this.ctx.fillRect(px + 4, py + 4, this.cellSize - 8, this.cellSize - 8);
                        }
                    }
                }
                this.ctx.restore();
            }
        }

        if (this.clearFlash > 0) {
            this.ctx.fillStyle = `rgba(103, 247, 243, ${this.clearFlash * 0.14})`;
            this.ctx.fillRect(this.boardRect.x, this.boardRect.y, activeSize, activeSize);
            if (this.assets.burst) {
                this.ctx.save();
                this.ctx.globalAlpha = Math.min(1, this.clearFlash / 0.45);
                this.ctx.drawImage(this.assets.burst, this.width / 2 - 170, this.boardRect.y + activeSize / 2 - 170, 340, 340);
                this.ctx.restore();
            }
        }

        const controlsY = 778;
        const isSelected = (name) => this.selectedDirection.button === name;
        this.drawButton('shift_toggle', { x: 20, y: controlsY, width: 120, height: 52 }, this.shiftArmed ? 'CANCEL' : `SHIFT  ${this.model.shiftCharges}`, this.shiftArmed ? '#ff81c0' : '#178c9b');
        this.drawArrowButton('shift_left', { x: 151, y: controlsY, width: 106, height: 52 }, 'ROW', 'arrowLeft', isSelected('shift_left') ? '#65dbe6' : '#263d61');
        this.drawArrowButton('shift_right', { x: 263, y: controlsY, width: 106, height: 52 }, 'ROW', 'arrowRight', isSelected('shift_right') ? '#65dbe6' : '#263d61');
        this.drawArrowButton('shift_up', { x: 375, y: controlsY, width: 106, height: 52 }, 'COL', 'arrowUp', isSelected('shift_up') ? '#65dbe6' : '#263d61');
        this.drawArrowButton('shift_down', { x: 487, y: controlsY, width: 106, height: 52 }, 'COL', 'arrowDown', isSelected('shift_down') ? '#65dbe6' : '#263d61');
        this.ctx.fillStyle = '#b9cbe0';
        this.ctx.textAlign = 'center';
        this.ctx.font = '13px system-ui, sans-serif';
        this.ctx.fillText('CHARGES', 650, controlsY + 20);
        this.ctx.fillStyle = '#76f1df';
        this.ctx.font = '700 22px system-ui, sans-serif';
        this.ctx.fillText(String(this.model.shiftCharges), 650, controlsY + 44);
        this.ctx.fillStyle = this.shiftArmed ? '#81f5df' : '#9bb0ca';
        this.ctx.font = '15px system-ui, sans-serif';
        this.ctx.fillText(this.shiftArmed ? 'Select a direction, then tap the target row or column.' : 'Drag pieces onto the board. Clear a line to earn a SHIFT.', 360, 855);

        const trayY = 890;
        for (let i = 0; i < 3; i++) {
            const rect = { x: 30 + i * 225, y: trayY, width: 210, height: 190 };
            this.trayRects.push(rect);
            this.ctx.fillStyle = 'rgba(15, 31, 58, 0.92)';
            this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            this.ctx.strokeStyle = 'rgba(117, 178, 226, 0.38)';
            this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            const piece = this.model.tray[i];
            if (!piece || piece.used) continue;
            const maxX = Math.max(...piece.cells.map(c => c.x)) + 1;
            const maxY = Math.max(...piece.cells.map(c => c.y)) + 1;
            const size = Math.min(35, 112 / maxX, 100 / maxY);
            const originX = rect.x + (rect.width - maxX * size) / 2;
            const originY = rect.y + 42 + (105 - maxY * size) / 2;
            const tile = this.assets[`tile${piece.color % 6}`];
            for (const cell of piece.cells) {
                const x = originX + cell.x * size;
                const y = originY + cell.y * size;
                if (tile) this.ctx.drawImage(tile, x, y, size - 2, size - 2);
                else {
                    this.ctx.fillStyle = '#5bdfe6';
                    this.ctx.fillRect(x + 2, y + 2, size - 5, size - 5);
                }
            }
            if (piece.special) {
                const specialIcon = this.assets[`special${piece.special}`];
                if (specialIcon) this.ctx.drawImage(specialIcon, rect.x + rect.width / 2 - 20, rect.y + 145, 40, 40);
                else {
                    this.ctx.fillStyle = '#f4dc7b';
                    this.ctx.font = '700 13px system-ui, sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(['', 'BOMB', 'ARC', 'PRISM'][piece.special] || 'SPECIAL', rect.x + rect.width / 2, rect.y + 171);
                }
            }
        }
        // Render dragged piece attached to pointer
        if (this.dragIndex >= 0) {
            const piece = this.model.tray[this.dragIndex];
            if (piece && !piece.used) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.88;
                const floatSize = this.cellSize > 0 ? this.cellSize * 0.85 : 40;
                const offsetX = this.dragPosition.x;
                const offsetY = this.dragPosition.y - 70;
                const tile = this.assets[`tile${piece.color % 6}`];
                for (const cell of piece.cells) {
                    const px = offsetX + cell.x * floatSize - 20;
                    const py = offsetY + cell.y * floatSize - 20;
                    if (tile) {
                        this.ctx.drawImage(tile, px, py, floatSize - 2, floatSize - 2);
                    } else {
                        this.ctx.fillStyle = '#58e5dc';
                        this.ctx.fillRect(px, py, floatSize - 4, floatSize - 4);
                    }
                }
                this.ctx.restore();
            }
        }

        if (this.statusTimer > 0 && this.statusMessage) {
            this.ctx.fillStyle = 'rgba(5, 12, 28, 0.82)';
            this.ctx.fillRect(70, 1100, 580, 44);
            this.ctx.fillStyle = '#e8f3ff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '16px system-ui, sans-serif';
            this.ctx.fillText(this.statusMessage, 360, 1128);
        }
    }

    renderIslands() {
        this.drawBackdrop(this.assets.island0, 0.26);
        this.ctx.fillStyle = 'rgba(4, 12, 29, 0.76)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#f5f7ff';
        this.ctx.font = '700 38px system-ui, sans-serif';
        this.ctx.fillText('ISLAND BUILDER', 360, 92);
        this.ctx.fillStyle = '#83f1e2';
        this.ctx.font = '20px system-ui, sans-serif';
        this.ctx.fillText(`Aether Crystals: ${this.crystals}`, 360, 132);
        const names = ['Sky Haven', 'Prismatic Falls', 'Neon Cyber-City'];
        for (let i = 0; i < 3; i++) {
            const x = 24 + i * 228;
            const y = 205;
            const w = 216;
            const h = 500;
            this.ctx.fillStyle = 'rgba(17, 34, 63, 0.94)';
            this.ctx.fillRect(x, y, w, h);
            this.ctx.strokeStyle = 'rgba(112, 216, 234, 0.52)';
            this.ctx.strokeRect(x, y, w, h);
            const img = this.assets[`island${i}`];
            if (img) this.drawImageCover(img, x + 12, y + 16, w - 24, 158);
            this.ctx.fillStyle = '#f4f7ff';
            this.ctx.font = '700 18px system-ui, sans-serif';
            this.ctx.fillText(names[i], x + w / 2, y + 210);
            const level = Math.max(0, Math.min(5, Number(this.islandLevels[i]) || 0));
            this.ctx.fillStyle = '#bfcee2';
            this.ctx.font = '16px system-ui, sans-serif';
            this.ctx.fillText(`Restored: ${level} / 5`, x + w / 2, y + 252);
            
            this.ctx.fillStyle = '#7bece0';
            this.ctx.font = '13px system-ui, sans-serif';
            const perkTexts = [
                `Perk: +${level} Crystal${level === 1 ? '' : 's'} / run`,
                `Perk: +${level * 150} Start Score`,
                `Perk: ${level * 5}% Shift Refund`
            ];
            this.ctx.fillText(perkTexts[i], x + w / 2, y + 278);

            this.ctx.fillStyle = '#bdf7ee';
            this.ctx.font = '14px system-ui, sans-serif';
            this.ctx.fillText(level >= 5 ? 'Fully restored' : `Next: ${this.islandCost(level)} crystals`, x + w / 2, y + 312);

            this.drawButton(`restore_${i}`, { x: x + 22, y: y + 344, width: w - 44, height: 58 }, level >= 5 ? 'COMPLETE' : 'RESTORE', level >= 5 ? '#42665f' : '#48b8b9');
            this.ctx.fillStyle = '#9fb5d0';
            this.ctx.font = '14px system-ui, sans-serif';
            this.ctx.fillText('Tap to restore a stage', x + w / 2, y + 444);
        }
        this.drawButton('islands_home', { x: 248, y: 830, width: 224, height: 62 }, '← HOME', '#586b91');
        if (this.statusTimer > 0 && this.statusMessage) {
            this.ctx.fillStyle = '#e5f3ff';
            this.ctx.font = '16px system-ui, sans-serif';
            this.ctx.fillText(this.statusMessage, 360, 954);
        }
    }

    renderModal() {
        this.ctx.fillStyle = 'rgba(3, 7, 18, 0.78)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        const rect = { x: 92, y: 390, width: 536, height: 470 };
        this.ctx.fillStyle = '#142543';
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.strokeStyle = '#63d8e5';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#f4f7ff';
        this.ctx.font = '700 34px system-ui, sans-serif';
        this.ctx.fillText(this.modal === 'paused' ? 'PAUSED' : 'RUN COMPLETE', 360, rect.y + 72);
        if (this.modal === 'results') {
            this.ctx.fillStyle = '#c9d9ed';
            this.ctx.font = '20px system-ui, sans-serif';
            this.ctx.fillText(`Score: ${this.model.score}`, 360, rect.y + 126);
            this.ctx.fillText(`Crystals earned: ${this.crystalsEarned}`, 360, rect.y + 161);
        }
        if (this.modal === 'paused') {
            this.drawButton('modal_resume', { x: 146, y: rect.y + 190, width: 428, height: 58 }, 'RESUME', '#54e5df');
            this.drawButton('modal_restart', { x: 146, y: rect.y + 265, width: 428, height: 58 }, 'RESTART', '#ff76b5');
            this.drawButton('modal_home', { x: 146, y: rect.y + 340, width: 428, height: 58 }, 'HOME', '#927cff');
        } else {
            this.drawButton('modal_restart', { x: 146, y: rect.y + 235, width: 428, height: 58 }, 'PLAY AGAIN', '#54e5df');
            this.drawButton('modal_home', { x: 146, y: rect.y + 315, width: 428, height: 58 }, 'HOME', '#927cff');
        }
    }

    drawArrowButton(name, rect, label, iconKey, color) {
        this.buttonHits[name] = rect;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.strokeStyle = 'rgba(235, 249, 255, 0.4)';
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        const icon = this.assets[iconKey];
        if (icon) this.ctx.drawImage(icon, rect.x + 5, rect.y + 5, 42, 42);
        this.ctx.fillStyle = '#071326';
        this.ctx.font = '700 14px system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, rect.x + 77, rect.y + rect.height / 2);
        this.ctx.textBaseline = 'alphabetic';
    }

    drawButton(name, rect, label, color) {
        this.buttonHits[name] = rect;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.strokeStyle = 'rgba(235, 249, 255, 0.4)';
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.fillStyle = '#071326';
        this.ctx.font = `700 ${rect.height < 56 ? 15 : 18}px system-ui, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
        this.ctx.textBaseline = 'alphabetic';
    }
}
