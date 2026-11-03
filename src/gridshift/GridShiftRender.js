// GridShift renderer: chunky arcade look.
// Flat fills, thick dark outlines, hard offset shadows. Nothing is blurred or glowing,
// and every tile and panel is drawn in code, so the game ships without any image files.

const W = 720, H = 1280, CELL = 76, BOARD_Y = 180;
const FONT = '"Nunito", system-ui, sans-serif';
const DISPLAY_FONT = '"Lilita One", "Baloo 2", "Arial Black", system-ui, sans-serif';

// Tile colour ids 0..5. Particles in GridShiftMain use the same list.
export const TILE_COLORS = ['#FF5A5F', '#FF9F1C', '#FFD23F', '#34D17C', '#3D8BFF', '#9B5DE5'];
const HEAT_COLORS = ['#3D8BFF', '#FFD23F', '#FF9F1C', '#FF5A5F'];
const INK = '#2A2240';

const PALETTES = {
    classic: {
        name: 'ARCADE', bg: '#FFF1D0', dots: '#FFE2A3', panel: '#FFFBEF', slot: '#F7E4B9',
        slotEdge: '#E9D09A', ink: INK, muted: '#85708F', accent: '#34D17C', gold: '#FFD23F'
    },
    vaporwave: {
        name: 'BERRY', bg: '#FFE0EC', dots: '#FFC6DB', panel: '#FFF8FB', slot: '#FBD5E3',
        slotEdge: '#EDB4CA', ink: INK, muted: '#8F6A82', accent: '#FF6FA5', gold: '#FFD23F'
    },
    cyberpunk: {
        name: 'MINT', bg: '#DDF6E6', dots: '#C2EBD2', panel: '#F9FFFB', slot: '#CBECD8',
        slotEdge: '#A8D6BC', ink: INK, muted: '#5F8A78', accent: '#2FC9B0', gold: '#FFD23F'
    }
};

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

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const renderMethods = {
    palette() { return PALETTES[this.theme] || PALETTES.classic; },
    themeName() { return this.palette().name; },

    // ---------------------------------------------------------------- frame
    render() {
        const c = this.ctx;
        c.clearRect(0, 0, W, H);
        this.buttonHits = {};
        this.trayRects = [];
        c.save();
        if (this.shakeTimer > 0) {
            const s = this.shakeIntensity * this.shakeTimer / 0.35;
            c.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        }
        this.drawBackdrop();
        if (this.screen === 'game') this.renderGame();
        else this.renderHome();
        if (this.modal) this.renderModal();
        c.restore();
        this.drawFlash();
        if (this.showFps) this.drawFps();
    },

    drawBackdrop() {
        const c = this.ctx, p = this.palette();
        if (!this.bgCache || this.bgCache.key !== this.theme) {
            const oc = document.createElement('canvas');
            oc.width = W;
            oc.height = H;
            const g = oc.getContext('2d');
            g.fillStyle = p.bg;
            g.fillRect(0, 0, W, H);
            g.fillStyle = p.dots;
            for (let y = 0; y < H + 40; y += 44) {
                for (let x = ((y / 44) % 2) * 22; x < W + 44; x += 44) {
                    g.beginPath();
                    g.arc(x, y, 3.5, 0, Math.PI * 2);
                    g.fill();
                }
            }
            this.bgCache = { key: this.theme, canvas: oc };
        }
        c.drawImage(this.bgCache.canvas, 0, 0, W, H);
    },

    drawHeatBackdrop() {
        const tier = this.heatTier(this.model.heat);
        if (tier < 2) return;
        const c = this.ctx;
        c.save();
        c.globalAlpha = 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(this.clock * (tier === 3 ? 9 : 5)));
        c.fillStyle = HEAT_COLORS[tier];
        c.fillRect(0, 0, W, H);
        c.restore();
    },

    drawFlash() {
        if (!(this.flashTimer > 0)) return;
        const c = this.ctx;
        c.save();
        c.globalAlpha = Math.min(0.6, this.flashTimer / 0.35 * 0.6);
        c.fillStyle = '#fff';
        c.fillRect(0, 0, W, H);
        c.restore();
    },

    drawFps() {
        const c = this.ctx, s = this.frameStats;
        c.save();
        c.fillStyle = 'rgba(20,24,40,.72)';
        rr(c, 8, 1236, 250, 32, 8);
        c.fill();
        c.fillStyle = '#fff';
        c.font = '700 15px monospace';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(`${Math.round(s.fps)} fps · ${s.avg.toFixed(1)} ms · res ${this.dprCap}x`, 18, 1252);
        c.restore();
    },

    // ---------------------------------------------------------------- building blocks
    text(t, x, y, size, color = this.palette().ink, weight = 700, align = 'center', maxWidth = 0) {
        const c = this.ctx;
        c.save();
        c.textAlign = align;
        c.textBaseline = 'middle';
        c.font = `${weight} ${size}px ${FONT}`;
        if (maxWidth) {
            const w = c.measureText(t).width;
            if (w > maxWidth) c.font = `${weight} ${Math.floor(size * maxWidth / w)}px ${FONT}`;
        }
        c.fillStyle = color;
        c.fillText(t, x, y);
        c.restore();
    },

    // Chunky display text. Shrinks to fit maxWidth when given.
    display(t, x, y, size, color = this.palette().ink, align = 'center', maxWidth = 0) {
        const c = this.ctx;
        c.save();
        c.textAlign = align;
        c.textBaseline = 'middle';
        c.font = `400 ${size}px ${DISPLAY_FONT}`;
        if (maxWidth) {
            const w = c.measureText(t).width;
            if (w > maxWidth) c.font = `400 ${Math.floor(size * maxWidth / w)}px ${DISPLAY_FONT}`;
        }
        c.fillStyle = color;
        c.fillText(t, x, y);
        c.restore();
    },

    // Big outlined headline with a hard drop shadow.
    title(t, x, y, size = 56, fill = this.palette().ink, outline = null) {
        const c = this.ctx, p = this.palette();
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `400 ${size}px ${DISPLAY_FONT}`;
        c.lineJoin = 'round';
        if (outline) {
            c.lineWidth = size * 0.2;
            c.strokeStyle = p.ink;
            c.strokeText(t, x, y + size * 0.07);
            c.lineWidth = size * 0.16;
            c.strokeText(t, x, y);
        }
        c.fillStyle = fill;
        c.fillText(t, x, y);
        c.restore();
    },

    panel(r, fill = this.palette().panel, rad = 26, shadow = true) {
        const c = this.ctx, p = this.palette(), lw = 4;
        c.save();
        if (shadow) {
            c.fillStyle = p.ink;
            rr(c, r.x, r.y + 7, r.width, r.height, rad);
            c.fill();
        }
        c.fillStyle = fill;
        rr(c, r.x, r.y, r.width, r.height, rad);
        c.fill();
        c.lineWidth = lw;
        c.strokeStyle = p.ink;
        rr(c, r.x + lw / 2, r.y + lw / 2, r.width - lw, r.height - lw, rad);
        c.stroke();
        c.restore();
    },

    drawButton(name, r, label, color = this.palette().accent, kind = 'secondary', fontSize) {
        const c = this.ctx, p = this.palette(), depth = 7, lw = 4;
        this.buttonHits[name] = r;
        const rad = Math.min(22, r.height / 2);
        const faceH = r.height - depth;
        c.save();
        c.fillStyle = p.ink;
        rr(c, r.x, r.y + depth, r.width, faceH, rad);
        c.fill();
        c.fillStyle = kind === 'primary' ? color : p.panel;
        rr(c, r.x, r.y, r.width, faceH, rad);
        c.fill();
        if (kind === 'primary') {
            c.fillStyle = 'rgba(255,255,255,.35)';
            rr(c, r.x + 12, r.y + 9, r.width - 24, Math.min(12, faceH * 0.2), 6);
            c.fill();
        }
        c.lineWidth = lw;
        c.strokeStyle = p.ink;
        rr(c, r.x + lw / 2, r.y + lw / 2, r.width - lw, faceH - lw, rad);
        c.stroke();
        c.restore();
        const size = Math.round((fontSize || Math.min(27, r.height * 0.36)) * 1.12);
        this.display(label, r.x + r.width / 2, r.y + faceH / 2 + 1, size, p.ink, 'center', r.width - 28);
    },

    drawPill(x, y, w, h, label, fill = this.palette().panel, color = this.palette().ink) {
        const c = this.ctx, p = this.palette();
        c.save();
        c.fillStyle = fill;
        rr(c, x, y, w, h, h / 2);
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = p.ink;
        rr(c, x + 1.5, y + 1.5, w - 3, h - 3, h / 2);
        c.stroke();
        c.restore();
        this.display(label, x + w / 2, y + h / 2 + 1, Math.min(22, h * 0.5), color, 'center', w - 24);
    },

    drawStatus(y, fallback, force = false) {
        const active = !force && this.statusTimer > 0 && this.statusMessage;
        const msg = active ? this.statusMessage : fallback;
        if (!msg) return;
        const c = this.ctx, p = this.palette();
        c.save();
        c.font = `800 19px ${FONT}`;
        const natural = c.measureText(msg).width;
        c.restore();
        const maxText = 600;
        const size = natural > maxText ? Math.floor(19 * maxText / natural) : 19;
        const w = Math.min(650, Math.min(natural, maxText) + 44);
        if (active) {
            c.save();
            c.fillStyle = p.ink;
            rr(c, W / 2 - w / 2, y - 21, w, 42, 18);
            c.fill();
            c.restore();
        }
        this.text(msg, W / 2, y, size, active ? '#FFF7E0' : p.muted, 800);
    },

    // ---------------------------------------------------------------- tiles
    tileSprite(color) {
        const key = ((color % 6) + 6) % 6;
        this.tileCache = this.tileCache || {};
        if (!this.tileCache[key]) {
            const S = 160, oc = document.createElement('canvas');
            oc.width = S;
            oc.height = S;
            const g = oc.getContext('2d');
            const bx = 6, by = 4, bw = 148, bh = 138, r = 32, drop = 12;
            g.fillStyle = INK;
            rr(g, bx, by + drop, bw, bh, r);
            g.fill();
            g.fillStyle = TILE_COLORS[key];
            rr(g, bx, by, bw, bh, r);
            g.fill();
            g.save();
            rr(g, bx, by, bw, bh, r);
            g.clip();
            g.fillStyle = 'rgba(0,0,0,.15)';
            g.fillRect(bx, by + bh - 30, bw, 30);
            g.restore();
            g.fillStyle = 'rgba(255,255,255,.42)';
            rr(g, bx + 18, by + 14, bw - 54, 22, 11);
            g.fill();
            g.lineWidth = 10;
            g.strokeStyle = INK;
            rr(g, bx + 5, by + 5, bw - 10, bh - 10, r - 4);
            g.stroke();
            this.tileCache[key] = oc;
        }
        return this.tileCache[key];
    },

    drawTile(x, y, size, color, alpha = 1) {
        const c = this.ctx;
        c.save();
        c.globalAlpha = alpha;
        c.drawImage(this.tileSprite(color), x, y, size, size);
        c.restore();
    },

    drawGridCache(b) {
        if (!this.gridCache || this.gridCache.key !== this.theme) {
            const p = this.palette();
            const oc = document.createElement('canvas');
            oc.width = CELL * 16;
            oc.height = CELL * 16;
            const g = oc.getContext('2d');
            g.scale(2, 2);
            g.fillStyle = p.slot;
            g.fillRect(0, 0, CELL * 8, CELL * 8);
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    g.fillStyle = ((x + y) & 1) ? p.slotEdge : p.slotEdge;
                    g.globalAlpha = ((x + y) & 1) ? 0.55 : 0.8;
                    rr(g, x * CELL + 5, y * CELL + 5, CELL - 10, CELL - 10, 13);
                    g.fill();
                }
            }
            g.globalAlpha = 1;
            this.gridCache = { key: this.theme, canvas: oc };
        }
        this.ctx.drawImage(this.gridCache.canvas, b.x, b.y, CELL * 8, CELL * 8);
    },

    drawHeldPiece(drag) {
        const c = this.ctx;
        const cols = Math.max(...drag.piece.cells.map(a => a.x)) + 1;
        const rows = Math.max(...drag.piece.cells.map(a => a.y)) + 1;
        const t = Math.min(1, (this.clock - this.dragStartClock) / 0.09);
        const s = 0.62 + 0.38 * (1 - Math.pow(1 - t, 3));
        const size = drag.size * s;
        const cx = drag.left + cols * drag.size / 2;
        const cy = drag.top + rows * drag.size / 2;
        const left = cx - cols * size / 2;
        const top = cy - rows * size / 2;
        c.save();
        c.globalAlpha = drag.overlapsBoard ? 0.62 : 0.97;
        drag.piece.cells.forEach(a => this.drawTile(left + a.x * size, top + a.y * size, size, drag.piece.color));
        c.restore();
    },

    drawParticles(rect) {
        if (!this.particles || !this.particles.length) return;
        const c = this.ctx;
        c.save();
        if (rect) {
            rr(c, rect.x - 10, rect.y - 10, rect.width + 20, rect.height + 20, 20);
            c.clip();
        }
        c.lineWidth = 2;
        c.strokeStyle = INK;
        for (const q of this.particles) {
            const life = Math.max(0, 1 - q.age / q.life);
            const r = q.radius * (0.6 + 0.6 * life) + 2;
            c.save();
            c.globalAlpha = Math.min(1, life * 1.6);
            c.translate(q.x, q.y);
            c.rotate(q.age * 7 + q.x * 0.05);
            c.fillStyle = q.color;
            c.fillRect(-r, -r, r * 2, r * 2);
            c.strokeRect(-r, -r, r * 2, r * 2);
            c.restore();
        }
        c.restore();
    },

    // ---------------------------------------------------------------- game meters
    drawHeatMeter(b) {
        const c = this.ctx, p = this.palette(), m = this.model;
        const heat = m.heat, max = m.constructor.HEAT_MAX, tier = this.heatTier(heat), col = HEAT_COLORS[tier];
        const x = 8, w = 26, y = b.y, h = b.height;
        c.save();
        c.fillStyle = p.ink;
        rr(c, x, y + 5, w, h, 13);
        c.fill();
        c.fillStyle = p.panel;
        rr(c, x, y, w, h, 13);
        c.fill();
        const frac = (heat - 1) / (max - 1);
        if (frac > 0) {
            const fh = Math.max(w - 8, (h - 8) * frac);
            c.fillStyle = col;
            rr(c, x + 4, y + h - 4 - fh, w - 8, fh, 9);
            c.fill();
        }
        c.strokeStyle = 'rgba(42,34,64,.35)';
        c.lineWidth = 2;
        for (let i = 1; i < max - 1; i++) {
            const ty = y + h - h * i / (max - 1);
            c.beginPath();
            c.moveTo(x + 5, ty);
            c.lineTo(x + w - 5, ty);
            c.stroke();
        }
        c.lineWidth = 4;
        c.strokeStyle = p.ink;
        rr(c, x + 2, y + 2, w - 4, h - 4, 12);
        c.stroke();
        c.restore();
        this.title(`×${heat}`, x + w / 2, y - 11, 20, col, true);
        if (tier >= 1) {
            c.save();
            c.globalAlpha = 0.55 + 0.4 * Math.sin(this.clock * (4 + tier * 2));
            c.lineWidth = 8;
            c.strokeStyle = col;
            rr(c, b.x - 24, b.y - 24, b.width + 48, b.height + 48, 38);
            c.stroke();
            c.restore();
        }
    },

    drawShiftMeter(x, y, w, h) {
        const c = this.ctx, p = this.palette(), m = this.model;
        c.save();
        c.fillStyle = p.panel;
        rr(c, x, y, w, h, h / 2);
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = p.ink;
        rr(c, x + 1.5, y + 1.5, w - 3, h - 3, h / 2);
        c.stroke();
        c.restore();
        this.display('SHIFT', x + 16, y + h / 2 + 1, 17, p.ink, 'left');
        for (let i = 0; i < m.constructor.SHIFT_MAX_CHARGES; i++) {
            const cx = x + 100 + i * 34, cy = y + h / 2, on = i < m.shiftCharges;
            c.save();
            c.beginPath();
            c.arc(cx, cy, 11, 0, Math.PI * 2);
            c.fillStyle = on ? p.gold : p.slot;
            c.fill();
            c.lineWidth = 3;
            c.strokeStyle = p.ink;
            c.stroke();
            c.restore();
        }
        this.display(`${m.shiftProgress}/${m.constructor.SHIFT_LINES_PER_CHARGE}`, x + w - 30, y + h / 2 + 1, 17, p.muted);
    },

    drawShiftGesture(b) {
        const g = this.shiftGesture;
        if (!g) return;
        const c = this.ctx, p = this.palette(), ready = this.model.shiftCharges > 0;
        c.save();
        rr(c, b.x, b.y, b.width, b.height, 15);
        c.clip();
        c.globalAlpha = ready ? 0.8 : 0.4;
        c.fillStyle = ready ? p.gold : '#FF5A5F';
        if (g.axis !== 'col') c.fillRect(b.x, b.y + g.cell.y * CELL, b.width, CELL);
        if (g.axis !== 'row') c.fillRect(b.x + g.cell.x * CELL, b.y, CELL, b.height);
        c.restore();
    },

    // ---------------------------------------------------------------- home
    renderHome() {
        const p = this.palette();
        const letters = 'GRIDSHIFT';
        const c = this.ctx;
        c.save();
        c.font = `400 86px ${DISPLAY_FONT}`;
        const widths = [...letters].map(ch => c.measureText(ch).width + 2);
        c.restore();
        const total = widths.reduce((a, b) => a + b, 0);
        let lx = W / 2 - total / 2;
        for (let i = 0; i < letters.length; i++) {
            const bob = Math.sin(this.clock * 2.2 + i * 0.6) * 3;
            this.title(letters[i], lx + widths[i] / 2, 118 + bob, 86, TILE_COLORS[i % 6], true);
            lx += widths[i];
        }
        this.display('THE BLOCK PUZZLE WHERE YOU SLIDE THE BOARD', W / 2, 196, 19, p.ink, 'center', 620);

        this.drawButton('sound_toggle', { x: 18, y: 18, width: 104, height: 52 }, this.muted ? 'SOUND OFF' : 'SOUND ON', p.panel, 'secondary', 14);
        this.drawButton('toggle_theme', { x: 598, y: 18, width: 104, height: 52 }, this.themeName(), p.panel, 'secondary', 16);

        this.drawHero({ x: 48, y: 232, width: 624, height: 292 });

        this.drawButton('start_shift', { x: 58, y: 560, width: 604, height: 94 }, 'PLAY SHIFT', p.accent, 'primary', 36);
        this.drawButton('start_classic', { x: 58, y: 676, width: 194, height: 74 }, 'CLASSIC', p.panel, 'secondary', 21);
        this.drawButton('start_fever', { x: 263, y: 676, width: 194, height: 74 }, 'FEVER · 2M', p.panel, 'secondary', 21);
        this.drawButton('start_daily', { x: 468, y: 676, width: 194, height: 74 }, this.dailyLabel(), p.panel, 'secondary', 18);

        this.display('BEST SCORES', W / 2, 800, 17, p.muted);
        this.drawPill(58, 820, 190, 48, `SHIFT  ${this.bestScores.shift || 0}`);
        this.drawPill(265, 820, 190, 48, `CLASSIC  ${this.bestScores.classic || 0}`);
        this.drawPill(472, 820, 190, 48, `FEVER  ${this.bestScores.fever || 0}`);

        const how = { x: 58, y: 906, width: 604, height: 236 };
        this.panel(how, p.panel, 28, true);
        this.display('HOW IT WORKS', W / 2, how.y + 38, 24, p.ink);
        const rows = [
            ['DRAG pieces onto the board and fill rows or columns.', TILE_COLORS[3]],
            ['SWIPE a row or column to slide it. Clear 3 lines for a charge.', TILE_COLORS[4]],
            ['CLEAR lines back to back to build HEAT up to ×8.', TILE_COLORS[0]]
        ];
        rows.forEach((row, i) => {
            const cy = how.y + 92 + i * 56;
            c.save();
            c.beginPath();
            c.arc(how.x + 44, cy, 19, 0, Math.PI * 2);
            c.fillStyle = row[1];
            c.fill();
            c.lineWidth = 4;
            c.strokeStyle = p.ink;
            c.stroke();
            c.restore();
            this.display(String(i + 1), how.x + 44, cy + 1, 22, '#fff');
            this.text(row[0], how.x + 78, cy, 17, p.ink, 800, 'left', how.width - 100);
        });

        this.drawPill(210, 1172, 300, 52, `✦  ${this.crystals} CRYSTALS`, p.panel, p.ink);
    },

    // A looping mini board: one row at a time slides a cell, with wraparound.
    drawHero(r) {
        const c = this.ctx, p = this.palette();
        this.panel(r, p.slot, 32, true);
        const size = 52, cols = 8, rowsN = 5;
        const gx = r.x + (r.width - cols * size) / 2, gy = r.y + (r.height - rowsN * size) / 2;
        const SLIDE = 2.6;
        const cycle = Math.floor(this.clock / SLIDE);
        const frac = (this.clock % SLIDE) / SLIDE;
        const slideT = frac < 0.4 ? easeInOut(frac / 0.4) : 1;
        const dirOf = k => (k % 2 === 0 ? 1 : -1);
        const done = cycle % 10;
        c.save();
        rr(c, r.x + 10, r.y + 10, r.width - 20, r.height - 20, 24);
        c.clip();
        for (let row = 0; row < rowsN; row++) {
            let shift = 0;
            for (let k = 0; k < done; k++) if (k % rowsN === row) shift += dirOf(k);
            const active = cycle % rowsN === row;
            const offset = shift + (active ? slideT * dirOf(cycle) : 0);
            if (active && slideT < 1) {
                c.fillStyle = 'rgba(255,210,63,.55)';
                c.fillRect(gx - 20, gy + row * size, cols * size + 40, size);
            }
            for (let x = 0; x < cols; x++) {
                if (((x * 37 + row * 91 + 7) % 11) <= 3) continue;
                let pos = x + offset;
                pos = ((pos % cols) + cols) % cols;
                const color = (x * 2 + row * 3) % 6;
                this.drawTile(gx + pos * size, gy + row * size, size, color);
                if (pos > cols - 1) this.drawTile(gx + (pos - cols) * size, gy + row * size, size, color);
            }
        }
        c.restore();
    },

    // ---------------------------------------------------------------- game
    renderGame() {
        const c = this.ctx, p = this.palette();
        const boardSize = CELL * 8, boardX = (W - boardSize) / 2, boardY = BOARD_Y, bottom = boardY + boardSize;
        this.cellSize = CELL;
        this.boardRect = { x: boardX, y: boardY, width: boardSize, height: boardSize };

        this.drawHeatBackdrop();
        this.panel({ x: 32, y: 18, width: 656, height: 144 }, p.panel, 28, true);
        this.display('SCORE', W / 2, 46, 16, p.muted);
        this.title(String(this.model.score), W / 2, 86, 54, p.ink);
        const canUndo = this.model.history.length > 0 && this.crystals >= 2;
        this.drawButton('pause', { x: 44, y: 32, width: 84, height: 88 }, 'Ⅱ', p.panel, 'secondary', 25);
        this.drawButton('undo_move', { x: 592, y: 32, width: 84, height: 88 }, 'UNDO', p.panel, 'secondary', 15);
        if (!canUndo) {
            c.save();
            c.fillStyle = 'rgba(42,34,64,.28)';
            rr(c, 592, 32, 84, 81, 22);
            c.fill();
            c.restore();
        }
        const best = (this.mode === 'daily' ? this.dailyBestToday() : this.bestScores[this.mode]) || 0;
        this.drawPill(140, 121, 196, 32, `BEST  ${best}`, p.panel, p.muted);
        if (this.model.shiftEnabled) {
            this.drawShiftMeter(376, 119, 230, 36);
        } else {
            const mode = this.mode === 'fever' ? `FEVER · ${Math.ceil(this.secondsLeft)}s` : this.mode === 'daily' ? 'DAILY RUN' : 'CLASSIC';
            this.drawPill(396, 121, 196, 32, mode, p.panel, this.mode === 'fever' ? '#E0702F' : p.ink);
        }

        const b = this.boardRect;
        this.panel({ x: b.x - 13, y: b.y - 13, width: b.width + 26, height: b.height + 26 }, p.panel, 29, true);
        c.fillStyle = p.slot;
        rr(c, b.x, b.y, b.width, b.height, 15);
        c.fill();
        c.save();
        rr(c, b.x, b.y, b.width, b.height, 15);
        c.clip();
        this.drawGridCache(b);
        this.drawShiftGesture(b);
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const val = this.model.board[y][x];
                if (val < 0) continue;
                const px = b.x + x * CELL, py = b.y + y * CELL;
                const anim = this.snapAnimations && this.snapAnimations.get(`${x},${y}`);
                if (anim) {
                    const progress = Math.max(0, Math.min(1, (anim.elapsed - anim.delay) / anim.duration));
                    const t = progress - 1;
                    const eased = anim.slide ? 1 + t * t * t : 1 + 2.70158 * t * t * t + 1.70158 * t * t;
                    const ax = anim.fromX + (anim.targetX - anim.fromX) * eased;
                    const ay = anim.fromY + (anim.targetY - anim.fromY) * eased;
                    const size = anim.slide ? CELL : CELL * (0.8 + 0.2 * eased);
                    this.drawTile(ax + (CELL - size) / 2, ay + (CELL - size) / 2, size, anim.color, anim.slide ? 1 : 0.6 + 0.4 * progress);
                } else {
                    this.drawTile(px, py, CELL, val);
                }
            }
        }
        c.restore();
        this.drawHeatMeter(b);

        const drag = this.dragIndex >= 0 ? this.dragLayout() : null;
        let dragHint = '';
        if (drag && drag.overlapsBoard) dragHint = this.drawPlacementPreview(drag, b);
        this.drawParticles(b);

        if (!dragHint && this.tutorialStep >= 0 && !(this.statusTimer > 0 && this.statusMessage)) {
            this.drawTutorial(bottom + 40);
        } else {
            const hint = this.model.shiftEnabled
                ? 'Drag pieces in. Swipe a row or column to slide it.'
                : 'Drag pieces onto the board. Clear lines to make space.';
            this.drawStatus(bottom + 40, dragHint || hint, Boolean(dragHint));
        }

        const trayY = 860;
        this.panel({ x: 30, y: trayY, width: 660, height: 360 }, p.panel, 28, true);
        this.display('NEXT PIECES', W / 2, trayY + 32, 20, p.muted);
        for (let i = 0; i < 3; i++) {
            const r = { x: 43 + i * 212, y: trayY + 54, width: 202, height: 276 };
            this.trayRects.push(r);
            c.save();
            c.fillStyle = p.slot;
            rr(c, r.x, r.y, r.width, r.height, 20);
            c.fill();
            c.lineWidth = 3;
            c.strokeStyle = p.slotEdge;
            rr(c, r.x + 1.5, r.y + 1.5, r.width - 3, r.height - 3, 19);
            c.stroke();
            c.restore();
            const piece = this.model.tray[i];
            if (!piece || piece.used) {
                this.display('USED', r.x + r.width / 2, r.y + r.height / 2, 20, p.slotEdge);
                continue;
            }
            const cols = Math.max(...piece.cells.map(a => a.x)) + 1;
            const rows = Math.max(...piece.cells.map(a => a.y)) + 1;
            const size = Math.min(50, 170 / cols, 218 / rows);
            const ox = r.x + (r.width - cols * size) / 2;
            const oy = r.y + 24 + (218 - rows * size) / 2;
            c.save();
            c.globalAlpha = this.dragIndex === i ? 0.28 : 1;
            piece.cells.forEach(a => this.drawTile(ox + a.x * size, oy + a.y * size, size, piece.color));
            c.restore();
        }
        this.drawPraise();
        if (drag) this.drawHeldPiece(drag);
    },

    drawTutorial(y) {
        const c = this.ctx, p = this.palette(), x = 36, w = 648, h = 54;
        const steps = [
            ['Drag a piece onto the board.', 'An outline shows where it will land.'],
            ['Fill a whole row or column to clear it.', 'Gold cells show what will clear.'],
            ['Nice clear! Leave room for the next pieces.', 'The run ends when none of them fit.']
        ];
        const lines = steps[this.tutorialStep];
        if (!lines) return;
        c.save();
        c.fillStyle = p.ink;
        rr(c, x, y - h / 2, w, h, 20);
        c.fill();
        c.restore();
        this.text(lines[0], x + 22, y - 11, 18, '#FFF7E0', 800, 'left');
        this.text(lines[1], x + 22, y + 13, 15, 'rgba(255,247,224,.78)', 700, 'left');
        c.save();
        c.fillStyle = 'rgba(255,255,255,.2)';
        rr(c, x + w - 86, y - 16, 70, 32, 16);
        c.fill();
        c.restore();
        this.display('SKIP', x + w - 51, y + 1, 16, '#FFF7E0');
        this.buttonHits.tutorial_skip = { x: x + w - 96, y: y - h / 2, width: 96, height: h };
    },

    drawPlacementPreview(drag, b) {
        const c = this.ctx, p = this.palette(), cells = drag.piece.cells, o = drag.origin;
        const fit = this.model.canPlace(cells, o), pulse = 0.5 + 0.5 * Math.sin(this.clock * 8);
        if (!fit) {
            const off = cells.some(a => {
                const x = o.x + a.x, y = o.y + a.y;
                return x < 0 || x > 7 || y < 0 || y > 7;
            });
            for (const a of cells) {
                const gx = o.x + a.x, gy = o.y + a.y;
                if (gx < 0 || gx > 7 || gy < 0 || gy > 7) continue;
                const px = b.x + gx * CELL, py = b.y + gy * CELL;
                c.save();
                rr(c, px + 4, py + 4, CELL - 8, CELL - 8, 14);
                c.clip();
                c.fillStyle = 'rgba(255,90,95,.32)';
                c.fillRect(px, py, CELL, CELL);
                c.strokeStyle = 'rgba(255,90,95,.7)';
                c.lineWidth = 4;
                for (let k = -CELL; k < CELL; k += 16) {
                    c.beginPath();
                    c.moveTo(px + k, py + CELL);
                    c.lineTo(px + k + CELL, py);
                    c.stroke();
                }
                c.restore();
                c.save();
                c.setLineDash([9, 7]);
                c.strokeStyle = '#E0383E';
                c.lineWidth = 4;
                rr(c, px + 4, py + 4, CELL - 8, CELL - 8, 14);
                c.stroke();
                c.restore();
            }
            return off ? 'Part of that piece is off the board.' : 'No room there. Pieces cannot overlap.';
        }
        const placed = new Set(cells.map(a => `${o.x + a.x},${o.y + a.y}`));
        const clearing = new Set();
        let lines = 0;
        for (let i = 0; i < 8; i++) {
            let row = true, col = true;
            for (let j = 0; j < 8; j++) {
                if (this.model.board[i][j] < 0 && !placed.has(`${j},${i}`)) row = false;
                if (this.model.board[j][i] < 0 && !placed.has(`${i},${j}`)) col = false;
            }
            if (row) {
                lines++;
                for (let x = 0; x < 8; x++) clearing.add(`${x},${i}`);
            }
            if (col) {
                lines++;
                for (let y = 0; y < 8; y++) clearing.add(`${i},${y}`);
            }
        }
        for (const key of clearing) {
            const [gx, gy] = key.split(',').map(Number);
            c.save();
            c.globalAlpha = 0.5 + 0.25 * pulse;
            c.fillStyle = p.gold;
            rr(c, b.x + gx * CELL + 3, b.y + gy * CELL + 3, CELL - 6, CELL - 6, 15);
            c.fill();
            c.restore();
        }
        for (const a of cells) {
            const px = b.x + (o.x + a.x) * CELL, py = b.y + (o.y + a.y) * CELL;
            this.drawTile(px, py, CELL, drag.piece.color, 0.8 + 0.15 * pulse);
        }
        for (const key of clearing) {
            const [gx, gy] = key.split(',').map(Number);
            const cx = b.x + (gx + 0.5) * CELL, cy = b.y + (gy + 0.5) * CELL, r = 12;
            c.save();
            c.globalAlpha = 0.7 + 0.3 * pulse;
            c.fillStyle = '#fff';
            c.strokeStyle = p.ink;
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(cx, cy - r);
            c.lineTo(cx + r * 0.6, cy);
            c.lineTo(cx, cy + r);
            c.lineTo(cx - r * 0.6, cy);
            c.closePath();
            c.fill();
            c.stroke();
            c.restore();
        }
        return lines > 0 ? `Clears ${lines} line${lines === 1 ? '' : 's'}.` : 'Release to place it.';
    },

    showPraise(lines, combo) {
        this.praise = {
            text: combo >= 3 ? `COMBO ×${combo}` : lines >= 4 ? 'INCREDIBLE' : lines === 3 ? 'AMAZING' : lines === 2 ? 'NICE CLEAR' : 'GOOD MOVE',
            start: this.clock
        };
    },

    drawPraise() {
        if (!this.praise) return;
        const age = this.clock - this.praise.start, life = 0.9;
        if (age >= life) {
            this.praise = null;
            return;
        }
        const scale = age < 0.2 ? 0.7 + age * 2.1 : 1.12 - Math.max(0, age - 0.2) * 0.12;
        const alpha = age > 0.62 ? 1 - (age - 0.62) / (life - 0.62) : 1;
        const c = this.ctx;
        c.save();
        c.globalAlpha = alpha;
        c.translate(W / 2, this.boardRect.y + 215 - age * 22);
        c.scale(scale, scale);
        this.title(this.praise.text, 0, 0, 56, '#FFD23F', true);
        c.restore();
    },

    // ---------------------------------------------------------------- modal
    renderModal() {
        const c = this.ctx, p = this.palette();
        c.fillStyle = 'rgba(42,34,64,.55)';
        c.fillRect(0, 0, W, H);
        const daily = this.modal === 'results' && this.mode === 'daily';
        const r = { x: 72, y: daily ? 307 : 360, width: 576, height: daily ? 630 : 524 };
        this.panel(r, p.panel, 36, true);
        this.title(this.modal === 'paused' ? 'TAKE A BREATHER' : 'RUN COMPLETE', W / 2, r.y + 78, 50, p.ink);
        if (this.modal === 'results') {
            this.display('FINAL SCORE', W / 2, r.y + 150, 20, p.muted);
            this.title(String(this.model.score), W / 2, r.y + 208, 70, p.accent, true);
            this.drawPill(190, r.y + 250, 340, 48, `✦  ${this.crystalsEarned} CRYSTALS EARNED`, p.slot, p.ink);
            this.drawButton('modal_restart', { x: 126, y: r.y + 326, width: 468, height: 76 }, 'PLAY AGAIN', p.accent, 'primary', 26);
            if (daily) {
                this.drawButton('modal_share', { x: 126, y: r.y + 416, width: 468, height: 68 }, 'SHARE RESULT', p.gold, 'primary', 22);
                this.display(`TODAY'S BEST  ${this.daily.best}  ·  STREAK  ${this.currentStreak()}`, W / 2, r.y + 596, 19, p.muted, 'center', 520);
            }
            this.drawButton('modal_home', { x: 126, y: r.y + (daily ? 498 : 416), width: 468, height: 68 }, 'HOME', p.panel, 'secondary', 22);
        } else {
            this.text('The board will wait for you.', W / 2, r.y + 150, 19, p.muted, 800);
            this.drawButton('modal_resume', { x: 126, y: r.y + 200, width: 468, height: 76 }, 'KEEP PLAYING', p.accent, 'primary', 26);
            this.drawButton('modal_restart', { x: 126, y: r.y + 296, width: 468, height: 68 }, 'START OVER', p.panel, 'secondary', 22);
            this.drawButton('modal_home', { x: 126, y: r.y + 384, width: 468, height: 68 }, 'HOME', p.panel, 'secondary', 22);
        }
    }
};
