import { GridShiftModel } from './GridShiftModel.js';
import { skinColors } from './GridShiftRender.js';
import {
    makeContracts, updateContracts, seededRandom, snapshotProgress, restoreProgress
} from './GridShiftContracts.js';
import { findTheme, findSkin, isUnlocked, newlyUnlocked, unlockLabel } from './GridShiftUnlocks.js';

const SHIFT_LOCK_PX = 14;  // movement before the swipe picks a row or a column
const SHIFT_FIRE_PX = 40;  // movement along that line that triggers the slide

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
        this.bestScores = { classic: 0, shift: 0, daily: 0 };
        this.stats = { linesCleared: 0, maxCombo: 0 };
        this.statHistory = [];
        this.stars = 0;
        this.contracts = [];
        this.runStars = 0;
        this.newUnlocks = [];
        this.undosLeft = 1;
        this.tileSkin = 'primary'; // 'primary', 'candy', 'retro'
        this.daily = { date: '', best: 0, claimed: false, streak: 0, bestStreak: 0, lastDate: '' };
        this.runDailyKey = '';
        this.theme = 'classic'; // 'classic', 'vaporwave', 'cyberpunk'
        this.muted = false;
        this.tutorialDone = false;
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
        // View-only effect state (the model never sees any of this).
        this.endReason = '';
        this.praise = null;
        this.trauma = 0;          // 0..1 screen-shake energy, decays in update()
        this.hitStop = 0;         // seconds of frozen animation after a big clear
        this.dyingTiles = [];     // cleared tiles that are still playing their exit
        this.floaters = [];       // floating +score text
        this.displayScore = 0;    // eased number shown in the HUD
        this.lastScore = 0;
        this.scorePop = 0;
        this.dragVx = 0;
        this.lastMoveT = 0;
        this.returnAnim = null;   // piece flying back to the tray after an off-board release
        this.activePointer = null;
        this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
        this.initCanvasSize();
        this.bindEvents();
        this.loadProfile();
        this.audio.setMuted(this.muted);
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
        // Only one pointer drives the game at a time, so a second finger cannot hijack a drag.
        this.canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            if (this.activePointer !== null) return;
            this.activePointer = event.pointerId;
            this.canvas.setPointerCapture?.(event.pointerId);
            this.canvasRect = null;
            this.dragVx = 0;
            this.lastMoveT = event.timeStamp;
            this.pointerDown(getPos(event));
        });
        this.canvas.addEventListener('pointermove', (event) => {
            if (this.activePointer !== null && event.pointerId !== this.activePointer) return;
            const previous = this.dragPosition;
            this.dragPosition = getPos(event);
            const dt = (event.timeStamp - this.lastMoveT) / 1000;
            if (this.dragIndex >= 0 && dt > 0 && dt < 0.2) {
                this.dragVx = this.dragVx * 0.6 + ((this.dragPosition.x - previous.x) / dt) * 0.4;
            }
            this.lastMoveT = event.timeStamp;
            if (this.shiftGesture) this.shiftMove(this.dragPosition);
        });
        this.canvas.addEventListener('pointerup', (event) => {
            event.preventDefault();
            if (event.pointerId !== this.activePointer) return;
            this.activePointer = null;
            this.pointerUp(getPos(event));
        });
        this.canvas.addEventListener('pointercancel', (event) => {
            if (event.pointerId !== this.activePointer) return;
            this.activePointer = null;
            this.dragIndex = -1;
            this.shiftGesture = null;
        });
        // Closing the tab mid-run still banks the score.
        window.addEventListener('pagehide', () => this.bankRunIfAbandoned());
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
        // Past SHIFT_FIRE_PX the slide is armed and previewed; it commits on release and
        // cancels if the finger comes back, so a sloppy drag no longer burns a charge.
        if (Math.abs(travel) >= SHIFT_FIRE_PX) g.pending = travel > 0 ? 1 : -1;
        else if (Math.abs(travel) < SHIFT_FIRE_PX * 0.5) g.pending = 0;
    }

    performShift(axis, index, dir) {
        const statsBefore = { linesCleared: this.stats.linesCleared, maxCombo: this.stats.maxCombo, contracts: snapshotProgress(this.contracts) };
        const tierBefore = this.heatTier(this.model.heat);
        const scoreBefore = this.model.score;
        const outcome = this.model.shiftLine(axis, index, dir);
        if (!outcome.ok) {
            this.audio.playInvalid();
            this.vibrate(20);
            if (outcome.reason === 'nocharge') this.setStatus('No charges. Clear 3 lines to earn one.', 2);
            else if (outcome.reason === 'nochange') this.setStatus('Nothing to slide there.', 1.6);
            return false;
        }
        this.audio.unlockAndPlay();
        if (this.audio.playSlide) this.audio.playSlide(); else this.audio.playPlacement();
        this.statHistory.push(statsBefore);
        const excess = this.statHistory.length - this.model.history.length;
        if (excess > 0) this.statHistory.splice(0, excess);

        const step = this.cellSize;
        for (const move of outcome.moved) {
            if (this.model.board[move.toY][move.toX] === -1) continue; // cleared by the slide
            const wrapped = Math.abs(move.toX - move.fromX) > 1 || Math.abs(move.toY - move.fromY) > 1;
            if (wrapped) {
                // The tile leaving one edge slides out while its twin slides in from the other edge.
                const outX = this.boardRect.x + move.fromX * step;
                const outY = this.boardRect.y + move.fromY * step;
                this.snapAnimations.set(`exit:${move.fromX},${move.fromY}`, {
                    color: move.color, slide: true, exit: true, elapsed: 0, delay: 0, duration: 0.16,
                    fromX: outX, fromY: outY,
                    targetX: outX + (axis === 'row' ? dir * step : 0),
                    targetY: outY + (axis === 'col' ? dir * step : 0)
                });
            }
            const targetX = this.boardRect.x + move.toX * step;
            const targetY = this.boardRect.y + move.toY * step;
            this.snapAnimations.set(`${move.toX},${move.toY}`, {
                color: move.color,
                slide: true,
                elapsed: 0,
                delay: 0,
                duration: 0.16,
                fromX: axis === 'row' ? targetX - dir * step : targetX,
                fromY: axis === 'col' ? targetY - dir * step : targetY,
                targetX,
                targetY
            });
        }
        if (outcome.cleared.length) this.spawnClearParticles(outcome.cleared);
        this.clearFeedback?.(outcome, outcome.cleared, scoreBefore);
        if (outcome.lines > 0) {
            this.audio.playClear(outcome.combo, outcome.lines);
            this.showPraise(outcome.lines, outcome.combo);
            this.stats.linesCleared += outcome.lines;
            this.stats.maxCombo = Math.max(this.stats.maxCombo, outcome.combo);
            if (outcome.lines >= 2 || outcome.combo >= 3) this.triggerShake(0.25, 10);
        }
        this.hapticForMove(outcome.lines, outcome.combo);
        this.heatFeedback(outcome, tierBefore);
        if (outcome.shift_gained > 0) this.setStatus('+1 Shift charge', 1.6);
        this.recordMove('slide', outcome);
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
        const origin = this.resolveOrigin(piece.cells, (left - this.boardRect.x) / size, (top - this.boardRect.y) / size);
        const overlapsBoard = piece.cells.some(c =>
            origin.x + c.x >= 0 && origin.x + c.x < 8 && origin.y + c.y >= 0 && origin.y + c.y < 8);
        return { piece, size, left, top, origin, overlapsBoard };
    }

    // Rounds the dragged position to a board cell. If that spot is illegal, snaps to the
    // nearest legal origin within one cell, so a drop that is a hair off still lands.
    resolveOrigin(cells, fx, fy) {
        const base = { x: Math.round(fx), y: Math.round(fy) };
        if (!Number.isFinite(fx) || !Number.isFinite(fy)) return base;
        if (!this.model?.canPlace || this.model.canPlace(cells, base)) return base;
        let best = null;
        let bestDist = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const origin = { x: base.x + dx, y: base.y + dy };
                if (!this.model.canPlace(cells, origin)) continue;
                const dist = (origin.x - fx) ** 2 + (origin.y - fy) ** 2;
                if (dist < bestDist) { bestDist = dist; best = origin; }
            }
        }
        return best || base;
    }

    pointerUp(pos) {
        if (this.shiftGesture) {
            const g = this.shiftGesture;
            this.shiftGesture = null;
            if (g.pending && g.axis && this.screen === 'game' && !this.modal) {
                this.performShift(g.axis, g.axis === 'row' ? g.cell.y : g.cell.x, g.pending);
            }
            return;
        }
        if (this.dragIndex >= 0) {
            const slot = this.dragIndex;
            this.dragPosition = pos;
            const layout = this.dragLayout();
            this.dragIndex = -1;
            if (this.screen === 'game' && !this.modal && layout && layout.overlapsBoard) {
                this.placeFromTray(slot, layout.origin, layout);
            } else if (layout && !this.prefersReducedMotion) {
                this.returnAnim = { slot, x: layout.left, y: layout.top, size: layout.size, age: 0, dur: 0.12 };
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
            if (name === 'modal_restart') { this.bankRunIfAbandoned(); this.startRun(this.mode); }
            if (name === 'modal_home') { this.bankRunIfAbandoned(); this.goHome(); }
            if (name === 'modal_share') this.shareDaily();
            return;
        }
        if (name === 'start_shift') this.startRun('shift');
        else if (name === 'start_classic') this.startRun('classic');
        else if (name === 'start_daily') this.startRun('daily');
        else if (name === 'open_locker') this.screen = 'locker';
        else if (name === 'tutorial_skip') this.endTutorial();
        else if (name.startsWith('theme_')) this.equipTheme(name.slice(6));
        else if (name.startsWith('skin_')) this.equipSkin(name.slice(5));
        else if (name === 'back_home') this.goHome();
        else if (name === 'undo_move') {
            this.handleUndo();
        } else if (name === 'pause') {
            this.modal = 'paused';
            this.audio.pauseMusic();
        }
    }

    handleUndo() {
        if (this.model.history.length === 0) {
            this.setStatus('No moves to undo.', 1.5);
            return;
        }
        if (this.undosLeft <= 0) {
            this.setStatus('No undos left this run.', 1.8);
            return;
        }
        if (this.model.undo()) {
            const previous = this.statHistory.pop();
            if (previous) {
                this.stats.linesCleared = previous.linesCleared;
                this.stats.maxCombo = previous.maxCombo;
                restoreProgress(this.contracts, previous.contracts);
            }
            this.undosLeft--;
            this.audio.playUndo();
            this.vibrate(40);
            this.setStatus('Move undone. No undos left this run.', 1.8);
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
        const statsBefore = { linesCleared: this.stats.linesCleared, maxCombo: this.stats.maxCombo, contracts: snapshotProgress(this.contracts) };
        const tierBefore = this.heatTier(this.model.heat);
        const scoreBefore = this.model.score;
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
        this.clearFeedback?.(outcome, clearedCells, scoreBefore);
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
        this.hapticForMove(outcome.lines, outcome.combo);
        this.heatFeedback(outcome, tierBefore);
        if (outcome.shift_gained > 0) this.setStatus('+1 Shift charge', 1.6);
        this.recordMove('place', outcome);
        if (this.model.isStuck()) this.finishRun('stuck');
        else if (this.model.shiftEnabled && this.model.noPieceFits()) this.setStatus('No room! Swipe a row or column to slide it.', 3.2);
    }

    startRun(mode) {
        this.mode = mode;
        let seed = null;
        let rand = Math.random;
        if (mode === 'daily') {
            this.runDailyKey = this.dailyKey();
            seed = GridShiftModel.seedFromString(`gridshift:${this.runDailyKey}`);
            rand = seededRandom(GridShiftModel.seedFromString(`contracts:${this.runDailyKey}`));
        }
        // The Daily plays by Shift rules, with the same pieces and contracts for everyone.
        this.model.reset(mode === 'classic' ? 'classic' : 'shift', seed);
        this.contracts = makeContracts(mode === 'classic' ? 'classic' : 'shift', rand);
        this.runStars = 0;
        this.newUnlocks = [];
        this.undosLeft = 1;
        this.runFinalized = false;
        this.statHistory = [];
        this.displayScore = 0;
        this.lastScore = 0;
        this.trauma = 0;
        this.hitStop = 0;
        this.dyingTiles = [];
        this.floaters = [];
        this.returnAnim = null;
        this.screen = 'game';
        this.modal = '';
        this.audio.unlockAndPlay();
        this.audio.setHeat(1);
        this.tutorialStep = (!this.tutorialDone && mode === 'classic') ? 0 : -1;
        this.shiftGesture = null;
        if (this.tutorialStep < 0) {
            this.setStatus(mode === 'classic'
                ? 'Drag pieces onto the board. Finish contracts to earn stars.'
                : 'Swipe a row or column to slide it. Finish contracts to earn stars.', 3.6);
        }
    }

    // A run left through Pause -> Start over / Home still counts: best score and Daily are saved.
    bankRunIfAbandoned() {
        if (this.screen === 'game' && !this.runFinalized && this.model.score > 0) this.finishRun('quit', true);
    }

    finishRun(reason, silent = false) {
        if (this.runFinalized) return;
        this.runFinalized = true;
        if (this.tutorialStep >= 0) this.endTutorial();

        this.bestScores[this.mode] = Math.max(this.bestScores[this.mode] || 0, this.model.score);
        if (this.mode === 'daily') this.recordDaily();

        this.saveProfile();
        if (!silent) this.modal = 'results';
        this.endReason = reason;
        this.audio.setHeat(1);
    }

    // Called after every successful move: advances contracts and awards stars as soon as
    // a contract is done, so quitting mid-run never loses them.
    recordMove(kind, outcome) {
        const finished = updateContracts(this.contracts, {
            kind,
            lines: outcome.lines,
            combo: outcome.combo,
            heat: this.model.heat,
            score: this.model.score,
            surge: Boolean(outcome.surge)
        });
        if (!finished.length) return;
        const before = this.stars;
        let earned = 0;
        for (const contract of finished) {
            contract.doneAt = this.clock;
            earned += contract.stars;
        }
        this.stars += earned;
        this.runStars += earned;
        const unlocked = newlyUnlocked(before, this.stars);
        this.newUnlocks.push(...unlocked);
        this.saveProfile();
        this.audio.playContract();
        this.vibrate([25, 40, 25]);
        this.setStatus(unlocked.length
            ? `NEW UNLOCK: ${unlockLabel(unlocked[0])}!`
            : `Contract complete! +${earned} star${earned === 1 ? '' : 's'}`, unlocked.length ? 3.4 : 2.4);
    }

    equipTheme(id) {
        const item = findTheme(id);
        if (!item) return;
        if (!isUnlocked(item, this.stars)) {
            this.setStatus(`${item.stars - this.stars} more stars to unlock ${item.name}.`, 2);
            return;
        }
        this.theme = id;
        this.saveProfile();
    }

    equipSkin(id) {
        const item = findSkin(id);
        if (!item) return;
        if (!isUnlocked(item, this.stars)) {
            this.setStatus(`${item.stars - this.stars} more stars to unlock ${item.name} tiles.`, 2);
            return;
        }
        this.tileSkin = id;
        this.saveProfile();
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
            this.flashTimer = this.prefersReducedMotion ? 0 : 0.35;
            this.triggerShake(0.4, 16);
            this.triggerHitStop?.(0.16);
            this.audio.playSurge?.();
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

    hapticForMove(lines, combo) {
        if (lines > 0) this.hapticClear(lines, combo);
        else this.vibrate(12);
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
                delay: index * 0.01,
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
        const colors = skinColors(this.tileSkin);
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
            this.muted = Boolean(data.muted);
            const best = data.bestScores || {};
            this.bestScores = {
                classic: Math.max(0, Number(best.classic) || 0),
                shift: Math.max(0, Number(best.shift) || 0),
                daily: Math.max(0, Number(best.daily) || 0)
            };
            this.stats = {
                linesCleared: Number(data.stats?.linesCleared) || 0,
                maxCombo: Number(data.stats?.maxCombo) || 0
            };
            this.stars = Math.max(0, Math.floor(Number(data.stars) || 0));
            const theme = findTheme(data.theme);
            this.theme = theme && isUnlocked(theme, this.stars) ? theme.id : 'classic';
            const skin = findSkin(data.tileSkin);
            this.tileSkin = skin && isUnlocked(skin, this.stars) ? skin.id : 'primary';
            this.tutorialDone = data.tutorialDone === true || Object.values(this.bestScores).some(score => score > 0);
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
                muted: this.muted,
                bestScores: this.bestScores,
                stats: this.stats,
                stars: this.stars,
                theme: this.theme,
                tileSkin: this.tileSkin,
                tutorialDone: this.tutorialDone,
                daily: this.daily
            }));
        } catch (error) {
            console.warn('Could not save GridShift profile:', error);
        }
    }

    update(delta) {
        // Hit-stop freezes animation (not input or the HUD easing) for a few frames after a big clear.
        const live = this.hitStop > 0 ? 0 : delta;
        this.hitStop = Math.max(0, this.hitStop - delta);
        if (this.modal !== 'paused') this.clock += live;
        this.statusTimer = Math.max(0, this.statusTimer - delta);
        this.shakeTimer = Math.max(0, this.shakeTimer - delta);
        this.flashTimer = Math.max(0, this.flashTimer - delta);
        this.trauma = Math.max(0, (this.trauma || 0) - delta * 1.6);
        this.dragVx = (this.dragVx || 0) * Math.exp(-delta * 8);

        const target = this.model.score;
        if (target !== this.lastScore) this.scorePop = 0.18;
        this.lastScore = target;
        this.scorePop = Math.max(0, (this.scorePop || 0) - delta);
        if (!Number.isFinite(this.displayScore)) this.displayScore = target;
        this.displayScore += (target - this.displayScore) * (1 - Math.exp(-12 * delta));
        if (Math.abs(target - this.displayScore) < 1) this.displayScore = target;

        for (const [key, animation] of this.snapAnimations) {
            animation.elapsed += live;
            if (animation.elapsed >= animation.delay + animation.duration) this.snapAnimations.delete(key);
        }
        if (this.returnAnim) {
            this.returnAnim.age += live;
            if (this.returnAnim.age >= this.returnAnim.dur) this.returnAnim = null;
        }
        // In-place compaction: no new arrays every frame.
        const drag = Math.pow(0.94, live * 60);
        let kept = 0;
        for (const particle of this.particles) {
            particle.age += live;
            if (particle.age >= particle.life) continue;
            particle.x += particle.vx * live;
            particle.y += particle.vy * live;
            particle.vy += particle.gravity * live;
            particle.vx *= drag;
            this.particles[kept++] = particle;
        }
        this.particles.length = kept;
        this.dyingTiles = (this.dyingTiles || []).filter(tile => (tile.age += live) < tile.delay + tile.life);
        this.floaters = (this.floaters || []).filter(item => (item.age += live) < item.life);
    }

    // Legacy signature kept: duration/intensity map onto trauma (intensity 18 = full).
    triggerShake(duration = 0.3, intensity = 12) {
        if (this.prefersReducedMotion) return;
        this.shakeTimer = duration;
        this.shakeIntensity = intensity;
        this.addTrauma(intensity / 18);
    }

    addTrauma(amount) {
        if (this.prefersReducedMotion) return;
        this.trauma = Math.min(1, (this.trauma || 0) + amount);
    }

    triggerHitStop(seconds) {
        if (this.prefersReducedMotion) return;
        this.hitStop = Math.max(this.hitStop || 0, seconds);
    }

    // One call per clearing move: shake, hit-stop, the wave dissolve and the floating score.
    clearFeedback(outcome, cells, scoreBefore) {
        const lines = outcome.lines | 0;
        if (lines <= 0) return;
        if (lines === 1) this.addTrauma(0.18);
        this.triggerHitStop(lines >= 3 ? 0.12 : lines === 2 ? 0.09 : 0.06);
        this.spawnDyingTiles(cells);
        const gain = (outcome.score ?? 0) - scoreBefore;
        if (gain > 0) this.spawnFloater(gain, cells);
    }

    cellsCentroid(cells) {
        let sx = 0, sy = 0;
        for (const cell of cells) { sx += cell.x; sy += cell.y; }
        return { x: sx / cells.length, y: sy / cells.length };
    }

    // Cleared tiles leave the model instantly, so the view keeps them alive for a short
    // dissolve that ripples outward from the middle of the clear (22 ms per cell of distance).
    spawnDyingTiles(cells) {
        if (this.prefersReducedMotion || !cells?.length) return;
        const mid = this.cellsCentroid(cells);
        for (const cell of cells.slice(0, 64)) {
            const dist = Math.hypot(cell.x - mid.x, cell.y - mid.y);
            this.dyingTiles.push({ x: cell.x, y: cell.y, color: cell.color, age: 0, delay: dist * 0.022, life: 0.17 });
        }
    }

    spawnFloater(gain, cells) {
        if (!cells?.length || !this.boardRect) return;
        const mid = this.cellsCentroid(cells);
        const text = `+${String(gain).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
        this.floaters.push({
            text,
            x: this.boardRect.x + (mid.x + 0.5) * this.cellSize,
            y: this.boardRect.y + (mid.y + 0.5) * this.cellSize,
            age: 0, life: 0.8, heat: this.model.heat, tier: this.heatTier(this.model.heat)
        });
        if (this.floaters.length > 6) this.floaters.shift();
    }
}
