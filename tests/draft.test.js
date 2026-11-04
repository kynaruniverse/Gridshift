import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBoons, BOONS } from '../src/gridshift/GridShiftBoons.js';

test('drawBoons offers distinct boons and never more than exist', () => {
    const offer = drawBoons(Math.random, 3);
    assert.equal(offer.length, 3);
    assert.equal(new Set(offer.map(b => b.id)).size, 3);
    assert.equal(drawBoons(Math.random, 99).length, BOONS.length);
});