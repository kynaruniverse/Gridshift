import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, SKINS, isUnlocked, newlyUnlocked, nextUnlock, unlockLabel, findTheme, findSkin } from '../src/gridshift/GridShiftUnlocks.js';

test('the starting theme and skin are free', () => {
    assert.equal(findTheme('classic').stars, 0);
    assert.equal(findSkin('primary').stars, 0);
    assert.ok(THEMES.every(t => typeof t.name === 'string'));
    assert.ok(SKINS.every(t => typeof t.name === 'string'));
});

test('items unlock at their star count', () => {
    const berry = findTheme('vaporwave');
    assert.equal(isUnlocked(berry, berry.stars - 1), false);
    assert.equal(isUnlocked(berry, berry.stars), true);
});

test('newlyUnlocked reports everything crossed between two star totals', () => {
    assert.deepEqual(newlyUnlocked(0, 5), []);
    assert.deepEqual(newlyUnlocked(8, 12).map(i => i.id), ['vaporwave']);
    assert.deepEqual(newlyUnlocked(20, 50).map(i => i.id), ['candy', 'cyberpunk']);
    assert.deepEqual(newlyUnlocked(12, 12), []);
    assert.equal(newlyUnlocked(0, 5).length, 0);
});

test('nextUnlock points at the closest locked item and ends when all are open', () => {
    assert.equal(nextUnlock(0).id, 'vaporwave');
    assert.equal(nextUnlock(10).id, 'candy');
    assert.equal(nextUnlock(69).id, 'retro');
    assert.equal(nextUnlock(70), null);
});

test('unlock labels say what you are getting', () => {
    assert.equal(unlockLabel({ name: 'BERRY', kind: 'theme' }), 'BERRY THEME');
    assert.equal(unlockLabel({ name: 'RETRO', kind: 'skin' }), 'RETRO TILES');
});
