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
        this.stats = { linesCleared: 0, maxCombo: 0, totalCrystalsEarned: 0 };
        this.achievementsUnlocked = {};
        this.theme = 'classic'; // 'classic', 'vaporwave', 'cyberpunk'
        this.unlockedThemes = { classic: true, vaporwave: false, cyberpunk: false };
        this.muted = false;

        this.runFinalized = false;
        this.dragIndex = -1;
        this.dragPosition = { x: 0, y: 0 };
        this.dragLift = 90;
        this.boardRect = { x: 0, y: 0, width: 0, height: 0 };
        this.cellSize = 0;
        this.trayRects = [];
        this.buttonHits = {};
        this.statusMessage = '';
        this.statusTimer = 0;
        this.shiftArmed = false;
        this.selectedDirection = { axis: 'row', direction: -1, button: 'shift_left' };
        this.clock = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.snapAnimations = new Map();
        this.particles = [];
        this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
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
        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    dragLayout() {
        const piece = this.model.tray[this.dragIndex];
        if (!piece || piece.used || !this.cellSize) return null;
        const size = this.cellSize;
        const cols = Math.max(...piece.cells.map(c => c.x)) + 1;
        const rows = Math.max(...piece.cells.map(c => c.y)) + 1;
        const left = this.dragPosition.x - (cols * size) / 2;
        const top = this.dragPosition.y - this.dragLift - rows * size;
        const origin = {
            x: Math.round((left - this.boardRect.x) / size),
            y: Math.round((top - this.boardRect.y) / size)
        };
        const overlapsBoard = piece.cells.some(c =>
            origin.x + c.x >= 0 && origin.x + c.x < 8 && origin.y + c.y >= 0 && origin.y + c.y < 8);
        return { piece, size, left, top, origin, overlapsBoard };
    }

    pointerUp(pos) {
        if (this.dragIndex >= 0) {
            const slot = this.dragIndex;
            this.dragPosition = pos;
            const layout = this.dragLayout();
            this.dragIndex = -1;
            if (this.screen === 'game' && !this.modal && layout && layout.overlapsBoard) {
                this.placeFromTray(slot, layout.origin, layout);
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
        else if (name === 'start_daily') this.startRun('daily');
        else if (name === 'open_islands') this.screen = 'islands';
        else if (name === 'toggle_theme') {
            const themes = ['classic', 'vaporwave', 'cyberpunk'];
            const nextIdx = (themes.indexOf(this.theme) + 1) % themes.length;
            this.theme = themes[nextIdx];
            this.setStatus(`Theme switched to ${this.theme.toUpperCase()}`, 1.5);
            this.saveProfile();
        }
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

    placeFromTray(slot, origin, releaseLayout = null) {
        const beforeBoard = this.model.board.map(row => row.slice());
        const piece = this.model.tray[slot];
        const placedCells = piece?.cells.map(cell => ({
            x: origin.x + cell.x, y: origin.y + cell.y,
            localX: cell.x, localY: cell.y
        })) || [];
        const pieceColor = piece?.color ?? 0;
        const outcome = this.model.placePiece(slot, origin, this.mode === 'fever');
        if (!outcome.ok) {
            this.audio.playInvalid();
            this.vibrate(20);
            this.setStatus('That shape needs empty cells inside the board.', 1.8);
            return;
        }
        this.audio.unlockAndPlay();
        this.audio.playPlacement();
        this.animatePlacedCells(placedCells, pieceColor, releaseLayout);
        const clearedCells = this.findClearedCells(beforeBoard, placedCells, pieceColor);
        if (clearedCells.length) this.spawnClearParticles(clearedCells);
        if (outcome.special) {
            this.audio.playSpecial(outcome.special);
            this.triggerShake(0.35, 14);
        }
        if (outcome.lines > 0) {
            this.audio.playClear(outcome.combo, outcome.lines);
            this.showPraise(outcome.lines, outcome.combo);
            this.stats.linesCleared += outcome.lines;
            this.stats.maxCombo = Math.max(this.stats.maxCombo, outcome.combo);
            if (outcome.lines >= 2 || outcome.combo >= 3) {
                this.triggerShake(0.25, 10);
            }
        } else {
            this.audio.setComboIntensity(0);
        }
        this.hapticForMove(outcome.lines, outcome.combo, Boolean(outcome.special));
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
        if (result.lines > 0) {
            this.audio.playClear(result.combo, result.lines);
            this.showPraise(result.lines, result.combo);
        } else {
            this.audio.setComboIntensity(0);
        }
        this.hapticForMove(result.lines, result.combo);
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
        this.model.reset(mode === 'daily' ? 'classic' : mode);
        this.secondsLeft = 120;
        if (mode === 'daily') {
            this.model.shiftCharges = 2; // Daily bonus
        }
        
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
        const skyHavenBonus = this.islandLevels[0] || 0;
        const multiplier = this.mode === 'daily' ? 2 : 1;
        this.crystalsEarned = baseCrystals > 0 ? (baseCrystals + skyHavenBonus) * multiplier : 0;
        
        this.crystals += this.crystalsEarned;
        this.stats.totalCrystalsEarned += this.crystalsEarned;
        this.bestScores[this.mode] = Math.max(this.bestScores[this.mode] || 0, this.model.score);
        
        // Check Achievements
        if (this.stats.linesCleared >= 20) this.achievementsUnlocked['lines_20'] = true;
        if (this.stats.maxCombo >= 3) this.achievementsUnlocked['combo_3'] = true;
        if (this.crystals >= 50) this.achievementsUnlocked['crystals_50'] = true;

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
        if (typeof navigator !== 'undefined' && navigator.vibrate &&
            (typeof document === 'undefined' || document.visibilityState !== 'hidden')) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Ignore if permissions/device block vibration
            }
        }
    }

    hapticClear(lines, combo) {
        if (combo >= 3) this.vibrate([22, 28, 22, 34, 42]);
        else if (lines >= 3) this.vibrate([24, 34, 32]);
        else if (lines === 2) this.vibrate([18, 28, 22]);
        else this.vibrate(18);
    }

    hapticForMove(lines, combo, special = false) {
        if (lines > 0) this.hapticClear(lines, combo);
        else this.vibrate(special ? [18, 30, 24] : 12);
    }

    animatePlacedCells(cells, color, releaseLayout) {
        const duration = this.prefersReducedMotion ? 0.14 : 0.26;
        cells.forEach((cell, index) => {
            if (this.model.board[cell.y]?.[cell.x] !== color) return;
            const targetX = this.boardRect.x + cell.x * this.cellSize;
            const targetY = this.boardRect.y + cell.y * this.cellSize;
            this.snapAnimations.set(`${cell.x},${cell.y}`, {
                color,
                elapsed: 0,
                delay: index * 0.018,
                duration,
                fromX: releaseLayout ? releaseLayout.left + cell.localX * releaseLayout.size : targetX,
                fromY: releaseLayout ? releaseLayout.top + cell.localY * releaseLayout.size : targetY - 26,
                targetX,
                targetY
            });
        });
    }

    findClearedCells(beforeBoard, placedCells, placedColor) {
        const placed = new Set(placedCells.map(cell => `${cell.x},${cell.y}`));
        const cleared = [];
        for (let y = 0; y < this.model.board.length; y++) {
            for (let x = 0; x < this.model.board[y].length; x++) {
                if (this.model.board[y][x] !== -1) continue;
                const wasFilled = beforeBoard[y][x] !== -1;
                const wasJustPlaced = placed.has(`${x},${y}`);
                if (wasFilled || wasJustPlaced) {
                    cleared.push({ x, y, color: wasFilled ? beforeBoard[y][x] : placedColor });
                }
            }
        }
        return cleared;
    }

    spawnClearParticles(cells) {
        const colors = ['#4dcbb4', '#f28da9', '#a987db', '#f3ba50', '#9bcf59', '#66a9e8'];
        const count = this.prefersReducedMotion ? 1 : 3;
        const room = Math.max(0, 60 - this.particles.length);
        const cap = this.particles.length + room;
        for (const cell of cells.slice(0, 24)) {
            for (let i = 0; i < count && this.particles.length < cap; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 45 + Math.random() * 115;
                this.particles.push({
                    x: this.boardRect.x + (cell.x + 0.5) * this.cellSize,
                    y: this.boardRect.y + (cell.y + 0.5) * this.cellSize,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 45,
                    gravity: 170,
                    age: 0,
                    life: this.prefersReducedMotion ? 0.28 : 0.52 + Math.random() * 0.18,
                    radius: 2 + Math.random() * 3,
                    color: colors[cell.color % colors.length]
                });
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
            this.stats = {
                linesCleared: Number(data.stats?.linesCleared) || 0,
                maxCombo: Number(data.stats?.maxCombo) || 0,
                totalCrystalsEarned: Number(data.stats?.totalCrystalsEarned) || 0
            };
            this.achievementsUnlocked = data.achievementsUnlocked || {};
            this.theme = ['classic', 'vaporwave', 'cyberpunk'].includes(data.theme) ? data.theme : 'classic';
            this.unlockedThemes = { classic: true, ...(data.unlockedThemes || {}) };
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
                islandLevels: this.islandLevels,
                stats: this.stats,
                achievementsUnlocked: this.achievementsUnlocked,
                theme: this.theme,
                unlockedThemes: this.unlockedThemes
            }));
        } catch (error) {
            console.warn('Could not save GridShift profile:', error);
        }
    }

    update(delta) {
        this.clock += delta;
        this.statusTimer = Math.max(0, this.statusTimer - delta);
        this.shakeTimer = Math.max(0, this.shakeTimer - delta);
        for (const [key, animation] of this.snapAnimations) {
            animation.elapsed += delta;
            if (animation.elapsed >= animation.delay + animation.duration) this.snapAnimations.delete(key);
        }
        for (const particle of this.particles) {
            particle.age += delta;
            particle.x += particle.vx * delta;
            particle.y += particle.vy * delta;
            particle.vy += particle.gravity * delta;
            particle.vx *= Math.pow(0.94, delta * 60);
        }
        this.particles = this.particles.filter(particle => particle.age < particle.life);
        if (this.screen === 'game' && !this.modal && this.mode === 'fever') {
            this.secondsLeft = Math.max(0, this.secondsLeft - delta);
            if (this.secondsLeft <= 0) this.finishRun('time');
        }
    }

    triggerShake(duration = 0.3, intensity = 12) {
        this.shakeTimer = duration;
        this.shakeIntensity = intensity;
    }
}
