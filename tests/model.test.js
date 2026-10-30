import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';

test('placing a piece updates the board and scores using JavaScript array length', () => {
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

test('a charged row shift wraps cells and spends one charge', () => {
    const model = new GridShiftModel();
    model.reset();
    model.board[3] = [0, 1, 2, 3, 4, 5, 6, -1];
    model.shiftCharges = 1;
    const result = model.shiftLine('row', 3, 1);
    assert.equal(result.ok, true);
    assert.deepEqual(model.board[3], [-1, 0, 1, 2, 3, 4, 5, 6]);
    assert.equal(model.shiftCharges, 0);
});

test('a vertical shift wraps special markers with the board cells', () => {
    const model = new GridShiftModel();
    model.reset();
    model.board[0][2] = 4;
    model.specialBoard[0][2] = GridShiftModel.SPECIAL_PRISM;
    model.shiftCharges = 1;
    const result = model.shiftLine('col', 2, -1);
    assert.equal(result.ok, true);
    assert.equal(model.board[7][2], 4);
    assert.equal(model.specialBoard[7][2], GridShiftModel.SPECIAL_PRISM);
});
