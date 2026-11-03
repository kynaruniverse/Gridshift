import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

function shiftModel() {
    const model = new GridShiftModel();
    model.reset('shift');
    model.board = model._emptyBoard(-1);
    return model;
}

const row = (model, y) => model.board[y].slice();
const col = (model, x) => model.board.map(r => r[x]);

test('shift mode starts with one charge and classic has none', () => {
    const shift = new GridShiftModel();
    shift.reset('shift');
    assert.equal(shift.shiftEnabled, true);
    assert.equal(shift.shiftCharges, 1);
    const classic = new GridShiftModel();
    classic.reset('classic');
    assert.equal(classic.shiftEnabled, false);
    assert.equal(classic.shiftLine('row', 0, 1).ok, false);
});

test('a row slides right with wraparound and costs a charge', () => {
    const model = shiftModel();
    model.board[3] = [1, 2, -1, -1, -1, -1, -1, 3];
    const result = model.shiftLine('row', 3, 1);
    assert.equal(result.ok, true);
    assert.deepEqual(row(model, 3), [3, 1, 2, -1, -1, -1, -1, -1]);
    assert.equal(model.shiftCharges, 0);
    assert.equal(result.moved.length, 3);
    assert.deepEqual(result.moved.find(m => m.color === 3), { fromX: 7, fromY: 3, toX: 0, toY: 3, color: 3 });
});

test('a row slides left and a column slides down and up', () => {
    const model = shiftModel();
    model.shiftCharges = 3;
    model.board[2] = [4, -1, -1, -1, -1, -1, -1, 5];
    model.shiftLine('row', 2, -1);
    assert.deepEqual(row(model, 2), [-1, -1, -1, -1, -1, -1, 5, 4]);

    model.board[0][6] = 1;
    model.board[7][6] = 2;
    model.shiftLine('col', 6, 1);
    assert.equal(model.board[0][6], 2);
    assert.equal(model.board[1][6], 1);
    model.shiftLine('col', 6, -1);
    assert.equal(model.board[0][6], 1);
    assert.equal(model.board[7][6], 2);
});

test('rejected slides spend nothing', () => {
    const model = shiftModel();
    assert.equal(model.shiftLine('row', 4, 1).reason, 'nochange'); // empty row
    model.board[4][2] = 1;
    model.shiftCharges = 0;
    assert.equal(model.shiftLine('row', 4, 1).reason, 'nocharge');
    model.shiftCharges = 1;
    assert.equal(model.shiftLine('diag', 4, 1).reason, 'invalid');
    assert.equal(model.shiftLine('row', 9, 1).reason, 'invalid');
    assert.equal(model.shiftLine('row', 4, 2).reason, 'invalid');
    assert.equal(model.shiftCharges, 1);
    assert.equal(model.history.length, 0);
});

test('a slide that completes a column clears it, scores and extends the combo', () => {
    const model = shiftModel();
    for (let y = 0; y < 7; y++) model.board[y][0] = 1;
    model.board[7][1] = 2;      // the stray tile that will slide into column 0
    const result = model.shiftLine('row', 7, -1);
    assert.equal(result.ok, true);
    assert.equal(result.lines, 1);
    assert.equal(result.cleared.length, 8);
    assert.deepEqual(col(model, 0), Array(8).fill(-1));
    assert.equal(model.combo, 1);
    assert.equal(model.score, 8 * 10 + 100);
    assert.equal(result.shift_gained, 0);
    assert.equal(model.shiftProgress, 1);
});

test('a slide that clears nothing keeps the combo alive', () => {
    const model = shiftModel();
    model.combo = 3;
    model.board[5][2] = 1;
    model.shiftLine('row', 5, 1);
    assert.equal(model.combo, 3);
});

test('every third cleared line earns a charge, capped at three', () => {
    const model = shiftModel();
    assert.equal(model._earnShiftCharges(2), 0);
    assert.equal(model.shiftProgress, 2);
    assert.equal(model._earnShiftCharges(1), 1);
    assert.equal(model.shiftCharges, 2);
    assert.equal(model.shiftProgress, 0);
    assert.equal(model._earnShiftCharges(9), 1);
    assert.equal(model.shiftCharges, 3);
    assert.equal(model.shiftProgress, 0);
    const classic = new GridShiftModel();
    classic.reset('classic');
    assert.equal(classic._earnShiftCharges(6), 0);
});

test('placing a piece that clears lines can earn a charge', () => {
    const model = shiftModel();
    model.shiftProgress = 2;
    model.tray = [{ cells: [{ x: 0, y: 0 }], color: 0, used: false }, { cells: [{ x: 0, y: 0 }], color: 0, used: true }, { cells: [{ x: 0, y: 0 }], color: 0, used: true }];
    for (let x = 1; x < 8; x++) model.board[0][x] = 1;
    const result = model.placePiece(0, { x: 0, y: 0 });
    assert.equal(result.lines, 1);
    assert.equal(result.shift_gained, 1);
    assert.equal(model.shiftCharges, 2);
});

test('undo gives back the charge and the board', () => {
    const model = shiftModel();
    model.board[2] = [1, 2, -1, -1, -1, -1, -1, -1];
    const before = row(model, 2);
    model.shiftLine('row', 2, 1);
    assert.equal(model.undo(), true);
    assert.deepEqual(row(model, 2), before);
    assert.equal(model.shiftCharges, 1);
});

function checkerboard(model) {
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) model.board[y][x] = (x + y) % 2 === 0 ? 1 : -1;
    }
    model.tray = [{ cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }], color: 0, used: false }];
}

test('a stuck board is not game over while a slide can rescue it', () => {
    const model = shiftModel();
    checkerboard(model);
    assert.equal(model.canAnyPieceFit(), false);
    assert.equal(model.canRescueByShift(), true);
    assert.equal(model.isStuck(), false);
    model.shiftCharges = 0;
    assert.equal(model.isStuck(), true);
});

test('classic mode is still stuck as before', () => {
    const model = new GridShiftModel();
    model.reset('classic');
    model.board = model._emptyBoard(-1);
    checkerboard(model);
    assert.equal(model.isStuck(), true);
});

test('canRescueByShift leaves the board untouched', () => {
    const model = shiftModel();
    checkerboard(model);
    const copy = JSON.stringify(model.board);
    model.canRescueByShift();
    assert.equal(JSON.stringify(model.board), copy);
});

function gestureStub() {
    return {
        modal: '',
        calls: [],
        shiftGesture: { startX: 100, startY: 100, cell: { x: 2, y: 5 }, axis: null },
        performShift(axis, index, dir) { this.calls.push([axis, index, dir]); }
    };
}

test('a short wiggle does not slide anything', () => {
    const game = gestureStub();
    GridShiftMain.prototype.shiftMove.call(game, { x: 108, y: 104 });
    assert.equal(game.calls.length, 0);
    assert.ok(game.shiftGesture);
});

test('a horizontal swipe slides the row under the finger once', () => {
    const game = gestureStub();
    GridShiftMain.prototype.shiftMove.call(game, { x: 120, y: 102 });
    assert.equal(game.shiftGesture.axis, 'row');
    GridShiftMain.prototype.shiftMove.call(game, { x: 150, y: 103 });
    assert.deepEqual(game.calls, [['row', 5, 1]]);
    assert.equal(game.shiftGesture, null);
    GridShiftMain.prototype.shiftMove.call(game, { x: 220, y: 103 });
    assert.equal(game.calls.length, 1);
});

test('a vertical swipe upward slides the column under the finger', () => {
    const game = gestureStub();
    GridShiftMain.prototype.shiftMove.call(game, { x: 102, y: 80 });
    GridShiftMain.prototype.shiftMove.call(game, { x: 103, y: 55 });
    assert.deepEqual(game.calls, [['col', 2, -1]]);
});

test('the board cell under a point is found, and points outside give nothing', () => {
    const game = { boardRect: { x: 56, y: 180, width: 608, height: 608 }, cellSize: 76 };
    assert.deepEqual(GridShiftMain.prototype.boardCellAt.call(game, { x: 60, y: 184 }), { x: 0, y: 0 });
    assert.deepEqual(GridShiftMain.prototype.boardCellAt.call(game, { x: 660, y: 784 }), { x: 7, y: 7 });
    assert.equal(GridShiftMain.prototype.boardCellAt.call(game, { x: 20, y: 300 }), null);
    assert.equal(GridShiftMain.prototype.boardCellAt.call(game, { x: 300, y: 850 }), null);
});
