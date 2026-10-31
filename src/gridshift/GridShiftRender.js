const W = 720;
const H = 1280;
const CELL = 80;
const BOARD_Y = 215;
const INK = '#1d3b73';
const FONT = '"Fredoka", "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
const CLOUDS = [
    { x: 40, y: 150, s: 1.0, v: 6 }, { x: 430, y: 330, s: 1.4, v: 4 }, { x: 600, y: 80, s: 0.8, v: 8 },
    { x: 180, y: 930, s: 1.2, v: 5 }, { x: 520, y: 1100, s: 1.0, v: 7 }, { x: 60, y: 1210, s: 0.9, v: 3 }
];

function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export const renderMethods = {
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, W, H);
        this.buttonHits = {};
        this.trayRects = [];
        ctx.save();
        if (this.shakeTimer > 0) {
            ctx.translate((Math.random() - 0.5) * this.shakeIntensity, (Math.random() - 0.5) * this.shakeIntensity);
        }
        this.drawSky();
        if (this.screen === 'home') this.renderHome();
        else if (this.screen === 'game') this.renderGame();
        else this.renderIslands();
        if (this.modal) this.renderModal();
        ctx.restore();
    },

    drawSky() {
        const ctx = this.ctx;
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#4fb8ff');
        g.addColorStop(1, '#d4f4ff');
        ctx.fillStyle = g;
        ctx.fillRect(-30, -30, W + 60, H + 60);
        ctx.fillStyle = '#ffffff';
        for (const c of CLOUDS) {
            const x = ((c.x + this.clock * c.v) % (W + 300)) - 150;
            for (const [dx, dy, r] of [[0, 0, 34], [44, -16, 44], [92, 0, 34]]) {
                ctx.beginPath();
                ctx.arc(x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2);
                ctx.fill();
            }
            rr(ctx, x - 20 * c.s, c.y, 132 * c.s, 34 * c.s, 17 * c.s);
            ctx.fill();
        }
    },

    drawContain(img, x, y, w, h) {
        if (!img) return;
        const s = Math.min(w / img.width, h / img.height);
        const dw = img.width * s;
        const dh = img.height * s;
        this.ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    },

    plainText(text, x, y, size, color, weight = 600) {
        const ctx = this.ctx;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${weight} ${size}px ${FONT}`;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    outlineText(text, x, y, size, fill = '#ffffff', ink = INK, lw = Math.max(6, size * 0.16)) {
        const ctx = this.ctx;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${size}px ${FONT}`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = lw;
        ctx.strokeStyle = ink;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = fill;
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    drawPill(x, y, w, h, text, bg, fg = '#ffffff') {
        this.ctx.fillStyle = bg;
        rr(this.ctx, x, y, w, h, h / 2);
        this.ctx.fill();
        this.plainText(text, x + w / 2, y + h / 2 + 1, h * 0.52, fg, 700);
    },

    jelly(name, rect, color) {
        const ctx = this.ctx;
        if (name) this.buttonHits[name] = rect;
        const r = Math.min(26, rect.height / 2);
        const lip = Math.max(6, Math.round(rect.height * 0.1));
        ctx.fillStyle = shade(color, -0.3);
        rr(ctx, rect.x, rect.y + lip, rect.width, rect.height, r);
        ctx.fill();
        ctx.fillStyle = color;
        rr(ctx, rect.x, rect.y, rect.width, rect.height, r);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        rr(ctx, rect.x + 10, rect.y + 6, rect.width - 20, rect.height * 0.34, r * 0.6);
        ctx.fill();
    },

    drawButton(name, rect, label, color) {
        this.jelly(name, rect, color);
        const size = rect.width < 100 ? 38 : rect.height < 56 ? 22 : rect.height < 76 ? 28 : 34;
        this.outlineText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1, size, '#ffffff', shade(color, -0.5), Math.max(5, size * 0.2));
    },

    drawArrowButton(name, rect, label, iconKey, color) {
        this.jelly(name, rect, color);
        const icon = this.assets[iconKey];
        if (icon) this.ctx.drawImage(icon, rect.x + 6, rect.y + (rect.height - 44) / 2, 44, 44);
        this.plainText(label, rect.x + 82, rect.y + rect.height / 2 + 1, 19, INK, 700);
    },

    drawStatus(y, fallback) {
        const ctx = this.ctx;
        const active = this.statusTimer > 0 && this.statusMessage;
        const msg = active ? this.statusMessage : fallback;
        if (!msg) return;
        if (active) {
            ctx.save();
            ctx.font = `600 20px ${FONT}`;
            const w = Math.min(660, ctx.measureText(msg).width + 44);
            ctx.restore();
            ctx.fillStyle = INK;
            rr(ctx, 360 - w / 2, y - 21, w, 42, 21);
            ctx.fill();
        }
        this.plainText(msg, 360, y, 20, active ? '#ffffff' : INK, 600);
    },

    showPraise(lines, combo) {
        let text;
        if (combo >= 3) text = `COMBO x${combo}!`;
        else if (lines >= 4) text = 'INCREDIBLE!';
        else if (lines === 3) text = 'AWESOME!';
        else if (lines === 2) text = 'GREAT!';
        else text = ['NICE!', 'SWEET!', 'COOL!'][Math.floor(Math.random() * 3)];
        this.praise = { text, start: this.clock };
    },

    drawPraise() {
        if (!this.praise) return;
        const age = this.clock - this.praise.start;
        const life = 1.2;
        if (age >= life) {
            this.praise = null;
            return;
        }
        const pop = age < 0.18 ? 0.5 + (age / 0.18) * 0.75 : age < 0.3 ? 1.25 - ((age - 0.18) / 0.12) * 0.25 : 1;
        const alpha = age > 0.85 ? 1 - (age - 0.85) / (life - 0.85) : 1;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(360, this.boardRect.y + 250 - age * 40);
        ctx.scale(pop, pop);
        this.outlineText(this.praise.text, 0, 0, 92, '#ffd23f', INK, 16);
        ctx.restore();
    },

    renderHome() {
        const bob = Math.sin(this.clock * 1.6) * 10;
        this.outlineText('GRIDSHIFT', 360, 165, 104, '#ffffff', INK, 18);
        this.outlineText('BREAK  •  BUILD  •  SHIFT', 360, 245, 30, '#ffd23f', INK, 9);
        this.drawContain(this.assets.island0, 140, 285 + bob, 440, 330);
        this.drawButton('start_classic', { x: 120, y: 650, width: 480, height: 84 }, 'CLASSIC', '#3ddc84');
        this.drawButton('start_fever', { x: 120, y: 756, width: 480, height: 84 }, 'FEVER RUSH · 2 MIN', '#ff7a59');
        this.drawButton('start_daily', { x: 120, y: 862, width: 480, height: 72 }, '★ DAILY CHALLENGE', '#ffc83d');
        this.drawButton('open_islands', { x: 120, y: 954, width: 480, height: 72 }, 'ISLAND BUILDER', '#8a7dff');
        this.drawButton('sound_toggle', { x: 230, y: 1050, width: 260, height: 56 }, this.muted ? 'SOUND OFF' : 'SOUND ON', '#4ab3ff');
        this.drawPill(50, 1140, 290, 52, `BEST CLASSIC  ${this.bestScores.classic || 0}`, INK);
        this.drawPill(380, 1140, 290, 52, `BEST FEVER  ${this.bestScores.fever || 0}`, INK);
        this.drawPill(190, 1210, 340, 52, '', INK);
        this.plainText(`CRYSTALS  ${this.crystals}`, 378, 1237, 27, '#ffffff', 700);
        if (this.assets.tile0) this.ctx.drawImage(this.assets.tile0, 206, 1214, 44, 44);
    },

    renderGame() {
        const ctx = this.ctx;
        const boardX = (W - CELL * 8) / 2;
        const boardBottom = BOARD_Y + CELL * 8;
        this.cellSize = CELL;
        this.boardRect = { x: boardX, y: BOARD_Y, width: CELL * 8, height: CELL * 8 };
        const b = this.boardRect;

        // header
        this.plainText('SCORE', 360, 62, 22, INK, 700);
        this.outlineText(String(this.model.score), 360, 116, 72);
        const canUndo = this.model.history.length > 0 && this.crystals >= 2;
        this.drawButton('pause', { x: 28, y: 40, width: 76, height: 76 }, 'II', '#ff9f43');
        this.drawButton('undo_move', { x: 616, y: 40, width: 76, height: 76 }, '↺', canUndo ? '#4cd964' : '#9db4d6');
        const modeText = this.mode === 'fever' ? `TIME  ${Math.ceil(this.secondsLeft)}s` : this.mode === 'daily' ? 'DAILY' : 'CLASSIC';
        this.drawPill(110, 150, 240, 42, `BEST  ${this.bestScores[this.mode] || 0}`, INK);
        this.drawPill(370, 150, 240, 42, modeText, this.mode === 'fever' ? '#ff7a59' : '#4a7bd8');

        // board
        ctx.save();
        ctx.shadowColor = 'rgba(15,45,110,0.35)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#27468f';
        rr(ctx, b.x - 10, b.y - 10, b.width + 20, b.height + 20, 30);
        ctx.fill();
        ctx.restore();
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const px = b.x + x * CELL;
                const py = b.y + y * CELL;
                const val = this.model.board[y][x];
                if (val >= 0) {
                    const tile = this.assets[`tile${val % 6}`];
                    if (tile) ctx.drawImage(tile, px + 2, py + 2, CELL - 4, CELL - 4);
                    else {
                        ctx.fillStyle = '#58e5dc';
                        rr(ctx, px + 3, py + 3, CELL - 6, CELL - 6, 14);
                        ctx.fill();
                    }
                } else {
                    ctx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)';
                    rr(ctx, px + 3, py + 3, CELL - 6, CELL - 6, 12);
                    ctx.fill();
                }
            }
        }

        // ghost preview (lands where the lifted piece snaps)
        const drag = this.dragIndex >= 0 ? this.dragLayout() : null;
        if (drag && drag.overlapsBoard) {
            const canFit = this.model.canPlace(drag.piece.cells, drag.origin);
            const tile = this.assets[`tile${drag.piece.color % 6}`];
            ctx.save();
            for (const cell of drag.piece.cells) {
                const gx = drag.origin.x + cell.x;
                const gy = drag.origin.y + cell.y;
                if (gx < 0 || gx > 7 || gy < 0 || gy > 7) continue;
                const px = b.x + gx * CELL;
                const py = b.y + gy * CELL;
                if (canFit && tile) {
                    ctx.globalAlpha = 0.78 + 0.12 * Math.sin(this.clock * 10);
                    ctx.drawImage(tile, px + 2, py + 2, CELL - 4, CELL - 4);
                } else {
                    ctx.globalAlpha = 0.55;
                    ctx.fillStyle = canFit ? '#ffffff' : '#ff5a5a';
                    rr(ctx, px + 3, py + 3, CELL - 6, CELL - 6, 14);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        if (this.clearFlash > 0) {
            const t = this.clearFlash / 0.45;
            ctx.fillStyle = `rgba(255,255,255,${t * 0.25})`;
            rr(ctx, b.x - 10, b.y - 10, b.width + 20, b.height + 20, 30);
            ctx.fill();
            if (this.assets.burst) {
                const s = 440 + (1 - t) * 120;
                ctx.save();
                ctx.globalAlpha = Math.min(1, t);
                ctx.drawImage(this.assets.burst, W / 2 - s / 2, b.y + b.height / 2 - s / 2, s, s);
                ctx.restore();
            }
        }

        // shift controls
        const cy = boardBottom + 26;
        this.drawButton('shift_toggle', { x: 40, y: cy, width: 150, height: 64 }, this.shiftArmed ? 'CANCEL' : `SHIFT ${this.model.shiftCharges}`, this.shiftArmed ? '#ff6b9d' : '#8a7dff');
        const dirs = [['shift_left', 'ROW', 'arrowLeft'], ['shift_right', 'ROW', 'arrowRight'], ['shift_up', 'COL', 'arrowUp'], ['shift_down', 'COL', 'arrowDown']];
        dirs.forEach(([name, label, icon], i) => {
            const on = this.selectedDirection.button === name;
            this.drawArrowButton(name, { x: 202 + i * 122, y: cy, width: 110, height: 64 }, label, icon, on ? '#ffd23f' : '#ffffff');
        });
        this.drawStatus(cy + 64 + 38, this.shiftArmed ? 'Pick a direction, then tap a line.' : 'Drag a piece onto the board.');

        // tray
        const trayY = cy + 64 + 70;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        rr(ctx, 30, trayY - 10, 660, 240, 36);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
            const rect = { x: 40 + i * 220, y: trayY, width: 200, height: 220 };
            this.trayRects.push(rect);
            const piece = this.model.tray[i];
            if (!piece || piece.used) continue;
            const maxX = Math.max(...piece.cells.map(c => c.x)) + 1;
            const maxY = Math.max(...piece.cells.map(c => c.y)) + 1;
            const size = Math.min(54, 180 / maxX, 160 / maxY);
            const ox = rect.x + (rect.width - maxX * size) / 2;
            const oy = rect.y + (rect.height - maxY * size) / 2;
            const tile = this.assets[`tile${piece.color % 6}`];
            ctx.save();
            ctx.globalAlpha = this.dragIndex === i ? 0.35 : 1;
            for (const cell of piece.cells) {
                const x = ox + cell.x * size;
                const y = oy + cell.y * size;
                if (tile) ctx.drawImage(tile, x + 1, y + 1, size - 2, size - 2);
                else {
                    ctx.fillStyle = '#5bdfe6';
                    rr(ctx, x + 2, y + 2, size - 4, size - 4, 8);
                    ctx.fill();
                }
            }
            if (piece.special) {
                const icon = this.assets[`special${piece.special}`];
                if (icon) ctx.drawImage(icon, rect.x + rect.width - 52, rect.y + 6, 46, 46);
            }
            ctx.restore();
        }

        this.drawPraise();

        // held piece, lifted above the finger (over the board the ghost shows instead)
        if (drag && !drag.overlapsBoard) {
            const tile = this.assets[`tile${drag.piece.color % 6}`];
            ctx.save();
            ctx.globalAlpha = 0.95;
            for (const cell of drag.piece.cells) {
                const px = drag.left + cell.x * drag.size;
                const py = drag.top + cell.y * drag.size;
                if (tile) ctx.drawImage(tile, px + 2, py + 2, drag.size - 4, drag.size - 4);
                else {
                    ctx.fillStyle = '#58e5dc';
                    rr(ctx, px + 3, py + 3, drag.size - 6, drag.size - 6, 14);
                    ctx.fill();
                }
            }
            ctx.restore();
        }
    },

    renderIslands() {
        const ctx = this.ctx;
        this.outlineText('ISLAND BUILDER', 360, 100, 64, '#ffffff', INK, 14);
        this.drawPill(210, 150, 300, 52, `CRYSTALS  ${this.crystals}`, INK);
        const names = ['Sky Haven', 'Prismatic Falls', 'Cloud City'];
        for (let i = 0; i < 3; i++) {
            const x = 24 + i * 228;
            const y = 240;
            const w = 216;
            ctx.fillStyle = '#f3f9ff';
            rr(ctx, x, y, w, 440, 28);
            ctx.fill();
            this.drawContain(this.assets[`island${i}`], x + 10, y + 14, w - 20, 150);
            const level = Math.max(0, Math.min(5, Number(this.islandLevels[i]) || 0));
            const perks = [
                `Perk: +${level} Crystal${level === 1 ? '' : 's'} / run`,
                `Perk: +${level * 150} Start Score`,
                `Perk: ${level * 5}% Shift Refund`
            ];
            this.plainText(names[i], x + w / 2, y + 196, 24, INK, 700);
            this.plainText(`Restored ${level} / 5`, x + w / 2, y + 234, 20, '#4a6290', 600);
            this.plainText(perks[i], x + w / 2, y + 266, 16, '#1f9d6b', 700);
            this.plainText(level >= 5 ? 'Fully restored' : `Next: ${this.islandCost(level)} crystals`, x + w / 2, y + 298, 17, '#4a6290', 600);
            this.drawButton(`restore_${i}`, { x: x + 22, y: y + 340, width: w - 44, height: 64 }, level >= 5 ? 'DONE' : 'RESTORE', level >= 5 ? '#9db4d6' : '#3ddc84');
        }
        this.drawButton('islands_home', { x: 232, y: 730, width: 256, height: 70 }, 'HOME', '#4ab3ff');
        this.drawStatus(860, '');
    },

    renderModal() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(20,45,100,0.55)';
        ctx.fillRect(-30, -30, W + 60, H + 60);
        const rect = { x: 92, y: 400, width: 536, height: 450 };
        ctx.fillStyle = '#b8d4f0';
        rr(ctx, rect.x, rect.y + 10, rect.width, rect.height, 40);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        rr(ctx, rect.x, rect.y, rect.width, rect.height, 40);
        ctx.fill();
        this.outlineText(this.modal === 'paused' ? 'PAUSED' : 'RUN COMPLETE', 360, rect.y + 72, 56, '#ffd23f', INK, 12);
        if (this.modal === 'results') {
            this.plainText(`Score: ${this.model.score}`, 360, rect.y + 142, 30, INK, 700);
            this.plainText(`Crystals earned: ${this.crystalsEarned}`, 360, rect.y + 184, 24, '#4a6290', 600);
            this.drawButton('modal_restart', { x: 146, y: rect.y + 240, width: 428, height: 64 }, 'PLAY AGAIN', '#3ddc84');
            this.drawButton('modal_home', { x: 146, y: rect.y + 326, width: 428, height: 64 }, 'HOME', '#8a7dff');
        } else {
            this.drawButton('modal_resume', { x: 146, y: rect.y + 150, width: 428, height: 64 }, 'RESUME', '#3ddc84');
            this.drawButton('modal_restart', { x: 146, y: rect.y + 238, width: 428, height: 64 }, 'RESTART', '#ff7a59');
            this.drawButton('modal_home', { x: 146, y: rect.y + 326, width: 428, height: 64 }, 'HOME', '#8a7dff');
        }
    }
};