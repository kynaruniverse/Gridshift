import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CONTRACT_TYPES, makeContracts, updateContracts, contractLabel, isDone,
    snapshotProgress, restoreProgress, seededRandom
} from '../src/gridshift/GridShiftContracts.js';

const contract = (type, target = 3, tier = 1) => ({ type, tier, stars: tier, target, progress: 0, awarded: false });
const move = (extra = {}) => ({ kind: 'place', lines: 0, combo: 0, heat: 1, score: 0, surge: false, ...extra });

test('every run draws one contract per difficulty, with 1, 2 and 3 stars', () => {
    for (let i = 0; i < 200; i++) {
        const list = makeContracts('shift', Math.random);
        assert.deepEqual(list.map(c => c.tier), [1, 2, 3]);
        assert.deepEqual(list.map(c => c.stars), [1, 2, 3]);
        list.forEach(c => assert.equal(c.target, CONTRACT_TYPES[c.type].tiers[c.tier]));
    }
});

test('a run never repeats a contract type', () => {
    for (let i = 0; i < 200; i++) {
        const types = makeContracts('shift', Math.random).map(c => c.type);
        assert.equal(new Set(types).size, 3);
    }
});

test('classic runs never get slide contracts, shift runs can', () => {
    let sawSlide = false;
    for (let i = 0; i < 400; i++) {
        const classic = makeContracts('classic', Math.random);
        assert.ok(classic.every(c => !CONTRACT_TYPES[c.type].shiftOnly));
        if (makeContracts('shift', Math.random).some(c => CONTRACT_TYPES[c.type].shiftOnly)) sawSlide = true;
    }
    assert.ok(sawSlide);
});

test('the same seed always gives the same contracts, so the Daily is shared', () => {
    const a = makeContracts('shift', seededRandom(1234));
    const b = makeContracts('shift', seededRandom(1234));
    const c = makeContracts('shift', seededRandom(9999));
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.map(x => x.type + x.target), c.map(x => x.type + x.target).concat('different').slice(0, 3));
});

test('line contracts add up cleared lines', () => {
    const list = [contract('lines', 5)];
    updateContracts(list, move({ lines: 2 }));
    updateContracts(list, move({ lines: 1 }));
    assert.equal(list[0].progress, 3);
    const done = updateContracts(list, move({ lines: 4 }));
    assert.equal(done.length, 1);
    assert.equal(list[0].progress, 5, 'progress is capped at the target');
});

test('double contracts only count moves that clear two or more lines', () => {
    const list = [contract('doubles', 2)];
    updateContracts(list, move({ lines: 1 }));
    assert.equal(list[0].progress, 0);
    updateContracts(list, move({ lines: 2 }));
    updateContracts(list, move({ lines: 3 }));
    assert.equal(list[0].progress, 2);
});

test('heat, score and streak contracts track the highest value reached', () => {
    const list = [contract('heat', 5), contract('score', 3000), contract('streak', 4)];
    updateContracts(list, move({ heat: 3, score: 1200, combo: 2 }));
    updateContracts(list, move({ heat: 2, score: 1300, combo: 0 }));
    assert.deepEqual(list.map(c => c.progress), [3, 1300, 2]);
    updateContracts(list, move({ heat: 6, score: 3100, combo: 4 }));
    assert.ok(list.every(isDone));
});

test('slide contracts only count slides', () => {
    const list = [contract('slides', 2), contract('slideclear', 1)];
    updateContracts(list, move({ lines: 1 }));
    assert.deepEqual(list.map(c => c.progress), [0, 0]);
    updateContracts(list, move({ kind: 'slide', lines: 0 }));
    assert.deepEqual(list.map(c => c.progress), [1, 0]);
    updateContracts(list, move({ kind: 'slide', lines: 1 }));
    assert.deepEqual(list.map(c => c.progress), [2, 1]);
    assert.ok(list.every(isDone));
});

test('a surge contract completes on a surge only', () => {
    const list = [contract('surge', 1, 3)];
    updateContracts(list, move({ lines: 2, heat: 8 }));
    assert.equal(isDone(list[0]), false);
    updateContracts(list, move({ lines: 1, surge: true }));
    assert.equal(isDone(list[0]), true);
});

test('a contract is only reported as finished once', () => {
    const list = [contract('lines', 2)];
    assert.equal(updateContracts(list, move({ lines: 2 })).length, 1);
    assert.equal(updateContracts(list, move({ lines: 2 })).length, 0);
});

test('undo rewinds progress but never takes back an earned contract', () => {
    const list = [contract('lines', 5), contract('lines', 3)];
    updateContracts(list, move({ lines: 1 }));
    const saved = snapshotProgress(list);
    updateContracts(list, move({ lines: 2 }));
    assert.equal(isDone(list[1]), true);
    restoreProgress(list, saved);
    assert.equal(list[0].progress, 1);
    assert.equal(list[1].progress, 3, 'the finished contract stays finished');
    assert.equal(isDone(list[1]), true);
});

test('labels are short and readable', () => {
    assert.equal(contractLabel(contract('lines', 8)), '8 LINES');
    assert.equal(contractLabel(contract('lines', 1)), '1 LINE');
    assert.equal(contractLabel(contract('doubles', 1)), '1 DOUBLE');
    assert.equal(contractLabel(contract('heat', 5)), 'HEAT ×5');
    assert.equal(contractLabel(contract('score', 3500)), '3.5K POINTS');
    assert.equal(contractLabel(contract('slideclear', 1)), 'SLIDE A CLEAR');
    assert.equal(contractLabel(contract('slideclear', 3)), '3 SLIDE CLEARS');
    assert.equal(contractLabel(contract('streak', 5)), '5 IN A ROW');
});
