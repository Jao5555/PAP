'use strict';
// ═══════════════════════════════════════════════════════════════
//  codex.js  —  Índice desbloqueável + Conquistas
//
//  COMO FUNCIONA:
//  - Cada torre/inimigo tem uma "unlockKey" própria (ex: 'tower_pistol').
//  - G chama CODEX.onPlace(type) quando o jogador constrói uma torre,
//    e CODEX.onSpawn(type) quando um inimigo aparece no mapa.
//  - Isto desbloqueia automaticamente a entrada correspondente no Codex.
//  - Conquistas são verificadas em CODEX._checkAch() sempre que
//    uma estatística é atualizada (onKill, onWave, etc.)
//
//  PARA ADICIONAR UMA NOVA ENTRADA: junta um objeto a ENTRIES com
//  unlockKey único (ex: 'tower_X' ou 'enemy_X') e chama
//  CODEX.unlock('tower_X') / CODEX.unlock('enemy_X') no sítio certo.
// ═══════════════════════════════════════════════════════════════

var CODEX = {

  // ── Entradas: Torres + Inimigos ─────────────────────────────────
  ENTRIES:{
    // ─ TORRES ─
    pistol:{type:'tower',name:'Pistola',color:'#4466cc',unlockKey:'tower_pistol',unlockHint:'Constrói uma Pistola',
      lore:'Uma torre simples mas eficaz. Montada com fragmentos de metal reciclados após o colapso, dispara sem parar contra as hordas de infectados. A base de qualquer defesa sólida.',
      tips:'Ideal para cobrir zonas com muita passagem. Posiciona perto de curvas para maior cobertura. Não precisas de muitas Pistolas, mas precisas das certas.'},

    sniper:{type:'tower',name:'Sniper',color:'#2a6642',unlockKey:'tower_sniper',unlockHint:'Constrói um Sniper',
      lore:'Desenvolvido por engenheiros militares sobreviventes. Precisão cirúrgica a grandes distâncias. Um único tiro pode parar um Blindado no seu caminho.',
      tips:'Excelente contra Tanks e Blindados. Posiciona em linha recta longa para máximo aproveitamento. Combina com Lança-Granadas para coverage total.'},

    grenade:{type:'tower',name:'Lança-Granada',color:'#998822',unlockKey:'tower_grenade',unlockHint:'Constrói um Lança-Granada',
      lore:'Adaptado de lançadores militares encontrados em depósitos abandonados. Cada projétil descreve um arco balístico antes de explodir, causando dano massivo em área.',
      tips:'Posiciona em curvas apertadas para maximizar o AOE. Muito eficaz contra grupos de Runners. Nível 3 transforma-se numa arma de destruição massiva.'},

    mortar:{type:'tower',name:'Morteiro',color:'#883322',unlockKey:'tower_mortar',unlockHint:'Constrói um Morteiro',
      lore:'A arma definitiva de área. Lento mas devastador. O estrondo do Morteiro é ouvido a quilómetros. Deixa os infectados em fragmentos. Nada sobrevive ao epicentro.',
      tips:'Combina com Snipers: o Morteiro abranda grupos, o Sniper elimina sobreviventes. Nível 3 tem AOE quase impraticável de escapar.'},

    minigun:{type:'tower',name:'Minigun',color:'#334466',unlockKey:'tower_minigun',unlockHint:'Constrói uma Minigun',
      lore:'Recuperada de um helicóptero militar abatido nos primeiros dias do colapso. Dispara centenas de projéteis por minuto, mas cada bala individual causa pouco dano.',
      tips:'Combina bem com DJ Booth e Commander para compensar o baixo dano. Ideal contra Runners e Zombies em massa — evita usar contra Tanks sozinha.'},

    flamethrower:{type:'tower',name:'Lança-Chamas',color:'#cc4400',unlockKey:'tower_flamethrower',unlockHint:'Constrói um Lança-Chamas',
      lore:'Um tanque de combustível modificado com um bico de ignição. O fogo queima tudo o que toca numa pequena área, e o calor residual continua a causar dano por segundos.',
      tips:'Alcance muito curto — posiciona em pontos onde os inimigos passam mais tempo (curvas apertadas). Dano contínuo excelente contra grupos lentos e densos.'},

    commander:{type:'tower',name:'Commander',color:'#cc8800',unlockKey:'tower_commander',unlockHint:'Constrói um Commander',
      lore:'Um antigo oficial militar que recusou desistir. A sua presença e ordens gritadas aumentam a precisão e potência de fogo de todas as torres num raio considerável.',
      tips:'Coloca no centro de um cluster de torres para maximizar quantas beneficiam do +30% de dano. Funciona com QUALQUER torre, incluindo outras de suporte.'},

    djbooth:{type:'tower',name:'DJ Booth',color:'#aa00cc',unlockKey:'tower_djbooth',unlockHint:'Constrói uma DJ Booth',
      lore:'Ninguém sabe como ou porquê, mas música alta parece acelerar os reflexos dos operadores das torres próximas. Talvez seja adrenalina, talvez pura sorte. Funciona.',
      tips:'+35% de velocidade de ataque é enorme em torres de cadência alta (Minigun, Pistola). Combina com Commander para um dueto devastador de dano+velocidade.'},

    gerador:{type:'tower',name:'Gerador',color:'#00aa88',unlockKey:'tower_gerador',unlockHint:'Constrói um Gerador',
      lore:'Uma turbina portátil recuperada de uma subestação abandonada. Em vez de consumir energia como todas as outras torres, produz +5 energia por segundo, aliviando a pressão sobre o teu orçamento energético.',
      tips:'Indispensável quando tens um loadout pesado (Morteiro + Minigun + Commander). Cada Gerador "paga" o consumo de ~3 Pistolas. Coloca 1-2 para ter margem para construir mais torres sem correr o risco de apagão.'},

    artilharia:{type:'tower',name:'Artilharia',color:'#556677',unlockKey:'tower_artilharia',unlockHint:'Constrói uma Artilharia (⛰ só em montanha)',
      lore:'Peças de canhão pesadas, montadas nos pontos mais altos do terreno. A vantagem de altitude permite-lhes bombardear inimigos a distâncias que nenhuma outra torre alcança.',
      tips:'Só pode ser construída em tiles de montanha (⛰). Compensa com o maior alcance do jogo — posiciona onde vês mais do caminho possível.'},

    observador:{type:'tower',name:'Observador',color:'#558866',unlockKey:'tower_observador',unlockHint:'Constrói um Observador (⛰ só em montanha)',
      lore:'Um posto de vigia elevado, equipado com binóculos e rádio. Não ataca diretamente, mas a sua visão privilegiada do campo de batalha é inestimável para coordenar a defesa.',
      tips:'Só pode ser construído em tiles de montanha (⛰). Torre de suporte — não causa dano, mas o seu posicionamento estratégico é valioso para vigiar grandes áreas do mapa.'},

    // ─ INIMIGOS ─
    zombie:{type:'enemy',name:'Zombie',color:'#5a8040',unlockKey:'enemy_zombie',unlockHint:'Encontra um Zombie',
      lore:'Outrora humanos normais. O Vírus Void transforma-os em criaturas lentas e sem razão. Sozinhos são fracos. Em horda são imparáveis. A ameaça mais comum da zona.',
      weak:'Torres de fogo rápido. São lentos — qualquer torre os consegue atingir. Pistolas são suficientes para pequenos grupos.'},

    runner:{type:'enemy',name:'Runner',color:'#228844',unlockKey:'enemy_runner',unlockHint:'Encontra um Runner (onda 2+)',
      lore:'Mutantes hiper-ativos. A infecção acelerou o seu metabolismo ao extremo. Correm como o vento mas são frágeis como papel. Aparecem em manadas para ultrapassar as defesas.',
      weak:'Lança-Granadas e Pistolas. Evita Snipers — são difíceis de acertar. O Morteiro e Lança-Chamas são devastadores contra grupos de Runners.'},

    armored:{type:'enemy',name:'Z.Blindado',color:'#4a6030',unlockKey:'enemy_armored',unlockHint:'Encontra um Z.Blindado (onda 3+)',
      lore:'Fragmentos de armadura militar fundidos com carne corrompida. Resistem a dezenas de tiros normais. O resultado horrível de infectados que encontraram depósitos militares.',
      weak:'Snipers e Morteiros. Evita desperdiçar Pistolas neles. Buffs de Dano são altamente recomendados quando aparecem em número.'},

    tank:{type:'enemy',name:'Tank',color:'#334455',unlockKey:'enemy_tank',unlockHint:'Encontra um Tank (onda 4+)',
      lore:'A mutação extrema. Estes colossos desenvolveram massa muscular e couro resistente a projéteis. Um único Tank pode destruir a base sozinho se não for detido imediatamente.',
      weak:'Todo o fogo concentrado. Usa Buff de Dano imediatamente. Prioridade MÁXIMA. Um Tank não parado é quase sempre game over.'},

    ninja:{type:'enemy',name:'Ninja',color:'#223344',unlockKey:'enemy_ninja',unlockHint:'Encontra um Ninja (onda 4+)',
      lore:'Infectados que mantiveram parte da sua agilidade e instintos furtivos. Movem-se em silêncio entre as sombras do mapa, sendo dos mais difíceis de detetar e antecipar.',
      weak:'Frágeis (40 HP) mas rápidos — qualquer torre de fogo rápido os elimina assim que aparecem. Precisas de um Observador (⛰) para que as torres os consigam ver e atacar.'},

    voador:{type:'enemy',name:'Voador',color:'#557799',unlockKey:'enemy_voador',unlockHint:'Encontra um Voador (onda 3+)',
      lore:'Mutantes com membros superiores transformados em asas membranosas. Planam acima do terreno a velocidade elevada, o que os torna resistentes a explosões — a onda de choque dissipa-se antes de os alcançar.',
      weak:'Resistem a torres AOE (Granada/Morteiro/Chamas — 55% do dano). Torres de tiro direto (Pistola/Sniper/Minigun) causam dano normal. Prioritiza sempre torres de tiro rápido contra grupos de Voadores.'},

    boss:{type:'enemy',name:'BOSS',color:'#cc1100',unlockKey:'enemy_boss',unlockHint:'Encontra o BOSS (onda 5+)',
      lore:'Surgido das profundezas da infestação, esta criatura monstruosa concentra centenas de infecções num único corpo. As suas 2500 unidades de vida tornam-no praticamente imparável sem preparação. Aparece a partir da onda 5, e em maior número nas ondas finais.',
      weak:'Concentra TODO o fogo possível. Usa os dois buffs de sangue (Dano + Velocidade) imediatamente. Morteiros e Snipers nível 3 são essenciais. Commander + DJ Booth ajudam imenso.'}
  },  // fecha ENTRIES

  // ── Conquistas ────────────────────────────────────────────────
  ACHIEVEMENTS:[
    {id:'first_blood',  name:'Primeiro Sangue',  icon:'🩸',desc:'Mata o primeiro inimigo',          cat:'kill_any',  req:1,   gold:30},
    {id:'builder5',     name:'Arquiteto',         icon:'🏗',desc:'Constrói 5 torres no total',       cat:'place',     req:5,   gold:80},
    {id:'arsenal',      name:'Arsenal Completo',  icon:'🎖',desc:'Constrói todos os 8 tipos de torre',cat:'arsenal',  req:8,   gold:200},
    {id:'support_squad',name:'Equipa de Suporte', icon:'🎺',desc:'Constrói Commander E DJ Booth',    cat:'support',   req:1,   gold:120},
    {id:'kills50',      name:'Defensor',          icon:'⚔',desc:'Abate 50 inimigos',                cat:'kill_any',  req:50,  gold:100},
    {id:'kills200',     name:'Exterminador',      icon:'☠',desc:'Abate 200 inimigos',               cat:'kill_any',  req:200, gold:250},
    {id:'wave1',        name:'Sobrevivente',      icon:'🛡',desc:'Completa a onda 1',                cat:'wave',      req:1,   gold:50},
    {id:'wave4',        name:'Veterano',          icon:'⚔',desc:'Completa a onda 4',                cat:'wave',      req:4,   gold:150},
    {id:'wave6',        name:'Sobrevivente Elite',icon:'🔥',desc:'Completa a onda 6',                cat:'wave',      req:6,   gold:300},
    {id:'wave8',        name:'Mestre das Ondas',  icon:'👑',desc:'Completa todas as 8 ondas',       cat:'wave',      req:8,   gold:700},
    {id:'kill_boss',    name:'Caçador de Deuses', icon:'💀',desc:'Derrota o BOSS',                  cat:'kill_type', req:1,   type:'boss',gold:300},
    {id:'kill_tank',    name:'Caçador de Titãs',  icon:'🦣',desc:'Mata o primeiro Tank',            cat:'kill_type', req:1,   type:'tank',gold:100},
    {id:'kill_runner100',name:'Anti-Corrida',     icon:'🏃',desc:'Mata 100 Runners',                cat:'kill_type', req:100, type:'runner',gold:120},
    {id:'blood200',     name:'Coletador',         icon:'🧪',desc:'Coleta 200 de sangue total',      cat:'blood',     req:200, gold:100},
    {id:'speedrun',     name:'Speedrunner',       icon:'⚡',desc:'Termina onda com bónus de rapidez',cat:'bonus',    req:1,   gold:80},
    {id:'maxed',        name:'Engenheiro',        icon:'🔧',desc:'Atualiza uma torre ao nível 3',   cat:'maxed',     req:1,   gold:150},
    {id:'nodmg',        name:'Intocável',         icon:'✨',desc:'Completa onda sem perder HP',     cat:'nodmg',     req:1,   gold:200},
    {id:'rock_buster',  name:'Demolidor',         icon:'⛏',desc:'Destrói 5 pedras',                cat:'rocks',     req:5,   gold:80},
    {id:'cartographer', name:'Cartógrafo',        icon:'🗺',desc:'Joga nos 3 mapas diferentes',     cat:'maps',      req:3,   gold:120},
    {id:'full_codex',   name:'Historiador',       icon:'📖',desc:'Desbloqueia todo o Codex',        cat:'codex',     req:16,  gold:400}
  ],

  // ── Estado persistente ──────────────────────────────────────────
  st:{unlocked:{},kills:{},placed:0,placedTypes:{},mapsPlayed:{},totalBlood:0,wavesDone:0,earlyBonus:0,maxedTowers:0,nodmgWaves:0,rocksDestroyed:0,achievements:[]},
  visible:false, tab:'tower', selected:null,
  _notifications:[],
  SAVE_KEY:'vd_codex_v5',
  _closeBtn:null, _tabBtns:[], _entryBtns:[],

  // ── Persistência ──────────────────────────────────────────────
  load:function(){
    try{
      var d=localStorage.getItem(this.SAVE_KEY);
      if(d){
        var loaded=JSON.parse(d);
        // Merge com defaults para garantir que novos campos existem em saves antigos
        for(var k in this.st)if(!(k in loaded))loaded[k]=this.st[k];
        this.st=loaded;
      }
    }catch(e){}
  },
  save:function(){try{localStorage.setItem(this.SAVE_KEY,JSON.stringify(this.st));}catch(e){}},

  // ── Desbloqueio de entradas ──────────────────────────────────────
  unlock:function(key){
    if(this.st.unlocked[key])return;
    this.st.unlocked[key]=true;
    var name='';
    for(var k in this.ENTRIES){if(this.ENTRIES[k].unlockKey===key){name=this.ENTRIES[k].name;break;}}
    if(name)this._notifications.push({msg:'CODEX: '+name+' descoberto!',col:'#88ccff',timer:3.5});
    this.save();
    this._checkAch();
  },
  isUnlocked:function(entryKey){var e=this.ENTRIES[entryKey];if(!e)return false;return!!this.st.unlocked[e.unlockKey];},
  unlockedCount:function(){var t=0;for(var k in this.ENTRIES)if(this.isUnlocked(k))t++;return t;},

  // ── Hooks chamados pelo motor do jogo ────────────────────────────
  onPlace:function(type){
    this.st.placed=(this.st.placed||0)+1;
    this.st.placedTypes[type]=true;
    this.unlock('tower_'+type);
    this._checkAch();
  },
  onSpawn:function(type){ this.unlock('enemy_'+type); },
  onKill:function(type){
    this.st.kills[type]=(this.st.kills[type]||0)+1;
    this._checkAch();
  },
  onWave:function(n){ this.st.wavesDone=Math.max(this.st.wavesDone||0,n); this._checkAch(); },
  onBlood:function(v){ this.st.totalBlood=(this.st.totalBlood||0)+v; this._checkAch(); },
  onEarlyBonus:function(){ this.st.earlyBonus=(this.st.earlyBonus||0)+1; this._checkAch(); },
  onMaxed:function(){ this.st.maxedTowers=(this.st.maxedTowers||0)+1; this._checkAch(); },
  onNodmg:function(){ this.st.nodmgWaves=(this.st.nodmgWaves||0)+1; this._checkAch(); },
  onRockDestroyed:function(){ this.st.rocksDestroyed=(this.st.rocksDestroyed||0)+1; this._checkAch(); },
  onMapPlayed:function(mapKey){ this.st.mapsPlayed[mapKey]=true; this._checkAch(); },

  totalKills:function(){var t=0;for(var k in this.st.kills)t+=this.st.kills[k];return t;},

  // ── Verificação de conquistas ─────────────────────────────────
  _checkAch:function(){
    var tot=this.totalKills();
    for(var i=0;i<this.ACHIEVEMENTS.length;i++){
      var a=this.ACHIEVEMENTS[i];
      if(this.st.achievements.indexOf(a.id)>=0)continue;
      var met=false;
      if(a.cat==='kill_any')met=tot>=a.req;
      else if(a.cat==='kill_type')met=(this.st.kills[a.type]||0)>=a.req;
      else if(a.cat==='place')met=(this.st.placed||0)>=a.req;
      else if(a.cat==='arsenal')met=Object.keys(this.st.placedTypes).length>=a.req;
      else if(a.cat==='support')met=this.st.placedTypes.commander&&this.st.placedTypes.djbooth;
      else if(a.cat==='wave')met=(this.st.wavesDone||0)>=a.req;
      else if(a.cat==='blood')met=(this.st.totalBlood||0)>=a.req;
      else if(a.cat==='bonus')met=(this.st.earlyBonus||0)>=a.req;
      else if(a.cat==='maxed')met=(this.st.maxedTowers||0)>=a.req;
      else if(a.cat==='nodmg')met=(this.st.nodmgWaves||0)>=a.req;
      else if(a.cat==='rocks')met=(this.st.rocksDestroyed||0)>=a.req;
      else if(a.cat==='maps')met=Object.keys(this.st.mapsPlayed).length>=a.req;
      else if(a.cat==='codex')met=this.unlockedCount()>=a.req;
      if(met){this.st.achievements.push(a.id);this.save();this._unlockAch(a);}
    }
  },

  _unlockAch:function(a){
    ECO.addG(a.gold);
    this._notifications.push({msg:'CONQUISTA: '+a.name+'! +$'+a.gold,col:'#ffd700',timer:4.0});
    PS.txt(C.W/2,70,a.icon+' '+a.name+' +$'+a.gold,'#ffd700',14);
  },

  // ── Notificações (toast no topo) ──────────────────────────────
  updNotifications:function(dt){
    for(var i=this._notifications.length-1;i>=0;i--){
      this._notifications[i].timer-=dt;
      if(this._notifications[i].timer<=0)this._notifications.splice(i,1);
    }
  },
  drwNotifications:function(ctx){
    for(var i=0;i<this._notifications.length&&i<3;i++){
      var n=this._notifications[i],t=Math.min(1,n.timer,3.5-n.timer+0.001),y=80+i*38;
      ctx.save();ctx.globalAlpha=Math.min(1,t);
      ctx.fillStyle='rgba(0,5,18,0.88)';U.rr(ctx,C.W/2-220,y-14,440,28,6);ctx.fill();
      ctx.strokeStyle=n.col;ctx.lineWidth=1.2;ctx.stroke();
      ctx.fillStyle=n.col;ctx.font='bold 12px Orbitron,sans-serif';ctx.textAlign='center';ctx.fillText(n.msg,C.W/2,y+4);
      ctx.restore();
    }
  },

  // ── Render principal (overlay de tela cheia) ──────────────────
  render:function(ctx){
    if(!this.visible)return;
    ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillRect(0,0,C.W,C.H);
    var px=50,py=24,pw=C.W-100,ph=C.H-48;
    ctx.fillStyle='rgba(4,8,20,0.98)';U.rr(ctx,px,py,pw,ph,12);ctx.fill();
    ctx.strokeStyle='#2a3a5a';ctx.lineWidth=1.5;ctx.stroke();

    ctx.fillStyle='#fff';ctx.font='bold 18px Orbitron,sans-serif';ctx.textAlign='center';
    ctx.shadowBlur=20;ctx.shadowColor='#4488ff';
    ctx.fillText('CODEX  —  VOID DEFENSE',px+pw/2,py+30);ctx.shadowBlur=0;

    var cnt=this.unlockedCount(),total=Object.keys(this.ENTRIES).length;
    ctx.fillStyle='#445566';ctx.font='10px Orbitron,sans-serif';
    ctx.fillText(cnt+'/'+total+' descobertos  |  Conquistas: '+this.st.achievements.length+'/'+this.ACHIEVEMENTS.length,px+pw/2,py+46);

    var tabs=[['tower','TORRES'],['enemy','INIMIGOS'],['achievement','CONQUISTAS']];
    var tabW=(pw-40)/3;
    this._tabBtns=[];
    for(var i=0;i<tabs.length;i++){
      var tx=px+20+i*(tabW+2),ty=py+54,tw=tabW,th=26,isSel=this.tab===tabs[i][0];
      this._tabBtns.push({tab:tabs[i][0],x:tx,y:ty,w:tw,h:th});
      ctx.fillStyle=isSel?'rgba(0,150,255,0.2)':'rgba(0,0,0,0.18)';
      U.rr(ctx,tx,ty,tw,th,4);ctx.fill();
      ctx.strokeStyle=isSel?'#4488ff':'#2a3a5a';ctx.lineWidth=isSel?1.8:0.7;ctx.stroke();
      ctx.fillStyle=isSel?'#88ccff':'#556677';ctx.font='bold 10px Orbitron,sans-serif';ctx.textAlign='center';
      ctx.fillText(tabs[i][1],tx+tw/2,ty+17);
    }

    if(this.tab==='achievement')this._renderAch(ctx,px,py,pw,ph);
    else this._renderEntries(ctx,px,py,pw,ph);

    var cx2=px+pw-56,cy2=py+8;
    this._closeBtn={x:cx2,y:cy2,w:50,h:22};
    ctx.fillStyle='rgba(200,50,50,0.15)';U.rr(ctx,cx2,cy2,50,22,4);ctx.fill();
    ctx.strokeStyle='#cc4444';ctx.lineWidth=0.8;ctx.stroke();
    ctx.fillStyle='#ff6666';ctx.font='bold 10px Orbitron,sans-serif';ctx.textAlign='center';ctx.fillText('✕ ESC',cx2+25,cy2+15);
  },

  // ── Grelha de entradas (torres / inimigos) ────────────────────
  _renderEntries:function(ctx,px,py,pw,ph){
    var keys=[];for(var k in this.ENTRIES)if(this.ENTRIES[k].type===(this.tab==='tower'?'tower':'enemy'))keys.push(k);
    var sy=py+88,sx=px+20,cw=170,ch=100,gap=8,cols=4;
    var detailX=sx+cols*(cw+gap)+10,detailW=pw-(detailX-px)-20;
    this._entryBtns=[];

    for(var i=0;i<keys.length;i++){
      var key=keys[i],en=this.ENTRIES[key];
      var col=i%cols,row=Math.floor(i/cols);
      var cx2=sx+col*(cw+gap),cy2=sy+row*(ch+gap);
      var unlocked=this.isUnlocked(key),isSel=this.selected===key;
      this._entryBtns.push({key:key,x:cx2,y:cy2,w:cw,h:ch});

      ctx.fillStyle=isSel?'rgba(0,150,255,0.18)':(unlocked?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.18)');
      U.rr(ctx,cx2,cy2,cw,ch,6);ctx.fill();
      ctx.strokeStyle=isSel?'#4488ff':(unlocked?en.color:'#1e2838');ctx.lineWidth=isSel?2:1;ctx.stroke();

      if(unlocked){
        ctx.fillStyle=en.color;ctx.fillRect(cx2+8,cy2+10,16,16);
        ctx.fillStyle='#e8eaf0';ctx.font='bold 11px Orbitron,sans-serif';ctx.textAlign='left';ctx.fillText(en.name,cx2+30,cy2+22);
        ctx.fillStyle='#44aa66';ctx.font='9px Orbitron,sans-serif';ctx.fillText('✓ DESCOBERTO',cx2+8,cy2+38);

        if(en.type==='tower'){
          var cf=C.TW_DEF[key];
          ctx.fillStyle='#8892aa';ctx.font='10px Rajdhani,sans-serif';
          if(cf.support)ctx.fillText('AURA '+cf.auraType.toUpperCase()+' +'+Math.floor((cf.auraMult-1)*100)+'%',cx2+8,cy2+54);
          else ctx.fillText('DMG:'+cf.dmg+'  Alc:'+cf.range,cx2+8,cy2+54);
          ctx.fillText('$'+cf.cost+(cf.aoe?' AOE':''),cx2+8,cy2+68);
          var towerLvl=0;for(var ti=0;ti<G.towers.length;ti++){if(G.towers[ti].type===key&&G.towers[ti].level>towerLvl)towerLvl=G.towers[ti].level;}
          if(towerLvl>1){ctx.fillStyle='#ffd700';ctx.font='11px sans-serif';ctx.textAlign='right';ctx.fillText('★'.repeat(towerLvl-1),cx2+cw-8,cy2+22);}
        } else {
          var ef=C.EN_DEF[key];
          ctx.fillStyle='#8892aa';ctx.font='10px Rajdhani,sans-serif';
          ctx.fillText('HP:'+ef.hp+'  Vel:'+ef.spd,cx2+8,cy2+54);
          var kc=this.st.kills[key]||0;
          ctx.fillStyle=kc>0?'#cc8888':'#667788';
          ctx.fillText('Abatidos: '+kc,cx2+8,cy2+68);
          if(kc>0){ctx.fillStyle='rgba(180,30,30,0.75)';ctx.beginPath();ctx.arc(cx2+cw-16,cy2+16,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText(kc>999?'999+':kc,cx2+cw-16,cy2+20);}
        }
      } else {
        ctx.fillStyle='#101820';ctx.fillRect(cx2+2,cy2+2,cw-4,ch-4);
        ctx.fillStyle='#334455';ctx.font='bold 26px sans-serif';ctx.textAlign='center';ctx.fillText('🔒',cx2+cw/2,cy2+ch/2-5);
        ctx.fillStyle='#445566';ctx.font='9px Rajdhani,sans-serif';ctx.fillText(en.unlockHint,cx2+cw/2,cy2+ch-10);
      }
    }

    // Painel de detalhes
    var gridRows=Math.ceil(keys.length/cols);
    var gridBottom=sy+gridRows*(ch+gap);
    if(this.selected&&this.isUnlocked(this.selected)){
      var en2=this.ENTRIES[this.selected];
      ctx.fillStyle='rgba(0,15,40,0.7)';U.rr(ctx,detailX,sy,detailW,ph-sy+py-20,8);ctx.fill();
      ctx.strokeStyle=en2.color;ctx.lineWidth=1.2;ctx.stroke();

      var dy=sy+18;
      ctx.fillStyle=en2.color;ctx.fillRect(detailX+12,dy,20,20);
      ctx.fillStyle='#fff';ctx.font='bold 14px Orbitron,sans-serif';ctx.textAlign='left';ctx.fillText(en2.name.toUpperCase(),detailX+40,dy+14);

      if(en2.type==='tower'){
        var cf2=C.TW_DEF[this.selected];
        ctx.fillStyle='#6688aa';ctx.font='10px Orbitron,sans-serif';
        if(cf2.support){
          ctx.fillText('TIPO: TORRE DE SUPORTE (não ataca)',detailX+12,dy+34);
          ctx.fillText('AURA '+cf2.auraType.toUpperCase()+': +'+Math.floor((cf2.auraMult-1)*100)+'%  RAIO: '+cf2.auraRange+'  DRAIN: '+cf2.drain+'/s',detailX+12,dy+48);
        } else {
          ctx.fillText('DMG '+cf2.dmg+'  ALC '+cf2.range+'  RATE '+cf2.rate+'/s',detailX+12,dy+34);
          ctx.fillText('DRAIN '+cf2.drain+'/s'+(cf2.aoe?'  AOE '+cf2.aoe:''),detailX+12,dy+48);
        }
      } else {
        var ef2=C.EN_DEF[this.selected];
        ctx.fillStyle='#8892aa';ctx.font='10px Orbitron,sans-serif';
        ctx.fillText('HP '+ef2.hp+'  VEL '+ef2.spd+'  DMG '+ef2.dmg,detailX+12,dy+34);
        ctx.fillText('GOLD '+ef2.gold+'  SANGUE '+ef2.blood,detailX+12,dy+48);
      }

      ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(detailX+10,dy+56,detailW-20,1);dy+=62;

      ctx.fillStyle='#6688aa';ctx.font='bold 9px Orbitron,sans-serif';ctx.fillText('LORE',detailX+12,dy);dy+=14;
      ctx.fillStyle='#c8d8e8';ctx.font='11px Rajdhani,sans-serif';
      var lw2=detailW-24;
      dy=this._wrapText(ctx,en2.lore,detailX+12,dy,lw2,16)+8;

      ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(detailX+10,dy,detailW-20,1);dy+=12;
      ctx.fillStyle='#6688aa';ctx.font='bold 9px Orbitron,sans-serif';ctx.fillText(en2.type==='tower'?'DICAS':'FRAQUEZA',detailX+12,dy);dy+=14;
      ctx.fillStyle='#b0cce0';ctx.font='11px Rajdhani,sans-serif';
      this._wrapText(ctx,en2.tips||en2.weak||'',detailX+12,dy,lw2,16);
    } else if(!this.selected){
      ctx.fillStyle='#2a3a4a';ctx.font='11px Rajdhani,sans-serif';ctx.textAlign='center';
      ctx.fillText('Clica numa entrada para ver detalhes',detailX+detailW/2,sy+(gridBottom-sy)/2);
    }
  },

  // ── Grelha de conquistas ────────────────────────────────────────
  _renderAch:function(ctx,px,py,pw,ph){
    var sy=py+88,sx=px+20,cols=3,cw=(pw-60)/cols,ch=74,gap=8;
    for(var i=0;i<this.ACHIEVEMENTS.length;i++){
      var a=this.ACHIEVEMENTS[i],col=i%cols,row=Math.floor(i/cols);
      var cx2=sx+col*(cw+gap),cy2=sy+row*(ch+gap);
      var done=this.st.achievements.indexOf(a.id)>=0;
      ctx.fillStyle=done?'rgba(255,215,0,0.08)':'rgba(0,0,0,0.15)';
      U.rr(ctx,cx2,cy2,cw,ch,6);ctx.fill();
      ctx.strokeStyle=done?'#ffd700':'#2a3a5a';ctx.lineWidth=done?1.5:0.7;ctx.stroke();
      ctx.font=done?'22px sans-serif':'20px sans-serif';ctx.textAlign='left';ctx.fillText(done?a.icon:'🔒',cx2+10,cy2+34);
      ctx.fillStyle=done?'#ffe080':'#556677';ctx.font='bold 10px Orbitron,sans-serif';ctx.fillText(done?a.name:'???',cx2+44,cy2+22);
      ctx.fillStyle=done?'#a8b8c8':'#445566';ctx.font='10px Rajdhani,sans-serif';ctx.fillText(a.desc,cx2+44,cy2+38);
      ctx.fillStyle=done?'#ffd700':'#445566';ctx.font='9px Orbitron,sans-serif';ctx.fillText(done?'COMPLETO  +$'+a.gold:'Recompensa: $'+a.gold,cx2+44,cy2+56);
      if(done){ctx.fillStyle='rgba(0,200,100,0.12)';ctx.fillRect(cx2+2,cy2+2,cw-4,ch-4);}
    }
    var done2=this.st.achievements.length;
    ctx.fillStyle='#556677';ctx.font='11px Rajdhani,sans-serif';ctx.textAlign='center';
    ctx.fillText(done2+'/'+this.ACHIEVEMENTS.length+' conquistas desbloqueadas',px+pw/2,sy+Math.ceil(this.ACHIEVEMENTS.length/cols)*(ch+gap)+20);
  },

  // ── Quebra de linha de texto ──────────────────────────────────
  _wrapText:function(ctx,text,x,y,maxW,lineH){
    var words=text.split(' '),line='';
    for(var i=0;i<words.length;i++){
      var test=line+words[i]+' ';
      if(ctx.measureText(test).width>maxW&&i>0){ctx.fillText(line,x,y);y+=lineH;line=words[i]+' ';}
      else line=test;
    }
    if(line)ctx.fillText(line,x,y);
    return y+lineH;
  },

  // ── Clicks dentro do overlay ──────────────────────────────────
  handleClick:function(x,y){
    if(!this.visible)return false;
    if(this._closeBtn&&x>=this._closeBtn.x&&x<=this._closeBtn.x+this._closeBtn.w&&y>=this._closeBtn.y&&y<=this._closeBtn.y+this._closeBtn.h){this.visible=false;return true;}
    for(var i=0;i<this._tabBtns.length;i++){var tb=this._tabBtns[i];if(x>=tb.x&&x<=tb.x+tb.w&&y>=tb.y&&y<=tb.y+tb.h){this.tab=tb.tab;this.selected=null;return true;}}
    for(var i=0;i<this._entryBtns.length;i++){var eb=this._entryBtns[i];if(x>=eb.x&&x<=eb.x+eb.w&&y>=eb.y&&y<=eb.y+eb.h&&this.isUnlocked(eb.key)){this.selected=eb.key;return true;}}
    return true; // bloqueia clicks no jogo enquanto o codex está aberto
  }
};
