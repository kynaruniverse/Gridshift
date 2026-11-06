import test from 'node:test';
import assert from 'node:assert/strict';
import { drawIcon, ICON_NAMES } from '../src/gridshift/GridShiftIcons.js';

test('every icon draws without throwing and restores the canvas state', () => {
    let depth = 0;
    const ctx = new Proxy({}, {
        get: (t, k) => k === 'save' ? () => { depth++; } : k === 'restore' ? () => { depth--; } : (k in t ? t[k] : () => {}),
        set: (t, k, v) => { t[k] = v; return true; }
    });
    for (const name of ICON_NAMES) drawIcon(ctx, name, 100, 100, 20, '#fff');
    assert.equal(depth, 0);
    assert.equal(ICON_NAMES.length, 9);
});