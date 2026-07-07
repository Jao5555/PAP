'use strict';
// ═══════════════════════════════════════════════════════════════
//  projectile.js  —  Projéteis: balas, granadas (arco), chamas, AOE
// ═══════════════════════════════════════════════════════════════

function Proj(sx, sy, tx, ty, dmg, aoe, spd, ttype, tgt) {
  this.x = sx; this.y = sy;
  this.dmg = dmg; this.aoe = aoe; this.spd = spd; this.ttype = ttype; this.tgt = tgt;
  this.dead = false; this.sk = 9999; this.trail = []; this.life = 4.5;

  var dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
  this.vx = (dx/d) * spd; this.vy = (dy/d) * spd;

  var cols = { pistol:'#88aaff', sniper:'#00ff88', grenade:'#ffcc22', mortar:'#ffaa22', minigun:'#aaccff', flamethrower:'#ff6600' };
  var gls  = { pistol:'#4466ff', sniper:'#00cc55', grenade:'#ffaa00', mortar:'#ff6600', minigun:'#88aaff', flamethrower:'#ff3300' };
  this.col = cols[ttype] || '#fff'; this.glow = gls[ttype] || '#fff';

  this.expl = false; this.eR = 0; this.eMax = 0; this.eX = 0; this.eY = 0;
}

Proj.prototype.upd = function(dt, enemies) {
  if (this.expl) {
    this.eR += this.eMax * dt * 2.8;
    if (this.eR >= this.eMax * 1.15) this.dead = true;
    return;
  }
  this.life -= dt; if (this.life <= 0) { this.dead = true; return; }

  // Homing suave (exceto morteiro/granada, que seguem trajetória balística)
  if (this.tgt && !this.tgt.dead && this.ttype !== 'mortar' && this.ttype !== 'grenade') {
    var tp = U.isoF(this.tgt.gc, this.tgt.gr);
    var dx = tp.x - this.x, dy = (tp.y - this.tgt.sz) - this.y, d = Math.hypot(dx, dy) || 1;
    this.vx = U.lerp(this.vx, (dx/d) * this.spd, dt * 8);
    this.vy = U.lerp(this.vy, (dy/d) * this.spd, dt * 8);
  }

  // Granada: arco balístico (gravidade)
  if (this.ttype === 'grenade') this.vy += 120 * dt;

  // Lança-chamas: a "chama" dissipa quase instantaneamente
  if (this.ttype === 'flamethrower') this.life = Math.min(this.life, 0.35);

  this.x += this.vx * dt; this.y += this.vy * dt;
  this.trail.push({ x:this.x, y:this.y });
  if (this.trail.length > 10) this.trail.shift();

  if (this.tgt && !this.tgt.dead) {
    var tp2 = U.isoF(this.tgt.gc, this.tgt.gr);
    if (Math.hypot(this.x - tp2.x, this.y - (tp2.y - this.tgt.sz)) < 20) this._hit(enemies, tp2.x, tp2.y);
  } else if (this.aoe > 0 && this.ttype === 'grenade' && this.vy > 0 && this.y > 520) {
    this._hit(enemies, this.x, this.y);
  }
};

Proj.prototype._hit = function(enemies, hx, hy) {
  if (this.aoe > 0) {
    // Zona de impacto em DIAMANTE (não círculo) — alinhada ao grid quadrado,
    // igual ao indicador de alcance visual. rx = largura, ry = rx/2 (proporção iso).
    var rx = this.aoe * (C.TW + C.TH) * 0.255;
    var ry = rx * 0.5;

    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i]; if (e.dead) continue;
      if (e.invisible && !e.detected) continue; // torres não percebem o Ninja escondido
      var ep = U.isoF(e.gc, e.gr);
      var dd = U.diaDist(ep.x, ep.y, hx, hy, rx, ry); // 0=centro .. 1=borda

      if (dd <= 1) {
        // Dano cheio nos 55% centrais, depois cai linearmente até à borda.
        var fo = dd <= 0.55 ? 1 : 1 - ((dd - 0.55) / 0.45) * 0.45;
        var dmg = Math.max(1, Math.floor(this.dmg * fo * (e.aoeResist||1)));
        e.hit(dmg);
        if (dmg > 5) PS.txt(ep.x, ep.y - e.sz*2.2, '-'+dmg, this.ttype==='flamethrower' ? '#ff6600' : '#ffaa22', 11);
      }
    }

    if (this.ttype !== 'flamethrower') {
      this.expl = true; this.eX = hx; this.eY = hy; this.eMax = rx; this.eR = 0;
      PS.burst(hx, hy, this.ttype==='mortar' ? '#ff8800' : '#ffcc44', this.ttype==='mortar' ? '#ffcc44' : '#ffff88', this.ttype==='mortar' ? 18 : 8);
    } else this.dead = true;
  } else {
    this.tgt.hit(this.dmg);
    var tp3 = U.isoF(this.tgt.gc, this.tgt.gr);
    PS.burst(tp3.x, tp3.y - this.tgt.sz, this.col, '#fff', this.ttype==='minigun' ? 3 : 5);
    if (this.dmg > 10) PS.txt(tp3.x, tp3.y - this.tgt.sz*2.2, '-'+this.dmg, this.col, 11);
    this.dead = true;
  }
};

Proj.prototype.drw = function(ctx) {
  if (this.expl) {
    var t = 1 - (this.eR / (this.eMax * 1.15));
    var ry = this.eR * 0.5;
    ctx.save(); ctx.globalAlpha = t*0.6;
    ctx.strokeStyle = this.ttype==='mortar' ? '#ff4400' : '#ffcc00'; ctx.lineWidth = 3;
    U.diaPath(ctx, this.eX, this.eY, this.eR, ry); ctx.stroke();
    ctx.globalAlpha = t*0.3;
    ctx.fillStyle = this.ttype==='mortar' ? '#ff8800' : '#ffdd44';
    U.diaPath(ctx, this.eX, this.eY, this.eR*0.55, ry*0.55); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.restore();
    return;
  }

  if (this.ttype === 'flamethrower') {
    var t2 = this.life / 0.35;
    ctx.save();
    for (var fi = 0; fi < 5; fi++) {
      ctx.globalAlpha = t2 * (0.7 - fi*0.12);
      ctx.fillStyle = ['#ff6600','#ff4400','#ff8800','#ffaa00','#ff2200'][fi];
      ctx.beginPath(); ctx.arc(this.x + U.rnd(-4,4), this.y + U.rnd(-4,4), 5 + fi*1.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Rastro
  for (var i = 0; i < this.trail.length; i++) {
    var t3 = i / this.trail.length;
    ctx.globalAlpha = t3 * 0.42; ctx.fillStyle = this.col;
    ctx.beginPath(); ctx.arc(this.trail[i].x, this.trail[i].y, 3*t3, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  var sz = this.ttype==='mortar' ? 7 : this.ttype==='grenade' ? 6 : this.ttype==='minigun' ? 3 : 4;
  ctx.shadowBlur = 12; ctx.shadowColor = this.glow; ctx.fillStyle = this.col;
  ctx.beginPath(); ctx.arc(this.x, this.y, sz, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(this.x, this.y, sz*0.35, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
};
