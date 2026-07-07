'use strict';
// ═══════════════════════════════════════════════════════════════
//  ui.js  —  Interface in-game completamente redesenhada v5.1
//
//  LAYOUT:
//  ┌────────────────────────────────┬──────────────┐
//  │  TOPBAR: HP | Ouro | Energia   │  Onda/Mapa   │  58px
//  ├────────────────────────────────┴──────────────┤
//  │                                               │
//  │         CANVAS (mapa + inimigos)              │
//  │                                               │ 
//  ├───────────────────────────────┬───────────────┤
//  │  TROPAS (HTML, fundo)         │  PAINEL DIREITO│
//  └───────────────────────────────┴───────────────┘ 64px
//
//  Painel direito dividido em secções claras:
//  [ONDAS] → [SANGUE] → [ESTATÍSTICAS]
// ═══════════════════════════════════════════════════════════════

var UI = {
  PX: 1048, PW: 232,
  placing: null, selT: null, spd: 1, destroyMode: false,
  showSave: false, saveSlotBtns: [],

  _nwBtn: null, _skipBtn: null, _autoCk: null, _collectBtn: null,
  _spdBtn: null, _cdxBtn: null, _destroyBtn: null,
  _bloodUseBtns: [], _saveBtnArea: null, _menuBtnArea: null,
  _tBtns: [], // hotbar clique por tecla (fallback canvas)

  init: function() {
    this.placing = null; this.selT = null; this.spd = 1;
    this.showSave = false; this.destroyMode = false;
  },

  // ── Cliques no painel/topbar ─────────────────────────────────
  click: function(mx, my) {
    if (this._nwBtn   && this._hit(mx,my,this._nwBtn))   { G.startWave();   return true; }
    if (this._skipBtn && this._hit(mx,my,this._skipBtn))  { G.skipWave();    return true; }
    if (this._autoCk  && this._hit(mx,my,this._autoCk))   { WV.autoAdv = !WV.autoAdv; return true; }
    if (this._collectBtn && this._hit(mx,my,this._collectBtn)) {
      var bv = PS.collectAll(); ECO.addB(bv);
      if (bv > 0) PS.txt(C.W/2, 120, '+'+bv+' SANGUE COLETADO', C.P.blood, 13);
      return true;
    }
    for (var i=0;i<this._bloodUseBtns.length;i++) {
      var bb = this._bloodUseBtns[i];
      if (this._hit(mx,my,bb)) { ECO.useBuff(bb.id, G.towers); return true; }
    }
    if (this._spdBtn    && this._hit(mx,my,this._spdBtn))    { this.spd=this.spd===1?2:this.spd===2?3:1; G.spd=this.spd; return true; }
    if (this._cdxBtn    && this._hit(mx,my,this._cdxBtn))    { CODEX.visible=!CODEX.visible; return true; }
    if (this._destroyBtn&& this._hit(mx,my,this._destroyBtn)){ this.destroyMode=!this.destroyMode; if(this.destroyMode){this.placing=null;this.selT=null;G.sTwr=null;} return true; }
    if (this._saveBtnArea && this._hit(mx,my,this._saveBtnArea)) { this.showSave=true; return true; }
    if (this._menuBtnArea && this._hit(mx,my,this._menuBtnArea)) {
      if(confirm('Voltar ao menu? O jogo é guardado automaticamente.')) { SAVE.save(0); window.location.href='menu.html'; }
      return true;
    }
    if (this.showSave) {
      for (var i=0;i<this.saveSlotBtns.length;i++) {
        var sb=this.saveSlotBtns[i];
        if (this._hit(mx,my,sb)) {
          if(sb.action==='close') this.showSave=false;
          else if(sb.action==='save') { SAVE.save(sb.slot); PS.txt(C.W/2,100,'GUARDADO','#44aa88',13); }
          else if(sb.action==='load') { var d=SAVE.load(sb.slot); if(d&&SAVE.apply(d)) this.showSave=false; }
          return true;
        }
      }
      this.showSave=false;
    }
    return false;
  },

  // ── Cliques no mapa ────────────────────────────────────────────
  mapClick: function(col, row) {
    if (this.destroyMode) {
      if (MAP.isRock(col,row)) {
        if (ECO.can(C.ROCK_COST)) {
          ECO.spend(C.ROCK_COST); MAP.destroyRock(col,row); CODEX.onRockDestroyed();
          var ip=U.iso(col,row);
          PS.txt(ip.x,ip.y-20,'PEDRA DESTRUÍDA!','#ffaa00',11);
          PS.burst(ip.x,ip.y,'#888','#aaa',8);
        } else PS.txt(U.iso(col,row).x,U.iso(col,row).y-20,'SEM OURO!','#ff4444');
        return true;
      }
      return false;
    }
    if (this.placing) {
      var cf = C.TW_DEF[this.placing];
      var isMtn = G._isMtnTower && G._isMtnTower(this.placing);
      var canPlace = isMtn ? MAP.isMountain(col,row) : MAP.ok(col,row);
      if (canPlace) {
        if (!ECO.can(cf.cost)) { PS.txt(U.iso(col,row).x,U.iso(col,row).y-20,'SEM OURO!','#ff4444'); return false; }
        var t = new Tower(col,row,this.placing);
        G.towers.push(t); MAP.setT(col,row); ECO.spend(cf.cost);
        CODEX.onPlace(this.placing);
        this.placing=null; return true;
      } else if (isMtn&&MAP.ok(col,row)) {
        PS.txt(U.iso(col,row).x,U.iso(col,row).y-20,'APENAS EM MONTANHA ⛰','#ffaa00'); return false;
      } else if (!isMtn&&MAP.isMountain(col,row)) {
        PS.txt(U.iso(col,row).x,U.iso(col,row).y-20,'APENAS TROPAS ⛰ AQUI','#ffaa00'); return false;
      }
    }
    for (var i=0;i<G.towers.length;i++) {
      if (G.towers[i].col===col && G.towers[i].row===row) {
        this.selT=G.towers[i]; G.sTwr=G.towers[i]; this.placing=null; return true;
      }
    }
    this.selT=null; G.sTwr=null; return false;
  },

  _hit: function(mx,my,r){ return mx>=r.x && mx<=r.x+r.w && my>=r.y && my<=r.y+r.h; },

  // ── RENDER GERAL ────────────────────────────────────────────────
  render: function(ctx) {
    this._panel(ctx);
    this._topbar(ctx);
    this._waveSection(ctx);
    this._bloodSection(ctx);
    this._statsSection(ctx);
    if (this.showSave) this._savePanel(ctx);
  },

  // ── Painel de fundo ─────────────────────────────────────────────
  _panel: function(ctx) {
    var g = ctx.createLinearGradient(this.PX-4, 0, this.PX-4+this.PW+4, 0);
    g.addColorStop(0,'rgba(5,8,22,0.97)'); g.addColorStop(1,'rgba(8,12,28,0.97)');
    ctx.fillStyle=g; ctx.fillRect(this.PX-4,0,this.PW+4,C.H);
    ctx.strokeStyle='#1e2a3a'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(this.PX-4,0); ctx.lineTo(this.PX-4,C.H); ctx.stroke();
    ctx.strokeStyle='rgba(68,136,255,0.15)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(this.PX-3,0); ctx.lineTo(this.PX-3,C.H); ctx.stroke();
  },

  // ── Barra de topo: HP / Ouro / Energia / Onda ─────────────────
  _topbar: function(ctx) {
    var P = C.P, W = this.PX-4;
    ctx.fillStyle='rgba(3,5,16,0.98)'; ctx.fillRect(0,0,W,58);
    ctx.strokeStyle='#1e2a3a'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,58); ctx.lineTo(W,58); ctx.stroke();

    var col1=160, col2=380, col3=580;
    var NEUTRAL='#8fa0b0'; // cor única para valores — a cor fica reservada para barras/avisos, não decoração

    // ── HP da Base (única barra crítica — merece destaque de cor) ──
    ctx.font='bold 8px Orbitron,sans-serif'; ctx.fillStyle='#556677'; ctx.textAlign='left';
    ctx.fillText('❤ HP', 14, 14);
    var hpW=130, hpH=10;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(14,18,hpW,hpH);
    var hpC = ECO.hpP()>0.5 ? '#44cc44' : ECO.hpP()>0.25 ? '#ccaa22' : '#cc2222';
    ctx.fillStyle=hpC; ctx.fillRect(14,18,hpW*ECO.hpP(),hpH);
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=0.8; ctx.strokeRect(14,18,hpW,hpH);
    ctx.fillStyle='#fff'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText(ECO.bhp+'/'+ECO.mxH, 14+hpW/2, 26);

    // ── Ouro (valor neutro — a cor não acrescenta informação aqui) ──
    ctx.font='bold 8px Orbitron,sans-serif'; ctx.fillStyle='#556677'; ctx.textAlign='left';
    ctx.fillText('OURO', col1, 14);
    ctx.fillStyle=NEUTRAL; ctx.font='bold 15px Orbitron,sans-serif';
    ctx.fillText('$'+ECO.gold, col1, 33);

    // ── Energia (a barra é que conta a história; texto fica neutro) ──
    ctx.font='bold 8px Orbitron,sans-serif'; ctx.fillStyle='#556677'; ctx.textAlign='left';
    ctx.fillText('ENERGIA', col2, 14);
    var eW=160, eH=10, eX=col2;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(eX,18,eW,eH);
    var ep=ECO.eP();
    var eCol = ep>0.5?'#3a8fc0':ep>0.25?'#ccaa22':'#cc2222'; // só aquece de cor quando é preciso reagir
    ctx.fillStyle=eCol; ctx.fillRect(eX,18,eW*ep,eH);
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=0.8; ctx.strokeRect(eX,18,eW,eH);
    ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.font='7px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText(Math.floor(ECO.enrg)+'/'+ECO.mxE, eX+eW/2, 26);
    if (ep<0.25) {
      ctx.fillStyle='#cc4444'; ctx.font='bold 9px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText('⚠ ENERGIA BAIXA', eX+eW/2, 42);
    }

    // ── Sangue (só aparece quando há algum — reduz ruído quando não é relevante) ──
    if (ECO.bPool>0) {
      ctx.font='bold 8px Orbitron,sans-serif'; ctx.fillStyle='#556677'; ctx.textAlign='left';
      ctx.fillText('SANGUE', col3, 14);
      ctx.fillStyle=NEUTRAL; ctx.font='bold 15px Orbitron,sans-serif';
      ctx.fillText('B'+Math.floor(ECO.bPool), col3, 33);
    }

    // ── Buffs ativos (mantêm cor — são avisos temporários e acionáveis) ──
    var bx = col3+(ECO.bPool>0?70:0);
    if (ECO.buffs.dmg.active) {
      ctx.fillStyle='#ff8800'; ctx.font='bold 9px Orbitron,sans-serif'; ctx.textAlign='left';
      ctx.fillText('⚔'+Math.ceil(ECO.buffs.dmg.timer)+'s', bx, 22); bx+=52;
    }
    if (ECO.buffs.spd.active) {
      ctx.fillStyle='#3a8fc0'; ctx.font='bold 9px Orbitron,sans-serif'; ctx.textAlign='left';
      ctx.fillText('⚡'+Math.ceil(ECO.buffs.spd.timer)+'s', bx, 22);
    }

    // ── Onda / Mapa (texto neutro, é informativo não urgente) ──
    ctx.fillStyle='#8fa0b0'; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='right';
    ctx.fillText('ONDA '+WV.num()+'/'+WV.tot(), W-12, 18);
    ctx.fillStyle='#445566'; ctx.font='9px Rajdhani,sans-serif';
    ctx.fillText(C.MAPS[G.selectedMap||'desert'].name.toUpperCase()+' · '+G.difficulty.toUpperCase(), W-12, 32);

    // ── Botões auxiliares — todos neutros por defeito; só acendem quando ATIVOS ──
    var bw=62, bh=20, by=36, gap=4, startX=W-bw*3-gap*2-8;

    this._destroyBtn={x:startX,y:by,w:bw,h:bh};
    var dAct=this.destroyMode;
    ctx.fillStyle=dAct?'rgba(255,140,0,0.2)':'rgba(255,255,255,0.03)';
    U.rr(ctx,startX,by,bw,bh,3); ctx.fill();
    ctx.strokeStyle=dAct?'#ffaa00':'#293646'; ctx.lineWidth=dAct?1.2:0.7; ctx.stroke();
    ctx.fillStyle=dAct?'#ffcc44':'#4a5a6a'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('⛏ PEDRAS',startX+bw/2,by+14);

    this._cdxBtn={x:startX+bw+gap,y:by,w:bw,h:bh};
    var cAct=CODEX.visible;
    ctx.fillStyle=cAct?'rgba(68,136,255,0.2)':'rgba(255,255,255,0.03)';
    U.rr(ctx,startX+bw+gap,by,bw,bh,3); ctx.fill();
    ctx.strokeStyle=cAct?'#4488ff':'#293646'; ctx.lineWidth=cAct?1.2:0.7; ctx.stroke();
    ctx.fillStyle=cAct?'#88ccff':'#4a5a6a'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('📖 CODEX',startX+bw+gap+bw/2,by+14);

    // Velocidade: neutro em 1x (o normal), só acende quando o jogador acelerou
    this._spdBtn={x:startX+(bw+gap)*2,y:by,w:bw,h:bh};
    var spdLbls=['1x','2x ▶','3x ▶▶'], isDefault=this.spd===1;
    ctx.fillStyle=isDefault?'rgba(255,255,255,0.03)':'rgba(255,170,0,0.15)';
    U.rr(ctx,startX+(bw+gap)*2,by,bw,bh,3); ctx.fill();
    ctx.strokeStyle=isDefault?'#293646':'#ffaa00'; ctx.lineWidth=isDefault?0.7:1.2; ctx.stroke();
    ctx.fillStyle=isDefault?'#4a5a6a':'#ffcc44'; ctx.font='bold 9px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('VEL '+spdLbls[this.spd-1],startX+(bw+gap)*2+bw/2,by+14);
  },

  // ── SECÇÃO ONDAS ──────────────────────────────────────────────
  _waveSection: function(ctx) {
    var P=C.P, px=this.PX+10, pw=this.PW-20, y=72;

    // Cabeçalho da secção
    this._sectionHeader(ctx,'⚔ ONDAS',px,y,pw);
    y+=20;

    // Barra de progressão das ondas
    var wProgress = WV.cur / WV.tot();
    ctx.fillStyle='rgba(0,0,0,0.4)'; U.rr(ctx,px,y,pw,8,4); ctx.fill();
    var wG=ctx.createLinearGradient(px,y,px+pw,y);
    wG.addColorStop(0,'#1a5a2a'); wG.addColorStop(1,'#44cc66');
    ctx.fillStyle=wG; U.rr(ctx,px,y,pw*wProgress,8,4); ctx.fill();
    ctx.strokeStyle='#1e3a2a'; ctx.lineWidth=0.7; U.rr(ctx,px,y,pw,8,4); ctx.stroke();
    // Marcadores de cada onda
    for (var w=1;w<=WV.tot();w++) {
      var wx = px + pw*(w/WV.tot()) - 0.5;
      ctx.strokeStyle = w<=WV.cur ? '#44cc66' : '#223322';
      ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(wx,y); ctx.lineTo(wx,y+8); ctx.stroke();
    }
    ctx.fillStyle='#6688aa'; ctx.font='7px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('Onda '+WV.num()+' de '+WV.tot(),px+pw/2,y+20);
    y+=26;

    if (!WV.active && !WV.won()) {
      // Botão PRÓXIMA ONDA
      this._nwBtn={x:px,y:y,w:pw,h:34};
      var g=ctx.createLinearGradient(px,y,px,y+34);
      g.addColorStop(0,'#0d3318'); g.addColorStop(1,'#0a2010');
      ctx.fillStyle=g; U.rr(ctx,px,y,pw,34,6); ctx.fill();
      ctx.shadowBlur=8; ctx.shadowColor='#44cc44';
      ctx.strokeStyle='#44cc44'; ctx.lineWidth=1.5; U.rr(ctx,px,y,pw,34,6); ctx.stroke(); ctx.shadowBlur=0;
      ctx.fillStyle='#44ff66'; ctx.font='bold 12px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText('▶  PRÓXIMA ONDA',px+pw/2,y+22);
      // Preview dos inimigos
      var prev=WV.preview(),ps='';
      for(var pi=0;pi<prev.length&&pi<4;pi++) ps+=C.EN_DEF[prev[pi].t].name.substr(0,3)+'×'+prev[pi].n+' ';
      ctx.fillStyle='#445566'; ctx.font='9px Rajdhani,sans-serif';
      ctx.fillText(ps.trim(),px+pw/2,y+46);
      y+=54;
    } else if (WV.active) {
      this._nwBtn=null;
      // Info da onda em curso
      ctx.fillStyle='rgba(0,0,0,0.25)'; U.rr(ctx,px,y,pw,20,4); ctx.fill();
      ctx.fillStyle='#667788'; ctx.font='10px Rajdhani,sans-serif'; ctx.textAlign='left';
      ctx.fillText('Em curso',px+8,y+13);
      ctx.fillStyle='#e8eaf0'; ctx.textAlign='right';
      ctx.fillText(G.enemies.length+' inimigos',px+pw-8,y+13);
      y+=26;
      // Botão SALTAR ONDA
      this._skipBtn={x:px,y:y,w:pw,h:28};
      ctx.fillStyle='rgba(200,120,0,0.15)'; U.rr(ctx,px,y,pw,28,5); ctx.fill();
      ctx.strokeStyle='#cc8800'; ctx.lineWidth=1.2; U.rr(ctx,px,y,pw,28,5); ctx.stroke();
      ctx.fillStyle='#ffcc44'; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText('⏭  SALTAR ONDA (sem bónus)',px+pw/2,y+19);
      y+=36;
    } else { this._nwBtn=null; this._skipBtn=null; }

    // Auto-avanço
    this._autoCk={x:px,y:y,w:pw,h:22};
    var autoOn=WV.autoAdv;
    ctx.fillStyle=autoOn?'rgba(0,180,80,0.12)':'rgba(0,0,0,0.15)';
    U.rr(ctx,px,y,pw,22,4); ctx.fill();
    ctx.strokeStyle=autoOn?'#44aa44':'#2a3a2a'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.fillStyle=autoOn?'#44cc44':'#445544'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText((autoOn?'■ AUTO-AVANÇO ON':'□ AUTO-AVANÇO OFF'),px+pw/2,y+14);
    y+=28;

    // Botão Coletar Sangue (só quando há gotas)
    var bp=PS.pending();
    if (bp>0) {
      var pulse=0.55+0.45*Math.sin(Date.now()*0.005);
      this._collectBtn={x:px,y:y,w:pw,h:26};
      ctx.fillStyle='rgba(160,20,50,'+(0.25+pulse*0.15)+')';
      U.rr(ctx,px,y,pw,26,5); ctx.fill();
      ctx.strokeStyle='rgba(220,40,80,'+(0.5+pulse*0.5)+')'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.shadowBlur=pulse*6; ctx.shadowColor='#cc2244';
      ctx.fillStyle='#ff6688'; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText('🩸 COLETAR SANGUE  ('+bp+')',px+pw/2,y+17);
      ctx.shadowBlur=0;
    } else this._collectBtn=null;
  },

  // ── SECÇÃO SANGUE ──────────────────────────────────────────────
  _bloodSection: function(ctx) {
    var P=C.P, px=this.PX+10, pw=this.PW-20;

    // Calcular Y dinamicamente abaixo da secção de ondas
    // (estimativa fixa que evita sobreposição)
    var y = WV.active ? 300 : (WV.won() ? 248 : 302);
    if (PS.pending()>0) y += 30;

    this._sectionHeader(ctx,'🩸 USAR SANGUE',px,y,pw);

    // Pool de sangue em destaque
    var pool=Math.floor(ECO.bPool);
    var poolColor = pool>120?'#ff4466':pool>50?'#cc3355':'#882244';
    ctx.fillStyle='rgba(0,0,0,0.3)'; U.rr(ctx,px,y+18,pw,22,4); ctx.fill();
    ctx.fillStyle=poolColor; ctx.font='bold 12px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('B '+pool+(pool===0?' — Abate inimigos para obter sangue':''),px+pw/2,y+33);
    y+=42;

    this._bloodUseBtns=[];
    var uses=Object.keys(C.BLOOD_USES);
    for (var i=0;i<uses.length;i++) {
      var k=uses[i], bu=C.BLOOD_USES[k], by=y+i*34, can=ECO.bPool>=bu.cost;
      this._bloodUseBtns.push({id:k,x:px,y:by,w:pw,h:28});

      var bg=can?'rgba(180,30,60,0.18)':'rgba(0,0,0,0.12)';
      ctx.fillStyle=bg; U.rr(ctx,px,by,pw,28,5); ctx.fill();
      ctx.strokeStyle=can?'#882244':'#2a1a2a'; ctx.lineWidth=can?1:0.5; ctx.stroke();

      // Ícone
      ctx.font='13px sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#fff';
      ctx.fillText(bu.icon,px+8,by+19);

      // Nome
      ctx.fillStyle=can?P.txt:'#554455'; ctx.font='bold 9px Orbitron,sans-serif';
      ctx.textAlign='left'; ctx.fillText(bu.name,px+26,by+13);

      // Descrição e custo
      ctx.fillStyle=can?'#887799':'#443344'; ctx.font='9px Rajdhani,sans-serif';
      ctx.fillText(bu.desc,px+26,by+24);
      ctx.textAlign='right'; ctx.fillStyle=can?'#ff8899':'#442233';
      ctx.font='bold 9px Orbitron,sans-serif';
      ctx.fillText('B'+bu.cost,px+pw-6,by+19);

      if (!can) { ctx.fillStyle='rgba(0,0,0,0.3)'; U.rr(ctx,px,by,pw,28,5); ctx.fill(); }
    }
  },

  // ── SECÇÃO ESTATÍSTICAS ────────────────────────────────────────
  _statsSection: function(ctx) {
    var P=C.P, px=this.PX+10, pw=this.PW-20, y=C.H-150;

    this._sectionHeader(ctx,'📊 ESTATÍSTICAS',px,y,pw);
    y+=20;

    var rows=[
      ['Torres',G.towers.length],
      ['Abatidos',G.kills],
      ['Ouro ganho','$'+G.earned],
      ['Dificuldade',G.difficulty.toUpperCase()]
    ];
    for (var i=0;i<rows.length;i++) {
      ctx.font='10px Rajdhani,sans-serif'; ctx.fillStyle='#445566'; ctx.textAlign='left';
      ctx.fillText(rows[i][0],px,y+i*18);
      ctx.fillStyle='#8fa0b0'; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='right';
      ctx.fillText(rows[i][1],px+pw,y+i*18);
    }
    y+=rows.length*18+8;

    // Botões Save + Menu
    var hw=(pw-6)/2;
    this._saveBtnArea={x:px,y:y,w:hw,h:24};
    ctx.fillStyle='rgba(0,140,100,0.15)'; U.rr(ctx,px,y,hw,24,4); ctx.fill();
    ctx.strokeStyle='#336655'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.fillStyle='#44aa88'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('💾 SAVE',px+hw/2,y+15);

    this._menuBtnArea={x:px+hw+6,y:y,w:hw,h:24};
    ctx.fillStyle='rgba(80,80,80,0.12)'; U.rr(ctx,px+hw+6,y,hw,24,4); ctx.fill();
    ctx.strokeStyle='#334455'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.fillStyle='#667788'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('☰ MENU',px+hw+6+hw/2,y+15);

    // Atalhos de teclado (rodapé)
    ctx.fillStyle='#2a3a4a'; ctx.font='8px Rajdhani,sans-serif'; ctx.textAlign='center';
    ctx.fillText('N=onda  P=pausa  S=save  C=codex  ?=teclas',px+pw/2,C.H-12);
  },

  // ── Divisória com título ────────────────────────────────────────
  _sectionHeader: function(ctx, title, x, y, w) {
    ctx.fillStyle='rgba(255,255,255,0.03)'; ctx.fillRect(x-4,y-2,w+8,18);
    ctx.strokeStyle='rgba(68,136,255,0.15)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(x-4,y+16); ctx.lineTo(x+w+4,y+16); ctx.stroke();
    ctx.fillStyle='#445566'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='left';
    ctx.fillText(title.toUpperCase(),x,y+12);
  },

  // ── Painel guardar/carregar ─────────────────────────────────────
  _savePanel: function(ctx) {
    ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(0,0,C.W,C.H);
    ctx.fillStyle='rgba(5,10,24,0.98)'; U.rr(ctx,C.W/2-230,C.H/2-150,460,300,12); ctx.fill();
    ctx.strokeStyle='#44aa88'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#44aa88'; ctx.font='bold 14px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('💾 GUARDAR / CARREGAR',C.W/2,C.H/2-120);

    this.saveSlotBtns=[];
    for (var i=0;i<3;i++) {
      var info=SAVE.info(i), sy=C.H/2-90+i*76;
      ctx.fillStyle='rgba(255,255,255,0.03)'; U.rr(ctx,C.W/2-210,sy,420,64,6); ctx.fill();
      ctx.strokeStyle='#2a3a5a'; ctx.lineWidth=0.8; ctx.stroke();
      ctx.fillStyle='#e8eaf0'; ctx.font='bold 10px Orbitron,sans-serif'; ctx.textAlign='left';
      ctx.fillText('SLOT '+(i+1),C.W/2-198,sy+18);
      ctx.fillStyle=info?'#88aacc':'#445566'; ctx.font='10px Rajdhani,sans-serif';
      ctx.fillText(info||'(vazio)',C.W/2-198,sy+36);

      var sBtn={action:'save',slot:i,x:C.W/2+80,y:sy+10,w:60,h:22};
      ctx.fillStyle='rgba(0,140,100,0.2)'; U.rr(ctx,sBtn.x,sBtn.y,sBtn.w,sBtn.h,4); ctx.fill();
      ctx.strokeStyle='#44aa88'; ctx.lineWidth=0.8; ctx.stroke();
      ctx.fillStyle='#44aa88'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText('GUARDAR',sBtn.x+30,sBtn.y+15); this.saveSlotBtns.push(sBtn);

      if (info) {
        var lBtn={action:'load',slot:i,x:C.W/2+150,y:sy+10,w:56,h:22};
        ctx.fillStyle='rgba(0,80,200,0.2)'; U.rr(ctx,lBtn.x,lBtn.y,lBtn.w,lBtn.h,4); ctx.fill();
        ctx.strokeStyle='#4488ff'; ctx.lineWidth=0.8; ctx.stroke();
        ctx.fillStyle='#88aaff'; ctx.font='bold 8px Orbitron,sans-serif'; ctx.textAlign='center';
        ctx.fillText('CARREGAR',lBtn.x+28,lBtn.y+15); this.saveSlotBtns.push(lBtn);
      }
    }
    var cBtn={action:'close',x:C.W/2-36,y:C.H/2+112,w:72,h:28};
    ctx.fillStyle='rgba(200,50,50,0.15)'; U.rr(ctx,cBtn.x,cBtn.y,cBtn.w,cBtn.h,5); ctx.fill();
    ctx.strokeStyle='#cc4444'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.fillStyle='#ff6666'; ctx.font='bold 9px Orbitron,sans-serif'; ctx.textAlign='center';
    ctx.fillText('FECHAR',cBtn.x+36,cBtn.y+18); this.saveSlotBtns.push(cBtn);
  }
};
