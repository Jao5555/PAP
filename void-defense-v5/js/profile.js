'use strict';
// ═══════════════════════════════════════════════════════════════
//  profile.js  —  Sistema de perfis/contas local
//
//  Cada "conta" é um perfil com nome próprio.
//  Todos os dados do jogo (loja, loadout, saves, codex)
//  são guardados separadamente por perfil.
//  Não há servidor — tudo em localStorage, funciona offline.
//
//  CHAVES:
//   vd_profiles          → lista de perfis [{id,name,createdAt,lastPlayed}]
//   vd_active            → id do perfil ativo
//   vd_p_[id]_shop       → dados de loja desse perfil
//   vd_p_[id]_loadout    → loadout
//   vd_p_[id]_codex      → codex/conquistas
//   vd_p_[id]_sv1/2/3    → saves de partida
// ═══════════════════════════════════════════════════════════════

var PROFILE = {
  // ── Chaves de cada perfil ──────────────────────────────────────
  _k: function(id, key) { return 'vd_p_' + id + '_' + key; },

  // ── Carrega lista de perfis ────────────────────────────────────
  list: function() {
    try { return JSON.parse(localStorage.getItem('vd_profiles') || '[]'); }
    catch(e) { return []; }
  },

  // ── Guarda lista de perfis ─────────────────────────────────────
  saveList: function(profiles) {
    try { localStorage.setItem('vd_profiles', JSON.stringify(profiles)); }
    catch(e) {}
  },

  // ── Cria novo perfil ───────────────────────────────────────────
  create: function(name) {
    var id = 'u' + Date.now().toString(36);
    var profiles = this.list();
    profiles.push({ id: id, name: name, createdAt: Date.now(), lastPlayed: null });
    this.saveList(profiles);
    return id;
  },

  // ── Obtém o ID do perfil ativo ─────────────────────────────────
  activeId: function() {
    return localStorage.getItem('vd_active') || null;
  },

  // ── Define perfil ativo e restaura os seus dados ───────────────
  activate: function(id) {
    localStorage.setItem('vd_active', id);
    this._restore(id);
    // Atualiza lastPlayed
    var profiles = this.list();
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].id === id) { profiles[i].lastPlayed = Date.now(); break; }
    }
    this.saveList(profiles);
  },

  // ── Obtém nome do perfil ativo ─────────────────────────────────
  activeName: function() {
    var id = this.activeId();
    if (!id) return 'Jogador';
    var profiles = this.list();
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].id === id) return profiles[i].name;
    }
    return 'Jogador';
  },

  // ── Apaga perfil ──────────────────────────────────────────────
  remove: function(id) {
    var profiles = this.list().filter(function(p) { return p.id !== id; });
    this.saveList(profiles);
    // Apaga dados do perfil
    var keys = ['shop', 'loadout', 'codex', 'sv1', 'sv2', 'sv3'];
    keys.forEach(function(k) { localStorage.removeItem('vd_p_' + id + '_' + k); });
    if (this.activeId() === id) localStorage.removeItem('vd_active');
  },

  // ── Restaura dados de um perfil para as chaves globais ──────────
  _restore: function(id) {
    var map = { 'shop':'vd_shop_v5', 'loadout':'vd_loadout_v5',
                'codex':'vd_codex_v5', 'sv1':'vd_sv_1', 'sv2':'vd_sv_2', 'sv3':'vd_sv_3' };
    var self = this;
    Object.keys(map).forEach(function(pk) {
      var val = localStorage.getItem(self._k(id, pk));
      if (val !== null) localStorage.setItem(map[pk], val);
      else localStorage.removeItem(map[pk]);
    });
  },

  // ── Guarda dados globais de volta para o perfil ativo ──────────
  // Chama isto ANTES de navegar para outra página.
  save: function() {
    var id = this.activeId();
    if (!id) return;
    var map = { 'shop':'vd_shop_v5', 'loadout':'vd_loadout_v5',
                'codex':'vd_codex_v5', 'sv1':'vd_sv_1', 'sv2':'vd_sv_2', 'sv3':'vd_sv_3' };
    var self = this;
    Object.keys(map).forEach(function(pk) {
      var val = localStorage.getItem(map[pk]);
      if (val !== null) localStorage.setItem(self._k(id, pk), val);
    });
    // Atualiza lastPlayed
    var profiles = self.list();
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].id === id) { profiles[i].lastPlayed = Date.now(); break; }
    }
    self.saveList(profiles);
  },

  // ── Stats resumo de um perfil (para exibir no ecrã de seleção) ─
  summary: function(id) {
    var shopRaw = localStorage.getItem(this._k(id, 'shop'));
    var shop = shopRaw ? JSON.parse(shopRaw) : null;
    var codexRaw = localStorage.getItem(this._k(id, 'codex'));
    var codex = codexRaw ? JSON.parse(codexRaw) : null;
    var hasSave = !!localStorage.getItem(this._k(id, 'sv1'));
    return {
      credits: shop ? (shop.credits || 0) : 0,
      ownedCount: shop ? Object.keys(shop.owned || {}).length : 0,
      achievements: codex ? (codex.achievements || []).length : 0,
      hasSave: hasSave
    };
  }
};
