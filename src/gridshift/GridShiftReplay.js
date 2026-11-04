import { GridShiftModel } from './GridShiftModel.js';
import { mulberry32 } from './GridShiftRng.js';

// A run is its header plus the moves the player made. Replaying it must give the same score,
// which makes runs reproducible from a bug report and lets a Daily ghost be shared as text.
export function replayRun(log) {
    const model = new GridShiftModel();
    if (log.seed !== null && log.seed !== undefined && log.mode === 'daily') {
        model.reset('shift', log.seed, log.rules);
    } else {
        model.rng = mulberry32(log.seed >>> 0);
        model.reset(log.mode === 'classic' ? 'classic' : 'shift', null, log.rules);
    }
    for (const move of log.moves) {
        let result = { ok: true };
        if (move.t === 'p') result = model.placePiece(move.slot, { x: move.x, y: move.y });
        else if (move.t === 's') result = model.shiftLine(move.axis, move.index, move.dir);
        else if (move.t === 'r') result = { ok: model.rotatePiece(move.slot) };
        else if (move.t === 'u') result = { ok: model.undo() };
        if (!result.ok) throw new Error(`Replay diverged at move ${JSON.stringify(move)}`);
    }
    return model;
}
