import { GridShiftModel } from './GridShiftModel.js';

const SHIFT_LOCK_PX = 14; // movement before the swipe picks a row or a column
const SHIFT_FIRE_PX = 40; // movement along that line that triggers the slide

// Three tiers of five stages. Stages past the first tier give half-strength perks.
const ISLAND_MAX_LEVEL = 15;

export class GridShiftMain {
    constructor(model, audio, containerElement) {
        this.model = model;
        this.audio = audio;
        this.container = containerElement;
        this.width = 720;
        this.height = 1280;
        this.canvas = document.createElement('canvas');
        // alpha:false and desynchronized:true both reduce drawing cost and input-to-screen delay.
        this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
        this.dprCap = 2;
        try {
            const saved = Number(localStorage.getItem('gridshift-dpr'));
            if (saved >= 1 && saved <= 2) this.dprCap = saved;
        } catch (error) { /* storage unavailable */ }
        this.showFps = new URLSearchParams(location.search).has('fps');
        this.frameStats = { last: 0, frames: 0, ms: 0, avg: 0, fps: 0, windows: 0 };
        this.dragStartClock = 0;
        this.canvasRect = null;
        this.shiftGesture = null;
        this.flashTimer = 0;
        this.container.appendChild(this.canvas);

        this.screen = 'home';
        this.modal = '';
        this.mode = 'classic';
        this.secondsLeft = 120;
        this.crystals = 0;
        this.crystalsEarned = 0;
        this.bestScores = { classic: 0, fever: 0, shift: 0 };
        this.islandLevels = [0, 0, 0];
        this.stats = { linesCleared: 0, maxCombo: 0, totalCrystalsEarned: 0 };
        this.statHistory = [];
        this.achievementsUnlocked = {};
        this.cloudCarry = 0;
        this.daily = { date: '', best: 0, claimed: false, streak: 0, bestStreak: 0, lastDate: '' };
        this.runDailyKey = '';
        this.cloudBonusEarned = 0;
        this.theme = 'classic'; // 'classic', 'vaporwave', 'cyberpunk'
        this.unlockedThemes = { classic: true, vaporwave: false, cyberpunk: false };
        this.muted = false;
        this.tutorialDone = false;
        this.seenSpecials = {};
        this.tutorialStep = -1;

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
            tile0: './assets/runtime/tile_cyan.webp',
            tile1: './assets/runtime/tile_pink.webp',
            tile2: './assets/runtime/tile_violet.webp',
            tile3: './assets/runtime/tile_gold.webp',
            tile4: './assets/runtime/tile_lime.webp',
            tile5: './assets/runtime/tile_blue.webp',
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
        const dpr = Math.min(this.dprCap, Math.max(1, window.devicePixelRatio || 1));
        this.canvasRect = null;
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.touchAction = 'none';
    }

    // Drops canvas resolution if the game cannot hold about 40 fps, and remembers the choice.
    trackFrame(timestamp) {
        const s = this.frameStats;
        if (s.last) {
            const ms = timestamp - s.last;
            if (ms < 250) { s.frames++; s.ms += ms; }
        }
        s.last = timestamp;
        if (s.frames < 45) return;
        s.avg = s.ms / s.frames;
        s.fps = 1000 / s.avg;
        s.frames = 0;
        s.ms = 0;
        s.windows++;
        if (s.windows > 1 && s.avg > 24 && this.dprCap > 1) {
            this.dprCap = this.dprCap > 1.5 ? 1.5 : 1;
            try { localStorage.setItem('gridshift-dpr', String(this.dprCap)); } catch (error) { /* ignore */ }
            this.initCanvasSize();
        }
    }

    bindEvents() {
        const getPos = (event) => {
            const rect = this.canvasRect || (this.canvasRect = this.canvas.getBoundingClientRect());
            const point = event.changedTouches?.[0] || event;
            return {
                x: (point.clientX - rect.left) * this.width / rect.width,
                y: (point.clientY - rect.top) * this.height / rect.height
            };
        };
        this.canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            this.canvas.setPointerCapture?.(event.pointerId);
            this.canvasRect = null;
            this.pointerDown(getPos(event));
        });
        this.canvas.addEventListener('pointermove', (event) => {
            this.dragPosition = getPos(event);
            if (this.shiftGesture) this.shiftMove(this.dragPosition);
        });
        this.canvas.addEventListener('pointerup', (event) => {
            event.preventDefault();
            this.pointerUp(getPos(event));
        });
        this.canvas.addEventListener('pointercancel', () => { this.dragIndex = -1; this.shiftGesture = null; });
        window.addEventListener('resize', () => this.initCanvasSize());
    }

    pointerDown(pos) {
        if (this.screen === 'game' && !this.modal) {
            const slot = this.pieceAt(pos);
            if (slot >= 0) {
                this.dragIndex = slot;
                this.dragStartClock = this.clock;
                this.dragPosition = pos;
            } else if (this.model.shiftEnabled) {
                const cell = this.boardCellAt(pos);
                if (cell) this.shiftGesture = { startX: pos.x, startY: pos.y, cell, axis: null };
            }
        }
    }

    boardCellAt(pos) {
        const b = this.boardRect;
        if (!b || !this.cellSize) return null;
        const x = Math.floor((pos.x - b.x) / this.cellSize);
        const y = Math.floor((pos.y - b.y) / this.cellSize);
        return x >= 0 && x < 8 && y >= 0 && y < 8 ? { x, y } : null;
    }

    // One swipe: press a cell, drag along its row or column, and the line slides as soon
    // as the finger has travelled far enough. No release needed.
    shiftMove(pos) {
        const g = this.shiftGesture;
        if (!g || this.modal) return;
        const dx = pos.x - g.startX;
        const dy = pos.y - g.startY;
        if (!g.axis && Math.max(Math.abs(dx), Math.abs(dy)) > SHIFT_LOCK_PX) {
            g.axis = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col';
        }
        if (!g.axis) return;
        const travel = g.axis === 'row' ? dx : dy;
        if (Math.abs(travel) < SHIFT_FIRE_PX) return;
        this.shiftGesture = null;
        this.performShift(g.axis, g.axis === 'row' ? g.cell.y : g.cell.x, travel > 0 ? 1 : -1);
    }

    performShift(axis, index, dir) {
        const statsBefore = { linesCleared: this.stats.linesCleared, maxCombo: this.stats.maxCombo };
        const tierBefore = this.heatTier(this.model.heat);
        const outcome = this.model.shiftLine(axis, index, dir);
        if (!outcome.ok) {
            this.audio.playInvalid();
            this.vibrate(20);
            if (outcome.reason === 'nocharge') this.setStatus('No charges. Clear 3 lines to earn one.', 2);
            else if (outcome.reason === 'nochange') this.setStatus('Nothing to slide there.', 1.6);
            return false;
        }
        this.audio.unlockAndPlay();
        this.audio.playPlacement();
        this.statHistory.push(statsBefore);
        const excess = this.statHistory.length - this.model.history.length;
        if (excess > 0) this.statHistory.splice(0, excess);

        const step = this.cellSize;
        for (const move of outcome.moved) {
            if (this.model.board[move.toY][move.toX] === -1) continue; // cleared by the slide
            const targetX = this.boardRect.x + move.toX * step;
            const targetY = this.boardRect.y + move.toY * step;
            this.snapAnimations.set(`${move.toX},${move.toY}`, {
                color: move.color,
                slide: true,
                elapsed: 0,
                delay: 0,
                duration: 0.11,
                fromX: axis === 'row' ? targetX - dir * step : targetX,
                fromY: axis === 'col' ? targetY - dir * step : targetY,
                targetX,
                targetY
            });
        }
        if (outcome.cleared.length) this.spawnClearParticles(outcome.cleared);
        if (outcome.lines > 0) {
            this.audio.playClear(outcome.combo, outcome.lines);
            this.showPraise(outcome.lines, outcome.combo);
            this.stats.linesCleared += outcome.lines;
            this.stats.maxCombo = Math.max(this.stats.maxCombo, outcome.combo);
            if (outcome.lines >= 2 || outcome.combo >= 3) this.triggerShake(0.25, 10);
        }
        this.hapticForMove(outcome.lines, outcome.combo, false);
        this.heatFeedback(outcome, tierBefore);
        if (outcome.shift_gained > 0) this.setStatus('+1 Shift charge', 1.6);
        if (this.model.isStuck()) this.finishRun('stuck');
        return true;
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
        if (this.shiftGesture) {
            this.shiftGesture = null;
            return;
        }
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
            if (name === 'modal_share') this.shareDaily();
            return;
        }
        if (name === 'start_shift') this.startRun('shift');
        else if (name === 'start_classic') this.startRun('classic');
        else if (name === 'start_fever') this.startRun('fever');
        else if (name === 'start_daily') this.startRun('daily');
        else if (name === 'open_islands') this.screen = 'islands';
        else if (name === 'tutorial_skip') this.endTutorial();
        else if (name === 'toggle_theme') {
            const themes = ['classic', 'vaporwave', 'cyberpunk'];
            const nextIdx = (themes.indexOf(this.theme) + 1) % themes.length;
            this.theme = themes[nextIdx];
            this.setStatus(`Theme switched to ${this.themeName()}`, 1.5);
            this.saveProfile();
        }
        else if (name === 'back_home' || name === 'islands_home') this.goHome();
        else if (name === 'undo_move') {
            this.handleUndo();
        } else if (name === 'pause') {
            this.modal = 'paused';
            this.audio.pauseMusic();
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
            const previous = this.statHistory.pop();
            if (previous) {
                this.stats.linesCleared = previous.linesCleared;
                this.stats.maxCombo = previous.maxCombo;
            }
            this.crystals -= cost;
            this.saveProfile();
            this.audio.playUndo();
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
        const statsBefore = { linesCleared: this.stats.linesCleared, maxCombo: this.stats.maxCombo };
        const tierBefore = this.heatTier(this.model.heat);
        const outcome = this.model.placePiece(slot, origin);
        if (!outcome.ok) {
            this.audio.playInvalid();
            this.vibrate(20);
            const offBoard = placedCells.some(cell => cell.x < 0 || cell.x > 7 || cell.y < 0 || cell.y > 7);
            this.setStatus(offBoard ? 'Part of that piece is off the board.' : 'No room there. Pieces cannot overlap.', 1.8);
            return;
        }
        this.audio.unlockAndPlay();
        this.audio.playPlacement();
        this.statHistory.push(statsBefore);
        const excess = this.statHistory.length - this.model.history.length;
        if (excess > 0) this.statHistory.splice(0, excess);
        this.animatePlacedCells(placedCells, pieceColor, releaseLayout);
        this.tutorialAdvance('placed');
        const clearedCells = this.findClearedCells(beforeBoard, placedCells, pieceColor);
        if (clearedCells.length) this.spawnClearParticles(clearedCells);
        if (outcome.special) {
            this.audio.playSpecial(outcome.special);
            this.triggerShake(0.35, 14);
        }
        if (outcome.lines > 0) {
            this.audio.playClear(outcome.combo, outcome.lines);
            this.showPraise(outcome.lines, outcome.combo);
            this.tutorialAdvance('cleared');
            this.stats.linesCleared += outcome.lines;
            this.stats.maxCombo = Math.max(this.stats.maxCombo, outcome.combo);
            if (outcome.lines >= 2 || outcome.combo >= 3) {
                this.triggerShake(0.25, 10);
            }
        } else {
            this.audio.setHeat(1);
        }
        this.hapticForMove(outcome.lines, outcome.combo, Boolean(outcome.special));
        this.heatFeedback(outcome, tierBefore);
        if (outcome.shift_gained > 0) this.setStatus('+1 Shift charge', 1.6);
        if (this.model.isStuck()) this.finishRun('stuck');
        else if (this.model.shiftEnabled && this.model.noPieceFits()) this.setStatus('No room! Swipe a row or column to slide it.', 3.2);
    }

    startRun(mode) {
        this.mode = mode;
        let seed = null;
        if (mode === 'daily') {
            this.runDailyKey = this.dailyKey();
            seed = GridShiftModel.seedFromString(`gridshift:${this.runDailyKey}`);
        }
        this.model.reset(mode === 'daily' ? 'classic' : mode, seed);
        this.secondsLeft = 120;

        // Prismatic Falls Perk: +150 starting score per restored stage
        const prismaticLevel = this.perkLevel(1);
        // Not applied to the daily, so scores stay comparable between players.
        if (prismaticLevel > 0 && mode !== 'daily') this.model.score = prismaticLevel * 150;

        this.crystalsEarned = 0;
        this.runFinalized = false;
        this.statHistory = [];
        this.screen = 'game';
        this.modal = '';
        this.audio.unlockAndPlay();
        this.audio.setHeat(1);
        this.tutorialStep = (!this.tutorialDone && mode === 'classic') ? 0 : -1;
        this.shiftGesture = null;
        if (this.tutorialStep < 0) {
            this.setStatus(mode === 'shift'
                ? 'Swipe a row or column to slide it. Clear 3 lines to earn a charge.'
                : 'Drag pieces onto the board. Clear lines to make space.', 3.6);
        }
    }

    finishRun(reason) {
        if (this.runFinalized) return;
        this.runFinalized = true;
        if (this.tutorialStep >= 0) this.endTutorial();
        
        const baseCrystals = this.model.score <= 0 ? 0 : Math.min(50, Math.max(1, Math.floor(this.model.score / 650)));
        const skyHavenBonus = Math.floor(this.perkLevel(0));
        this.cloudBonusEarned = 0;
        // Only the first daily run of each day earns the 2x bonus.
        const multiplier = this.mode === 'daily' && !this.dailyClaimed(this.runDailyKey) ? 2 : 1;
        this.crystalsEarned = baseCrystals > 0
            ? this.applyCloudBonus((baseCrystals + skyHavenBonus) * multiplier)
            : 0;
        
        this.crystals += this.crystalsEarned;
        this.stats.totalCrystalsEarned += this.crystalsEarned;
        this.bestScores[this.mode] = Math.max(this.bestScores[this.mode] || 0, this.model.score);
        if (this.mode === 'daily') this.recordDaily();
        
        // Check Achievements
        if (this.stats.linesCleared >= 20) this.achievementsUnlocked['lines_20'] = true;
        if (this.stats.maxCombo >= 3) this.achievementsUnlocked['combo_3'] = true;
        if (this.crystals >= 50) this.achievementsUnlocked['crystals_50'] = true;

        this.saveProfile();
        this.modal = 'results';
        this.endReason = reason;
        this.audio.setHeat(1);
    }

    restoreIsland(index) {
        const level = this.islandLevels[index] || 0;
        if (level >= ISLAND_MAX_LEVEL) {
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
        this.setStatus((level + 1) % 5 === 0 ? 'Tier complete! A new tier is open.' : 'Island restored. Your progress is saved.', 2);
    }

    islandCost(level) { return 3 + level * 2; }

    islandMax() { return ISLAND_MAX_LEVEL; }

    islandTier(level) { return Math.min(2, Math.floor(level / 5)); }

    // Perk strength: full value for the first five stages, half value after that.
    perkLevel(index) {
        const level = Math.max(0, Math.min(ISLAND_MAX_LEVEL, Number(this.islandLevels?.[index]) || 0));
        return level <= 5 ? level : 5 + (level - 5) * 0.5;
    }

    dailyKey() { return new Date().toISOString().slice(0, 10); }

    dayBefore(key) {
        const date = new Date(`${key}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() - 1);
        return date.toISOString().slice(0, 10);
    }

    dailyClaimed(key) { return this.daily.date === key && this.daily.claimed; }

    dailyBestToday() { return this.daily.date === this.runDailyKey ? this.daily.best : 0; }

    currentStreak() {
        const today = this.dailyKey();
        const { lastDate, streak } = this.daily;
        return lastDate === today || lastDate === this.dayBefore(today) ? streak : 0;
    }

    dailyLabel() {
        const today = this.dailyKey();
        if (this.dailyClaimed(today)) return `DAILY ✓ ${this.daily.best}`;
        const streak = this.currentStreak();
        return streak > 0 ? `DAILY · 🔥 ${streak}` : 'DAILY CHALLENGE';
    }

    recordDaily() {
        const key = this.runDailyKey || this.dailyKey();
        const d = this.daily;
        if (d.date !== key) { d.date = key; d.best = 0; d.claimed = false; }
        d.best = Math.max(d.best, this.model.score);
        if (!d.claimed) {
            d.claimed = true;
            d.streak = d.lastDate === this.dayBefore(key) ? d.streak + 1 : 1;
            d.lastDate = key;
            d.bestStreak = Math.max(d.bestStreak, d.streak);
        }
        this.saveProfile();
    }

    async shareDaily() {
        const key = this.runDailyKey || this.dailyKey();
        const streak = this.currentStreak();
        const text = `GridShift Daily ${key}\n${this.model.score} pts${streak > 1 ? ` · ${streak}-day streak` : ''}\nCan you beat it?`;
        // Inside a portal iframe the page address isn't the game's public link, so share text only.
        const url = window.self === window.top ? location.href.split('#')[0] : '';
        const payload = url ? { title: 'GridShift Daily', text, url } : { title: 'GridShift Daily', text };
        try {
            if (navigator.share) {
                await navigator.share(payload);
                return;
            }
        } catch (error) {
            if (error?.name === 'AbortError') return;
        }
        try {
            await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
            this.setStatus('Result copied to clipboard.', 2);
        } catch (error) {
            this.setStatus('Could not share on this device.', 2);
        }
    }

    checkSpecialTips() {
        if (this.screen !== 'game' || this.modal || this.tutorialStep >= 0 || this.statusTimer > 0) return;
        const tips = {
            1: 'Bomb: clears a 3×3 area around its middle.',
            2: 'Lightning: clears the row and column through it.',
            3: 'Prism: fills gaps in nearly full lines it touches.'
        };
        for (const piece of this.model.tray) {
            if (!piece || piece.used || !piece.special || this.seenSpecials[piece.special]) continue;
            this.seenSpecials[piece.special] = true;
            this.setStatus(tips[piece.special], 4.5);
            this.saveProfile();
            return;
        }
    }

    tutorialAdvance(event) {
        if (this.tutorialStep < 0) return;
        if (this.tutorialStep === 0 && event === 'placed') this.tutorialStep = 1;
        else if (this.tutorialStep === 1 && event === 'cleared') this.tutorialStep = 2;
        else if (this.tutorialStep === 2 && event === 'placed') this.endTutorial();
    }

    endTutorial() {
        this.tutorialStep = -1;
        this.tutorialDone = true;
        this.saveProfile();
    }

    applyCloudBonus(amount) {
        const percent = 5 * this.perkLevel(2);
        if (percent <= 0) return amount;
        const total = amount * percent + (this.cloudCarry || 0);
        const whole = Math.floor(total / 100);
        this.cloudCarry = total % 100;
        this.cloudBonusEarned = whole;
        return amount + whole;
    }

    goHome() {
        this.screen = 'home';
        this.modal = '';
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

    heatTier(heat) { return heat >= 8 ? 3 : heat >= 5 ? 2 : heat >= 3 ? 1 : 0; }

    // Shared by placements and slides: heat audio, tier-up callouts and the Surge burst.
    heatFeedback(outcome, tierBefore) {
        this.audio.setHeat(this.model.heat);
        if (outcome.surge) {
            this.praise = { text: `SURGE ×${outcome.heat_before}!`, start: this.clock };
            this.flashTimer = 0.35;
            this.triggerShake(0.4, 16);
            this.vibrate([30, 30, 30, 30, 90]);
            return;
        }
        const tier = this.heatTier(this.model.heat);
        if (tier > tierBefore && outcome.lines > 0) {
            this.praise = { text: `HEAT ×${this.model.heat}`, start: this.clock };
        } else if (tier < tierBefore) {
            this.setStatus('Heat cooling down. Clear a line to build it back.', 1.8);
        }
    }

    hapticClear(lines, combo) {
        if (this.heatTier(this.model.heat) >= 2) this.vibrate([20, 24, 26, 24, 34, 24, 48]);
        else if (combo >= 3) this.vibrate([22, 28, 22, 34, 42]);
        else if (lines >= 3) this.vibrate([24, 34, 32]);
        else if (lines === 2) this.vibrate([18, 28, 22]);
        else this.vibrate(18);
    }

    hapticForMove(lines, combo, special = false) {
        if (lines > 0) this.hapticClear(lines, combo);
        else this.vibrate(special ? [18, 30, 24] : 12);
    }

    animatePlacedCells(cells, color, releaseLayout) {
        const duration = this.prefersReducedMotion ? 0.1 : 0.16;
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
        const tier = this.heatTier(this.model.heat);
        const count = this.prefersReducedMotion ? 1 : 3 + tier;
        const room = Math.max(0, 60 + tier * 12 - this.particles.length);
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
                    radius: (2 + Math.random() * 3) * (1 + tier * 0.2),
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
            this.bestScores = { classic: 0, fever: 0, shift: 0, ...(data.bestScores || {}) };
            this.islandLevels = Array.isArray(data.islandLevels)
                ? data.islandLevels.slice(0, 3).map(v => Math.max(0, Math.min(ISLAND_MAX_LEVEL, Math.floor(Number(v) || 0))))
                : [0, 0, 0];
            while (this.islandLevels.length < 3) this.islandLevels.push(0);
            this.stats = {
                linesCleared: Number(data.stats?.linesCleared) || 0,
                maxCombo: Number(data.stats?.maxCombo) || 0,
                totalCrystalsEarned: Number(data.stats?.totalCrystalsEarned) || 0
            };
            this.achievementsUnlocked = data.achievementsUnlocked || {};
            this.cloudCarry = Math.max(0, Math.min(99, Math.floor(Number(data.cloudCarry) || 0)));
            this.theme = ['classic', 'vaporwave', 'cyberpunk'].includes(data.theme) ? data.theme : 'classic';
            this.tutorialDone = data.tutorialDone === true || Object.values(this.bestScores).some(score => score > 0);
            this.seenSpecials = data.seenSpecials && typeof data.seenSpecials === 'object' ? data.seenSpecials : {};
            this.unlockedThemes = { classic: true, ...(data.unlockedThemes || {}) };
            const d = data.daily && typeof data.daily === 'object' ? data.daily : {};
            this.daily = {
                date: typeof d.date === 'string' ? d.date : '',
                best: Math.max(0, Number(d.best) || 0),
                claimed: d.claimed === true,
                streak: Math.max(0, Math.floor(Number(d.streak) || 0)),
                bestStreak: Math.max(0, Math.floor(Number(d.bestStreak) || 0)),
                lastDate: typeof d.lastDate === 'string' ? d.lastDate : ''
            };
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
                cloudCarry: this.cloudCarry,
                theme: this.theme,
                unlockedThemes: this.unlockedThemes,
                tutorialDone: this.tutorialDone,
                seenSpecials: this.seenSpecials,
                daily: this.daily
            }));
        } catch (error) {
            console.warn('Could not save GridShift profile:', error);
        }
    }

    update(delta) {
        this.clock += delta;
        this.statusTimer = Math.max(0, this.statusTimer - delta);
        this.checkSpecialTips();
        this.shakeTimer = Math.max(0, this.shakeTimer - delta);
        this.flashTimer = Math.max(0, this.flashTimer - delta);
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
