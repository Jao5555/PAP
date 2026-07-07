'use strict';
// ═══════════════════════════════════════════════════════════════
//  enemy.js  —  Inimigos com modelos 2.5D animados
//
//  MELHORIAS v5:
//  - Ciclo de caminhada (pernas/braços animados via seno)
//  - Bobbing vertical (corpo sobe/desce ao andar)
//  - Silhuetas distintas por tipo (Runner magro, Tank pesado, etc.)
//  - Boss com capa, chifres, núcleo brilhante e partículas de aura
//
//  Para adicionar um novo tipo de inimigo:
//  1. Define os stats em config.js (EN_DEF)
//  2. Adiciona a "forma" em SHAPE abaixo (proporções visuais)
//  3. (Opcional) adiciona um caso em _extras() para detalhes únicos
// ═══════════════════════════════════════════════════════════════

// ── Proporções visuais por tipo (não afeta gameplay) ─────────────
var ENEMY_SHAPE = {
  zombie:  {bW:0.75, bH:1.00, headSc:0.58, legLen:0.36, armLen:0.32, walkSpd:5.0, swing:0.14, bob:1.0},
  runner:  {bW:0.60, bH:0.92, headSc:0.46, legLen:0.42, armLen:0.28, walkSpd:9.5, swing:0.24, bob:1.6},
  armored: {bW:0.82, bH:1.05, headSc:0.54, legLen:0.32, armLen:0.36, walkSpd:4.0, swing:0.09, bob:0.55},
  tank:    {bW:0.98, bH:1.18, headSc:0.48, legLen:0.28, armLen:0.42, walkSpd:2.8, swing:0.06, bob:0.35},
  boss:    {bW:1.05, bH:1.25, headSc:0.52, legLen:0.30, armLen:0.42, walkSpd:2.2, swing:0.05, bob:0.30},
  ninja:   {bW:0.56, bH:0.88, headSc:0.44, legLen:0.40, armLen:0.30, walkSpd:8.5, swing:0.20, bob:1.3},
  voador:  {bW:0.64, bH:0.80, headSc:0.46, legLen:0.20, armLen:0.50, walkSpd:7.0, swing:0.10, bob:0.4}
};

function Enemy(type, prog, dm) {
  this.type = type; this.prog = prog || 0;
  var cf = C.EN_DEF[type]; dm = dm || 1;
  this.mhp = Math.floor(cf.hp * dm); this.hp = this.mhp;
  this.spd = cf.spd; this.eDmg = cf.dmg;
  this.gReward = cf.gold; this.bReward = cf.blood;
  this.bc = cf.bc; this.sc = cf.sc; this.hc = cf.hc; this.ac = cf.ac;
  this.sz = cf.sz;
  this.dead = false; this.reached = false; this.ht = 0;
  this.isBoss = (type === 'boss');
  this.walkOff = Math.random() * Math.PI * 2; // offset aleatório p/ não andarem em sincronia
  this.emberT = Math.random() * 0.5;          // timer para partículas de aura (boss)

  // ── Ninja: invisível CONSTANTEMENTE (não expira sozinho) ──────
  // 'detected' é recalculado todos os frames pelo motor do jogo
  // (G._updDetection) com base na proximidade de torres Observador.
  this.invisible = !!cf.invisible;
  this.detected  = false;

  // ── Voador: ignora obstáculos visualmente, resiste a dano de área ──
  this.flying    = !!cf.flying;
  this.aoeResist = cf.aoeResist || 1; // multiplicador de dano recebido de AOE (1=normal)

  var pos = MAP.pos(this.prog);
  this.gc = pos.gc; this.gr = pos.gr; this.sk = this.gc + this.gr;
}

Enemy.prototype.upd = function(dt) {
  if (this.dead || this.reached) return;
  this.ht = Math.max(0, this.ht - dt);
  // Congelado pela Granada de Gelo (item de campo) — para de avançar,
  // mas continua atacável normalmente (não é invisibilidade nem imunidade).
  if (typeof ITEMS !== 'undefined' && ITEMS.freezeTimer > 0) return;
  this.prog += this.spd * dt;
  if (this.prog >= MAP.data.length) { this.reached = true; return; }
  var pos = MAP.pos(this.prog);
  this.gc = pos.gc; this.gr = pos.gr; this.sk = this.gc + this.gr;

  // Boss: emite partículas de aura periodicamente
  if (this.isBoss) {
    this.emberT -= dt;
    if (this.emberT <= 0) {
      this.emberT = 0.12;
      var p = U.isoF(this.gc, this.gr);
      PS.burst(p.x + U.rnd(-14,14), p.y - this.sz*1.3 + U.rnd(-10,10), '#ff2200', '#ff8800', 1);
    }
  }
};

Enemy.prototype.hit = function(d) {
  this.hp -= d; this.ht = 0.13;
  if (this.hp <= 0) { this.hp = 0; this.dead = true; }
};

// ── Render principal ──────────────────────────────────────────
Enemy.prototype.drw = function(ctx) {
  var pos = U.isoF(this.gc, this.gr), x = pos.x, gy = pos.y; // gy = ponto no "chão"
  var sz = this.sz, h = this.ht > 0;

  // ── Ninja invisível e NÃO detetado: só um leve tremeluzir, nada mais.
  // Não é alvejável pelas torres, por isso também não mostramos HP bar
  // nem silhueta detalhada — só uma pista muito ténue de que algo passou ali.
  if (this.invisible && !this.detected) {
    var shimmer = 0.06 + 0.05*Math.sin(Date.now()*0.01 + this.walkOff);
    ctx.save(); ctx.globalAlpha = shimmer;
    ctx.fillStyle = '#88aacc';
    ctx.beginPath(); ctx.ellipse(x, gy-this.sz*0.6, this.sz*0.7, this.sz*1.1, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    return; // nada mais é desenhado — verdadeiramente invisível
  }

  // ── Voador: paira acima do chão (offset vertical) + sombra projetada ──
  var hoverY = gy;
  if (this.flying) {
    var hoverOff = 22 + Math.sin(Date.now()*0.004 + this.walkOff)*4;
    hoverY = gy - hoverOff;
    // Sombra no chão (mostra a que altura está)
    ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(x, gy+2, this.sz*0.65, this.sz*0.22, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    gy = hoverY; // todo o resto do desenho usa a posição elevada
  }
  var shp = ENEMY_SHAPE[this.type];

  // ── Ciclo de caminhada ──
  var phase = this.prog * shp.walkSpd + this.walkOff;
  var walk = Math.sin(phase);          // -1..1
  var walk2 = Math.sin(phase + Math.PI); // oposto (outro braço/perna)
  var bob = Math.abs(Math.cos(phase)) * shp.bob; // sobe nos extremos da passada

  var bW = sz * shp.bW, bH = bW * 0.5;
  var legLen = sz * shp.legLen, armLen = sz * shp.armLen;
  var bodyBottom = gy - legLen - bob;     // base do tronco (acima das pernas)
  var bodyTop = bodyBottom - sz * shp.bH; // topo do tronco

  var bodyTopCol = h ? '#fff' : this.bc;
  var bodyLftCol = h ? '#ddd' : this.sc;
  var bodyRgtCol = h ? '#ccc' : this.bc;

  // ── Sombra no chão (pulsa ligeiramente p/ Tank/Boss) ──
  ctx.save();
  ctx.globalAlpha = this.isBoss ? 0.28 : 0.18;
  ctx.fillStyle = this.isBoss ? '#cc0000' : '#000';
  var shW = sz * (this.isBoss ? 1.3 : (this.type==='tank'?1.05:0.85));
  ctx.beginPath(); ctx.ellipse(x, gy + sz*0.35, shW, shW*0.38, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  if (this.isBoss) { ctx.shadowBlur = 18; ctx.shadowColor = '#ff0000'; }

  // ── PERNAS (caixas isométricas pequenas, animadas) ──
  this._drawLeg(ctx, x, bodyBottom, legLen, bW, walk,  bodyLftCol, bodyRgtCol);
  this._drawLeg(ctx, x, bodyBottom, legLen, bW, walk2, bodyLftCol, bodyRgtCol);

  // ── BRAÇOS (atrás do corpo, animados opostos às pernas) ──
  this._drawArm(ctx, x, bodyTop, bodyBottom, armLen, bW, walk2, -1, bodyTopCol, bodyRgtCol);
  this._drawArm(ctx, x, bodyTop, bodyBottom, armLen, bW,  walk, 1, bodyTopCol, bodyLftCol);

  // ── TRONCO (caixa isométrica principal) ──
  ctx.beginPath();
  ctx.moveTo(x, bodyTop-bH); ctx.lineTo(x+bW, bodyTop);
  ctx.lineTo(x, bodyTop+bH); ctx.lineTo(x-bW, bodyTop);
  ctx.closePath(); ctx.fillStyle = bodyTopCol; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.6; ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x-bW,bodyTop); ctx.lineTo(x,bodyTop+bH);
  ctx.lineTo(x,bodyBottom); ctx.lineTo(x-bW,bodyBottom-bH);
  ctx.closePath(); ctx.fillStyle = bodyLftCol; ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x+bW,bodyTop); ctx.lineTo(x,bodyTop+bH);
  ctx.lineTo(x,bodyBottom); ctx.lineTo(x+bW,bodyBottom-bH);
  ctx.closePath(); ctx.fillStyle = bodyRgtCol; ctx.fill(); ctx.stroke();

  // ── Detalhes específicos do tipo (armadura, capa, etc.) ──
  this._extras(ctx, x, bodyTop, bodyBottom, bW, bH, walk, phase, h);

  // ── CABEÇA ──
  var hw = bW * shp.headSc, hh = hw * 0.5, hD = bH * shp.headSc * 0.95;
  var hY = bodyTop - bH - sz * (this.isBoss||this.type==='tank' ? 0.08 : 0.55);

  if (!this.isBoss && this.type !== 'tank') {
    ctx.beginPath();
    ctx.moveTo(x,hY-hh); ctx.lineTo(x+hw,hY); ctx.lineTo(x,hY+hh); ctx.lineTo(x-hw,hY);
    ctx.closePath(); ctx.fillStyle = h?'#eee':this.hc; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x-hw,hY); ctx.lineTo(x,hY+hh); ctx.lineTo(x,hY+hh+hD); ctx.lineTo(x-hw,hY+hD);
    ctx.closePath(); ctx.fillStyle = h?'#ddd':this.bc; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x+hw,hY); ctx.lineTo(x,hY+hh); ctx.lineTo(x,hY+hh+hD); ctx.lineTo(x+hw,hY+hD);
    ctx.closePath(); ctx.fillStyle = h?'#ccc':this.sc; ctx.fill(); ctx.stroke();
  }

  // Olhos / extras da cabeça (Boss tem versão própria em _extras)
  if (!this.isBoss) {
    ctx.fillStyle = '#ff2200'; ctx.shadowBlur = 5; ctx.shadowColor = '#f00';
    var eyeSz = this.type==='runner' ? 1.1 : this.type==='tank' ? 1.8 : 1.6;
    var eyeY = this.type==='tank' ? bodyTop - bH - sz*0.55 : hY - hh*0.08;
    ctx.beginPath(); ctx.arc(x-hw*0.30, eyeY, eyeSz, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+hw*0.30, eyeY, eyeSz, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  }

  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

  // Congelado (Granada de Gelo) — tint azulado + ícone de floco de neve
  if (typeof ITEMS !== 'undefined' && ITEMS.freezeTimer > 0) {
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#88ddff';
    ctx.beginPath(); ctx.ellipse(x, gy - sz*0.5, sz*0.9, sz*1.3, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.8; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('❄', x, gy - sz*1.8);
    ctx.restore();
  }

  // ── Barra de HP ──
  var hpP = this.hp / this.mhp;
  var bwb = sz * 2.5 * (this.isBoss ? 1.8 : 1);
  var bxb = x - bwb/2;
  var byb = (this.isBoss ? bodyTop-bH-sz*0.95 : this.type==='tank' ? bodyTop-bH-sz*0.65 : hY-hh-14);
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(bxb-1, byb-1, bwb+2, 6);
  ctx.fillStyle = hpP>0.5 ? C.P.hpHi : hpP>0.25 ? C.P.hpMd : C.P.hpLo;
  ctx.fillRect(bxb, byb, bwb*hpP, 4);
  if (this.isBoss || this.type==='tank') {
    ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.font='bold '+(this.isBoss?9:7)+'px sans-serif';
    ctx.textAlign='center'; ctx.fillText(Math.ceil(this.hp)+'/'+this.mhp, x, byb-2);
  }
};

// ── Desenha uma perna (pequena caixa 3D) ────────────────────────
Enemy.prototype._drawLeg = function(ctx, x, bodyBottom, legLen, bW, swing, lft, rgt) {
  var lw = bW * 0.32;
  var ox = swing * lw * 1.6;            // deslocamento horizontal (passada)
  var lift = Math.max(0, swing) * legLen * 0.4; // perna "levanta" um pouco
  var topY = bodyBottom - lift;
  var botY = bodyBottom + legLen;
  ctx.fillStyle = lft;
  ctx.beginPath();
  ctx.moveTo(x+ox-lw*0.5, topY); ctx.lineTo(x+ox+lw*0.5, topY);
  ctx.lineTo(x+ox+lw*0.5, botY); ctx.lineTo(x+ox-lw*0.5, botY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgt; ctx.globalAlpha = 0.55;
  ctx.fillRect(x+ox, topY, lw*0.5, botY-topY);
  ctx.globalAlpha = 1;
};

// ── Desenha um braço (atrás do tronco, balança ao andar) ────────
Enemy.prototype._drawArm = function(ctx, x, bodyTop, bodyBottom, armLen, bW, swing, side, top, sideCol) {
  var aw = bW * 0.28;
  var baseX = x + side * bW * 0.78;
  var baseY = bodyTop + (bodyBottom-bodyTop) * 0.32;
  var swingX = swing * aw * 1.8;
  var swingY = Math.abs(swing) * armLen * 0.15;
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(baseX-aw*0.5, baseY);
  ctx.lineTo(baseX+aw*0.5, baseY);
  ctx.lineTo(baseX+aw*0.5+swingX, baseY+armLen+swingY);
  ctx.lineTo(baseX-aw*0.5+swingX, baseY+armLen+swingY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = sideCol; ctx.globalAlpha = 0.5;
  ctx.fillRect(baseX-aw*0.5+swingX, baseY+armLen*0.6+swingY, aw, armLen*0.4);
  ctx.globalAlpha = 1;
};

// ── Detalhes extra por tipo de inimigo ───────────────────────────
Enemy.prototype._extras = function(ctx, x, bodyTop, bodyBottom, bW, bH, walk, phase, hit) {
  switch (this.type) {

    case 'zombie': {
      // Roupa rasgada: pequeno retalho a esvoaçar
      ctx.fillStyle = hit?'#ccc':'#3a4a28';
      var flapA = Math.sin(phase*0.7)*0.3;
      ctx.save(); ctx.translate(x+bW*0.55, bodyTop+bH*0.6); ctx.rotate(0.4+flapA);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(7,3); ctx.lineTo(2,12); ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }

    case 'runner': {
      // Linhas de velocidade atrás do corpo
      ctx.strokeStyle = hit?'rgba(255,255,255,0.5)':'rgba(100,255,140,0.45)';
      ctx.lineWidth = 1.2;
      for (var i=0;i<3;i++){
        var ly = bodyTop + bH*0.3 + i*bH*0.55;
        ctx.beginPath(); ctx.moveTo(x-bW*0.9, ly); ctx.lineTo(x-bW*1.6-i*3, ly); ctx.stroke();
      }
      break;
    }

    case 'armored': {
      // Peitoral metálico + ombreiras
      var ac = this.ac;
      ctx.fillStyle = ac+'cc';
      // Peitoral (placa central)
      ctx.beginPath();
      ctx.moveTo(x, bodyTop-bH*0.3); ctx.lineTo(x+bW*0.55, bodyTop+bH*0.15);
      ctx.lineTo(x, bodyTop+bH*0.65); ctx.lineTo(x-bW*0.55, bodyTop+bH*0.15);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.6; ctx.stroke();
      // Ombreiras (pequenos blocos)
      [-1,1].forEach(function(s){
        ctx.fillStyle = ac;
        ctx.fillRect(x+s*bW*0.75-3, bodyTop-bH*0.15, 6, bH*0.5);
      });
      // Risca do capacete (visor)
      ctx.fillStyle='#222'; ctx.fillRect(x-bW*0.32, bodyTop-bH-7, bW*0.64, 2.5);
      break;
    }

    case 'tank': {
      var ac2 = this.ac;
      // Placas de armadura grandes a cobrir o tronco
      ctx.fillStyle = ac2+'dd';
      ctx.beginPath();
      ctx.moveTo(x, bodyTop-bH*0.5); ctx.lineTo(x+bW*0.85, bodyTop+bH*0.05);
      ctx.lineTo(x+bW*0.6, bodyBottom-bH*0.3); ctx.lineTo(x, bodyBottom);
      ctx.lineTo(x-bW*0.6, bodyBottom-bH*0.3); ctx.lineTo(x-bW*0.85, bodyTop+bH*0.05);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1; ctx.stroke();
      // Rebites
      ctx.fillStyle='#222';
      for (var i=-1;i<=1;i++){ ctx.beginPath(); ctx.arc(x+i*bW*0.4, bodyTop+bH*0.1, 1.4, 0, Math.PI*2); ctx.fill(); }
      // Núcleo brilhante (ponto fraco)
      var pulse=0.5+0.5*Math.sin(phase*2);
      ctx.shadowBlur=8+pulse*6; ctx.shadowColor='#ff3300';
      ctx.fillStyle='rgba(255,80,0,'+(0.6+pulse*0.4)+')';
      ctx.beginPath(); ctx.arc(x, bodyTop+bH*0.25, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.shadowColor='transparent';
      // Cabeça pequena com capacete pesado
      ctx.fillStyle = hit?'#eee':this.hc;
      ctx.beginPath(); ctx.ellipse(x, bodyTop-bH-6, bW*0.4, bH*0.65, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.7; ctx.stroke();
      ctx.fillStyle=ac2; ctx.fillRect(x-bW*0.35, bodyTop-bH-9, bW*0.7, 4);
      break;
    }

    case 'ninja': {
      // Capuz/máscara — cobre quase toda a cabeça, só os olhos ficam visíveis
      ctx.fillStyle = hit?'#ccc':'#0d141c';
      ctx.beginPath();
      ctx.moveTo(x-bW*0.5, bodyTop-bH*1.5); ctx.lineTo(x+bW*0.5, bodyTop-bH*1.5);
      ctx.lineTo(x+bW*0.4, bodyTop-bH*0.3); ctx.lineTo(x-bW*0.4, bodyTop-bH*0.3);
      ctx.closePath(); ctx.fill();
      // Lenço a esvoaçar atrás
      var flapA = Math.sin(phase*0.8)*0.35;
      ctx.save(); ctx.translate(x-bW*0.5, bodyTop-bH*0.7); ctx.rotate(2.6+flapA);
      ctx.fillStyle='#1a2430';
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(8,2); ctx.lineTo(3,9); ctx.closePath(); ctx.fill();
      ctx.restore();
      // Brilho subtil de lâmina (kunai à cintura)
      ctx.strokeStyle='rgba(180,210,230,0.7)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x+bW*0.45,bodyTop+bH*0.3); ctx.lineTo(x+bW*0.6,bodyTop+bH*0.5); ctx.stroke();
      break;
    }

    case 'voador': {
      // Asas membranosas batendo (sincronizadas com o "walk" para dar vida)
      var wingFlap = Math.sin(phase*1.4) * 0.6;
      [-1,1].forEach(function(side){
        ctx.save();
        ctx.translate(x + side*bW*0.65, bodyTop+bH*0.1);
        ctx.rotate(side * (0.5 + wingFlap*side));
        ctx.fillStyle = hit ? 'rgba(255,255,255,0.7)' : 'rgba(85,120,160,0.55)';
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.quadraticCurveTo(side*16, -6, side*22, 2);
        ctx.quadraticCurveTo(side*12, 6, 0, 8);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.6; ctx.stroke();
        ctx.restore();
      });
      break;
    }

    case 'boss': {
      var t = phase;
      // ── Capa ondulante atrás ──
      ctx.fillStyle = 'rgba(60,10,10,0.85)';
      ctx.beginPath();
      ctx.moveTo(x-bW*0.7, bodyTop-bH*0.3);
      ctx.lineTo(x-bW*1.15+Math.sin(t)*5, bodyBottom+bH*1.4+Math.cos(t*0.7)*4);
      ctx.lineTo(x-bW*0.3, bodyBottom+bH*0.5);
      ctx.lineTo(x, bodyTop+bH*0.3);
      ctx.lineTo(x+bW*0.3, bodyBottom+bH*0.5);
      ctx.lineTo(x+bW*1.15+Math.cos(t)*5, bodyBottom+bH*1.4+Math.sin(t*0.7)*4);
      ctx.lineTo(x+bW*0.7, bodyTop-bH*0.3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(255,60,0,0.4)'; ctx.lineWidth=1; ctx.stroke();

      // ── Placas de ombro com espinhos ──
      [-1,1].forEach(function(s){
        ctx.fillStyle='#553333';
        ctx.beginPath();
        ctx.moveTo(x+s*bW*0.5, bodyTop-bH*0.5);
        ctx.lineTo(x+s*bW*1.0, bodyTop-bH*0.2);
        ctx.lineTo(x+s*bW*0.7, bodyTop+bH*0.3);
        ctx.closePath(); ctx.fill();
        // espinho
        ctx.fillStyle='#cc2200';
        ctx.beginPath();
        ctx.moveTo(x+s*bW*0.85, bodyTop-bH*0.35);
        ctx.lineTo(x+s*bW*1.25, bodyTop-bH*0.65);
        ctx.lineTo(x+s*bW*0.95, bodyTop-bH*0.05);
        ctx.closePath(); ctx.fill();
      });

      // ── Núcleo no peito (ponto fraco, pulsante) ──
      var pulse2=0.5+0.5*Math.sin(t*2.4);
      ctx.shadowBlur=14+pulse2*14; ctx.shadowColor='#ffaa00';
      var coreGrad=ctx.createRadialGradient(x,bodyTop+bH*0.15,0,x,bodyTop+bH*0.15,7);
      coreGrad.addColorStop(0,'#ffff66'); coreGrad.addColorStop(0.5,'#ff6600'); coreGrad.addColorStop(1,'rgba(255,0,0,0)');
      ctx.fillStyle=coreGrad;
      ctx.beginPath(); ctx.arc(x, bodyTop+bH*0.15, 6+pulse2*2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.shadowColor='transparent';

      // ── Cabeça com chifres ──
      var headY=bodyTop-bH-sz*0.55;
      ctx.fillStyle=hit?'#fff':'#883333';
      ctx.beginPath(); ctx.ellipse(x, headY, bW*0.5, bH*0.85, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.8; ctx.stroke();

      ctx.fillStyle='#cc2200'; ctx.shadowBlur=10; ctx.shadowColor='#ff0000';
      [-1,1].forEach(function(s){
        ctx.beginPath();
        ctx.moveTo(x+s*bW*0.35, headY-bH*0.5);
        ctx.lineTo(x+s*bW*0.65, headY-bH*1.7);
        ctx.lineTo(x+s*bW*0.18, headY-bH*0.9);
        ctx.closePath(); ctx.fill();
      });
      ctx.shadowBlur=0; ctx.shadowColor='transparent';

      // Olhos amarelos brilhantes
      ctx.fillStyle='#ffff00'; ctx.shadowBlur=10; ctx.shadowColor='#ffff00';
      ctx.beginPath(); ctx.arc(x-bW*0.18, headY, 3.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+bW*0.18, headY, 3.2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.shadowColor='transparent';

      // Label "BOSS"
      ctx.fillStyle='#ff2200'; ctx.shadowBlur=8; ctx.shadowColor='#ff0000';
      ctx.font='bold 11px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText('BOSS', x, headY-bH*2.1); ctx.shadowBlur=0; ctx.shadowColor='transparent';
      break;
    }
  }
};
