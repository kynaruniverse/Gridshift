// Vector icons drawn in code (no image files). s is the icon's half-size in pixels.
function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

function speaker(c, s, dx) {
    c.beginPath();
    c.moveTo(dx - 0.8 * s, -0.3 * s);
    c.lineTo(dx - 0.4 * s, -0.3 * s);
    c.lineTo(dx + 0.05 * s, -0.75 * s);
    c.lineTo(dx + 0.05 * s, 0.75 * s);
    c.lineTo(dx - 0.4 * s, 0.3 * s);
    c.lineTo(dx - 0.8 * s, 0.3 * s);
    c.closePath();
    c.fill();
}

export const ICON_NAMES = ['pause', 'undo', 'sound_on', 'sound_off', 'star', 'home', 'calendar', 'shirt', 'lock'];

export function drawIcon(c, name, cx, cy, s, color) {
    c.save();
    c.translate(cx, cy);
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineWidth = s * 0.22;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    switch (name) {
        case 'pause':
            rr(c, -0.62 * s, -0.8 * s, 0.46 * s, 1.6 * s, 0.14 * s);
            c.fill();
            rr(c, 0.16 * s, -0.8 * s, 0.46 * s, 1.6 * s, 0.14 * s);
            c.fill();
            break;
        case 'undo': {
            const a = Math.PI * 1.25, px = 0.05 * s + Math.cos(a) * 0.62 * s, py = 0.1 * s + Math.sin(a) * 0.62 * s;
            c.beginPath();
            c.arc(0.05 * s, 0.1 * s, 0.62 * s, a, Math.PI * 2.15);
            c.stroke();
            c.beginPath();
            c.moveTo(px + 0.27 * s, py + 0.27 * s);
            c.lineTo(px - 0.27 * s, py - 0.27 * s);
            c.lineTo(px - 0.35 * s, py + 0.35 * s);
            c.closePath();
            c.fill();
            break;
        }
        case 'sound_on':
            speaker(c, s, -0.1 * s);
            c.beginPath();
            c.arc(-0.05 * s, 0, 0.5 * s, -0.7, 0.7);
            c.stroke();
            c.beginPath();
            c.arc(-0.05 * s, 0, 0.92 * s, -0.7, 0.7);
            c.stroke();
            break;
        case 'sound_off':
            speaker(c, s, -0.2 * s);
            c.beginPath();
            c.moveTo(0.3 * s, -0.4 * s);
            c.lineTo(0.9 * s, 0.4 * s);
            c.moveTo(0.9 * s, -0.4 * s);
            c.lineTo(0.3 * s, 0.4 * s);
            c.stroke();
            break;
        case 'star':
            c.lineWidth = s * 0.12;
            c.beginPath();
            for (let i = 0; i < 10; i++) {
                const r = i % 2 === 0 ? s * 0.95 : s * 0.42, ang = -Math.PI / 2 + i * Math.PI / 5;
                if (i === 0) c.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
                else c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
            }
            c.closePath();
            c.fill();
            c.stroke();
            break;
        case 'home':
            c.beginPath();
            c.moveTo(-0.95 * s, -0.05 * s);
            c.lineTo(0, -0.85 * s);
            c.lineTo(0.95 * s, -0.05 * s);
            c.closePath();
            c.fill();
            rr(c, -0.62 * s, -0.05 * s, 1.24 * s, 0.85 * s, 0.1 * s);
            c.fill();
            break;
        case 'calendar':
            rr(c, -0.8 * s, -0.65 * s, 1.6 * s, 1.5 * s, 0.22 * s);
            c.stroke();
            c.beginPath();
            c.moveTo(-0.8 * s, -0.2 * s);
            c.lineTo(0.8 * s, -0.2 * s);
            c.moveTo(-0.4 * s, -0.92 * s);
            c.lineTo(-0.4 * s, -0.45 * s);
            c.moveTo(0.4 * s, -0.92 * s);
            c.lineTo(0.4 * s, -0.45 * s);
            c.stroke();
            for (const [dx, dy] of [[-0.4, 0.2], [0.05, 0.2], [0.45, 0.2], [-0.4, 0.58], [0.05, 0.58]]) {
                c.beginPath();
                c.arc(dx * s, dy * s, 0.1 * s, 0, Math.PI * 2);
                c.fill();
            }
            break;
        case 'shirt':
            c.beginPath();
            c.moveTo(-0.35 * s, -0.8 * s);
            c.lineTo(-0.95 * s, -0.4 * s);
            c.lineTo(-0.62 * s, 0.02 * s);
            c.lineTo(-0.45 * s, -0.1 * s);
            c.lineTo(-0.45 * s, 0.85 * s);
            c.lineTo(0.45 * s, 0.85 * s);
            c.lineTo(0.45 * s, -0.1 * s);
            c.lineTo(0.62 * s, 0.02 * s);
            c.lineTo(0.95 * s, -0.4 * s);
            c.lineTo(0.35 * s, -0.8 * s);
            c.quadraticCurveTo(0, -0.4 * s, -0.35 * s, -0.8 * s);
            c.closePath();
            c.fill();
            break;
        case 'lock':
            rr(c, -0.65 * s, -0.05 * s, 1.3 * s, 0.95 * s, 0.16 * s);
            c.fill();
            c.beginPath();
            c.arc(0, -0.1 * s, 0.4 * s, Math.PI, 0);
            c.stroke();
            break;
        default:
            break;
    }
    c.restore();
}