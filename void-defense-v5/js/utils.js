'use strict';
// ═══════════════════════════════════════════════════════════════
//  utils.js  —  Matemática isométrica e funções de desenho
// ═══════════════════════════════════════════════════════════════

var U = {
  // Grid (col,row) → posição no ecrã
  iso: function(c, r) {
    return {
      x: (c - r) * (C.TW / 2) + C.OX,
      y: (c + r) * (C.TH / 2) + C.OY
    };
  },

  // Grid (col,row) FLOAT → posição no ecrã (para inimigos a mover-se)
  isoF: function(gc, gr) {
    return {
      x: (gc - gr) * (C.TW / 2) + C.OX,
      y: (gc + gr) * (C.TH / 2) + C.OY
    };
  },

  // Ecrã → Grid (aproximado, usado para clicks)
  inv: function(sx, sy) {
    var rx = sx - C.OX, ry = sy - C.OY;
    var tw2 = C.TW / 2, th2 = C.TH / 2;
    return {
      col: Math.floor((rx / tw2 + ry / th2) / 2),
      row: Math.floor((ry / th2 - rx / tw2) / 2)
    };
  },

  // Distância entre duas células do grid
  gdist: function(c1, r1, c2, r2) { return Math.hypot(c2 - c1, r2 - r1); },

  // Matemática geral
  lerp: function(a, b, t) { return a + (b - a) * t; },
  rnd:  function(a, b)    { return Math.random() * (b - a) + a; },
  clp:  function(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },

  // Retângulo arredondado
  rr: function(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  },

  // Desenha um tile isométrico plano (3 faces: topo, esquerda, direita)
  // Desenha um tile isométrico plano (3 faces: topo, esquerda, direita)
  // Topo usa um gradiente suave + brilho de aresta para dar sensação de profundidade
  // em vez de uma cor lisa (visual antigo "básico").
  tile: function(ctx, c, r, col) {
    var p = U.iso(c, r), x = p.x, y = p.y;
    var tw2 = C.TW / 2, th2 = C.TH / 2, d = C.TD;

    // Topo (diamante) — gradiente radial subtil do centro para a borda
    ctx.beginPath();
    ctx.moveTo(x, y - th2); ctx.lineTo(x + tw2, y);
    ctx.lineTo(x, y + th2); ctx.lineTo(x - tw2, y);
    ctx.closePath();
    var grad = ctx.createRadialGradient(x, y-4, 2, x, y, tw2);
    grad.addColorStop(0, U._lighten(col.top, 14));
    grad.addColorStop(1, col.top);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();

    // Brilho fino na aresta superior (luz a vir de cima-esquerda)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x-tw2,y); ctx.lineTo(x,y-th2); ctx.stroke();

    // Esquerda
    ctx.beginPath();
    ctx.moveTo(x - tw2, y); ctx.lineTo(x, y + th2);
    ctx.lineTo(x, y + th2 + d); ctx.lineTo(x - tw2, y + d);
    ctx.closePath();
    ctx.fillStyle = col.lft; ctx.fill(); ctx.stroke();

    // Direita
    ctx.beginPath();
    ctx.moveTo(x + tw2, y); ctx.lineTo(x, y + th2);
    ctx.lineTo(x, y + th2 + d); ctx.lineTo(x + tw2, y + d);
    ctx.closePath();
    ctx.fillStyle = col.rgt; ctx.fill(); ctx.stroke();
  },

  // Aclara uma cor hex em N% (usado no gradiente dos tiles)
  _lighten: function(hex, pct) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, (n>>16) + Math.round(255*pct/100));
    var g = Math.min(255, ((n>>8)&255) + Math.round(255*pct/100));
    var b = Math.min(255, (n&255) + Math.round(255*pct/100));
    return 'rgb('+r+','+g+','+b+')';
  },

  // Desenha uma caixa 3D isométrica (torres). glow = blur opcional.
  box: function(ctx, cx, cy, col, bW, bD, ht, glow) {
    var bH = bW * 0.5, topY = cy - ht;
    if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = col.top; }

    // Sombra no chão
    ctx.save();
    ctx.globalAlpha = 0.14; ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy + C.TH * 0.28, bW * 0.88, bH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Topo
    ctx.beginPath();
    ctx.moveTo(cx, topY - bH); ctx.lineTo(cx + bW, topY);
    ctx.lineTo(cx, topY + bH); ctx.lineTo(cx - bW, topY);
    ctx.closePath();
    ctx.fillStyle = col.top; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.9; ctx.stroke();

    // Esquerda
    ctx.beginPath();
    ctx.moveTo(cx - bW, topY); ctx.lineTo(cx, topY + bH);
    ctx.lineTo(cx, topY + bH + bD); ctx.lineTo(cx - bW, topY + bD);
    ctx.closePath();
    ctx.fillStyle = col.lft; ctx.fill(); ctx.stroke();

    // Direita
    ctx.beginPath();
    ctx.moveTo(cx + bW, topY); ctx.lineTo(cx, topY + bH);
    ctx.lineTo(cx, topY + bH + bD); ctx.lineTo(cx + bW, topY + bD);
    ctx.closePath();
    ctx.fillStyle = col.rgt; ctx.fill(); ctx.stroke();

    if (glow) ctx.shadowBlur = 0;
  },

  // Traça um diamante (losango) isométrico — usado para indicadores de
  // alcance, em vez de círculos/elipses, para se alinhar com o grid quadrado.
  // rx = semi-largura horizontal, ry = semi-altura vertical (normalmente rx/2).
  diaPath: function(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.moveTo(x, y - ry);
    ctx.lineTo(x + rx, y);
    ctx.lineTo(x, y + ry);
    ctx.lineTo(x - rx, y);
    ctx.closePath();
  },

  // Distância normalizada num diamante isométrico (0 = centro, 1 = na borda).
  // Usado para o dano em área (AOE) ficar alinhado ao grid quadrado em vez
  // de circular — um projétil que explode tem uma "zona de impacto" em
  // forma de losango, igual ao indicador de alcance.
  diaDist: function(px, py, cx, cy, rx, ry) {
    var dx = Math.abs(px - cx) / rx;
    var dy = Math.abs(py - cy) / ry;
    return dx + dy; // métrica de Manhattan rodada = losango
  }
};
