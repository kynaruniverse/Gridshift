import { DEFAULT_RULES, makeRules } from './GridShiftRules.js';
import { rngAdvance, rngValue } from './GridShiftRng.js';

export class GridShiftModel {
    static SIZE = 8;

    static SHAPES = [
        [{ x: 0, y: 0 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
        [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
        [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
        [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
        [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
        [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }]
    ];
    static COLOR_IDS = 6;
    // One weight per entry in SHAPES, same order. Higher means more common.
    static SHAPE_WEIGHTS = [3, 5, 5, 5, 6, 4, 4, 4, 3, 3, 2, 2, 2, 4, 2, 2, 2];

    // Shift mode: slide a row or column one cell (wrapping) by spending a charge.
    // These statics mirror DEFAULT_RULES; a run reads its own copy from this.rules.
    static SHIFT_START_CHARGES = DEFAULT_RULES.shiftStartCharges;
    static SHIFT_MAX_CHARGES = DEFAULT_RULES.shiftMaxCharges;
    static SHIFT_LINES_PER_CHARGE = DEFAULT_RULES.shiftLinesPerCharge;

    // Heat: every clear builds a score multiplier, and one free miss is allowed.
    static HEAT_MAX = DEFAULT_RULES.heatMax;
    static HEAT_GRACE_MISSES = DEFAULT_RULES.heatGraceMisses;
    static HEAT_AFTER_SURGE = DEFAULT_RULES.heatAfterSurge;
    static SURGE_BONUS = DEFAULT_RULES.surgeBonus;

    // Turns text such as "gridshift:2026-10-31" into a stable 32-bit seed (FNV-1a).
    static seedFromString(text) {
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    constructor() {
        this.board = [];
        this.tray = [];
        this.score = 0;
        this.combo = 0;
        this.piecesPlaced = 0;
        this.mode = "classic";
        this.history = [];
        this.seeded = false;
        this.seedBase = 0;
        this.trayCount = 0;
        this.rngState = 0;
        this.shiftEnabled = false;
        this.shiftCharges = 0;
        this.shiftProgress = 0;
        this.heat = 1;
        this.heatMisses = 0;
        this.overdrive = 0;
        this.rules = makeRules();
    }


    reset(newMode = "classic", seed = null, rules = null) {
        this.rules = makeRules(rules || {});
        this.overdrive = 0;
        this.mode = newMode;
        this.board = this._emptyBoard(-1);
        this.tray = [];
        this.score = 0;
        this.combo = 0;
        this.piecesPlaced = 0;
        this.history = [];
        this.seeded = seed !== null;
        this.seedBase = this.seeded ? seed >>> 0 : 0;
        this.trayCount = 0;
        this.shiftEnabled = newMode === 'shift';
        this.shiftCharges = this.shiftEnabled ? this.rules.shiftStartCharges : 0;
        this.shiftProgress = 0;
        this.heat = 1;
        this.heatMisses = 0;
        this._dealTray();
    }

    _emptyBoard(value) {
        const result = [];
        for (let y = 0; y < GridShiftModel.SIZE; y++) {
            const row = new Array(GridShiftModel.SIZE).fill(value);
            result.push(row);
        }
        return result;
    }

    _dealTray() {
        if (this.seeded) {
            // Seeded (daily) trays depend only on the seed and the tray number, so every
            // player sees the same pieces no matter how they played the earlier ones.
            this.rngState = (this.seedBase + Math.imul(this.trayCount + 1, 0x9E3779B1)) >>> 0;
            this.trayCount++;
            this.tray = this._rollTray();
            return;
        }
        for (let attempt = 0; attempt < 25; attempt++) {
            this.tray = this._rollTray();
            if (this.canAnyPieceFit()) return;
        }
        const keep = this.tray[0];
        this.tray[0] = {
            cells: JSON.parse(JSON.stringify(GridShiftModel.SHAPES[0])),
            color: keep.color,
            used: false
        };
    }

    _random() {
        if (this.seeded) {
            this.rngState = rngAdvance(this.rngState);
            return rngValue(this.rngState);
        }
        return (this.rng || Math.random)();
    }

    _pickShapeIndex(crowd, taken) {
        const shapes = GridShiftModel.SHAPES;
        const weights = shapes.map((shape, index) => {
            if (taken.has(index)) return 0;
            let weight = GridShiftModel.SHAPE_WEIGHTS[index] ?? 3;
            if (shape.length >= 5) weight *= Math.max(0.2, 1 - crowd * 0.8);
            else if (shape.length <= 2) weight *= 1 + crowd;
            return weight;
        });
        let roll = this._random() * weights.reduce((sum, w) => sum + w, 0);
        let last = 0;
        for (let i = 0; i < weights.length; i++) {
            if (weights[i] <= 0) continue;
            last = i;
            roll -= weights[i];
            if (roll < 0) return i;
        }
        return last;
    }

    _rollTray() {
        let filled = 0;
        for (const row of this.board) for (const cell of row) if (cell !== -1) filled++;
        const crowd = this.seeded ? 0.3 : filled / (GridShiftModel.SIZE * GridShiftModel.SIZE);
        const taken = new Set();
        const tray = [];
        for (let i = 0; i < 3; i++) {
            const shapeIndex = this._pickShapeIndex(crowd, taken);
            taken.add(shapeIndex);
            tray.push({
                cells: JSON.parse(JSON.stringify(GridShiftModel.SHAPES[shapeIndex])),
                color: Math.floor(this._random() * GridShiftModel.COLOR_IDS),
                used: false
            });
        }
        return tray;
    }

    canPlace(cells, origin) {
        for (const offset of cells) {
            const x = origin.x + offset.x;
            const y = origin.y + offset.y;
            if (x < 0 || x >= GridShiftModel.SIZE || y < 0 || y >= GridShiftModel.SIZE) {
                return false;
            }
            if (this.board[y][x] !== -1) {
                return false;
            }
        }
        return true;
    }

    saveSnapshot() {
        this.history.push(JSON.stringify({
            board: this.board,
            tray: this.tray,
            score: this.score,
            combo: this.combo,
            piecesPlaced: this.piecesPlaced,
            trayCount: this.trayCount,
            shiftCharges: this.shiftCharges,
            shiftProgress: this.shiftProgress,
            heat: this.heat,
            heatMisses: this.heatMisses,
            overdrive: this.overdrive
        }));
        if (this.history.length > 5) this.history.shift();
    }

    undo() {
        if (this.history.length === 0) return false;
        const snapshot = JSON.parse(this.history.pop());
        this.board = snapshot.board;
        this.tray = snapshot.tray;
        this.score = snapshot.score;
        this.combo = snapshot.combo;
        this.piecesPlaced = snapshot.piecesPlaced;
        this.trayCount = snapshot.trayCount ?? this.trayCount;
        this.shiftCharges = snapshot.shiftCharges ?? this.shiftCharges;
        this.shiftProgress = snapshot.shiftProgress ?? this.shiftProgress;
        this.heat = snapshot.heat ?? this.heat;
        this.heatMisses = snapshot.heatMisses ?? this.heatMisses;
        this.overdrive = snapshot.overdrive ?? 0;
        return true;
    }

    placePiece(slot, origin) {
        if (slot < 0 || slot >= this.tray.length) return { ok: false };
        const piece = this.tray[slot];
        if (piece.used) return { ok: false };
        const cells = piece.cells;
        if (!this.canPlace(cells, origin)) return { ok: false };

        this.saveSnapshot();

        const color = piece.color;
        const placedCells = [];
        for (const offset of cells) {
            const cell = { x: origin.x + offset.x, y: origin.y + offset.y };
            this.board[cell.y][cell.x] = color;
            placedCells.push(cell);
        }
        piece.used = true;
        this.piecesPlaced++;

        const linesData = this._clearFullLines();
        const lineCount = linesData.lines;
        const lineCells = linesData.cells;
        
        if (lineCount > 0) {
            this.combo++;
        } else {
            this.combo = 0;
        }

        const heatBefore = this.heat;
        const surge = lineCount > 0 && heatBefore >= this.rules.heatMax;
        const sweep = surge ? this._surgeSweep() : [];
        this._scoreMove(cells.length, lineCount, lineCells, sweep.length, surge, heatBefore);
        this._updateHeat(lineCount, surge);

        const shiftGained = this._earnShiftCharges(lineCount);

        let batchComplete = true;
        for (const current of this.tray) {
            if (!current.used) batchComplete = false;
        }
        if (batchComplete) {
            this._dealTray();
        }

        return {
            ok: true,
            lines: lineCount,
            line_cells: lineCells,
            combo: this.combo,
            score: this.score,
            batch_complete: batchComplete,
            shift_gained: shiftGained,
            heat: this.heat,
            heat_before: heatBefore,
            surge,
            surge_cells: sweep,
            overdrive: this.overdrive
        };
    }

    // One scoring formula for placements and slides (a slide places no cells).
    _lineBonus(lines) {
        const table = this.rules.lineBonus;
        return table[Math.min(lines, table.length - 1)];
    }

    _scoreMove(placedCells, lines, lineCells, sweepCells, surge, heatBefore) {
        let gain = placedCells * 5 + (lineCells + sweepCells) * 10 + this._lineBonus(lines);
        if (surge) gain += this.rules.surgeBonus;
        this.score += gain * heatBefore;
    }

    // Clears build heat (two or more lines at once build it faster). A placement with no
    // clear is a miss: the first one is free, each one after that cools heat by a step.
    // Slides that clear nothing are not counted as misses.
    _updateHeat(lines, surge) {
        const rules = this.rules;
        if (surge) {
            // Overdrive: heat stays at max for the next few placements, so every clear surges again.
            this.heatMisses = 0;
            if (rules.overdriveMoves > 0) {
                this.overdrive = rules.overdriveMoves;
                this.heat = rules.heatMax;
            } else {
                this.heat = rules.heatAfterSurge;
            }
            return;
        }
        if (this.overdrive > 0) {
            this.overdrive--;
            if (this.overdrive === 0) {
                this.heat = rules.heatAfterSurge;
                this.heatMisses = 0;
            }
            return;
        }
        if (lines > 0) {
            this.heat = Math.min(rules.heatMax, this.heat + (lines >= 2 ? 2 : 1));
            this.heatMisses = 0;
        } else {
            this.heatMisses++;
            if (this.heatMisses > rules.heatGraceMisses) this.heat = Math.max(1, this.heat - 1);
        }
    }

    // Surge: at full heat, the next clear also sweeps the fullest remaining row or column.
    _surgeSweep() {
        const size = GridShiftModel.SIZE;
        const cellAt = (axis, index, i) => (axis === 'row' ? { x: i, y: index } : { x: index, y: i });
        let best = null;
        for (const axis of ['row', 'col']) {
            for (let index = 0; index < size; index++) {
                let count = 0;
                for (let i = 0; i < size; i++) {
                    const c = cellAt(axis, index, i);
                    if (this.board[c.y][c.x] !== -1) count++;
                }
                if (count > 0 && (!best || count > best.count)) best = { axis, index, count };
            }
        }
        const swept = [];
        if (!best) return swept;
        for (let i = 0; i < size; i++) {
            const c = cellAt(best.axis, best.index, i);
            if (this.board[c.y][c.x] === -1) continue;
            swept.push({ x: c.x, y: c.y, color: this.board[c.y][c.x] });
            this.board[c.y][c.x] = -1;
        }
        return swept;
    }

    _earnShiftCharges(lines) {
        if (!this.shiftEnabled || lines <= 0) return 0;
        this.shiftProgress += lines;
        let gained = 0;
        while (this.shiftProgress >= this.rules.shiftLinesPerCharge) {
            this.shiftProgress -= this.rules.shiftLinesPerCharge;
            if (this.shiftCharges < this.rules.shiftMaxCharges) {
                this.shiftCharges++;
                gained++;
            }
        }
        if (this.shiftCharges >= this.rules.shiftMaxCharges) this.shiftProgress = 0;
        return gained;
    }

    // Returns a copy of the board with one row or column slid by one cell (wrapping),
    // or null if the slide would change nothing. dir is +1 (right or down) or -1 (left or up).
    _shiftedBoard(axis, index, dir) {
        const size = GridShiftModel.SIZE;
        const at = i => (axis === 'row' ? { x: i, y: index } : { x: index, y: i });
        const values = [];
        for (let i = 0; i < size; i++) {
            const c = at(i);
            values.push(this.board[c.y][c.x]);
        }
        const from = i => (i - dir + size) % size;
        const board = this.board.map(row => row.slice());
        let changed = false;
        for (let i = 0; i < size; i++) {
            const c = at(i);
            board[c.y][c.x] = values[from(i)];
            if (values[from(i)] !== values[i]) changed = true;
        }
        return changed ? board : null;
    }

    // Slides one row (axis "row") or column (axis "col") by one cell, wrapping around.
    // Costs one charge. A slide that completes lines clears them and extends the combo;
    // a slide that clears nothing leaves the combo alone.
    shiftLine(axis, index, dir) {
        const size = GridShiftModel.SIZE;
        if (!this.shiftEnabled) return { ok: false, reason: 'disabled' };
        if ((axis !== 'row' && axis !== 'col') || !Number.isInteger(index) || index < 0 || index >= size || (dir !== 1 && dir !== -1)) {
            return { ok: false, reason: 'invalid' };
        }
        if (this.shiftCharges <= 0) return { ok: false, reason: 'nocharge' };
        const next = this._shiftedBoard(axis, index, dir);
        if (!next) return { ok: false, reason: 'nochange' };

        this.saveSnapshot();
        const moved = [];
        for (let i = 0; i < size; i++) {
            const from = axis === 'row' ? { x: i, y: index } : { x: index, y: i };
            const value = this.board[from.y][from.x];
            if (value === -1) continue;
            const j = (i + dir + size) % size;
            const to = axis === 'row' ? { x: j, y: index } : { x: index, y: j };
            moved.push({ fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, color: value });
        }
        this.board = next;
        this.shiftCharges--;

        const settled = this.board.map(row => row.slice());
        const linesData = this._clearFullLines();
        const lines = linesData.lines;
        const heatBefore = this.heat;
        const surge = lines > 0 && heatBefore >= this.rules.heatMax;
        const sweep = surge ? this._surgeSweep() : [];
        const cleared = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (settled[y][x] !== -1 && this.board[y][x] === -1) cleared.push({ x, y, color: settled[y][x] });
            }
        }
        if (lines > 0) {
            this.combo++;
            this._scoreMove(0, lines, linesData.cells, sweep.length, surge, heatBefore);
            this._updateHeat(lines, surge);
            // Boons: Furnace adds a heat step, Slingshot refunds the spent charge.
            if (this.rules.furnace && !surge && this.overdrive === 0) this.heat = Math.min(this.rules.heatMax, this.heat + 1);
            if (this.rules.slingshot) this.shiftCharges = Math.min(this.rules.shiftMaxCharges, this.shiftCharges + 1);
        }
        const gained = this._earnShiftCharges(lines);
        return {
            ok: true,
            lines,
            line_cells: linesData.cells,
            combo: this.combo,
            score: this.score,
            moved,
            cleared,
            shift_gained: gained,
            charges: this.shiftCharges,
            heat: this.heat,
            heat_before: heatBefore,
            surge,
            surge_cells: sweep,
            overdrive: this.overdrive
        };
    }

    // True when some single slide would let a tray piece fit or complete a line.
    canRescueByShift() {
        if (!this.shiftEnabled || this.shiftCharges <= 0) return false;
        const size = GridShiftModel.SIZE;
        const original = this.board;
        try {
            for (const axis of ['row', 'col']) {
                for (let index = 0; index < size; index++) {
                    for (const dir of [1, -1]) {
                        const next = this._shiftedBoard(axis, index, dir);
                        if (!next) continue;
                        const hasLine = next.some(row => row.every(cell => cell !== -1))
                            || [...Array(size).keys()].some(x => next.every(row => row[x] !== -1));
                        if (hasLine) return true;
                        this.board = next;
                        if (this.canAnyPieceFit()) return true;
                    }
                }
            }
        } finally {
            this.board = original;
        }
        return false;
    }

    noPieceFits() {
        return !this.canAnyPieceFit();
    }

    _clearFullLines() {
        const fullRows = [];
        const fullCols = [];
        for (let y = 0; y < GridShiftModel.SIZE; y++) {
            if (this.board[y].every(cell => cell !== -1)) fullRows.push(y);
        }
        for (let x = 0; x < GridShiftModel.SIZE; x++) {
            let full = true;
            for (let y = 0; y < GridShiftModel.SIZE; y++) {
                if (this.board[y][x] === -1) { full = false; break; }
            }
            if (full) fullCols.push(x);
        }

        const cleared = new Set();
        for (const y of fullRows) {
            for (let x = 0; x < GridShiftModel.SIZE; x++) cleared.add(`${x},${y}`);
        }
        for (const x of fullCols) {
            for (let y = 0; y < GridShiftModel.SIZE; y++) cleared.add(`${x},${y}`);
        }
        for (const key of cleared) {
            const [x, y] = key.split(',').map(Number);
            this.board[y][x] = -1;
        }
        return { lines: fullRows.length + fullCols.length, cells: cleared.size };
    }

    // Quarter-turn clockwise, shifted back so the piece starts at (0, 0).
    static rotateCells(cells) {
        const rows = Math.max(...cells.map(c => c.y)) + 1;
        return cells.map(c => ({ x: rows - 1 - c.y, y: c.x }));
    }

    // Twist boon: rotates a tray piece in place. Free, and deliberately not an Undo step.
    rotatePiece(slot) {
        if (!this.rules.rotate || slot < 0 || slot >= this.tray.length) return false;
        const piece = this.tray[slot];
        if (piece.used) return false;
        piece.cells = GridShiftModel.rotateCells(piece.cells);
        return true;
    }

    canAnyPieceFit() {
        for (const piece of this.tray) {
            if (piece.used) continue;
            // With Twist, a piece also fits if any of its four rotations does.
            let cells = piece.cells;
            for (let turn = 0; turn < (this.rules.rotate ? 4 : 1); turn++) {
                for (let y = 0; y < GridShiftModel.SIZE; y++) {
                    for (let x = 0; x < GridShiftModel.SIZE; x++) {
                        if (this.canPlace(cells, { x, y })) return true;
                    }
                }
                cells = GridShiftModel.rotateCells(cells);
            }
        }
        return false;
    }

    isStuck() {
        if (this.canAnyPieceFit()) return false;
        return !this.canRescueByShift();
    }
}
