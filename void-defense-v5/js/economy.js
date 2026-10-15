'use strict';
// ═══════════════════════════════════════════════════════════════
//  economy.js  —  Ouro, Energia, Sangue, HP da Base, Buffs
// ═══════════════════════════════════════════════════════════════

var ECO = {
  gold: 0, enrg: 0, mxE: C.ENRG_MAX, bhp: 0, mxH: C.BASE_HP, buf: 0, bPool: 0,
  buffs: { dmg:{active:false,timer:0,mult:1.6}, spd:{active:false,timer:0,mult:1.6} },

  init: function(diff) {
    var d = C.DIFF[diff || 'normal'];
    this.gold = d.startGold; this.enrg = d.enrg; this.mxE = C.ENRG_MAX;
    this.bhp = C.BASE_HP; this.mxH = C.BASE_HP; this.buf = 0; this.bPool = 0;
    this.buffs = { dmg:{active:false,timer:0,mult:1.6}, spd:{active:false,timer:0,mult:1.6} };
  },

  update: function(dt, towers) {
    // Clamp defensivo — garante que nunca fica fora dos limites válidos
    // (protege contra saves antigos/corrompidos ou interações inesperadas)
    this.enrg = U.clp(this.enrg, 0, this.mxE);
    this.gold = Math.max(0, this.gold);
    this.bhp  = U.clp(this.bhp, 0, this.mxH);

    this.enrg = Math.min(this.mxE, this.enrg + C.ENRG_RG * dt);

    if (towers && towers.length) {
      // Geradores (drain < 0) produzem energia ANTES de calcular o consumo
      var genBonus = 0;
      for (var i = 0; i < towers.length; i++) {
        if (towers[i].drain < 0) { genBonus += Math.abs(towers[i].drain) * dt; towers[i].powered = true; }
      }
      this.enrg = Math.min(this.mxE, this.enrg + genBonus);

      // Torres de consumo positivo. IMPORTANTE: uma torre de ataque só paga o
      // custo TOTAL enquanto tem um alvo trancado (a disparar de facto). Sem
      // alvo em alcance, paga apenas uma fração baixa ("standby"). Isto evita
      // a energia esvaziar-se sozinha só por teres torres construídas sem
      // inimigos por perto — o dreno fica ligado ao combate real, que é a
      // intuição natural do jogador. Torres de suporte (aura contínua) não
      // entram nesta redução, pois o efeito delas está sempre ativo.
      var IDLE_DRAIN_MULT = 0.15;
      var tot = 0;
      for (var i = 0; i < towers.length; i++) {
        var t = towers[i];
        if (t.drain <= 0) continue;
        var active = t.support || !!t.tgt; // suporte = sempre "ativo"; ataque = só se tem alvo
        tot += t.drain * dt * (active ? 1 : IDLE_DRAIN_MULT);
      }
      if (this.enrg >= tot) {
        this.enrg -= tot;
        for (var i = 0; i < towers.length; i++) if (towers[i].drain > 0) towers[i].powered = true;
      } else {
        var av = this.enrg;
        var sorted = towers.filter(function(t){return t.drain>0;}).sort(function(a,b){ return b.drain - a.drain; });
        for (var i = 0; i < sorted.length; i++) {
          var st = sorted[i];
          var stActive = st.support || !!st.tgt;
          var cost = st.drain * dt * (stActive ? 1 : IDLE_DRAIN_MULT);
          if (av >= cost) { av -= cost; st.powered = true; }
          else st.powered = false;
        }
        this.enrg = Math.max(0, av);
      }
    }

    // Conversão automática de sangue → energia (25/s)
    if (this.buf > 0) {
      var cv = Math.min(this.buf, 14 * dt); // era 25 — conversão passiva mais lenta
      this.buf -= cv;
      this.enrg = Math.min(this.mxE, this.enrg + cv / C.B2E);
    }

    // Atualiza temporizadores de buffs
    for (var k in this.buffs) {
      var b = this.buffs[k];
      if (b.active) {
        b.timer -= dt;
        if (b.timer <= 0) { b.active = false; b.timer = 0; this._applyBuffs(towers); }
      }
    }
  },

  _applyBuffs: function(towers) {
    if (!towers) return;
    var dm = this.buffs.dmg.active ? this.buffs.dmg.mult : 1;
    var sm = this.buffs.spd.active ? this.buffs.spd.mult : 1;
    for (var i = 0; i < towers.length; i++) { towers[i].dmgBuff = dm; towers[i].spdBuff = sm; }
  },

  // ── Usar sangue acumulado para efeitos ──────────────────────────
  useBuff: function(which, towers) {
    var bu = C.BLOOD_USES[which];
    if (this.bPool < bu.cost) return false;
    this.bPool -= bu.cost;
    if (which === 'heal') {
      this.bhp = Math.min(this.mxH, this.bhp + 25);
      PS.txt(C.W/2, C.H/2-60, 'BASE +25 HP', '#44cc44', 14);
    } else if (which === 'energy') {
      this.enrg = Math.min(this.mxE, this.enrg + 80);
      PS.txt(C.W/2, C.H/2-60, '+80 ENERGIA', C.P.enrg, 14);
    } else if (which === 'dmgBuff') {
      this.buffs.dmg.active = true; this.buffs.dmg.timer = 12;
      this._applyBuffs(towers);
      PS.txt(C.W/2, C.H/2-60, 'BUFF DANO ATIVO!', '#ff8800', 14);
    } else if (which === 'spdBuff') {
      this.buffs.spd.active = true; this.buffs.spd.timer = 12;
      this._applyBuffs(towers);
      PS.txt(C.W/2, C.H/2-60, 'BUFF ATAQUE ATIVO!', C.P.enrg, 14);
    }
    return true;
  },

  addB: function(v) { this.buf += v; this.bPool += v; CODEX.onBlood(v); },
  addG: function(v) { this.gold += v; },
  can:  function(c) { return this.gold >= c; },
  spend:function(c) { if (this.can(c)) { this.gold -= c; return true; } return false; },

  hitBase: function(d) { this.bhp = Math.max(0, this.bhp - d); return this.bhp <= 0; },
  hpP: function() { return this.bhp / this.mxH; },
  eP:  function() { return this.enrg / this.mxE; }
};
