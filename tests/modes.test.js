import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyBoon, drawBoons, BOONS } from '../src/gridshift/GridShiftBoons.js';

test('the boon of the day is stable for a date and always a real boon', () => {
    assert.equal(dailyBoon('2026-11-05').id, dailyBoon('2026-11-05').id);
    for (const key of ['2026-11-05', '2026-11-06', '2027-01-01']) {
        assert.ok(BOONS.includes(dailyBoon(key)));
    }
});

test('drawBoons can skip boons a mode already has built in', () => {
    const offer = drawBoons(Math.random, 99, ['safetynet', 'twist']);
    assert.equal(offer.length, BOONS.length - 2);
    assert.ok(offer.every(b => b.id !== 'safetynet' && b.id !== 'twist'));
});