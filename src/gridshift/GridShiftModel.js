export class GridShiftModel {
    static SIZE = 8;
    static SPECIAL_NONE = 0;
    static SPECIAL_BOMB = 1;
    static SPECIAL_LIGHTNING = 2;
    static SPECIAL_PRISM = 3;

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
    static BOMB_RADIUS = 1;
    // One weight per entry in SHAPES, same order. Higher means more common.
    static SHAPE_WEIGHTS = [3, 5, 5, 5, 6, 4, 4, 4, 3, 3, 2, 2, 2, 4, 2, 2, 2];

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
        this.specialBoard = [];
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
    }

    reset(newMode = "classic", seed = null) {
        this.mode = newMode;
        this.board = this._emptyBoard(-1);
        this.specialBoard = this._emptyBoard(GridShiftModel.SPECIAL_NONE);
        this.tray = [];
        this.score = 0;
        this.combo = 0;
        this.piecesPlaced = 0;
        this.history = [];
        this.seeded = seed !== null;
        this.seedBase = this.seeded ? seed >>> 0 : 0;
        this.trayCount = 0;
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
            special: GridShiftModel.SPECIAL_NONE,
            used: false
        };
    }

    _random() {
        if (this.seeded) {
            // mulberry32
            this.rngState = (this.rngState + 0x6D2B79F5) >>> 0;
            let t = this.rngState;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
            let special = GridShiftModel.SPECIAL_NONE;
            if (this._random() < 0.05) special = Math.floor(this._random() * 3) + 1;
            tray.push({
                cells: JSON.parse(JSON.stringify(GridShiftModel.SHAPES[shapeIndex])),
                color: Math.floor(this._random() * GridShiftModel.COLOR_IDS),
                special,
                used: false
            });
        }
        return tray;
    }

    _legacyDealTray() {
        this.tray = [];
        for (let i = 0; i < 3; i++) {
            const shapeIndex = Math.floor(Math.random() * GridShiftModel.SHAPES.length);
            const shape = JSON.parse(JSON.stringify(GridShiftModel.SHAPES[shapeIndex]));
            let special = GridShiftModel.SPECIAL_NONE;
            if (Math.random() < 0.05) {
                special = Math.floor(Math.random() * 3) + 1;
            }
            this.tray.push({
                cells: shape,
                color: Math.floor(Math.random() * GridShiftModel.COLOR_IDS),
                special: special,
                used: false
            });
        }
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
            specialBoard: this.specialBoard,
            tray: this.tray,
            score: this.score,
            combo: this.combo,
            piecesPlaced: this.piecesPlaced,
            trayCount: this.trayCount
        }));
        if (this.history.length > 5) this.history.shift();
    }

    undo() {
        if (this.history.length === 0) return false;
        const snapshot = JSON.parse(this.history.pop());
        this.board = snapshot.board;
        this.specialBoard = snapshot.specialBoard;
        this.tray = snapshot.tray;
        this.score = snapshot.score;
        this.combo = snapshot.combo;
        this.piecesPlaced = snapshot.piecesPlaced;
        this.trayCount = snapshot.trayCount ?? this.trayCount;
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
        const pivot = this._pivot(placedCells);
        const special = piece.special;
        if (special !== GridShiftModel.SPECIAL_NONE) {
            this.specialBoard[pivot.y][pivot.x] = special;
        }
        piece.used = true;
        this.piecesPlaced++;

        let specialCleared = 0;
        if (special === GridShiftModel.SPECIAL_BOMB) {
            specialCleared = this._clearArea(pivot, GridShiftModel.BOMB_RADIUS);
        } else if (special === GridShiftModel.SPECIAL_LIGHTNING) {
            specialCleared = this._clearCross(pivot);
        } else if (special === GridShiftModel.SPECIAL_PRISM) {
            this._prismCompleteGaps(placedCells, color);
        }

        const linesData = this._clearFullLines();
        const lineCount = linesData.lines;
        const lineCells = linesData.cells;
        
        if (lineCount > 0) {
            this.combo++;
        } else {
            this.combo = 0;
        }

        const totalCleared = specialCleared + lineCells;
        this.score += cells.length * 5;
        if (totalCleared > 0) this.score += totalCleared * 10;
        if (lineCount > 0) {
            this.score += lineCount * 100 + lineCount * Math.min(this.combo - 1, 4) * 30;
        }

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
            special_cleared: specialCleared,
            total_cleared: totalCleared,
            special: special,
            combo: this.combo,
            score: this.score,
            batch_complete: batchComplete
        };
    }

    _clearArea(center, radius) {
        let cleared = 0;
        for (let y = Math.max(0, center.y - radius); y <= Math.min(GridShiftModel.SIZE - 1, center.y + radius); y++) {
            for (let x = Math.max(0, center.x - radius); x <= Math.min(GridShiftModel.SIZE - 1, center.x + radius); x++) {
                if (this.board[y][x] !== -1) {
                    this.board[y][x] = -1;
                    this.specialBoard[y][x] = GridShiftModel.SPECIAL_NONE;
                    cleared++;
                }
            }
        }
        return cleared;
    }

    _clearCross(center) {
        const marked = new Set();
        for (let x = 0; x < GridShiftModel.SIZE; x++) {
            if (this.board[center.y][x] !== -1) marked.add(`${x},${center.y}`);
        }
        for (let y = 0; y < GridShiftModel.SIZE; y++) {
            if (this.board[y][center.x] !== -1) marked.add(`${center.x},${y}`);
        }
        for (const key of marked) {
            const [x, y] = key.split(',').map(Number);
            this.board[y][x] = -1;
            this.specialBoard[y][x] = GridShiftModel.SPECIAL_NONE;
        }
        return marked.size;
    }

    _prismCompleteGaps(placedCells, color) {
        const touchedRows = new Set();
        const touchedCols = new Set();
        for (const cell of placedCells) {
            touchedRows.add(cell.y);
            touchedCols.add(cell.x);
        }
        for (const r of touchedRows) {
            const gaps = [];
            for (let x = 0; x < GridShiftModel.SIZE; x++) {
                if (this.board[r][x] === -1) gaps.push(x);
            }
            if (gaps.length > 0 && gaps.length <= 2) {
                for (const x of gaps) this.board[r][x] = color;
            }
        }
        for (const c of touchedCols) {
            const gaps = [];
            for (let y = 0; y < GridShiftModel.SIZE; y++) {
                if (this.board[y][c] === -1) gaps.push(y);
            }
            if (gaps.length > 0 && gaps.length <= 2) {
                for (const y of gaps) this.board[y][c] = color;
            }
        }
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
            this.specialBoard[y][x] = GridShiftModel.SPECIAL_NONE;
        }
        return { lines: fullRows.length + fullCols.length, cells: cleared.size };
    }

    _pivot(placedCells) {
        return placedCells[Math.floor((placedCells.length - 1) * 0.5)];
    }

    previewPlacement(slot, origin) {
        const piece = this.tray[slot];
        if (!piece || piece.used || !this.canPlace(piece.cells, origin)) return null;
        const size = GridShiftModel.SIZE;
        const placed = piece.cells.map(c => ({ x: origin.x + c.x, y: origin.y + c.y }));
        const placedKeys = new Set(placed.map(c => `${c.x},${c.y}`));
        const sim = new GridShiftModel();
        sim.board = this.board.map(row => row.slice());
        sim.specialBoard = this.specialBoard.map(row => row.slice());
        for (const c of placed) sim.board[c.y][c.x] = piece.color;
        const withPiece = sim.board.map(row => row.slice());
        const pivot = this._pivot(placed);
        const area = [];
        const addArea = (x, y) => {
            if (!area.some(a => a.x === x && a.y === y)) area.push({ x, y });
        };
        if (piece.special === GridShiftModel.SPECIAL_BOMB) {
            const r = GridShiftModel.BOMB_RADIUS;
            sim._clearArea(pivot, r);
            for (let y = Math.max(0, pivot.y - r); y <= Math.min(size - 1, pivot.y + r); y++) {
                for (let x = Math.max(0, pivot.x - r); x <= Math.min(size - 1, pivot.x + r); x++) addArea(x, y);
            }
        } else if (piece.special === GridShiftModel.SPECIAL_LIGHTNING) {
            sim._clearCross(pivot);
            for (let x = 0; x < size; x++) addArea(x, pivot.y);
            for (let y = 0; y < size; y++) addArea(pivot.x, y);
        } else if (piece.special === GridShiftModel.SPECIAL_PRISM) {
            sim._prismCompleteGaps(placed, piece.color);
        }
        const afterSpecial = sim.board.map(row => row.slice());
        const lineData = sim._clearFullLines();
        const hits = [];
        const gaps = [];
        const lineCells = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const wasFilled = withPiece[y][x] !== -1;
                const midFilled = afterSpecial[y][x] !== -1;
                const endFilled = sim.board[y][x] !== -1;
                if (wasFilled && !midFilled && !placedKeys.has(`${x},${y}`)) hits.push({ x, y });
                if (!wasFilled && midFilled) gaps.push({ x, y });
                if (midFilled && !endFilled) lineCells.push({ x, y });
            }
        }
        return { lines: lineData.lines, lineCells, area, hits, gaps };
    }

    canAnyPieceFit() {
        for (const piece of this.tray) {
            if (piece.used) continue;
            for (let y = 0; y < GridShiftModel.SIZE; y++) {
                for (let x = 0; x < GridShiftModel.SIZE; x++) {
                    if (this.canPlace(piece.cells, { x, y })) return true;
                }
            }
        }
        return false;
    }

    isStuck() {
        return !this.canAnyPieceFit();
    }
}
