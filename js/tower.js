'use strict';
// ═══════════════════════════════════════════════════════════════
//  tower.js  —  Torres com modelos 2.5D animados
//
//  MELHORIAS v5:
//  - Torreta roda na direção do alvo (Pistola/Sniper/Minigun/Granada)
//  - Recoil (recuo) animado ao disparar
//  - Morteiro inclina o tubo na direção do alvo
//  - Minigun: 3 canos rotativos + correia de munições
//  - Lança-Chamas: tanque de combustível + chama piloto
//  - Commander: bandeira a ondular animada
//  - DJ Booth: pratos giratórios + equalizador colorido
//
//  Para adicionar uma nova torre:
//  1. Define os stats em config.js (TW_DEF)
//  2. Adiciona um 'case' em _top() abaixo para o visual
// ═══════════════════════════════════════════════════════════════

function Tower(col, row, type) {
  this.col = col; this.row = row; this.type = type; this.level = 1;
  var cf = C.TW_DEF[type];
  this.baseDmg = cf.dmg; this.baseRange = cf.range; this.baseRate = cf.rate;
  this.dmg = cf.dmg; this.range = cf.range; this.rate = cf.rate;
  this.pspd = cf.pspd; this.aoe = cf.aoe; this.drain = cf.drain;
  this.support = cf.support || false;
  this.auraType = cf.auraType || null; this.auraMult = cf.auraMult || 1; this.auraRange = cf.auraRange || 0;
  this.colObj = cf.col; this.ht = cf.ht; this.bW = (C.TW/2) * cf.bw; this.bD = cf.bd;
  this.fcd = 0.3; this.tgt = null; this.powered = true; this.sk = col + row;
  this.baseCost = cf.cost; this.sell = Math.floor(cf.cost/2);
  this.dmgBuff = 1; this.spdBuff = 1; this.auraDmg = 1; this.auraSpd = 1;
  this.aimAngle = -Math.PI/2; // ângulo atual da torreta (rad)
}

Tower.prototype.getUpgCost = function() {
  if (this.level >= 3) return 0;
  return Math.floor(this.baseCost * C.UPG_COSTS[this.level]);
};
Tower.prototype.upgrade = function() {
  if (this.level >= 3 || this.support) return false;
  var cf = C.TW_DEF[this.type], lv = this.level; this.level++;
  this.dmg   = Math.floor(this.baseDmg * cf.upgDmg[lv]);
  this.range = this.baseRange * cf.upgRange[lv];
  this.rate  = this.baseRate * cf.upgRate[lv];
  this.sell  = Math.floor((this.baseCost + this.baseCost * C.UPG_COSTS.slice(0,lv).reduce(function(a,b){return a+b;},0)) * 0.5);
  return true;
};

// ── Aura de torres de suporte ────────────────────────────────────
Tower.prototype.applyAura = function(towers) {
  if (!this.auraType || !this.powered) return;
  for (var i = 0; i < towers.length; i++) {
    var t = towers[i]; if (t === this || t.support) continue;
    if (U.gdist(this.col, this.row, t.col, t.row) <= this.auraRange) {
      if (this.auraType === 'dmg') t.auraDmg = Math.max(t.auraDmg, this.auraMult);
      else if (this.auraType === 'spd') t.auraSpd = Math.max(t.auraSpd, this.auraMult);
    }
  }
};

// ── Lógica de disparo ─────────────────────────────────────────────
Tower.prototype.upd = function(dt, enemies) {
  this.fcd = Math.max(0, this.fcd - dt);
  if (!this.powered || this.support) return null;
  this.tgt = this._ftgt(enemies);

  // Suaviza a rotação da torreta para o alvo
  if (this.tgt) {
    var target = this._aimAngle();
    var diff = target - this.aimAngle;
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    this.aimAngle += diff * Math.min(1, dt * 10);
  }

  var realRate = this.rate * this.spdBuff * this.auraSpd;
  if (this.tgt && this.fcd <= 0) { this.fcd = 1/realRate; return this._mkproj(); }
  return null;
};
Tower.prototype._ftgt = function(enemies) {
  var best = null, bp = -1;
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i]; if (e.dead || e.reached) continue;
    if (e.invisible && !e.detected) continue; // Ninja escondido — invisível a todas as torres
    if (U.gdist(this.col, this.row, e.gc, e.gr) <= this.range && e.prog > bp) { bp = e.prog; best = e; }
  }
  return best;
};
Tower.prototype._aimAngle = function() {
  var sp = U.iso(this.col, this.row), tp = U.isoF(this.tgt.gc, this.tgt.gr);
  return Math.atan2(tp.y - sp.y, tp.x - sp.x);
};
Tower.prototype._mkproj = function() {
  var sp = U.iso(this.col, this.row), tp = U.isoF(this.tgt.gc, this.tgt.gr);
  return new Proj(sp.x, sp.y - this.ht*0.85, tp.x, tp.y - this.tgt.sz,
    Math.floor(this.dmg * this.dmgBuff * this.auraDmg), this.aoe, this.pspd, this.type, this.tgt);
};

// ── Recoil normalizado (1 = acabou de disparar, 0 = pronto) ──────
Tower.prototype._recoil = function() {
  var period = 1 / Math.max(0.01, this.rate * this.spdBuff * this.auraSpd);
  return U.clp(this.fcd / period, 0, 1);
};

// ── Render principal ──────────────────────────────────────────────
Tower.prototype.drw = function(ctx) {
  var p = U.iso(this.col, this.row), x = p.x, y = p.y;
  var lv = this.level, sc = this.support ? 1 : 1 + (lv-1)*0.12;
  var bW = this.bW * sc, bD = this.bD, ht = this.ht * (this.support ? 1 : 1 + (lv-1)*0.08);

  // Aura visual (torres de suporte)
  if (this.support && this.powered) this._drawAura(ctx, x, y);

  U.box(ctx, x, y, this.colObj, bW, bD, ht, this.support ? (this.powered?10:0) : (lv===3?12:lv===2?6:0));

  if (!this.support && lv > 1) {
    ctx.fillStyle = lv===3?'#ffd700':'#aaaaff'; ctx.shadowBlur=4; ctx.shadowColor=ctx.fillStyle;
    ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
    ctx.fillText('★'.repeat(lv-1), x, y-ht-bW*0.5-4); ctx.shadowBlur=0; ctx.shadowColor='transparent';
  }

  this._top(ctx, x, y-ht, bW);

  // Anel de alcance ao hover/selecionar — diamante alinhado ao grid
  if (G && (G.hTwr===this || G.sTwr===this)) {
    var rp = this.support ? this.auraRange*(C.TW+C.TH)*0.255 : this.range*(C.TW+C.TH)*0.255;
    ctx.save(); ctx.globalAlpha=0.1; ctx.fillStyle='#fff';
    U.diaPath(ctx, x, y, rp, rp*0.5); ctx.fill();
    ctx.globalAlpha=0.42; ctx.strokeStyle=this.support?(this.auraType==='dmg'?'#ff8800':'#cc44ff'):'#fff';
    ctx.lineWidth=1.3; ctx.setLineDash([5,5]); U.diaPath(ctx, x, y, rp, rp*0.5); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }

  // Sem energia
  if (!this.powered) {
    ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle='#440000';
    var bH2=bW*0.5;
    ctx.beginPath(); ctx.moveTo(x,y-ht-bH2-2); ctx.lineTo(x+bW,y-ht); ctx.lineTo(x,y-ht+bH2); ctx.lineTo(x-bW,y-ht);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // Indicadores de buff ativo
  if (!this.support && this.dmgBuff*this.auraDmg>1.02) { ctx.fillStyle='#ff8800'; ctx.shadowBlur=5; ctx.shadowColor='#ff8800'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.fillText('⚔',x+bW,y-ht-4); ctx.shadowBlur=0; ctx.shadowColor='transparent'; }
  if (!this.support && this.spdBuff*this.auraSpd>1.02) { ctx.fillStyle='#00ccff'; ctx.shadowBlur=5; ctx.shadowColor='#00ccff'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.fillText('⚡',x-bW,y-ht-4); ctx.shadowBlur=0; ctx.shadowColor='transparent'; }
};

// ── Aura visual (elipse pulsante) ─────────────────────────────────
Tower.prototype._drawAura = function(ctx, x, y) {
  var ap = this.auraRange*(C.TW+C.TH)*0.255;
  var pulse = 0.5+0.5*Math.sin(Date.now()*0.003);
  var col = this.auraType==='dmg' ? [255,150,0] : this.auraType==='detect' ? [80,220,255] : [180,60,255];
  if (this.type==='djbooth') { // cor cicla tipo equalizador
    var hue=(Date.now()*0.05)%360;
    col=hslToRgb(hue,80,55);
  }
  ctx.save();
  ctx.globalAlpha=0.05+pulse*0.06; ctx.fillStyle='rgb('+col[0]+','+col[1]+','+col[2]+')';
  U.diaPath(ctx, x, y, ap, ap*0.5); ctx.fill();
  ctx.globalAlpha=0.25+pulse*0.18; ctx.strokeStyle='rgb('+col[0]+','+col[1]+','+col[2]+')'; ctx.lineWidth=1.3;
  ctx.setLineDash([5,6]); U.diaPath(ctx, x, y, ap, ap*0.5); ctx.stroke(); ctx.setLineDash([]);

  // Observador: varrimento de radar (linha rotativa) — reforça a leitura
  // de "isto deteta coisas", distinto das auras de buff.
  if (this.auraType==='detect') {
    var sweepA = Date.now()*0.0018;
    ctx.globalAlpha=0.5;
    ctx.strokeStyle='rgba(120,230,255,0.7)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x,y);
    ctx.lineTo(x+Math.cos(sweepA)*ap, y+Math.sin(sweepA)*ap*0.5);
    ctx.stroke();
  }
  ctx.restore();
};

// ── Topo da torre (detalhes específicos por tipo) ─────────────────
Tower.prototype._top = function(ctx, cx, topY, bW) {
  var bH = bW*0.5, ang = this.aimAngle, hasTgt = !!this.tgt, recoil = this._recoil();
  var t = Date.now()*0.001;

  switch (this.type) {

    // ═══ PISTOLA: cano duplo, roda p/ alvo, recoil rápido ═══
    case 'pistol': {
      ctx.save(); ctx.translate(cx, topY-bH*0.3); ctx.rotate(ang+Math.PI/2);
      var kick = recoil*3;
      ctx.fillStyle='#0a0a1a';
      ctx.fillRect(-5,-16+kick,3,16); ctx.fillRect(2,-16+kick,3,16);
      ctx.shadowBlur=hasTgt?10:3; ctx.shadowColor='#4466ff';
      ctx.fillStyle=hasTgt?'#88aaff':'#334488';
      ctx.beginPath(); ctx.arc(-3.5,-16+kick,2.2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.5,-16+kick,2.2,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.shadowColor='transparent';
      // Base giratória
      ctx.fillStyle='#1a2a4a'; ctx.beginPath(); ctx.ellipse(0,0,6,3,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
      break;
    }

    // ═══ SNIPER: cano longo, bípode, recoil forte ═══
    case 'sniper': {
      ctx.save(); ctx.translate(cx, topY-bH*0.3); ctx.rotate(ang+Math.PI/2);
      var kick2 = recoil*6;
      // Bípode
      ctx.strokeStyle='#0a0a14'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(-4,-4); ctx.lineTo(-9,6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4,-4); ctx.lineTo(9,6); ctx.stroke();
      // Cano
      ctx.fillStyle='#080818'; ctx.fillRect(-2,-30+kick2,4,30);
      // Mira/scope
      ctx.fillStyle='#1a2240'; ctx.fillRect(-6,-22+kick2,12,5);
      ctx.fillStyle='#3355aa'; ctx.beginPath(); ctx.arc(0,-22+kick2,2,0,Math.PI*2); ctx.fill();
      if (hasTgt) {
        ctx.shadowBlur=12; ctx.shadowColor='#00ff88'; ctx.fillStyle='#00ff88';
        ctx.beginPath(); ctx.arc(0,-30+kick2,2.5,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.shadowColor='transparent';
        if (recoil>0.7) { // flash de disparo
          ctx.globalAlpha=recoil; ctx.fillStyle='#ffffaa';
          ctx.beginPath(); ctx.arc(0,-32+kick2,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
        }
      }
      ctx.restore();
      break;
    }

    // ═══ LANÇA-GRANADA: tubo largo + tambor rotativo ═══
    case 'grenade': {
      ctx.save(); ctx.translate(cx, topY-bH*0.3); ctx.rotate(ang+Math.PI/2);
      var kick3=recoil*4;
      // Tambor (gira a cada disparo)
      ctx.save(); ctx.rotate(this.fcd*2);
      ctx.fillStyle='#443300';
      for (var i=0;i<4;i++){var a2=(i/4)*Math.PI*2;ctx.beginPath();ctx.arc(Math.cos(a2)*3,2+Math.sin(a2)*3,1.6,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      ctx.fillStyle='#665500'; ctx.fillRect(-4,-14+kick3,8,14);
      ctx.fillStyle='#998822'; ctx.beginPath(); ctx.ellipse(0,-14+kick3,5,3,0,0,Math.PI*2); ctx.fill();
      if (hasTgt){ctx.shadowBlur=8;ctx.shadowColor='#ffcc00';ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(0,-14+kick3,2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0; ctx.shadowColor='transparent';}
      ctx.restore();
      break;
    }

    // ═══ MORTEIRO: tubo inclina-se na direção do alvo ═══
    case 'mortar': {
      // Base giratória
      ctx.fillStyle='#200a08'; ctx.beginPath(); ctx.ellipse(cx,topY+bH*0.3,bW*0.65,bH*0.45,0,0,Math.PI*2); ctx.fill();
      // Tubo: ângulo fixo de elevação + direção do alvo (simplificado: vira lateralmente)
      var tubeAng = hasTgt ? -0.85 + Math.cos(ang)*0.25 : -0.85;
      var kick4=recoil*5;
      ctx.save(); ctx.translate(cx + (hasTgt?Math.sin(ang)*6:-3), topY - kick4*0.4); ctx.rotate(tubeAng);
      ctx.fillStyle='#180808'; ctx.fillRect(-4,-22,8,22);
      ctx.fillStyle='#0c0404'; ctx.beginPath(); ctx.ellipse(0,-22,4.5,2.8,0,0,Math.PI*2); ctx.fill();
      if (recoil>0.75){ // fumo ao disparar
        ctx.globalAlpha=recoil*0.6; ctx.fillStyle='#888';
        ctx.beginPath(); ctx.arc(0,-24,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      }
      ctx.restore();
      break;
    }

    // ═══ MINIGUN: 3 canos rotativos + correia de munições ═══
    case 'minigun': {
      ctx.save(); ctx.translate(cx, topY-bH*0.3); ctx.rotate(ang+Math.PI/2);
      // Correia de munições (lado direito)
      ctx.fillStyle='#665522';
      for (var i=0;i<4;i++) ctx.fillRect(6, -2+i*3, 4, 2);
      // Caixa de munições
      ctx.fillStyle='#443311'; ctx.fillRect(7,8,8,7);
      // Canos rotativos (giram rápido se houver alvo)
      var spin = hasTgt ? t*22 : t*1.5;
      ctx.save(); ctx.translate(0,-10);
      for (var i=0;i<3;i++){
        var a3=spin+(i/3)*Math.PI*2;
        ctx.fillStyle='#112233';
        ctx.fillRect(Math.cos(a3)*2.2-1, Math.sin(a3)*2.2-9, 2, 12);
      }
      ctx.restore();
      ctx.fillStyle='#334466'; ctx.beginPath(); ctx.arc(0,-9,4,0,Math.PI*2); ctx.fill();
      // Flash de disparo
      if (hasTgt){
        ctx.shadowBlur=10; ctx.shadowColor='#aaccff';
        ctx.fillStyle='rgba(200,220,255,'+(0.4+0.4*Math.sin(t*40))+')';
        ctx.beginPath(); ctx.arc(0,-21,2.5,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.shadowColor='transparent';
      }
      ctx.restore();
      break;
    }

    // ═══ LANÇA-CHAMAS: tanque + bocal direcional + chama piloto ═══
    case 'flamethrower': {
      // Tanque de combustível (atrás, fixo)
      ctx.fillStyle='#552200'; ctx.beginPath(); ctx.ellipse(cx-bW*0.5, topY+bH*0.1, 6, 9, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='#220a00'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(cx-bW*0.5,topY+bH*0.1-9); ctx.lineTo(cx-bW*0.5,topY+bH*0.1+9); ctx.stroke();
      // Bocal direcional
      ctx.save(); ctx.translate(cx, topY-bH*0.3); ctx.rotate(ang+Math.PI/2);
      ctx.fillStyle='#441100'; ctx.fillRect(-4,-13,8,13);
      ctx.fillStyle='#661100'; ctx.beginPath(); ctx.ellipse(0,-13,5.5,3.2,0,0,Math.PI*2); ctx.fill();
      // Chama piloto sempre visível
      var flicker=0.6+0.4*Math.sin(t*18);
      ctx.shadowBlur=8*flicker; ctx.shadowColor='#ff5500';
      ctx.fillStyle='rgba(255,'+Math.floor(100+60*flicker)+',0,0.85)';
      ctx.beginPath(); ctx.arc(0,-14,2*flicker+1,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.shadowColor='transparent';
      // Chama grande quando ativo
      if (hasTgt){
        for (var fi=0;fi<3;fi++){
          ctx.fillStyle='rgba(255,'+(150-fi*40)+','+(fi*10)+',0.6)';
          ctx.beginPath(); ctx.arc(0,-15-fi*3,3-fi*0.6,0,Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();
      break;
    }

    // ═══ COMMANDER: bandeira ondulante + plataforma ═══
    case 'commander': {
      // Plataforma/sacos de areia
      ctx.fillStyle='#665533';
      [-1,0,1].forEach(function(o){ctx.beginPath();ctx.ellipse(cx+o*8,topY+bH*0.55,7,4,0,0,Math.PI*2);ctx.fill();});
      // Mastro
      ctx.fillStyle='#885500'; ctx.fillRect(cx-1.5,topY-32,3,32);
      // Bandeira ondulante (vários segmentos com onda)
      var segs=6, flagH=14, flagW=18;
      ctx.fillStyle='#cc8800';
      ctx.beginPath(); ctx.moveTo(cx,topY-32);
      for (var i=0;i<=segs;i++){
        var fx=cx+ (i/segs)*flagW;
        var fy=topY-32+Math.sin(t*4 + i*0.8)*2.5 - (i/segs)*2;
        if(i===0)ctx.moveTo(cx,topY-32); else ctx.lineTo(fx,fy);
      }
      for (var i=segs;i>=0;i--){
        var fx=cx+ (i/segs)*flagW;
        var fy=topY-32+flagH+Math.sin(t*4 + i*0.8)*2.5 - (i/segs)*2;
        ctx.lineTo(fx,fy);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.6; ctx.stroke();
      // Estrela na bandeira
      ctx.fillStyle='#ffe066'; ctx.shadowBlur=6; ctx.shadowColor='#ffe066';
      ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
      ctx.fillText('★', cx+flagW*0.45, topY-32+flagH*0.5+Math.sin(t*4+1.5)*2);
      ctx.shadowBlur=0; ctx.shadowColor='transparent';
      // Topo do mastro
      ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.arc(cx,topY-33,2,0,Math.PI*2); ctx.fill();
      break;
    }

    // ═══ DJ BOOTH: pratos giratórios + equalizador colorido ═══
    case 'djbooth': {
      // Mesa
      ctx.fillStyle='#2a1a3a'; ctx.fillRect(cx-bW*0.7, topY-4, bW*1.4, 6);
      // Altifalantes laterais com equalizador
      [-1,1].forEach(function(s){
        var sx2=cx+s*bW*0.85;
        ctx.fillStyle='#1a0a2a'; ctx.fillRect(sx2-5,topY-22,10,20);
        ctx.fillStyle='#3a2a4a'; ctx.beginPath(); ctx.arc(sx2,topY-12,3.5,0,Math.PI*2); ctx.fill();
        // Barras de equalizador
        for (var i=0;i<3;i++){
          var bh=2+Math.abs(Math.sin(t*6+i*1.3+s))*6;
          var hue=(t*80+i*60)%360, rgb=hslToRgb(hue,75,55);
          ctx.fillStyle='rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+')';
          ctx.fillRect(sx2-4+i*3, topY-2-bh, 2, bh);
        }
      });
      // Pratos giratórios (centro)
      [-1,1].forEach(function(s){
        var px2=cx+s*bW*0.32, py2=topY-10;
        ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(px2,py2,6,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#444'; ctx.lineWidth=0.6;
        for(var rg=1;rg<=2;rg++){ctx.beginPath();ctx.arc(px2,py2,rg*2,0,Math.PI*2);ctx.stroke();}
        // Indicador de rotação
        var ra=t*8*s;
        ctx.strokeStyle='#88ddff'; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(px2,py2); ctx.lineTo(px2+Math.cos(ra)*5,py2+Math.sin(ra)*5); ctx.stroke();
      });
      break;
    }

    // ═══ ARTILHARIA (montanha): canhão pesado, base reforçada ═══
    case 'artilharia': {
      var ang2 = hasTgt ? ang : -Math.PI/2;
      // Plataforma giratória reforçada
      ctx.fillStyle='#2a3038'; ctx.beginPath(); ctx.ellipse(cx,topY+bH*0.35,bW*0.75,bH*0.5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.stroke();
      var kickA=recoil*7;
      ctx.save(); ctx.translate(cx,topY-bH*0.2); ctx.rotate(ang2+Math.PI/2);
      // Cano duplo grosso
      ctx.fillStyle='#222830';
      ctx.fillRect(-7,-30+kickA,5,30); ctx.fillRect(2,-30+kickA,5,30);
      ctx.fillStyle='#3a4250'; ctx.fillRect(-8,-6,16,8); // bloco de culatra
      if (hasTgt && recoil>0.7){
        ctx.globalAlpha=recoil; ctx.fillStyle='#ffaa44';
        ctx.beginPath(); ctx.arc(-4.5,-32+kickA,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(4.5,-32+kickA,4,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
      }
      ctx.restore();
      // Indicador de longo alcance (pequenas bandeiras decorativas)
      ctx.fillStyle='#cc4422';
      ctx.beginPath(); ctx.moveTo(cx-bW*0.7,topY+2); ctx.lineTo(cx-bW*0.7,topY-10); ctx.lineTo(cx-bW*0.55,topY-6); ctx.closePath(); ctx.fill();
      break;
    }

    // ═══ OBSERVADOR (montanha): torre de vigia + binóculos ═══
    case 'observador': {
      // Poste da torre
      ctx.fillStyle='#3a4a3a'; ctx.fillRect(cx-3,topY-2,6,26);
      // Plataforma do observador
      ctx.fillStyle='#2a3a2a'; ctx.beginPath(); ctx.ellipse(cx,topY-2,bW*0.7,bH*0.45,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.8; ctx.stroke();
      // Corrimão (pequenos postes)
      ctx.strokeStyle='#445544'; ctx.lineWidth=1;
      [-1,-0.4,0.4,1].forEach(function(o){ ctx.beginPath(); ctx.moveTo(cx+o*bW*0.6,topY-2); ctx.lineTo(cx+o*bW*0.6,topY-9); ctx.stroke(); });
      // Silhueta do observador (corpo simples + binóculos)
      var bob = Math.sin(t*1.2)*1.2;
      ctx.fillStyle='#3a4a3a';
      ctx.beginPath(); ctx.ellipse(cx,topY-14+bob,4,7,0,0,Math.PI*2); ctx.fill(); // corpo
      ctx.fillStyle='#5a6a5a';
      ctx.beginPath(); ctx.arc(cx,topY-21+bob,3.2,0,Math.PI*2); ctx.fill(); // cabeça
      // Binóculos a apontar lentamente (varrimento)
      var lookA = Math.sin(t*0.5)*0.5;
      ctx.save(); ctx.translate(cx,topY-21+bob); ctx.rotate(lookA);
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(-4,-1.5,3,3); ctx.fillRect(1,-1.5,3,3);
      ctx.restore();
      // Luz de sinalização no topo (pisca devagar)
      var sigOn = Math.sin(t*2)>0.3;
      ctx.fillStyle = sigOn ? '#66ffcc' : '#225544';
      if (sigOn){ ctx.shadowBlur=8; ctx.shadowColor='#66ffcc'; }
      ctx.beginPath(); ctx.arc(cx,topY-30,2.2,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.shadowColor='transparent';
      break;
    }

    // ═══ GERADOR: turbina com pás a rodar + brilho de energia ═══
    case 'gerador': {
      // Base/plataforma
      ctx.fillStyle='#003322'; ctx.beginPath(); ctx.ellipse(cx, topY+bH*0.35, bW*0.7, bH*0.45, 0, 0, Math.PI*2); ctx.fill();
      // Corpo central
      ctx.fillStyle='#004433'; ctx.fillRect(cx-5, topY-14, 10, 14);
      // Pás da turbina (3, a rodar)
      ctx.save(); ctx.translate(cx, topY-14);
      ctx.rotate(t * 2.5 * (this.powered ? 1 : 0.1)); // para se sem energia
      for (var bi=0; bi<3; bi++) {
        var ba = (bi/3)*Math.PI*2;
        ctx.fillStyle='#00cc88';
        ctx.save(); ctx.rotate(ba);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-3,-12); ctx.lineTo(3,-12); ctx.closePath();
        ctx.fill(); ctx.restore();
      }
      ctx.restore();
      // Centro brilhante (pulsante)
      var ep = 0.5+0.5*Math.sin(t*3);
      ctx.shadowBlur = 8+ep*8; ctx.shadowColor='#00ffaa';
      ctx.fillStyle='rgba(0,220,140,'+(0.6+ep*0.4)+')';
      ctx.beginPath(); ctx.arc(cx, topY-14, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.shadowColor='transparent';
      // Texto "+ENRG"
      ctx.globalAlpha=0.5+ep*0.4; ctx.fillStyle='#00ffaa';
      ctx.font='bold 7px Orbitron,sans-serif'; ctx.textAlign='center';
      ctx.fillText('+ENRG', cx, topY-28); ctx.globalAlpha=1;
      break;
    }
  }
};

// ── Conversor HSL → RGB (para cores cíclicas do DJ Booth) ─────────
function hslToRgb(h, s, l) {
  h/=360; s/=100; l/=100;
  var r,g,b;
  if (s===0){r=g=b=l;}
  else{
    var hue2rgb=function(p,q,t){
      if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;
      return p;
    };
    var q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}
