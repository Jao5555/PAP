'use strict';
// ═══════════════════════════════════════════════════════════════
//  integrations.js  —  Ligações a serviços externos (base de dados,
//  webhooks, e o que mais precisares) — TUDO NUM SÓ SÍTIO.
//
//  PORQUÊ ESTE FICHEIRO EXISTE:
//  Sem isto, chamadas de rede a serviços externos (Supabase, um
//  webhook do Discord, etc.) tendem a espalhar-se por vários
//  ficheiros (login.html faz uma chamada, profile.js faz outra,
//  game.html faz outra...). Isso torna difícil de manter — se a
//  chave da API mudar, ou se quiseres mudar de fornecedor, tens de
//  procurar por todo o lado. Aqui fica tudo centralizado: um único
//  sítio para configurar credenciais, e funções prontas a chamar
//  a partir de qualquer página.
//
//  ESTADO ATUAL: isto é um ESQUELETO, não uma ligação a funcionar.
//  Falta preencher a SUPABASE_ANON_KEY (ver abaixo) antes de
//  qualquer chamada a Supabase funcionar de facto. Sem isso
//  preenchido, todas as funções falham de forma CONTROLADA
//  (mostram um aviso na consola, devolvem null/false) — nunca
//  rebentam o jogo nem lançam exceções não apanhadas.
//
//  COMO TESTAR ISTO QUANDO TIVERES A CHAVE:
//  1. Preenche SUPABASE_ANON_KEY abaixo
//  2. Abre a consola do browser (F12) e corre, por exemplo:
//       INTEGRATIONS.supabase.signUp('teste@teste.com', 'password123')
//         .then(r => console.log(r))
//     Se vires um erro de CORS ou 401, confirma a chave e as
//     políticas de RLS (Row Level Security) no painel do Supabase.
// ═══════════════════════════════════════════════════════════════

var INTEGRATIONS = {

  // ── CONFIGURAÇÃO — preenche isto quando tiveres as credenciais ──
  config: {
    // URL do projeto Supabase (já sabemos qual é, do dashboard partilhado)
    SUPABASE_URL: 'https://wwawwsaiibtxwrwdjzbe.supabase.co',

    // ⚠️ PREENCHER: a "chave anon/public" do Supabase (Project Settings
    // → API → "anon public"). Esta chave é SEGURA de expor no código
    // do cliente (é para isso que existe) — a segurança real vem das
    // políticas de Row Level Security (RLS) que configuras nas tabelas
    // do Supabase, não de esconder esta chave.
    SUPABASE_ANON_KEY: '', // <-- COLOCA A CHAVE AQUI

    // Nome da tabela onde guardas o progresso do jogador (cria-a no
    // Supabase antes de usar — sugestão de colunas: user_id, shop_json,
    // loadout_json, codex_json, updated_at)
    PROGRESS_TABLE: 'player_progress',

    // ⚠️ OPCIONAL: URL de um webhook (ex: Discord) para notificações
    // (ex: "alguém completou o jogo", "novo recorde no leaderboard").
    // Deixa vazio se não quiseres usar isto.
    WEBHOOK_URL: '',
  },

  _isConfigured: function() {
    return !!this.config.SUPABASE_ANON_KEY;
  },

  _warnNotConfigured: function(fnName) {
    console.warn(
      '[INTEGRATIONS] ' + fnName + '() foi chamado mas SUPABASE_ANON_KEY ' +
      'ainda não foi preenchida em js/integrations.js — nada foi feito. ' +
      'Isto não é um erro do jogo, é só configuração em falta.'
    );
  },

  // ═════════════════════════════════════════════════════════════
  //  SUPABASE — autenticação e progresso do jogador
  // ═════════════════════════════════════════════════════════════
  supabase: {

    _headers: function() {
      return {
        'Content-Type': 'application/json',
        'apikey': INTEGRATIONS.config.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + INTEGRATIONS.config.SUPABASE_ANON_KEY,
      };
    },

    // ── Registo de novo utilizador ──────────────────────────────
    // Devolve { ok:true, user, session } ou { ok:false, error }.
    signUp: function(email, password) {
      if (!INTEGRATIONS._isConfigured()) { INTEGRATIONS._warnNotConfigured('signUp'); return Promise.resolve({ ok:false, error:'não configurado' }); }
      var url = INTEGRATIONS.config.SUPABASE_URL + '/auth/v1/signup';
      return fetch(url, {
        method: 'POST',
        headers: INTEGRATIONS.supabase._headers(),
        body: JSON.stringify({ email: email, password: password }),
      })
        .then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
        .then(function(res){
          if (!res.ok) return { ok:false, error: (res.data && res.data.msg) || 'Erro ao registar' };
          return { ok:true, user: res.data.user, session: res.data };
        })
        .catch(function(err){ console.error('[INTEGRATIONS] signUp falhou:', err); return { ok:false, error: String(err) }; });
    },

    // ── Login ───────────────────────────────────────────────────
    signIn: function(email, password) {
      if (!INTEGRATIONS._isConfigured()) { INTEGRATIONS._warnNotConfigured('signIn'); return Promise.resolve({ ok:false, error:'não configurado' }); }
      var url = INTEGRATIONS.config.SUPABASE_URL + '/auth/v1/token?grant_type=password';
      return fetch(url, {
        method: 'POST',
        headers: INTEGRATIONS.supabase._headers(),
        body: JSON.stringify({ email: email, password: password }),
      })
        .then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
        .then(function(res){
          if (!res.ok) return { ok:false, error: (res.data && res.data.error_description) || 'Login inválido' };
          // Guarda o token de acesso localmente para pedidos futuros
          try { localStorage.setItem('vd_supabase_session', JSON.stringify(res.data)); } catch(e) {}
          return { ok:true, session: res.data, user: res.data.user };
        })
        .catch(function(err){ console.error('[INTEGRATIONS] signIn falhou:', err); return { ok:false, error: String(err) }; });
    },

    // ── Logout (limpa a sessão local) ───────────────────────────
    signOut: function() {
      try { localStorage.removeItem('vd_supabase_session'); } catch(e) {}
      return Promise.resolve({ ok:true });
    },

    // ── Sessão atual guardada localmente (se existir) ───────────
    getSession: function() {
      try {
        var raw = localStorage.getItem('vd_supabase_session');
        return raw ? JSON.parse(raw) : null;
      } catch(e) { return null; }
    },

    // ── Guarda o progresso do jogador (loja, loadout, codex) ────
    // userId: o id do utilizador Supabase (vem de signIn/signUp)
    // progressData: objeto simples, ex: {shop:{...}, loadout:[...], codex:{...}}
    saveProgress: function(userId, progressData) {
      if (!INTEGRATIONS._isConfigured()) { INTEGRATIONS._warnNotConfigured('saveProgress'); return Promise.resolve({ ok:false, error:'não configurado' }); }
      var url = INTEGRATIONS.config.SUPABASE_URL + '/rest/v1/' + INTEGRATIONS.config.PROGRESS_TABLE;
      return fetch(url, {
        method: 'POST',
        headers: Object.assign({}, INTEGRATIONS.supabase._headers(), { 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify({ user_id: userId, data: progressData, updated_at: new Date().toISOString() }),
      })
        .then(function(r){ return { ok: r.ok }; })
        .catch(function(err){ console.error('[INTEGRATIONS] saveProgress falhou:', err); return { ok:false, error: String(err) }; });
    },

    // ── Carrega o progresso do jogador a partir de outro dispositivo ──
    loadProgress: function(userId) {
      if (!INTEGRATIONS._isConfigured()) { INTEGRATIONS._warnNotConfigured('loadProgress'); return Promise.resolve({ ok:false, error:'não configurado' }); }
      var url = INTEGRATIONS.config.SUPABASE_URL + '/rest/v1/' + INTEGRATIONS.config.PROGRESS_TABLE + '?user_id=eq.' + encodeURIComponent(userId);
      return fetch(url, { headers: INTEGRATIONS.supabase._headers() })
        .then(function(r){ return r.json().then(function(rows){ return { ok:r.ok, rows:rows }; }); })
        .then(function(res){
          if (!res.ok || !res.rows.length) return { ok:false, data:null };
          return { ok:true, data: res.rows[0].data };
        })
        .catch(function(err){ console.error('[INTEGRATIONS] loadProgress falhou:', err); return { ok:false, error: String(err) }; });
    },
  },

  // ═════════════════════════════════════════════════════════════
  //  WEBHOOKS — notificações genéricas para serviços externos
  //  (Discord, Slack, ou qualquer endpoint que aceite POST JSON)
  // ═════════════════════════════════════════════════════════════
  webhook: {
    // Exemplo de uso: INTEGRATIONS.webhook.send('🏆 João completou o jogo em HARD!')
    send: function(message, extra) {
      var url = INTEGRATIONS.config.WEBHOOK_URL;
      if (!url) { console.warn('[INTEGRATIONS] webhook.send() chamado mas WEBHOOK_URL está vazio — nada foi enviado.'); return Promise.resolve({ ok:false }); }
      // Formato compatível com Discord webhooks ({content: "..."}) — ajusta
      // se usares outro serviço (Slack usa {text:"..."}, por exemplo).
      var payload = Object.assign({ content: message }, extra || {});
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function(r){ return { ok: r.ok }; })
        .catch(function(err){ console.error('[INTEGRATIONS] webhook.send falhou:', err); return { ok:false, error: String(err) }; });
    },
  },
};
