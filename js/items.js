'use strict';
// ═══════════════════════════════════════════════════════════════
//  items.js  —  Itens de campo (drops de inimigos)
//
//  Diferente do Sangue (acumula-se e gasta-se por botão): um item de
//  campo aparece no MAPA no local onde um inimigo morreu, pulsa por
//  alguns segundos, e desaparece se não for clicado a tempo. Cria uma
//  decisão tática rápida — "vale a pena ir buscar aquilo agora?"
//
//  Para adicionar um item novo: define-o em config.js ITEM_DEFS,
//  junta a chave a um pool em ITEM_DROP_TABLE, e adiciona um `case`
//  em ITEMS._applyEffect().
// ═══════════════════════════════════════════════════════════════

var ITEMS = {
  active: [],  // {id, type, x, y, life, maxLife, bob}
  freezeTimer: 0, // > 0 enquanto os inimigos estão congelados (Granada de Gelo)

  reset: function() { this.active = []; this.freezeTimer = 0; },

  // ── Decide se um inimigo morto larga item, e qual ────────────────
  trySpawn: function(enemy, screenX, screenY) {
    var tier = enemy.isBoss ? 'boss' : (enemy.type === 'armored' || enemy.type === 'tank') ? 'tough' : 'common';
    var table = C.ITEM_DROP_TABLE[tier];
    if (Math.random() >= table.chance) return;

    var pool = table.pool;
    var key = pool[Math.floor(Math.random() * pool.length)];
    var def = C.ITEM_DEFS[key];
    this.active.push({
      id: 'it' + Date.now() + Math.floor(Math.random()*1000),
      type: key, x: screenX, y: screenY,
      life: def.duration, maxLife: def.duration,
      bob: Math.random() * Math.PI * 2
    });
  },

  update: function(dt) {
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    for (var i = this.active.length - 1; i >= 0; i--) {
      this.active[i].life -= dt;
      if (this.active[i].life <= 0) this.active.splice(i, 1);
    }
  },

  // ── Desenho: ícone circular pulsante + anel de tempo restante ────
  draw: function(ctx) {
    for (var i = 0; i < this.active.length; i++) {
      var it = this.active[i], def = C.ITEM_DEFS[it.type];
      var bob = Math.sin(Date.now()*0.004 + it.bob) * 4;
      var y = it.y - 26 + bob;
      var urgent = it.life < 2.5;
      var pulse = urgent ? (0.5 + 0.5*Math.sin(Date.now()*0.02)) : (0.75 + 0.25*Math.sin(Date.now()*0.005));

      ctx.save();
      // Anel de fundo (progresso de tempo restante)
      ctx.strokeStyle = def.color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.85 * pulse;
      ctx.beginPath();
      ctx.arc(it.x, y, 15, -Math.PI/2, -Math.PI/2 + (it.life/it.maxLife)*Math.PI*2);
      ctx.stroke();

      // Fundo do ícone
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(5,8,20,0.85)';
      ctx.beginPath(); ctx.arc(it.x, y, 12, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 10 * pulse; ctx.shadowColor = def.color;
      ctx.strokeStyle = def.color; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(it.x, y, 12, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

      // Ícone
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, it.x, y + 1);
      ctx.restore();
    }
  },

  // ── Tenta apanhar um item perto de (x,y) em coordenadas de ecrã ──
  // callbacks = { addEnergy, addGold, buffAttackSpeed, healBase, log }
  tryCollect: function(x, y, callbacks) {
    for (var i = 0; i < this.active.length; i++) {
      var it = this.active[i];
      if (Math.hypot(it.x - x, (it.y - 26) - y) <= 18) {
        this._applyEffect(it.type, callbacks);
        this.active.splice(i, 1);
        return true;
      }
    }
    return false;
  },

  _applyEffect: function(key, cb) {
    var def = C.ITEM_DEFS[key];
    cb = cb || {};
    if (key === 'energyCore') {
      if (cb.addEnergy) cb.addEnergy(100);
      if (cb.log) cb.log(def.icon + ' +100 Energia', def.color);
    } else if (key === 'goldPouch') {
      var amount = 40 + Math.floor(Math.random() * 60); // 40-100, sente-se uma "surpresa"
      if (cb.addGold) cb.addGold(amount);
      if (cb.log) cb.log(def.icon + ' +$' + amount, def.color);
    } else if (key === 'overcharge') {
      if (cb.buffAttackSpeed) cb.buffAttackSpeed(1.5, 6);
      if (cb.log) cb.log(def.icon + ' Sobrecarga! +50% vel. 6s', def.color);
    } else if (key === 'frostBomb') {
      this.freezeTimer = 3;
      if (cb.log) cb.log(def.icon + ' Inimigos congelados 3s!', def.color);
    } else if (key === 'airstrike') {
      if (cb.airstrike) cb.airstrike();
      if (cb.log) cb.log(def.icon + ' Ataque aéreo!', def.color);
    } else if (key === 'medkit') {
      if (cb.healBase) cb.healBase(40);
      if (cb.log) cb.log(def.icon + ' +40 HP da Base', def.color);
    }
  }
};
