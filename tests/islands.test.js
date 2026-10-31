import test from 'node:test';
import assert from 'node:assert/strict';
import { GridShiftMain } from '../src/gridshift/GridShiftMain.js';

const proto = GridShiftMain.prototype;

function islandStub(levels, crystals) {
    const stub = {
        islandLevels: levels,
        crystals,
        status: '',
        saves: 0,
        islandCost: proto.islandCost,
        setStatus(message) { this.status = message; },
        saveProfile() { this.saves++; }
    };
    return stub;
}

test('perks grow at full strength for five stages, then at half strength', () => {
    const at = level => proto.perkLevel.call({ islandLevels: [level, 0, 0] }, 0);
    assert.equal(at(0), 0);
    assert.equal(at(5), 5);
    assert.equal(at(6), 5.5);
    assert.equal(at(15), 10);
    assert.equal(at(99), 10);
});

test('tiers are derived from the stage count', () => {
    assert.equal(proto.islandTier(0), 0);
    assert.equal(proto.islandTier(4), 0);
    assert.equal(proto.islandTier(5), 1);
    assert.equal(proto.islandTier(10), 2);
    assert.equal(proto.islandTier(15), 2);
});

test('restoring continues past stage five and stops at stage fifteen', () => {
    const stub = islandStub([5, 0, 14], 100);
    proto.restoreIsland.call(stub, 0);
    assert.equal(stub.islandLevels[0], 6);
    assert.equal(stub.crystals, 100 - 13); // stage six costs 3 + 5 * 2

    proto.restoreIsland.call(stub, 2);
    assert.equal(stub.islandLevels[2], 15);
    assert.equal(stub.status, 'Tier complete! A new tier is open.');

    const before = stub.crystals;
    proto.restoreIsland.call(stub, 2);
    assert.equal(stub.islandLevels[2], 15);
    assert.equal(stub.crystals, before);
});

test('restoring needs enough crystals', () => {
    const stub = islandStub([7, 0, 0], 5);
    proto.restoreIsland.call(stub, 0);
    assert.equal(stub.islandLevels[0], 7);
    assert.equal(stub.crystals, 5);
});