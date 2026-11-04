// Praise text is a tiny queue so a Surge call-out never erases the COMBO call-out before it.
// Pure functions over any object with { praise, praiseQueue, clock }.
const SHOW_MIN = 0.35;   // seconds the current text stays up before another may replace it
const QUEUE_MAX = 2;

export function pushPraise(game, text) {
    const current = game.praise;
    if (!current || game.clock - current.start >= SHOW_MIN) {
        game.praise = { text, start: game.clock };
        return;
    }
    game.praiseQueue = game.praiseQueue || [];
    if (game.praiseQueue.length < QUEUE_MAX) game.praiseQueue.push(text);
}

// Called when the current praise has finished; shows the next queued one, if any.
export function nextPraise(game) {
    const next = game.praiseQueue && game.praiseQueue.shift();
    game.praise = next ? { text: next, start: game.clock } : null;
}
