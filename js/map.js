'use strict';
// ═══════════════════════════════════════════════════════════════
//  map.js  —  Sistema de mapa: grid, caminhos, pedras destruíveis
//  3 mapas disponíveis: desert, maze, spiral (definidos em config.js)
// ═══════════════════════════════════════════════════════════════

var MAP = {
  grid: null,
  data: null,           // {cells, set, length} do mapa atual
  currentMap: 'desert',

  // Inicializa/troca de mapa
  init: function(mapKey) {
    mapKey = mapKey || this.currentMap;
    this.currentMap = mapKey;
    this.data = buildMapData(mapKey);

    var m = C.MAPS[mapKey];
    this.grid = [];
    for (var c = 0; c < C.COLS; c++) {
      this.grid[c] = [];
      for (var r = 0; r < C.ROWS; r++) this.grid[c][r] = 'grass';
    }

    // Marcar caminho
    for (var i = 0; i < this.data.cells.length; i++) {
      var p = this.data.cells[i];
      if (p.c >= 0 && p.c < C.COLS && p.r >= 0 && p.r < C.ROWS) this.grid[p.c][p.r] = 'path';
    }

    // Marcar base (última célula do caminho dentro do mapa)
    var onMap = this.data.cells.filter(function(p) {
      return p.c >= 0 && p.c < C.COLS && p.r >= 0 && p.r < C.ROWS;
    });
    if (onMap.length) {
      var last = onMap[onMap.length - 1];
      this.grid[last.c][last.r] = 'base';
    }

    // Árvores
    for (var i = 0; i < m.trees.length; i++) {
      var t = m.trees[i];
      if (t[0] >= 0 && t[0] < C.COLS && t[1] >= 0 && t[1] < C.ROWS && this.grid[t[0]][t[1]] === 'grass') {
        this.grid[t[0]][t[1]] = 'tree';
      }
    }

    // Pedras (destruíveis)
    for (var i = 0; i < m.rocks.length; i++) {
      var rk = m.rocks[i];
      if (rk[0] >= 0 && rk[0] < C.COLS && rk[1] >= 0 && rk[1] < C.ROWS && this.grid[rk[0]][rk[1]] === 'grass') {
        this.grid[rk[0]][rk[1]] = 'rock';
      }
    }

    // ── MONTANHAS (tiles especiais para tropas de montanha) ────────
    if (m.mountains) {
      for (var i = 0; i < m.mountains.length; i++) {
        var mt = m.mountains[i];
        if (mt[0] >= 0 && mt[0] < C.COLS && mt[1] >= 0 && mt[1] < C.ROWS && this.grid[mt[0]][mt[1]] === 'grass') {
          this.grid[mt[0]][mt[1]] = 'mountain';
        }
      }
    }
  },

  // ── Verificações de tile ──────────────────────────────────────
  ok:         function(c,r){ return c>=0&&c<C.COLS&&r>=0&&r<C.ROWS&&this.grid[c][r]==='grass'; },
  isRock:     function(c,r){ return c>=0&&c<C.COLS&&r>=0&&r<C.ROWS&&this.grid[c][r]==='rock'; },
  isMountain: function(c,r){ return c>=0&&c<C.COLS&&r>=0&&r<C.ROWS&&this.grid[c][r]==='mountain'; },
  isMtnTower: function(c,r){ return c>=0&&c<C.COLS&&r>=0&&r<C.ROWS&&this.grid[c][r]==='mtn_tower'; },

  setT: function(c, r) {
    if (this.ok(c,r))        { this.grid[c][r] = 'tower';     return true; }
    if (this.isMountain(c,r)){ this.grid[c][r] = 'mtn_tower'; return true; }
    return false;
  },
  clrT: function(c, r) {
    var t = this.grid[c] && this.grid[c][r];
    if (t === 'tower')     this.grid[c][r] = 'grass';
    if (t === 'mtn_tower') this.grid[c][r] = 'mountain';
  },
  destroyRock: function(c, r) {
    if (this.isRock(c, r)) { this.grid[c][r] = 'grass'; return true; }
    return false;
  },

  // ── Posição no caminho a partir do progresso (0 .. length) ────
  pos: function(prog) {
    var rem = prog, wps = C.MAPS[this.currentMap].path;
    for (var i = 0; i < wps.length - 1; i++) {
      var f = wps[i], t = wps[i+1];
      var seg = Math.abs(t.c - f.c) + Math.abs(t.r - f.r);
      if (rem <= seg) {
        var tv = seg > 0 ? rem / seg : 0;
        return { gc: f.c + (t.c - f.c) * tv, gr: f.r + (t.r - f.r) * tv };
      }
      rem -= seg;
    }
    var last = wps[wps.length - 1];
    return { gc: last.c, gr: last.r };
  },

  // ── Render principal ───────────────────────────────────────────
  // hc/hr = célula sob o rato; placing = tipo de torre a colocar; destroyMode = modo picareta
  render: function(ctx, hc, hr, placing, destroyMode) {
    for (var sum = 0; sum <= (C.COLS - 1) + (C.ROWS - 1); sum++) {
      for (var c = 0; c < C.COLS; c++) {
        var r = sum - c; if (r < 0 || r >= C.ROWS) continue;
        var tile = this.grid[c][r];
        var col = tile === 'path'  ? C.TC.path  :
                  tile === 'base'  ? C.TC.base  :
                  tile === 'tree'  ? C.TC.dark  :
                  tile === 'tower' ? C.TC.tower :
                  tile === 'rock'  ? C.TC.rock  : tile === 'mountain' ? C.TC.mountain : tile === 'mtn_tower' ? C.TC.mtn_used : C.TC.grass;

        if (c === hc && r === hr) {
          if (placing && tile === 'grass') col = C.TC.hover;
          else if (placing && tile === 'mountain' && G && G._isMtnTower && G._isMtnTower(placing)) col = {top:'#aabbaa',lft:'#889988',rgt:'#667766'};
          else if (placing && tile !== 'grass') col = C.TC.nobld;
          else if (destroyMode && tile === 'rock') col = { top:'#ffaa00', lft:'#cc7700', rgt:'#aa5500' };
        }

        U.tile(ctx, c, r, col);
        // Relva: removida a camada de manchas por tile (_grassDetail) — estava
        // a aparecer em quase 100% das tiles e criava ruído visual constante.
        // Fica só o gradiente do próprio tile (já dá profundidade) + props
        // esparsos e pouco frequentes (_grassProp) para dar vida sem poluir.
        if (tile === 'grass') this._grassProp(ctx, c, r);
        if (tile === 'path')  this._pathDetail(ctx, c, r);
        if (tile === 'tree') this._tree(ctx, c, r);
        if (tile === 'rock')      this._rock(ctx, c, r);
        if (tile === 'mountain' || tile === 'mtn_tower') this._mountain(ctx, c, r);
        if (tile === 'base') this._base(ctx, c, r);

        if (tile === 'rock' && destroyMode && c === hc && r === hr) {
          var rp = U.iso(c, r);
          ctx.fillStyle = '#ffd700'; ctx.font = 'bold 11px Orbitron,sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('$' + C.ROCK_COST, rp.x, rp.y - 35);
        }
      }
    }
    this._markers(ctx);
  },

  // ── Árvore decorativa (3 camadas de folhagem) ─────────────────
  // Ruído determinístico simples (mesmo c,r dá sempre o mesmo valor —
  // evita "flicker" de partículas a mudar todos os frames)
  _seed: function(c, r, salt) {
    var n = Math.sin((c*127.1 + r*311.7 + (salt||0)*74.3)) * 43758.5453;
    return n - Math.floor(n);
  },

  // Caminho: só a linha de desgaste central subtil — removidas as pedrinhas
  // aleatórias (3 por tile) que estavam a acrescentar ruído a um elemento
  // que já se distingue bem só pela cor (castanho/areia vs. relva verde).
  _pathDetail: function(ctx, c, r) {
    var p = U.iso(c, r), x = p.x, y = p.y;
    ctx.strokeStyle = 'rgba(80,55,25,0.12)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x-C.TW*0.25, y); ctx.lineTo(x+C.TW*0.25, y); ctx.stroke();
  },

  // ── Árvore decorativa — 3 variantes (pinheiro/frondosa/seca) ──────
  // A variante é escolhida de forma determinística pela posição,
  // dando variedade sem flicker entre frames.
  _tree: function(ctx, c, r) {
    var p = U.iso(c, r), x = p.x, y = p.y;
    var variant = this._seed(c, r, 99);
    var scale = 0.85 + this._seed(c, r, 100) * 0.35; // 0.85x–1.2x, mais orgânico

    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y);

    // Sombra no chão
    ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(x, y+2, 16, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Tronco (comum a todas as variantes)
    ctx.fillStyle = '#4a3015';
    ctx.fillRect(x - 3, y - 22, 6, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, y-22, 3, 18); // sombra lateral do tronco

    if (variant < 0.6) {
      // ── Variante PINHEIRO (camadas triangulares) ──
      var layers = [{dy:-28,w:20,col:'#1a6b25'},{dy:-39,w:14,col:'#228b2e'},{dy:-48,w:9,col:'#2aaa38'}];
      for (var i = 0; i < layers.length; i++) {
        var l = layers[i];
        ctx.fillStyle = l.col;
        ctx.beginPath();
        ctx.moveTo(x, y + l.dy - 9); ctx.lineTo(x + l.w, y + l.dy + 2);
        ctx.lineTo(x, y + l.dy + 10); ctx.lineTo(x - l.w, y + l.dy + 2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5; ctx.stroke();
        // Highlight de luz vindo de cima-esquerda
        ctx.fillStyle='rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.moveTo(x,y+l.dy-9); ctx.lineTo(x-l.w*0.5,y+l.dy-2); ctx.lineTo(x,y+l.dy+3); ctx.closePath(); ctx.fill();
      }
    } else if (variant < 0.88) {
      // ── Variante FRONDOSA (copa redonda em 3 esferas sobrepostas) ──
      var blobs = [{dx:-9,dy:-36,r:11,col:'#2a8b3a'},{dx:9,dy:-34,r:10,col:'#249b3e'},{dx:0,dy:-44,r:12,col:'#33aa44'}];
      for (var i=0;i<blobs.length;i++){
        var b=blobs[i];
        ctx.fillStyle=b.col;
        ctx.beginPath(); ctx.arc(x+b.dx, y+b.dy, b.r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.10)'; ctx.lineWidth=0.5; ctx.stroke();
      }
      // Highlight
      ctx.fillStyle='rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.arc(x-5,y-46,5,0,Math.PI*2); ctx.fill();
    } else {
      // ── Variante SECA/OUTONAL (galhos finos, sem folhagem densa) ──
      ctx.strokeStyle='#5a4020'; ctx.lineWidth=2.2; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(x,y-22); ctx.lineTo(x-9,y-34);
      ctx.moveTo(x,y-26); ctx.lineTo(x+8,y-37);
      ctx.moveTo(x,y-22); ctx.lineTo(x+2,y-40);
      ctx.stroke();
      // Folhas esparsas alaranjadas
      ctx.fillStyle='#cc7733';
      [[-9,-34],[8,-37],[2,-40],[-4,-30],[5,-28]].forEach(function(pt){
        ctx.beginPath(); ctx.arc(x+pt[0],y+pt[1],3,0,Math.PI*2); ctx.fill();
      });
    }
    ctx.restore();
  },

  // ── Pequenos adornos esparsos no relvado (flores/pedrinhas/tufos) ──
  // Aparecem em ~18% dos tiles de relva para dar vida sem poluir o mapa.
  _grassProp: function(ctx, c, r) {
    var s0 = this._seed(c, r, 200);
    if (s0 > 0.07) return; // esparso — só ~7% das tiles, dá vida sem poluir
    var p = U.iso(c, r), x = p.x, y = p.y;
    var kind = this._seed(c, r, 201);
    var ox = (this._seed(c,r,202)-0.5) * C.TW * 0.4;
    var oy = (this._seed(c,r,203)-0.5) * C.TH * 0.4;

    if (kind < 0.4) {
      // Tufo de erva alta (3 lâminas finas)
      ctx.strokeStyle='rgba(60,110,40,0.55)'; ctx.lineWidth=1.4; ctx.lineCap='round';
      for (var i=-1;i<=1;i++){
        ctx.beginPath();
        ctx.moveTo(x+ox+i*2, y+oy);
        ctx.lineTo(x+ox+i*3, y+oy-7-i);
        ctx.stroke();
      }
    } else if (kind < 0.7) {
      // Flores pequenas (3 pétalas coloridas)
      var hue = this._seed(c,r,204) < 0.5 ? '#ffe066' : '#ff9ecf';
      ctx.fillStyle = hue;
      [[0,0],[3,1],[-3,1]].forEach(function(pt){
        ctx.beginPath(); ctx.arc(x+ox+pt[0], y+oy+pt[1], 1.4, 0, Math.PI*2); ctx.fill();
      });
      ctx.fillStyle='#5a8030'; ctx.fillRect(x+ox-0.5,y+oy,1,3);
    } else {
      // Pedrinha solta
      ctx.fillStyle='rgba(120,120,110,0.5)';
      ctx.beginPath(); ctx.ellipse(x+ox,y+oy,3,1.8,0,0,Math.PI*2); ctx.fill();
    }
  },

  // ── Pedra destruível (forma irregular, com musgo e racha) ─────
  _rock: function(ctx, c, r) {
    var p = U.iso(c, r), x = p.x, y = p.y;
    ctx.fillStyle = '#888888';
    ctx.beginPath();
    ctx.moveTo(x, y-20); ctx.lineTo(x+18, y-8); ctx.lineTo(x+14, y+2);
    ctx.lineTo(x, y+6); ctx.lineTo(x-14, y+2); ctx.lineTo(x-18, y-8);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#aaaaaa';
    ctx.beginPath(); ctx.moveTo(x, y-20); ctx.lineTo(x+18, y-8); ctx.lineTo(x, y-6); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#666666';
    ctx.beginPath(); ctx.moveTo(x-18, y-8); ctx.lineTo(x, y-6); ctx.lineTo(x, y+6); ctx.lineTo(x-14, y+2); ctx.closePath(); ctx.fill();

    // Racha (linha mais escura a atravessar a face de cima)
    ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x-4,y-15); ctx.lineTo(x+2,y-9); ctx.lineTo(x-1,y-4); ctx.stroke();

    // Musgo (manchas verdes na base, lado sombreado)
    ctx.fillStyle='rgba(70,110,40,0.35)';
    ctx.beginPath(); ctx.ellipse(x-10,y-2,5,3,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x-5,y+3,3,2,0.1,0,Math.PI*2); ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y-20); ctx.lineTo(x+18, y-8); ctx.lineTo(x+14, y+2);
    ctx.lineTo(x, y+6); ctx.lineTo(x-14, y+2); ctx.lineTo(x-18, y-8);
    ctx.closePath(); ctx.stroke();
  },

  // ── Marcadores de Base e Entrada ────────────────────────────────

  // ── Base/QG fortificado — substitui o antigo diamante azul liso ──
  // Pequeno bunker com sacos de areia, antena pulsante e campo de energia.
  _base: function(ctx, c, r) {
    var p = U.iso(c, r), x = p.x, y = p.y;
    var t = Date.now() * 0.001;

    // Campo de energia pulsante (anel no chão)
    var pulse = 0.5 + 0.5*Math.sin(t*1.6);
    ctx.save(); ctx.globalAlpha = 0.15 + pulse*0.1;
    ctx.strokeStyle = '#4488ff'; ctx.lineWidth = 1.5;
    U.diaPath(ctx, x, y, 26+pulse*3, 13+pulse*1.5); ctx.stroke();
    ctx.restore();

    // Sacos de areia em redor (hexágono de pequenos blocos)
    ctx.fillStyle = '#9a8855';
    var sandbags = [[-16,4],[16,4],[-10,10],[10,10],[-18,-4],[18,-4]];
    sandbags.forEach(function(sb){
      ctx.beginPath(); ctx.ellipse(x+sb[0], y+sb[1], 6, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5; ctx.stroke();
    });

    // Estrutura central (bunker — caixa isométrica pequena)
    var bW=16, bH=8, bD=14, topY=y-10;
    ctx.fillStyle='#2a3a5a';
    ctx.beginPath(); ctx.moveTo(x,topY-bH); ctx.lineTo(x+bW,topY); ctx.lineTo(x,topY+bH); ctx.lineTo(x-bW,topY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.fillStyle='#16203a';
    ctx.beginPath(); ctx.moveTo(x-bW,topY); ctx.lineTo(x,topY+bH); ctx.lineTo(x,topY+bH+bD); ctx.lineTo(x-bW,topY+bD); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#1e2c4a';
    ctx.beginPath(); ctx.moveTo(x+bW,topY); ctx.lineTo(x,topY+bH); ctx.lineTo(x,topY+bH+bD); ctx.lineTo(x+bW,topY+bD); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Janelas/luzes no bunker (piscam)
    ctx.fillStyle = Math.sin(t*3)>0 ? '#4488ff' : '#2255aa';
    ctx.shadowBlur=4; ctx.shadowColor='#4488ff';
    ctx.fillRect(x-bW*0.5-2, topY+bH+3, 4, 3);
    ctx.fillRect(x+bW*0.5-2, topY+bH+3, 4, 3);
    ctx.shadowBlur=0; ctx.shadowColor='transparent';

    // Antena com luz pulsante no topo
    ctx.strokeStyle='#556677'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x,topY-bH); ctx.lineTo(x,topY-bH-16); ctx.stroke();
    ctx.fillStyle='#4488ff'; ctx.shadowBlur=10+pulse*8; ctx.shadowColor='#4488ff';
    ctx.beginPath(); ctx.arc(x,topY-bH-16,2.5,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0; ctx.shadowColor='transparent';
  },

  // ── Montanha elevada (tile especial, com vegetação no topo) ──
  _mountain: function(ctx, c, r) {
    var p = U.iso(c, r), x = p.x, y = p.y;
    var TW2 = C.TW/2, TH2 = C.TH/2, lift = 18;
    // Topo do planalto
    ctx.beginPath();
    ctx.moveTo(x, y-TH2-lift); ctx.lineTo(x+TW2, y-lift);
    ctx.lineTo(x, y+TH2-lift); ctx.lineTo(x-TW2, y-lift); ctx.closePath();
    ctx.fillStyle='#9a9a8a'; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=0.5; ctx.stroke();
    // Face esq
    ctx.beginPath();
    ctx.moveTo(x-TW2,y-lift); ctx.lineTo(x,y+TH2-lift);
    ctx.lineTo(x,y+TH2); ctx.lineTo(x-TW2,y); ctx.closePath();
    ctx.fillStyle='#666660'; ctx.fill(); ctx.stroke();
    // Veios de rocha na face esquerda (linhas horizontais sutis)
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=0.6;
    for(var vi=1;vi<=2;vi++){ ctx.beginPath(); ctx.moveTo(x-TW2,y-lift+vi*5); ctx.lineTo(x,y+TH2-lift+vi*5); ctx.stroke(); }
    // Face dir
    ctx.beginPath();
    ctx.moveTo(x+TW2,y-lift); ctx.lineTo(x,y+TH2-lift);
    ctx.lineTo(x,y+TH2); ctx.lineTo(x+TW2,y); ctx.closePath();
    ctx.fillStyle='#4e4e46'; ctx.fill(); ctx.stroke();
    // Pedrinhas decorativas
    ctx.fillStyle='#aaaaaa';
    var stones=[[-9,-8,3],[ 5,-5,2],[-2,-12,2],[7,-10,2]];
    for(var i=0;i<stones.length;i++){
      ctx.beginPath(); ctx.arc(x+stones[i][0],y-lift+stones[i][1],stones[i][2],0,Math.PI*2); ctx.fill();
    }
    // Tufos de vegetação resistente no topo (só em tile vazio, dá vida)
    if(this.grid[c]&&this.grid[c][r]==='mountain'){
      var vs = this._seed(c,r,300);
      if (vs > 0.3) {
        ctx.strokeStyle='rgba(80,120,60,0.6)'; ctx.lineWidth=1.2; ctx.lineCap='round';
        var tx=x-10, ty=y-lift-3;
        for(var bi=-1;bi<=1;bi++){ ctx.beginPath(); ctx.moveTo(tx+bi*2,ty); ctx.lineTo(tx+bi*3,ty-6-bi); ctx.stroke(); }
      }
      ctx.save(); ctx.globalAlpha=0.7;
      ctx.fillStyle='#cce8ff'; ctx.font='9px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⛰',x,y-lift-6); ctx.restore();
    }
  },

  _markers: function(ctx) {
    var first = null;
    for (var i = 0; i < this.data.cells.length; i++) {
      if (this.data.cells[i].c >= 0 && this.data.cells[i].c < C.COLS) { first = this.data.cells[i]; break; }
    }
    if (first) {
      var p2 = U.iso(first.c, first.r);
      var pl = 0.45 + 0.55 * Math.abs(Math.sin(Date.now() * 0.003));
      ctx.save(); ctx.globalAlpha = pl;
      ctx.fillStyle = '#ff4444'; ctx.font = 'bold 11px Rajdhani,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('▶ ENTRADA', p2.x - 20, p2.y - 18);
      ctx.restore();
    }
  },

  // ── Mini-preview do mapa (usado no menu) ───────────────────────
  drawPreview: function(ctx, mapKey, x, y, w, h) {
    var m = C.MAPS[mapKey];
    ctx.fillStyle = 'rgba(10,20,12,0.9)'; U.rr(ctx, x, y, w, h, 4); ctx.fill();

    var d = buildMapData(mapKey);
    var cw = w / C.COLS, ch = h / C.ROWS;

    // Grid de fundo
    ctx.fillStyle = 'rgba(50,80,40,0.4)';
    for (var c = 0; c < C.COLS; c++)
      for (var r = 0; r < C.ROWS; r++)
        ctx.fillRect(x + c * cw + 0.5, y + r * ch + 0.5, cw - 1, ch - 1);

    // Caminho
    for (var i = 0; i < d.cells.length; i++) {
      var p = d.cells[i];
      if (p.c >= 0 && p.c < C.COLS && p.r >= 0 && p.r < C.ROWS) {
        ctx.fillStyle = m.color + 'cc';
        ctx.fillRect(x + p.c * cw + 0.5, y + p.r * ch + 0.5, cw - 1, ch - 1);
      }
    }

    // Pedras
    for (var i = 0; i < m.rocks.length; i++) {
      ctx.fillStyle = '#888';
      ctx.fillRect(x + m.rocks[i][0] * cw + 1, y + m.rocks[i][1] * ch + 1, cw - 2, ch - 2);
    }

    // Marcadores entrada/saída
    ctx.fillStyle = '#ff4444';
    var first = m.path[0];
    ctx.beginPath(); ctx.arc(x + Math.max(0, first.c) * cw, y + first.r * ch + ch/2, 3, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#4488ff';
    var last = m.path[m.path.length - 1];
    ctx.beginPath(); ctx.arc(x + Math.min(last.c, C.COLS - 1) * cw, y + last.r * ch + ch/2, 3, 0, Math.PI * 2); ctx.fill();
  }
};
