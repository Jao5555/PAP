'use strict';
// ═══════════════════════════════════════════════════════════════
//  particles.js  —  Partículas, gotas de sangue, texto flutuante
// ═══════════════════════════════════════════════════════════════

// ── Partícula genérica (faíscas, explosões) ──────────────────────
function Ptcl(x, y, vx, vy, col, sz, life) {
  this.x = x; this.y = y; this.vx = vx; this.vy = vy;
  this.col = col; this.sz = sz; this.life = this.ml = life; this.dead = false;
}
Ptcl.prototype.upd = function(dt) {
  this.x += this.vx * dt; this.y += this.vy * dt;
  this.vy += 55 * dt; this.vx *= 0.99;
  this.life -= dt; if (this.life <= 0) this.dead = true;
};
Ptcl.prototype.drw = function(ctx) {
  var t = this.life / this.ml;
  ctx.globalAlpha = t; ctx.fillStyle = this.col;
  ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0.1, this.sz * t), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
};

// ── Gota de Sangue (recurso coletável) ───────────────────────────
function BDrop(x, y, val) {
  this.x = x; this.y = y; this.val = val;
  this.life = 22; this.dead = false; this.done = false; this.anim = 0;
  this.wb = Math.random() * Math.PI * 2;
}
BDrop.prototype.upd = function(dt) {
  this.wb += dt * 2.2; this.life -= dt;
  if (this.done) { this.anim += dt * 5; if (this.anim >= 1) this.dead = true; }
  if (this.life <= 0) this.dead = true;
};
BDrop.prototype.drw = function(ctx) {
  if (this.done) {
    var t = 1 - this.anim;
    ctx.globalAlpha = t; ctx.fillStyle = '#cc2244';
    ctx.beginPath(); ctx.arc(this.x, this.y - this.anim * 22, 5 * t, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; return;
  }
  var p = 0.72 + 0.28 * Math.sin(this.wb);
  var fl = this.life < 5 ? (Math.sin(this.wb * 7) > 0 ? 1 : 0.18) : 1;
  ctx.globalAlpha = 0.88 * fl;
  ctx.shadowBlur = 8; ctx.shadowColor = '#ff0044';
  ctx.fillStyle = '#cc2244';
  ctx.beginPath(); ctx.arc(this.x, this.y, 5.5 * p, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff4466';
  ctx.beginPath(); ctx.arc(this.x - 1.5, this.y - 1.5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.globalAlpha = 1;
};

// ── Texto flutuante (dano, ouro, mensagens) ──────────────────────
function FText(x, y, txt, col, sz) {
  this.x = x; this.y = y; this.txt = txt; this.col = col; this.sz = sz || 13;
  this.vy = -46; this.life = 1.35; this.ml = 1.35; this.dead = false;
}
FText.prototype.upd = function(dt) {
  this.y += this.vy * dt; this.vy *= 0.94;
  this.life -= dt; if (this.life <= 0) this.dead = true;
};
FText.prototype.drw = function(ctx) {
  ctx.save();
  ctx.globalAlpha = this.life / this.ml;
  ctx.shadowBlur = 5; ctx.shadowColor = this.col;
  ctx.fillStyle = this.col; ctx.font = 'bold ' + this.sz + 'px Orbitron,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(this.txt, this.x, this.y);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.restore();
};

// ── Gestor global de partículas ──────────────────────────────────
var PS = {
  p: [], b: [], f: [],

  upd: function(dt) {
    for (var i = this.p.length - 1; i >= 0; i--) { this.p[i].upd(dt); if (this.p[i].dead) this.p.splice(i, 1); }
    for (var i = this.b.length - 1; i >= 0; i--) { this.b[i].upd(dt); if (this.b[i].dead) this.b.splice(i, 1); }
    for (var i = this.f.length - 1; i >= 0; i--) { this.f[i].upd(dt); if (this.f[i].dead) this.f.splice(i, 1); }
  },

  drw: function(ctx) {
    for (var i = 0; i < this.p.length; i++) this.p[i].drw(ctx);
    for (var i = 0; i < this.b.length; i++) this.b[i].drw(ctx);
    for (var i = 0; i < this.f.length; i++) this.f[i].drw(ctx);
  },

  // Explosão de partículas pequenas
  burst: function(x, y, c1, c2, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = 35 + Math.random() * 90;
      this.p.push(new Ptcl(
        x + U.rnd(-3, 3), y + U.rnd(-3, 3),
        Math.cos(a) * s, Math.sin(a) * s - 28,
        Math.random() < 0.5 ? c1 : c2,
        1.5 + Math.random() * 3, 0.3 + Math.random() * 0.6
      ));
    }
  },

  blood: function(x, y, v) { this.b.push(new BDrop(x, y, v)); },
  txt:   function(x, y, t, col, sz) { this.f.push(new FText(x, y, t, col, sz)); },

  // Coleta todas as gotas pendentes, devolve o total
  collectAll: function() {
    var tot = 0;
    for (var i = 0; i < this.b.length; i++) {
      if (!this.b[i].done) { this.b[i].done = true; tot += this.b[i].val; }
    }
    return tot;
  },

  pending: function() {
    var n = 0;
    for (var i = 0; i < this.b.length; i++) if (!this.b[i].done) n++;
    return n;
  },

  reset: function() { this.p = []; this.b = []; this.f = []; }
};
