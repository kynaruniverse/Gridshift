import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';

test('placing a piece updates the board and scores', () => {
    const model = new GridShiftModel();
    model.reset();
    model.tray = [
        { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: 2, special: 0, used: false },
        { cells: [{ x: 0, y: 0 }], color: 1, special: 0, used: false },
        { cells: [{ x: 0, y: 0 }], color: 3, special: 0, used: false }
    ];
    const result = model.placePiece(0, { x: 0, y: 0 });
    assert.equal(result.ok, true);
    assert.equal(model.board[0][0], 2);
    assert.equal(model.board[0][1], 2);
    assert.equal(model.score, 10);
});

test('clearing a full line in classic mode scores normally and earns no shift charges', () => {
    const model = new GridShiftModel();
    model.reset();
    model.board[0] = [0, 1, 2, 3, 4, 5, 0, -1];
    model.tray = [
        { cells: [{ x: 0, y: 0 }], color: 3, special: 0, used: false },
        { cells: [{ x: 0, y: 0 }], color: 1, special: 0, used: false },
        { cells: [{ x: 0, y: 0 }], color: 2, special: 0, used: false }
    ];
    const result = model.placePiece(0, { x: 7, y: 0 });
    assert.equal(result.lines, 1);
    assert.equal(model.score, 185);
    assert.ok(model.board[0].every(cell => cell === -1));
    assert.equal(model.shiftEnabled, false);
    assert.equal(model.shiftCharges, 0);
});

test('a run ends when none of the offered pieces fit, without a special escape mechanic', () => {
    const model = new GridShiftModel();
    model.reset();
    model.board = Array.from({ length: 8 }, () => new Array(8).fill(0));
    model.board[7][7] = -1;
    const domino = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    model.tray = [0, 1, 2].map(color => ({ cells: domino, color, special: 0, used: false }));
    assert.equal(model.canAnyPieceFit(), false);
    assert.equal(model.isStuck(), true);
});

test('undo restores board state, score, and tray snapshot', () => {
    const model = new GridShiftModel();
    model.reset();
    model.tray = [
        { cells: [{ x: 0, y: 0 }], color: 1, special: 0, used: false },
        { cells: [{ x: 0, y: 0 }], color: 2, special: 0, used: false },
        { cells: [{ x: 0, y: 0 }], color: 3, special: 0, used: false }
    ];
    model.placePiece(0, { x: 0, y: 0 });
    assert.equal(model.board[0][0], 1);
    assert.equal(model.score, 5);

    const success = model.undo();
    assert.equal(success, true);
    assert.equal(model.board[0][0], -1);
    assert.equal(model.score, 0);
    assert.equal(model.tray[0].used, false);
});
