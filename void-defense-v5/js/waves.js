'use strict';
// ═══════════════════════════════════════════════════════════════
//  waves.js  —  Progressão de ondas, auto-avanço, skip manual
// ═══════════════════════════════════════════════════════════════

var WV = {
  cur: 0, active: false, allSpawned: false, groups: [], cb: null,
  autoAdv: false, countdown: -1, COUNTDOWN: 0.1,  // auto-avanço quase imediato
  waveStart: 0, expectedTime: 0, baseHpStart: 100,
  manualSkip: false, // true quando a onda foi terminada via botão "SALTAR ONDA"

  init: function() {
    this.cur = 0; this.active = false; this.allSpawned = false;
    this.groups = []; this.countdown = 0; this.manualSkip = false;
  },

  start: function(cb) {
    if (this.active || this.cur >= C.WAVES.length) return false;
    this.active = true; this.allSpawned = false; this.cb = cb; this.countdown = 0;
    this.waveStart = Date.now(); this.baseHpStart = ECO.bhp; this.manualSkip = false;

    var def = C.WAVES[this.cur];
    var totalEn = 0; for (var i=0;i<def.g.length;i++) totalEn += def.g[i].n;
    this.expectedTime = (totalEn * 1.8 + 10) * 1000;

    this.groups = [];
    for (var i=0;i<def.g.length;i++) {
      var g = def.g[i];
      this.groups.push({ type:g.t, count:g.n, iv:g.iv, spawned:0, timer:g.d||0, done:false });
    }
    return true;
  },

  update: function(dt) {
    if (!this.active) {
      if (this.countdown >= 0) {
        this.countdown -= dt;
        if (this.countdown <= 0 && this.autoAdv && this.cur < C.WAVES.length) {
          this.countdown = -1; // reset para não disparar repetidamente
          G.startWave();
        }
      }
      return;
    }
    var allDone = true;
    for (var i=0;i<this.groups.length;i++) {
      var g = this.groups[i]; if (g.done) continue;
      allDone = false; g.timer -= dt;
      if (g.timer <= 0) {
        if (this.cb) this.cb(g.type);
        g.spawned++; g.timer = g.iv;
        if (g.spawned >= g.count) g.done = true;
      }
    }
    if (allDone) this.allSpawned = true;
  },

  canEnd: function(n) { return this.allSpawned && n === 0; },

  // ── SALTAR A ONDA A MEIO — para spawns futuros e remove inimigos vivos ──
  // Disponível a qualquer momento enquanto a onda está ativa (botão na UI).
  // Dá a recompensa base da onda (sem bónus de rapidez, já que foi saltada).
  skip: function() {
    if (!this.active) return false;
    for (var i = 0; i < this.groups.length; i++) this.groups[i].done = true;
    this.allSpawned = true;
    this.manualSkip = true;
    if (G && G.enemies) G.enemies.length = 0; // remove os que já estavam no mapa
    return true;
  },

  // ── Termina a onda: recompensa base (+ bónus de rapidez se não saltada) ──
  end: function() {
    var reward = C.WAVES[this.cur].reward;

    if (this.manualSkip) {
      // Bónus proporcional ao progresso da onda completado antes do skip
      var elapsed = Date.now() - this.waveStart;
      var progress = Math.min(1, elapsed / this.expectedTime);
      var skipBonus = Math.floor(progress * 40); // até +40 de bónus
      reward += skipBonus;
      if (skipBonus > 0)
        PS.txt(C.W/2, C.H/2-80, 'ONDA SALTADA +'+skipBonus+'$ ('+Math.floor(progress*100)+'%)', '#ffaa00', 13);
      else
        PS.txt(C.W/2, C.H/2-80, 'ONDA SALTADA (muito cedo — sem bónus)', '#ff8833', 12);
    } else {
      var elapsed = Date.now() - this.waveStart, bonus = 0;
      if (elapsed < this.expectedTime) {
        bonus = Math.floor((1 - (elapsed / this.expectedTime)) * 60) + 20;
        reward += bonus;
        if (bonus > 0) {
          PS.txt(C.W/2, C.H/2-80, 'BONUS RAPIDO! +'+bonus+'$', '#ffd700', 15);
          CODEX.onEarlyBonus();
        }
      }
      // Conquista "Intocável": só conta se a onda foi feita até ao fim (não saltada)
      if (ECO.bhp >= this.baseHpStart) CODEX.onNodmg();
    }

    ECO.addG(reward);
    this.active = false; this.allSpawned = false; this.manualSkip = false;
    this.cur++;
    CODEX.onWave(this.cur);

    if (this.autoAdv && this.cur < C.WAVES.length) this.countdown = this.COUNTDOWN;
    else this.countdown = -1;
    return reward;
  },

  num: function() { return this.cur + 1; },
  tot: function() { return C.WAVES.length; },
  won: function() { return this.cur >= C.WAVES.length && !this.active; },
  preview: function() { if (this.cur >= C.WAVES.length) return []; return C.WAVES[this.cur].g; }
};
