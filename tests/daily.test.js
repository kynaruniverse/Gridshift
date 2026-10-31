import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftModel } from '../src/gridshift/GridShiftModel.js';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

const signature = tray => JSON.stringify(tray.map(p => [p.cells, p.color, p.special]));
const seed = key => GridShiftModel.seedFromString(`gridshift:${key}`);

test('the same daily seed deals the same trays however the player places pieces', () => {
    const a = new GridShiftModel();
    const b = new GridShiftModel();
    a.reset('classic', seed('2026-10-31'));
    b.reset('classic', seed('2026-10-31'));
    assert.equal(signature(a.tray), signature(b.tray));

    const place = (model, startX) => {
        for (let slot = 0; slot < 3; slot++) {
            const piece = model.tray[slot];
            let done = false;
            for (let y = 0; y < 8 && !done; y++) {
                for (let x = startX; x < 8 && !done; x++) {
                    if (model.canPlace(piece.cells, { x, y })) { model.placePiece(slot, { x, y }); done = true; }
                }
            }
            if (!done) return false;
        }
        return true;
    };
    assert.equal(place(a, 0), true);
    assert.equal(place(b, 3), true);
    // second tray is identical even though the boards differ
    assert.equal(a.trayCount, 2);
    assert.equal(b.trayCount, 2);
    assert.equal(signature(a.tray), signature(b.tray));
});

test('different days deal different trays', () => {
    const a = new GridShiftModel();
    const b = new GridShiftModel();
    a.reset('classic', seed('2026-10-31'));
    b.reset('classic', seed('2026-11-01'));
    assert.notEqual(signature(a.tray), signature(b.tray));
});

test('undo restores the tray counter so the next tray is unchanged', () => {
    const model = new GridShiftModel();
    model.reset('classic', seed('2026-10-31'));
    model.tray = [0, 1, 2].map(i => ({ cells: [{ x: 0, y: 0 }], color: i, special: 0, used: false }));
    model.placePiece(0, { x: 0, y: 0 });
    model.placePiece(1, { x: 1, y: 0 });
    model.placePiece(2, { x: 2, y: 0 });
    const firstNext = signature(model.tray);
    assert.equal(model.undo(), true);
    model.placePiece(2, { x: 2, y: 0 });
    assert.equal(signature(model.tray), firstNext);
});

test('unseeded runs still behave as before', () => {
    const model = new GridShiftModel();
    model.reset('classic');
    assert.equal(model.seeded, false);
    assert.equal(model.tray.length, 3);
});

function dailyStub(daily) {
    return {
        daily,
        runDailyKey: '2026-10-31',
        model: { score: 1200 },
        dailyKey: () => '2026-10-31',
        dayBefore: GridShiftMain.prototype.dayBefore,
        saveProfile() {}
    };
}

test('daily streak grows on consecutive days and resets after a gap', () => {
    const next = dailyStub({ date: '2026-10-30', best: 900, claimed: true, streak: 3, bestStreak: 3, lastDate: '2026-10-30' });
    GridShiftMain.prototype.recordDaily.call(next);
    assert.equal(next.daily.streak, 4);
    assert.equal(next.daily.claimed, true);
    assert.equal(next.daily.best, 1200);

    const gap = dailyStub({ date: '2026-10-28', best: 900, claimed: true, streak: 6, bestStreak: 6, lastDate: '2026-10-28' });
    GridShiftMain.prototype.recordDaily.call(gap);
    assert.equal(gap.daily.streak, 1);
    assert.equal(gap.daily.bestStreak, 6);
});

test('replaying the same day keeps the streak and the best score', () => {
    const stub = dailyStub({ date: '2026-10-31', best: 2000, claimed: true, streak: 4, bestStreak: 4, lastDate: '2026-10-31' });
    GridShiftMain.prototype.recordDaily.call(stub);
    assert.equal(stub.daily.streak, 4);
    assert.equal(stub.daily.best, 2000);
});