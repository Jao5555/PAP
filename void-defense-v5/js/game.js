'use strict';
// ═══════════════════════════════════════════════════════════════
//  game.js  —  Motor principal do Void Defense v5
//  Carregado por último; todos os outros sistemas já existem.
// ═══════════════════════════════════════════════════════════════

var G = {
  // ── Estado ─────────────────────────────────────────────────────
  state:    'menu',   // 'menu' | 'playing' | 'paused' | 'won' | 'lost'
  spd:      1,        // multiplicador de velocidade
  paused:   false,
  showKeys: false,     // painel de teclas
  showSkip: false,     // prompt de saltar onda
  difficulty:  'normal',
  selectedMap: 'desert',
  diffMult: 1,

  // ── Loadout (lido do localStorage ao iniciar) ───────────────────
  // Máx. 5 tipos de torre escolhidos no menu (index.html)
  loadout: [],
  DEFAULT_LOADOUT: ['pistol','sniper','grenade','mortar','minigun'],

  // ── Entidades ──────────────────────────────────────────────────
  towers: [], enemies: [], projs: [],

  // ── Estatísticas ───────────────────────────────────────────────
  kills: 0, earned: 0,

  // ── Tutorial ───────────────────────────────────────────────────
  showTut: true, tutStep: 0,
  _itemSpdBuffTimer: 0,

  // ── Referências para hover/seleção (usadas em tower.js) ─────────
  hTwr: null, sTwr: null, hCol: -1, hRow: -1,

  // ── Canvas / render ────────────────────────────────────────────
  canvas: null, ctx: null, lt: 0, scaleX: 1, scaleY: 1,

  // ── Botões do menu interno ─────────────────────────────────────
  _mBtn: null, _rBtn: null, _diffBtns: [], _mapBtns: [], _ldBtn: null,

  // ──────────────────────────────────────────────────────────────
  //  INIT
  // ──────────────────────────────────────────────────────────────
  init: function() {
    this.canvas = document.getElementById('gc');
    this.ctx    = this.canvas.getContext('2d');
    this.canvas.width  = C.W;
    this.canvas.height = C.H;

    this._resize();
    window.addEventListener('resize', function(){ G._resize(); });

    this.canvas.addEventListener('click',       function(e){ G._onClick(e); });
    this.canvas.addEventListener('mousemove',   function(e){ G._onMove(e); });
    this.canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); G._desel(); });
    document.addEventListener('keydown',        function(e){ G._onKey(e); });

    // ── Carrega Codex persistente ──
    CODEX.load();

    // ── Lê configuração pendente do menu (diff + mapa) ─────────────
    var hadPending = this._readPending();

    // ── Lê loadout do localStorage ─────────────────────────────────
    this._readLoadout();

    // ── Inicializa sistemas ─────────────────────────────────────────
    MAP.init(this.selectedMap);
    ECO.init(this.difficulty);
    WV.init();
    UI.init();
    PS.reset();
    ITEMS.reset();

    // ── Decide o que mostrar ao chegar a esta página ────────────────
    var wantsContinue = /continue=1/.test(window.location.search);
    if (hadPending) {
      // Veio do menu (index.html) depois de clicar "INICIAR MISSÃO" → começa já
      this.startGame(this.difficulty, false, this.selectedMap);
    } else if (wantsContinue) {
      // Veio da capa (index.html) via "CONTINUAR JOGO" → carrega save
      var d = SAVE.load(0);
      if (d) { SAVE.apply(d); }
      else   { this.state = 'menu'; }
    } else {
      this.state = 'menu';
    }

    this.lt = performance.now();
    requestAnimationFrame(function(t){ G._loop(t); });
  },

  _resize: function() {
    var r = C.W / C.H, w = window.innerWidth, h = window.innerHeight;
    if (w / h > r) w = h * r; else h = w / r;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scaleX = C.W / w;
    this.scaleY = C.H / h;
  },

  // ── Lê {diff,map} gravado pelo menu (index.html). Devolve true se encontrou. ──
  _readPending: function() {
    try {
      var raw = localStorage.getItem(C.STORAGE.PENDING);
      if (raw) {
        var p = JSON.parse(raw);
        if (p.diff && C.DIFF[p.diff])          this.difficulty   = p.diff;
        if (p.map  && C.MAPS[p.map])           this.selectedMap  = p.map;
        localStorage.removeItem(C.STORAGE.PENDING);
        return true;
      }
    } catch(e) {}
    return false;
  },

  // ── Lê loadout do localStorage (até 5 tipos válidos) ─────────────
  _readLoadout: function() {
    try {
      var raw = localStorage.getItem(C.STORAGE.LOADOUT);
      if (raw) {
        var arr = JSON.parse(raw);
        this.loadout = arr.filter(function(id){ return !!C.TW_DEF[id]; }).slice(0, 5);
      }
    } catch(e) {}
    if (!this.loadout || this.loadout.length === 0) this.loadout = this.DEFAULT_LOADOUT.slice();
  },

  // ──────────────────────────────────────────────────────────────
  //  START / RESTART
  // ──────────────────────────────────────────────────────────────
  startGame: function(diff, fromLoad, mapKey) {
    diff   = diff   || this.difficulty;
    mapKey = mapKey || this.selectedMap;
    this.state       = 'playing';
    this.spd         = 1;
    this.difficulty  = diff;
    this.selectedMap = mapKey;
    this.diffMult    = C.DIFF[diff].hpM;
    this._creditsAwarded = false;
    this._endFxDone = false;
    this._goldRain = [];
    this._lastCreditsEarned = 0;

    if (!fromLoad) {
      this.towers  = []; this.enemies = []; this.projs = [];
      this.kills   = 0;  this.earned  = 0;
      this.showTut = true; this.tutStep = 0;
      this.hTwr = null; this.sTwr = null;
      MAP.init(mapKey);
      ECO.init(diff);
      WV.init();
      UI.init();
      PS.reset();
      ITEMS.reset();
      CODEX.onMapPlayed(mapKey);
    } else {
      this.enemies = []; this.projs = [];
    }
    this._readLoadout();
  },

  startWave: function() {
    if (WV.start(function(t){
      var e = new Enemy(t, 0, G.diffMult);
      G.enemies.push(e);
      CODEX.onSpawn(t); // desbloqueia a entrada do inimigo no Codex ao vê-lo pela 1ª vez
    })) {
      this.showTut = false;
    }
  },

  // ── Salta a onda atual a meio (botão sempre visível enquanto ativa) ──
  skipWave: function() {
    if (WV.active) WV.skip();
  },

  // ──────────────────────────────────────────────────────────────
  //  LOOP
  // ──────────────────────────────────────────────────────────────
  _loop: function(ts) {
    var rawDt = Math.min((ts - this.lt) / 1000, 0.05);
    this.lt   = ts;
    var dt    = (this.state === 'playing') ? rawDt * this.spd : rawDt;

    if (this.state === 'playing') this._update(dt);
    CODEX.updNotifications(rawDt);
    this._draw(this.ctx);
    requestAnimationFrame(function(t){ G._loop(t); });
  },

  // ──────────────────────────────────────────────────────────────
  //  UPDATE
  // ──────────────────────────────────────────────────────────────
  _update: function(dt) {
    if (this.paused) return;
    WV.update(dt);
    ECO.update(dt, this.towers);

    // Sobrecarga (item de campo): decai e repõe spdBuff quando acaba
    if (this._itemSpdBuffTimer > 0) {
      this._itemSpdBuffTimer -= dt;
      if (this._itemSpdBuffTimer <= 0) {
        this._itemSpdBuffTimer = 0;
        for (var i=0;i<this.towers.length;i++) this.towers[i].spdBuff = 1;
      }
    }

    // 1. Reset auras → 2. Aplica auras de suporte → 3. Atualiza torres
    for (var i = 0; i < this.towers.length; i++) {
      this.towers[i].auraDmg = 1; this.towers[i].auraSpd = 1;
    }
    for (var i = 0; i < this.towers.length; i++) {
      if (this.towers[i].support) this.towers[i].applyAura(this.towers);
    }

    // ── Deteção do Ninja: reset todos os frames, depois revela quem
    // estiver dentro do raio de um Observador ligado. A invisibilidade
    // do Ninja é CONSTANTE — só fica visível enquanto estiver no raio. ──
    for (var i = 0; i < this.enemies.length; i++) this.enemies[i].detected = false;
    for (var i = 0; i < this.towers.length; i++) {
      var t = this.towers[i];
      if (t.type === 'observador' && t.powered) {
        for (var j = 0; j < this.enemies.length; j++) {
          var e = this.enemies[j];
          if (e.invisible && U.gdist(t.col, t.row, e.gc, e.gr) <= t.auraRange) e.detected = true;
        }
      }
    }

    // Inimigos
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i]; e.upd(dt);

      if (e.dead) {
        var ep = U.isoF(e.gc, e.gr);
        PS.blood(ep.x, ep.y - e.sz, e.bReward);
        var goldGet = Math.floor(e.gReward * C.DIFF[this.difficulty].goldM);
        ECO.addG(goldGet); this.earned += goldGet; this.kills++;
        if (e.isBoss) {
          PS.txt(ep.x, ep.y - 60, 'BOSS DESTRUIDO! +$'+goldGet, '#ff2200', 16);
          PS.burst(ep.x, ep.y, '#ff2200', '#ff8800', 25);
        } else {
          PS.txt(ep.x, ep.y - e.sz*2.4, '+'+goldGet+'$', C.P.gold, 11);
        }
        PS.burst(ep.x, ep.y - e.sz*0.5, '#cc2244', '#ff4466', 6);
        CODEX.onKill(e.type);
        ITEMS.trySpawn(e, ep.x, ep.y);
        this.enemies.splice(i, 1);
        if (this.tutStep === 1) this.tutStep = 2;
        continue;
      }

      if (e.reached) {
        var bp = U.iso(14, 4);
        PS.burst(bp.x, bp.y - 20, '#ff4444', '#ff8800', 8);
        var died = ECO.hitBase(e.eDmg);
        this.enemies.splice(i, 1);
        if (died) { this.state = 'lost'; this._awardCredits(); return; }
        continue;
      }
    }

    // Torres — disparo
    for (var i = 0; i < this.towers.length; i++) {
      var pr = this.towers[i].upd(dt, this.enemies);
      if (pr) this.projs.push(pr);
    }

    // Projéteis
    for (var i = this.projs.length - 1; i >= 0; i--) {
      this.projs[i].upd(dt, this.enemies);
      if (this.projs[i].dead) this.projs.splice(i, 1);
    }

    PS.upd(dt);
    ITEMS.update(dt);

    // Fim de onda
    if (WV.canEnd(this.enemies.length)) {
      var bv = PS.collectAll(); ECO.addB(bv);
      var rw = WV.end();
      PS.txt((UI.PX-4)/2, C.H/2-50, 'ONDA COMPLETA! +'+rw+'$', '#44ff88', 15);
      SAVE.save(0); // auto-save no slot 0 ao fim de cada onda
      if (WV.won()) {
        var self = this;
        setTimeout(function(){ if (self.state === 'playing') { self.state = 'won'; self._awardCredits(); } }, 2000);
      }
    }

    if (this.towers.length > 0 && this.tutStep === 0) this.tutStep = 1;
  },

  // ──────────────────────────────────────────────────────────────
  //  DRAW
  // ──────────────────────────────────────────────────────────────
  _draw: function(ctx) {
    var W = C.W, H = C.H;
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.P.bgT); bg.addColorStop(1, C.P.bgB);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    if (this.state === 'menu') { this._drawMenu(ctx); return; }

    MAP.render(ctx, this.hCol, this.hRow, UI.placing, UI.destroyMode);

    // Ordenar por profundidade isométrica
    var objs = this.towers.concat(this.enemies).concat(this.projs);
    objs.sort(function(a,b){ return (a.sk||0) - (b.sk||0); });
    for (var i = 0; i < objs.length; i++) objs[i].drw(ctx);

    PS.drw(ctx);
    ITEMS.draw(ctx);

    // Ghost de colocação
    if (UI.placing && MAP.ok(this.hCol, this.hRow)) {
      ctx.save(); ctx.globalAlpha = 0.52;
      var gh = new Tower(this.hCol, this.hRow, UI.placing); gh.drw(ctx);
      ctx.restore();
    }

    UI.render(ctx);
    CODEX.drwNotifications(ctx);
    CODEX.render(ctx);

    if (this.state === 'won' || this.state === 'lost') this._drawEnd(ctx);
  },

  // ── Menu interno (fallback se não veio do menu (index.html)) ─────────────
  _drawMenu: function(ctx) {
    var W=C.W, H=C.H, t=Date.now()*0.0003;
    for (var i=0;i<90;i++){
      var sx=(Math.sin(i*2.4+t)*0.5+0.5)*W, sy=(Math.sin(i*1.7+t*0.6)*0.5+0.5)*H;
      var a=0.25+0.6*Math.abs(Math.sin(i*3.1+t*1.8));
      ctx.globalAlpha=a; ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(sx,sy,1.2,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;

    var p=0.88+0.12*Math.sin(Date.now()*0.0018);
    ctx.save(); ctx.shadowBlur=40*p; ctx.shadowColor='#3366ff';
    ctx.fillStyle='#fff'; ctx.font='bold 68px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('VOID DEFENSE',W/2,H/2-140); ctx.shadowBlur=0; ctx.restore();
    ctx.fillStyle='#6688aa'; ctx.font='17px Rajdhani,sans-serif'; ctx.textAlign='center';
    ctx.fillText('v5.0  |  Para o menu completo usa start_server.bat',W/2,H/2-100);

    // Dificuldade
    ctx.fillStyle=C.P.dim; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('DIFICULDADE',W/2-200,H/2-72);
    this._diffBtns=[];
    var diffs=['easy','normal','hard'], dnames=['FACIL','NORMAL','DIFICIL'], dcols=['#44cc44','#ffcc00','#ff4444'];
    for (var i=0;i<3;i++){
      var bx=W/2-340+i*110, bw=100, bh=28, by=H/2-58, isSel=this.difficulty===diffs[i];
      ctx.fillStyle=isSel?'rgba(100,100,255,0.18)':'rgba(0,0,0,0.2)';
      U.rr(ctx,bx,by,bw,bh,6); ctx.fill();
      ctx.strokeStyle=isSel?dcols[i]:C.P.pbd; ctx.lineWidth=isSel?2:0.8; ctx.stroke();
      ctx.fillStyle=isSel?dcols[i]:C.P.dim; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText(dnames[i],bx+bw/2,by+19);
      this._diffBtns.push({diff:diffs[i],x:bx,y:by,w:bw,h:bh});
    }

    // Mapa
    ctx.fillStyle=C.P.dim; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('MAPA',W/2+200,H/2-72);
    this._mapBtns=[];
    var maps=Object.keys(C.MAPS);
    for (var i=0;i<maps.length;i++){
      var mk=maps[i], md=C.MAPS[mk];
      var bx=W/2+80+i*134, bw=124, bh=28, by=H/2-58, isSel=this.selectedMap===mk;
      ctx.fillStyle=isSel?'rgba(100,200,100,0.18)':'rgba(0,0,0,0.2)';
      U.rr(ctx,bx,by,bw,bh,6); ctx.fill();
      ctx.strokeStyle=isSel?md.color:C.P.pbd; ctx.lineWidth=isSel?2:0.8; ctx.stroke();
      ctx.fillStyle=isSel?md.color:C.P.dim; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText(md.name,bx+bw/2,by+19);
      this._mapBtns.push({map:mk,x:bx,y:by,w:bw,h:bh});
      if (isSel) MAP.drawPreview(ctx,mk,bx,by+34,bw,55);
    }

    // Botão iniciar
    var bw2=280,bh2=56,bx2=W/2-bw2/2,by2=H/2-10;
    ctx.fillStyle='#0a2212'; U.rr(ctx,bx2,by2,bw2,bh2,12); ctx.fill();
    ctx.shadowBlur=22*p; ctx.shadowColor='#44cc44'; ctx.strokeStyle='#44cc44'; ctx.lineWidth=2.5; ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle='#44ff66'; ctx.font='bold 24px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('▶  INICIAR JOGO',W/2,by2+37);
    this._mBtn={x:bx2,y:by2,w:bw2,h:bh2};

    // Carregar save
    var hasSave=SAVE.info(0)!==null;
    var lbx=W/2-90,lby=by2+70,lbw=180;
    ctx.fillStyle=hasSave?'rgba(0,120,180,0.18)':'rgba(0,0,0,0.08)';
    U.rr(ctx,lbx,lby,lbw,30,8); ctx.fill();
    ctx.strokeStyle=hasSave?'#4488ff':C.P.pbd; ctx.lineWidth=1.2; ctx.stroke();
    ctx.fillStyle=hasSave?'#88aaff':C.P.dim; ctx.font='bold 12px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('CARREGAR SAVE',W/2,lby+20);
    this._ldBtn={x:lbx,y:lby,w:lbw,h:30};

    ctx.fillStyle='#3a4a5a'; ctx.font='12px Rajdhani,sans-serif'; ctx.textAlign='center';
    ctx.fillText('[N]/ESPACO=onda  [S]=save  [C]=codex  [ESC]=cancelar',W/2,lby+52);
    ctx.fillStyle='#1e2a38'; ctx.font='10px sans-serif'; ctx.fillText('Void Defense v5.0',W/2,H-14);
  },

  // ── Ecrã de fim ────────────────────────────────────────────────
  // ── Atribui créditos permanentes da Loja no fim da partida ───────
  // Fórmula: 8% do ouro ganho + 18 por onda completa + bónus de 150 se venceu.
  // Isto fecha o ciclo: jogas → ganhas créditos → desbloqueias torres no menu.
  _awardCredits: function() {
    if (this._creditsAwarded) return; // só uma vez por partida
    this._creditsAwarded = true;

    var won = this.state === 'won';
    var earned = Math.floor(this.earned * 0.08) + WV.cur * 18 + (won ? 150 : 0);
    this._lastCreditsEarned = earned;

    try {
      var raw = localStorage.getItem(C.STORAGE.SHOP);
      var shop = raw ? JSON.parse(raw) : { credits:0, owned:{} };
      shop.credits = (shop.credits||0) + earned;
      localStorage.setItem(C.STORAGE.SHOP, JSON.stringify(shop));
    } catch(e) {}

    // Apaga o save da partida em curso (já terminou)
    try { localStorage.removeItem(SAVE.slots[0]); } catch(e) {}

    // Persiste já no perfil ativo (não espera pelo beforeunload, que pode
    // falhar em alguns browsers/dispositivos ao fechar o separador)
    try { if (typeof PROFILE !== 'undefined') PROFILE.save(); } catch(e) {}

    // Submete a pontuação ao leaderboard do servidor (se estiver a correr).
    // Falha em silêncio se não houver servidor multiplayer ativo — o jogo
    // continua a funcionar normalmente em modo totalmente offline.
    try {
      var playerName = (typeof PROFILE !== 'undefined') ? PROFILE.activeName() : 'Jogador';
      fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playerName,
          mode: 'solo', // único modo com jogo sincronizado por agora — ver server.py
          difficulty: this.difficulty,
          map: this.selectedMap,
          wavesCompleted: WV.cur,
          kills: this.kills,
          goldEarned: this.earned,
          won: won
        })
      }).catch(function(){}); // silencioso: sem servidor = sem leaderboard, sem crash
    } catch(e) {}
  },

  _drawEnd: function(ctx) {
    var W=C.W, H=C.H, won=this.state==='won';

    // Partículas de celebração (só uma vez, ao entrar no ecrã de vitória)
    if (won && !this._endFxDone) {
      this._endFxDone = true;
      for (var i=0;i<3;i++) {
        setTimeout((function(idx){ return function(){
          PS.burst(W*0.25+idx*W*0.25, 100, '#ffd700', '#44ff66', 30);
        };})(i), i*200);
      }
    }

    ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(0,0,W,H);

    // ── Chuva de partículas douradas contínua na vitória ──
    if (won) {
      if (!this._goldRain) this._goldRain = [];
      if (this._goldRain.length < 40 && Math.random()<0.3) {
        this._goldRain.push({x:Math.random()*W, y:-10, vy:60+Math.random()*60, sz:2+Math.random()*3});
      }
      for (var i=this._goldRain.length-1;i>=0;i--) {
        var g=this._goldRain[i]; g.y+=g.vy*0.016;
        if (g.y>H) { this._goldRain.splice(i,1); continue; }
        ctx.globalAlpha=0.7; ctx.fillStyle='#ffd700';
        ctx.beginPath(); ctx.arc(g.x,g.y,g.sz,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    // ── Título principal ──
    ctx.save();
    ctx.shadowBlur=44; ctx.shadowColor=won?'#44cc44':'#cc2222';
    ctx.fillStyle=won?'#44ff66':'#ff3344'; ctx.font='bold 76px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText(won?'🏆 VITÓRIA TOTAL!':'DERROTA',W/2,H/2-130);
    ctx.restore();

    ctx.fillStyle='#aabbcc'; ctx.font='20px Rajdhani,sans-serif'; ctx.textAlign='center';
    ctx.fillText(
      won ? 'Completaste todas as '+C.WAVES.length+' ondas em '+C.MAPS[this.selectedMap].name+'!'
          : 'A tua base foi destruída na onda '+WV.num()+'/'+C.WAVES.length+'...',
      W/2, H/2-92
    );

    // ── Caixa de estatísticas ──
    var boxW=480, boxX=W/2-boxW/2, boxY=H/2-70;
    ctx.fillStyle='rgba(255,255,255,0.04)'; U.rr(ctx,boxX,boxY,boxW,108,10); ctx.fill();
    ctx.strokeStyle=won?'#2a5a2a':'#5a2a2a'; ctx.lineWidth=1; ctx.stroke();

    var stats=[
      ['💰 Ouro Ganho', '$'+this.earned, C.P.gold],
      ['☠ Abatidos', this.kills, '#ff8888'],
      ['🌊 Ondas', WV.cur+'/'+C.WAVES.length, '#88ccff'],
      ['🏆 Conquistas', CODEX.st.achievements.length+'/'+CODEX.ACHIEVEMENTS.length, '#ffd700']
    ];
    var colW=boxW/stats.length;
    for (var i=0;i<stats.length;i++){
      var cx=boxX+colW*i+colW/2;
      ctx.fillStyle='#667788'; ctx.font='9px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText(stats[i][0], cx, boxY+30);
      ctx.fillStyle=stats[i][2]; ctx.font='bold 17px Orbitron,sans-serif';
      ctx.fillText(stats[i][1], cx, boxY+58);
    }

    // ── Créditos ganhos para a Loja (destaque) ──
    var credEarned = this._lastCreditsEarned||0;
    ctx.fillStyle='rgba(255,215,0,0.08)'; U.rr(ctx,boxX,boxY+74,boxW,28,6); ctx.fill();
    ctx.strokeStyle='#ffd700'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.fillStyle='#ffe080'; ctx.font='bold 12px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('💳 +'+credEarned+' CRÉDITOS para a Loja (desbloqueia torres no Menu)', W/2, boxY+93);

    // ── Botão jogar de novo ──
    var bw=240,bh=52,bx=W/2-bw/2,by=boxY+118;
    ctx.fillStyle='#0a1428'; U.rr(ctx,bx,by,bw,bh,10); ctx.fill();
    ctx.strokeStyle='#4488ff'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#88aaff'; ctx.font='bold 18px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('JOGAR NOVAMENTE',W/2,by+33);
    this._rBtn={x:bx,y:by,w:bw,h:bh};

    // ── Botão menu ──
    var mbw=160,mbx=W/2-mbw/2,mby=by+62;
    ctx.fillStyle='rgba(80,80,80,0.2)'; U.rr(ctx,mbx,mby,mbw,36,8); ctx.fill();
    ctx.strokeStyle='#556677'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#8899aa'; ctx.font='bold 13px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('◀  MENU PRINCIPAL',W/2,mby+24);
    this._menuEnd={x:mbx,y:mby,w:mbw,h:36};
  },

  // ──────────────────────────────────────────────────────────────
  //  INPUT
  // ──────────────────────────────────────────────────────────────
  _getPos: function(e) {
    var r=this.canvas.getBoundingClientRect();
    return { x:(e.clientX-r.left)*this.scaleX, y:(e.clientY-r.top)*this.scaleY };
  },

  _onClick: function(e) {
    var pos=this._getPos(e), x=pos.x, y=pos.y;

    // Codex intercepta todos os cliques quando aberto
    if (CODEX.visible) { CODEX.handleClick(x,y); return; }
    if (UI.showSave)   { UI.click(x,y); return; }

    if (this.state==='menu') {
      for (var i=0;i<this._diffBtns.length;i++){ var db=this._diffBtns[i]; if(this._inR(x,y,db)){this.difficulty=db.diff;return;} }
      for (var i=0;i<this._mapBtns.length;i++) { var mb=this._mapBtns[i];  if(this._inR(x,y,mb)){this.selectedMap=mb.map;MAP.init(mb.map);return;} }
      if (this._mBtn  && this._inR(x,y,this._mBtn))  { this.startGame(this.difficulty,false,this.selectedMap); return; }
      if (this._ldBtn && this._inR(x,y,this._ldBtn))  { var d=SAVE.load(0); if(d) SAVE.apply(d); return; }
      return;
    }

    if (this.state==='won'||this.state==='lost') {
      if (this._rBtn    && this._inR(x,y,this._rBtn))   { this.startGame(this.difficulty,false,this.selectedMap); return; }
      if (this._menuEnd && this._inR(x,y,this._menuEnd)){ window.location.href='menu.html'; return; }
      return;
    }

    // Itens de campo têm prioridade — são limitados no tempo, más sorte
    // se a torre por baixo "roubar" o clique. Efeitos ligados à economia
    // e ao estado do jogo através de callbacks simples.
    var self = this;
    var collected = ITEMS.tryCollect(x, y, {
      addEnergy:      function(v){ ECO.enrg = Math.min(ECO.mxE, ECO.enrg + v); },
      addGold:        function(v){ ECO.addG(v); },
      healBase:       function(v){ ECO.bhp = Math.min(ECO.mxH, ECO.bhp + v); },
      buffAttackSpeed:function(mult, dur){
        for (var i=0;i<self.towers.length;i++){ self.towers[i].spdBuff = Math.max(self.towers[i].spdBuff, mult); }
        self._itemSpdBuffTimer = dur; // decai no _update, ver abaixo
      },
      airstrike: function(){
        for (var i=0;i<self.enemies.length;i++){
          var en = self.enemies[i];
          if (en.invisible && !en.detected) continue; // ninja escondido continua a salvo
          en.hit(Math.floor(en.mhp * 0.45)); // 45% do HP máximo, ignora resistências
        }
        var cx = C.W*0.5 - (UI.PW)/2, cy = C.H*0.5;
        PS.burst(cx, cy, '#ff4400', '#ffaa00', 30);
      },
      log: function(msg, color){ PS.txt(x, y-40, msg, color, 13); }
    });
    if (collected) return;

    // Painel UI (direita) ou topbar
    if (x >= UI.PX-4 || y < 58) { UI.click(x,y); return; }

    // Mapa
    var gr=U.inv(x,y); UI.mapClick(gr.col,gr.row);
    this.hTwr=this._tAt(gr.col,gr.row);
  },

  _onMove: function(e) {
    var pos=this._getPos(e), x=pos.x, y=pos.y;
    var gr=U.inv(x,y); this.hCol=gr.col; this.hRow=gr.row;
    this.hTwr=this._tAt(gr.col,gr.row);
    if (this.state==='playing') {
      if (UI.destroyMode) this.canvas.style.cursor=MAP.isRock(gr.col,gr.row)?'pointer':'default';
      else this.canvas.style.cursor=UI.placing?(MAP.ok(gr.col,gr.row)?'crosshair':'not-allowed'):'default';
    }
  },

  _onKey: function(e) {
    if (e.key==='Escape') {
      if (CODEX.visible)    { CODEX.visible=false; return; }
      if (UI.showSave)      { UI.showSave=false; return; }
      G._desel();
    }
    if ((e.key==='n'||e.key==='N'||e.key===' ') && this.state==='playing') {
      e.preventDefault(); this.startWave();
    }
    if ((e.key==='c'||e.key==='C') && this.state!=='menu') CODEX.visible=!CODEX.visible;
    // 1-5: selecionar tropa do loadout
    var num=parseInt(e.key);
    if (!isNaN(num) && num>=1 && num<=5 && this.state==='playing' && this.loadout[num-1]) {
      UI.placing = (UI.placing===this.loadout[num-1]) ? null : this.loadout[num-1];
      UI.selT=null; this.sTwr=null;
    }
    if ((e.key==='p'||e.key==='P') && this.state==='playing') { this.paused=!this.paused; return; }
    if (e.key==='?' || e.key==='/') { this.showKeys=!this.showKeys; return; }
    if ((e.key==='s'||e.key==='S') && this.state==='playing') {
      SAVE.save(0); PS.txt(C.W/2,100,'JOGO GUARDADO','#44aa88',13);
    }
  },

  _isMtnTower: function(type){ var cf=C.TW_DEF[type]; return cf&&cf.mountainOnly===true; },

  _desel: function() { UI.placing=null; UI.selT=null; UI.destroyMode=false; this.sTwr=null; },
  _tAt:  function(c,r) { for(var i=0;i<this.towers.length;i++) if(this.towers[i].col===c&&this.towers[i].row===r) return this.towers[i]; return null; },
  _inR:  function(x,y,r){ return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h; }
};

// ── Arranque ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function(){ G.init(); });
