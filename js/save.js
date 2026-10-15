'use strict';
// ═══════════════════════════════════════════════════════════════
//  save.js  —  Sistema de save em 3 slots (progresso de uma partida)
//
//  Nota: isto guarda o PROGRESSO DE UMA PARTIDA (onda, torres, ouro...).
//  É diferente de:
//   - CODEX.SAVE_KEY      → descobertas/conquistas (permanente)
//   - SHOP_KEY (shop.js)  → créditos/torres possuídas (permanente)
// ═══════════════════════════════════════════════════════════════

var SAVE = {
  slots: ['vd_sv_1', 'vd_sv_2', 'vd_sv_3'],
  VERSION: 5,

  save: function(slot) {
    var data = {
      v: this.VERSION,
      wave: WV.cur, gold: ECO.gold, enrg: ECO.enrg, bhp: ECO.bhp, bPool: ECO.bPool,
      kills: G.kills, earned: G.earned, diff: G.difficulty, map: G.selectedMap,
      autoAdv: WV.autoAdv,
      towers: G.towers.map(function(t){ return { c:t.col, r:t.row, type:t.type, level:t.level }; })
    };
    try { localStorage.setItem(this.slots[slot], JSON.stringify(data)); return true; }
    catch(e) { return false; }
  },

  load: function(slot) {
    try {
      var raw = localStorage.getItem(this.slots[slot]);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  },

  info: function(slot) {
    var d = this.load(slot);
    if (!d || d.v !== this.VERSION) return null;
    var mapName = (C.MAPS[d.map||'desert']||C.MAPS.desert).name;
    return 'Onda '+(d.wave+1)+'/5  $'+d.gold+'  '+mapName;
  },

  // ── Aplica um save carregado ao jogo atual ──────────────────────
  apply: function(data) {
    if (!data || data.v !== this.VERSION) return false;
    G.startGame(data.diff, true, data.map || 'desert');
    WV.cur = data.wave;
    ECO.gold = Math.max(0, data.gold||0);
    ECO.enrg = U.clp(data.enrg||0, 0, ECO.mxE);
    ECO.bhp  = U.clp(data.bhp||0, 0, ECO.mxH);
    ECO.bPool = Math.max(0, data.bPool||0);
    G.kills = data.kills||0; G.earned = data.earned||0; WV.autoAdv = data.autoAdv||false;

    for (var i=0;i<data.towers.length;i++) {
      var td = data.towers[i];
      if (!MAP.ok(td.c, td.r)) continue; // tile já não é construível (ex: pedra ainda lá)
      var t = new Tower(td.c, td.r, td.type);
      var targetLv = td.level || 1;
      for (var lv=1; lv<targetLv; lv++) t.upgrade();
      G.towers.push(t);
      MAP.setT(td.c, td.r);
    }
    return true;
  }
};
