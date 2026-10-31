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

    constructor() {
        this.board = [];
        this.specialBoard = [];
        this.tray = [];
        this.score = 0;
        this.combo = 0;
        this.piecesPlaced = 0;
        this.mode = "classic";
        this.history = [];
    }


    reset(newMode = "classic") {
        this.mode = newMode;
        this.board = this._emptyBoard(-1);
        this.specialBoard = this._emptyBoard(GridShiftModel.SPECIAL_NONE);
        this.tray = [];
        this.score = 0;
        this.combo = 0;
        this.piecesPlaced = 0;
        this.history = [];
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
            piecesPlaced: this.piecesPlaced
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
        const pivot = placedCells[Math.floor((placedCells.length - 1) * 0.5)];
        const special = piece.special;
        if (special !== GridShiftModel.SPECIAL_NONE) {
            this.specialBoard[pivot.y][pivot.x] = special;
        }
        piece.used = true;
        this.piecesPlaced++;

        let specialCleared = 0;
        if (special === GridShiftModel.SPECIAL_BOMB) {
            specialCleared = this._clearArea(pivot, 1);
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
