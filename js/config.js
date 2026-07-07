'use strict';
// ═══════════════════════════════════════════════════════════════
//  config.js  —  Todas as constantes e definições do jogo
//  Para adicionar uma nova torre/inimigo/mapa, edita APENAS este ficheiro.
// ═══════════════════════════════════════════════════════════════

var C = {
  // ── Chaves de localStorage partilhadas entre index.html (menu) e game.html ─
  STORAGE:{
    LOADOUT:'vd_loadout_v5',  // array de até 5 tipos de torre escolhidos no menu
    SHOP:'vd_shop_v5',        // {credits, owned:{tipo:true}} — progresso permanente
    PENDING:'vd_pending_v5'   // {diff,map} — config escolhida no menu p/ a próxima partida
  },

  // ── Canvas e Grid ──────────────────────────────────────────────
  W:1280, H:720, TW:64, TH:32, TD:18, OX:490, OY:130, COLS:18, ROWS:12,

  // ── Economia base ──────────────────────────────────────────────
  // Energia: era 800 cap / 2.5 regen — praticamente infinita com qualquer
  // loadout. Agora é um recurso real que obriga a gerir torres/Observador/sangue.
  B2E:14, BASE_HP:100, ENRG_MAX:320, ENRG_RG:1.4,
  ENRG_BLOOD_COST:40,  // sangue necessário para comprar +80 energia
  ROCK_COST:40,
  UPG_COSTS:[0, 0.55, 1.0], // multiplicador do custo base por nível de upgrade

  // ── Dificuldades ───────────────────────────────────────────────
  DIFF:{
    easy:  {hpM:0.55, spdM:0.80, goldM:1.6,  startGold:580, enrg:160},
    normal:{hpM:1.00, spdM:1.00, goldM:1.0,  startGold:380, enrg:110},
    hard:  {hpM:1.60, spdM:1.20, goldM:0.75, startGold:220, enrg:75}
  },

  // ── Mapas ──────────────────────────────────────────────────────
  MAPS:{
    desert:{
      name:'DESERTO', desc:'Caminho serpenteante clássico', color:'#c4a060',
      path:[{c:-1,r:6},{c:3,r:6},{c:3,r:2},{c:9,r:2},{c:9,r:9},{c:14,r:9},{c:14,r:4},{c:18,r:4}],
      trees:[[0,0],[1,0],[0,1],[0,2],[17,0],[16,0],[17,1],[0,10],[0,11],[1,11],[17,11],[17,10],[5,5],[6,7],[11,3],[12,1],[13,1],[7,0],[15,6],[1,4],[2,8],[16,3],[4,10]],
      rocks:[[5,4],[6,4],[10,6],[11,6],[7,8],[8,8],[4,1],[15,8]],
      mountains:[]
    },
    maze:{
      name:'LABIRINTO', desc:'Ziguezague estratégico', color:'#5588cc',
      path:[{c:-1,r:9},{c:3,r:9},{c:3,r:3},{c:7,r:3},{c:7,r:9},{c:11,r:9},{c:11,r:3},{c:15,r:3},{c:15,r:9},{c:18,r:9}],
      trees:[[0,0],[17,0],[0,11],[17,11],[9,6],[5,1],[13,1],[1,6],[5,11],[13,11]],
      rocks:[[4,6],[8,6],[12,6],[2,3],[16,3],[2,9],[16,9]],
      mountains:[]
    },
    spiral:{
      name:'ESPIRAL', desc:'Longo caminho em espiral', color:'#44aa88',
      path:[{c:-1,r:10},{c:16,r:10},{c:16,r:1},{c:1,r:1},{c:1,r:7},{c:13,r:7},{c:13,r:4},{c:18,r:4}],
      trees:[[0,0],[17,0],[0,11],[17,11],[8,4],[8,5],[8,6],[7,9],[9,9]],
      rocks:[[3,10],[10,10],[16,5],[3,4],[10,4],[6,7],[10,3]],
      mountains:[]
    },
    // ── MAPA MONTANHA ─────────────────────────────────────────────
    // Caminho em vale; montanhas flanqueiam os lados — posições
    // estratégicas para torres de montanha com alcance elevado.
    montanha:{
      name:'MONTANHA', desc:'Alto terreno · tropas especiais', color:'#9a9a8a',
      path:[{c:-1,r:5},{c:5,r:5},{c:5,r:1},{c:12,r:1},{c:12,r:8},{c:17,r:8},{c:18,r:8}],
      trees:[[0,0],[0,1],[0,2],[17,0],[16,0],[17,1],[16,1],[0,10],[0,11],[17,10],[17,11]],
      rocks:[[6,5],[7,5],[8,5],[9,5],[4,2],[13,8],[14,8]],
      // tiles de montanha: dois planaltos elevados a flanquear o caminho
      mountains:[
        // Planalto Norte-Oeste
        [1,3],[2,3],[3,3],[1,4],[2,4],[3,4],[2,5],
        // Planalto Norte-Este
        [9,0],[10,0],[11,0],[9,1],[10,1],[11,1],
        // Planalto Sul
        [6,9],[7,9],[8,9],[7,10],[8,10],[9,10],[7,11],[8,11]
      ]
    }
  },

  // ── Torres ─────────────────────────────────────────────────────
  TW_DEF:{
    pistol:{name:'Pistola', desc:'Rápido · curto alcance',
      cost:75, dmg:22, range:3.2, rate:1.6, pspd:230, drain:0.4, aoe:0, support:false,
      upgDmg:[1,1.35,1.7], upgRange:[1,1.15,1.30], upgRate:[1,1.2,1.4],
      col:{top:'#4466cc',lft:'#2244aa',rgt:'#1a3388'}, ht:28, bw:0.62, bd:20},

    sniper:{name:'Sniper', desc:'Alto dano · longo alcance',
      cost:220, dmg:105, range:7.5, rate:0.40, pspd:480, drain:0.9, aoe:0, support:false,
      upgDmg:[1,1.40,1.80], upgRange:[1,1.20,1.40], upgRate:[1,1.15,1.30],
      col:{top:'#2a6642',lft:'#1a4a2e',rgt:'#103520'}, ht:44, bw:0.50, bd:16},

    grenade:{name:'L.Granada', desc:'AOE médio · custo baixo',
      cost:175, dmg:55, range:4.2, rate:0.50, pspd:160, drain:0.8, aoe:1.4, support:false,
      upgDmg:[1,1.35,1.65], upgRange:[1,1.15,1.30], upgRate:[1,1.2,1.35],
      col:{top:'#998822',lft:'#776611',rgt:'#554400'}, ht:26, bw:0.65, bd:20},

    mortar:{name:'Morteiro', desc:'Grande AOE · muito lento',
      cost:310, dmg:80, range:5.5, rate:0.28, pspd:145, drain:1.4, aoe:2.2, support:false,
      upgDmg:[1,1.45,1.90], upgRange:[1,1.20,1.40], upgRate:[1,1.25,1.50],
      col:{top:'#883322',lft:'#661610',rgt:'#440e08'}, ht:22, bw:0.72, bd:22},

    minigun:{name:'Minigun', desc:'Ultra rápido · baixo dano',
      cost:340, dmg:13, range:2.7, rate:4.0, pspd:290, drain:1.6, aoe:0, support:false,
      upgDmg:[1,1.30,1.60], upgRange:[1,1.10,1.20], upgRate:[1,1.25,1.50],
      col:{top:'#334466',lft:'#223344',rgt:'#112233'}, ht:26, bw:0.60, bd:18},

    flamethrower:{name:'L.Chamas', desc:'Chamas · área média · dano contínuo',
      cost:240, dmg:27, range:3.4, rate:4.5, pspd:280, drain:1.5, aoe:2.0, support:false,
      upgDmg:[1,1.40,1.85], upgRange:[1,1.20,1.35], upgRate:[1,1.20,1.40],
      col:{top:'#cc4400',lft:'#882200',rgt:'#661100'}, ht:24, bw:0.65, bd:18},

    commander:{name:'Commander', desc:'Aura +30% dano torres próx.',
      cost:400, dmg:0, range:0, rate:0, pspd:0, drain:1.0, aoe:0, support:true, mountainOnly:false,
      auraType:'dmg', auraMult:1.30, auraRange:4.0,
      upgDmg:[1,1,1], upgRange:[1,1,1], upgRate:[1,1,1],
      col:{top:'#cc8800',lft:'#885500',rgt:'#663300'}, ht:34, bw:0.70, bd:20},

    djbooth:{name:'DJ Booth', desc:'Aura +35% veloc. torres próx.',
      cost:370, dmg:0, range:0, rate:0, pspd:0, drain:0.8, aoe:0, support:true, mountainOnly:false,
      auraType:'spd', auraMult:1.35, auraRange:4.2,
      upgDmg:[1,1,1], upgRange:[1,1,1], upgRate:[1,1,1],
      col:{top:'#aa00cc',lft:'#660088',rgt:'#440066'}, ht:32, bw:0.68, bd:18},

    // ── GERADOR: gera +5 energia/s (em vez de consumir), não ataca ──
    // Constrói-se em tiles normais. Útil quando tens muitas torres a consumir.
    gerador:{name:'Gerador', desc:'Fornece +5 energia/s · não ataca',
      cost:280, dmg:0, range:0, rate:0, pspd:0, drain:-5.0, aoe:0, support:true, mountainOnly:false,
      auraType:'energy', auraMult:1.0, auraRange:0,
      upgDmg:[1,1,1], upgRange:[1,1,1], upgRate:[1,1,1],
      col:{top:'#00aa88',lft:'#006655',rgt:'#004433'}, ht:30, bw:0.65, bd:18},

    // ── TROPAS DE MONTANHA (só colocáveis em tiles montanha) ───────
    artilharia:{name:'Artilharia', desc:'⛰ Montanha · AOE pesado · grande alcance',
      cost:420, dmg:110, range:8.5, rate:0.30, pspd:155, drain:1.6, aoe:2.0, support:false, mountainOnly:true,
      upgDmg:[1,1.50,2.00], upgRange:[1,1.20,1.40], upgRate:[1,1.20,1.40],
      col:{top:'#556677',lft:'#334455',rgt:'#223344'}, ht:40, bw:0.72, bd:22},

    observador:{name:'Observador', desc:'⛰ Montanha · deteta invisíveis · buff alcance',
      cost:260, dmg:0, range:0, rate:0, pspd:0, drain:0.7, aoe:0, support:true, mountainOnly:true,
      auraType:'detect', auraMult:1.0, auraRange:6.0,
      upgDmg:[1,1,1], upgRange:[1,1.25,1.50], upgRate:[1,1,1],
      col:{top:'#558866',lft:'#336644',rgt:'#224433'}, ht:38, bw:0.65, bd:18}
  },

  // ── Inimigos ───────────────────────────────────────────────────
  EN_DEF:{
    zombie:  {name:'Zombie',     hp:80,  spd:0.80, dmg:10, gold:12, blood:12, bc:'#5a8040',sc:'#3d5a2a',hc:'#80b058',ac:null, sz:14, invisible:false},
    runner:  {name:'Runner',     hp:45,  spd:1.50, dmg:7,  gold:8,  blood:8,  bc:'#228844',sc:'#116633',hc:'#44aa66',ac:null, sz:11, invisible:false},
    armored: {name:'Z.Blindado', hp:260, spd:0.55, dmg:18, gold:28, blood:28, bc:'#4a6030',sc:'#2e4020',hc:'#6a8850',ac:'#888', sz:18, invisible:false},
    tank:    {name:'Tank',       hp:550, spd:0.32, dmg:30, gold:50, blood:50, bc:'#334455',sc:'#223344',hc:'#4466aa',ac:'#556677', sz:22, invisible:false},
    boss:    {name:'BOSS',       hp:2500,spd:0.20, dmg:55, gold:250,blood:220,bc:'#cc1100',sc:'#881100',hc:'#ff3300',ac:'#664444', sz:32, invisible:false},
    // ── NINJA: invisível CONSTANTEMENTE — só fica visível dentro do raio
    // de um Observador (não é um efeito temporário, é sempre assim) ────
    ninja:   {name:'Ninja',      hp:40,  spd:1.80, dmg:12, gold:18, blood:5,  bc:'#223344',sc:'#111e28',hc:'#2a3f50',ac:null, sz:10, invisible:true},
    // ── VOADOR: rápido, pouca vida, ignora obstáculos visualmente,
    // recebe menos dano de torres de área (AOE) mas dano normal de
    // torres de tiro direto ──────────────────────────────────────
    voador:  {name:'Voador',     hp:55,  spd:1.65, dmg:9,  gold:14, blood:9,  bc:'#557799',sc:'#33506e',hc:'#7799bb',ac:null, sz:12, invisible:false, flying:true, aoeResist:0.55}
  },

  // ── Ondas ──────────────────────────────────────────────────────
  WAVES:[
    {g:[{t:'zombie',n:10,iv:1.2}], reward:90},
    {g:[{t:'zombie',n:14,iv:0.9},{t:'runner',n:8,iv:0.6,d:4}], reward:130},
    {g:[{t:'zombie',n:20,iv:0.8},{t:'armored',n:5,iv:2.5,d:3},{t:'runner',n:10,iv:0.5,d:6},{t:'voador',n:5,iv:1.5,d:8}], reward:200},
    {g:[{t:'zombie',n:25,iv:0.6},{t:'armored',n:10,iv:1.8,d:2},{t:'ninja',n:6,iv:1.4,d:4},{t:'voador',n:8,iv:1.0,d:6},{t:'tank',n:2,iv:8.0,d:10}], reward:270},
    {g:[{t:'zombie',n:28,iv:0.5},{t:'runner',n:16,iv:0.4,d:3},{t:'armored',n:10,iv:1.2,d:6},{t:'ninja',n:8,iv:1.0,d:5},{t:'voador',n:10,iv:0.8,d:7},{t:'tank',n:3,iv:7.0,d:12},{t:'boss',n:1,iv:0,d:20}], reward:450},
    {g:[{t:'zombie',n:35,iv:0.4},{t:'runner',n:24,iv:0.35,d:2},{t:'armored',n:16,iv:0.9,d:4},{t:'ninja',n:14,iv:0.7,d:5},{t:'voador',n:14,iv:0.6,d:6},{t:'tank',n:5,iv:5.0,d:10}], reward:380},
    {g:[{t:'zombie',n:32,iv:0.35},{t:'runner',n:22,iv:0.3,d:2},{t:'armored',n:18,iv:0.8,d:4},{t:'ninja',n:16,iv:0.6,d:5},{t:'voador',n:16,iv:0.5,d:6},{t:'tank',n:6,iv:4.5,d:10},{t:'boss',n:1,iv:0,d:18}], reward:600},
    {g:[{t:'zombie',n:40,iv:0.3},{t:'runner',n:28,iv:0.25,d:2},{t:'armored',n:22,iv:0.7,d:4},{t:'ninja',n:20,iv:0.5,d:5},{t:'voador',n:20,iv:0.4,d:6},{t:'tank',n:8,iv:4.0,d:10},{t:'boss',n:2,iv:14,d:22}], reward:900}
  ],

  // ── Itens de campo ─────────────────────────────────────────────
  // Largados por inimigos ao morrer, aparecem no mapa (ícone pulsante)
  // e desaparecem se não forem clicados a tempo. Diferente do Sangue
  // (que se acumula e gasta por botão): isto é "apanha antes que fuja".
  ITEM_DEFS: {
    energyCore: {name:'Núcleo de Energia', icon:'🔋', color:'#00ccff', desc:'+100 energia', duration:8},
    goldPouch:  {name:'Bolsa de Ouro',     icon:'💰', color:'#ffd700', desc:'+ouro instantâneo', duration:8},
    overcharge: {name:'Sobrecarga',        icon:'⚡', color:'#ff8800', desc:'+50% vel. ataque 6s (todas as torres)', duration:7},
    frostBomb:  {name:'Granada de Gelo',   icon:'🧊', color:'#66ddff', desc:'Congela todos os inimigos 3s', duration:9},
    airstrike:  {name:'Ogiva Aérea',       icon:'💥', color:'#ff3300', desc:'Ataque aéreo maciço na zona', duration:11},
    medkit:     {name:'Kit Médico',        icon:'❤️', color:'#44ff66', desc:'+40 HP da base', duration:8}
  },
  // Tabela de drop: que itens cada "camada" de inimigo pode largar, e com que peso.
  // Camadas mais fortes (tank/boss) têm acesso a itens melhores/mais raros.
  ITEM_DROP_TABLE: {
    common:  {chance:0.05, pool:['energyCore','goldPouch']},                                   // zombie, runner, ninja, voador
    tough:   {chance:0.09, pool:['energyCore','goldPouch','overcharge','frostBomb','medkit']},  // armored, tank
    boss:    {chance:0.9,  pool:['airstrike','overcharge','medkit']}                            // boss (quase garantido)
  },
  // ── Cores de tiles ─────────────────────────────────────────────
  TC:{
    grass:{top:'#5c8a3c',lft:'#3d6128',rgt:'#2d4a1e'},
    path:{top:'#c4a060',lft:'#8a6e40',rgt:'#6a5230'},
    dark:{top:'#3a5a28',lft:'#253d18',rgt:'#1a2d10'},
    base:{top:'#2244aa',lft:'#162e7a',rgt:'#0e225c'},
    hover:{top:'#7abf50',lft:'#548235',rgt:'#3e6126'},
    nobld:{top:'#cc4444',lft:'#882222',rgt:'#661a1a'},
    tower:{top:'#4a7035',lft:'#2d4a20',rgt:'#1e3515'},
    rock:{top:'#7a7a7a',lft:'#555555',rgt:'#3a3a3a'},
    // ── TILES DE MONTANHA ──────────────────────────────────────
    mountain:{top:'#9a9a8a',lft:'#6a6a60',rgt:'#4e4e46'},
    mtn_used:{top:'#7a8a72',lft:'#556050',rgt:'#3a4438'} // montanha com torre
  },

  // ── Paleta UI ──────────────────────────────────────────────────
  P:{
    bgT:'#0d1b2a', bgB:'#1a3050', panel:'rgba(5,8,20,0.94)', pbd:'#2a3a5a',
    gold:'#ffd700', enrg:'#00ccff', blood:'#ff4466', txt:'#e8eaf0', dim:'#8892aa',
    hpHi:'#44cc44', hpMd:'#ccaa22', hpLo:'#cc2222'
  },

  // ── Usos do Sangue ─────────────────────────────────────────────
  // Nota: a conversão de Sangue→Energia é AUTOMÁTICA (passiva, 25/s).
  // Por isso não há botão manual de "converter sangue em energia" —
  // o sangue coletado serve apenas para estes efeitos especiais:
  BLOOD_USES:{
    heal:   {name:'Curar Base',  desc:'+25 HP base',   cost:70, icon:'♥'},
    dmgBuff:{name:'Buff Dano',   desc:'+60% dano 12s', cost:75, icon:'⚔'},
    spdBuff:{name:'Buff Ataque', desc:'+60% vel 12s',  cost:85, icon:'⚡'},
    energy: {name:'Comprar Energia', desc:'+80 energia agora', cost:40, icon:'~'}
  }
};

// ── Constrói dados de caminho para um mapa ───────────────────────
// Devolve {cells, set, length} a partir dos waypoints do mapa.
function buildMapData(mapKey){
  var m = C.MAPS[mapKey], wps = m.path, res = [], seen = {};
  for (var i = 0; i < wps.length - 1; i++) {
    var c = wps[i].c, r = wps[i].r, tc = wps[i+1].c, tr = wps[i+1].r;
    while (c !== tc || r !== tr) {
      var k = c + ',' + r;
      if (!seen[k]) { seen[k] = 1; res.push({ c: c, r: r }); }
      if (c < tc) c++; else if (c > tc) c--;
      if (r < tr) r++; else if (r > tr) r--;
    }
    var k2 = c + ',' + r;
    if (!seen[k2]) { seen[k2] = 1; res.push({ c: c, r: r }); }
  }
  var len = 0;
  for (var i = 0; i < wps.length - 1; i++) {
    len += Math.abs(wps[i+1].c - wps[i].c) + Math.abs(wps[i+1].r - wps[i].r);
  }
  return { cells: res, set: seen, length: len };
}
