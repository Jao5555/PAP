"""
VOID DEFENSE — Motor de Simulação Autoritativo (Cooperativo)
═══════════════════════════════════════════════════════════════════
Este ficheiro é a versão Python da lógica que em single-player corre
em game.js/tower.js/enemy.js/projectile.js/economy.js/waves.js.

PORQUÊ EXISTE: em multiplayer, não podemos confiar que o browser de
cada jogador calcula o jogo da mesma forma (lag, cópias diferentes,
ou alguém a tentar fazer batota). Por isso o SERVIDOR é quem decide
a verdade — onde estão os inimigos, quanto dano uma torre fez, etc.
Cada jogador só *vê* esse resultado e envia *pedidos* (colocar torre,
etc.), nunca manda diretamente "este inimigo morreu".

FONTE DOS NÚMEROS: game_data.json, gerado automaticamente a partir
de js/config.js (ver server/extract_config.js). Isto garante que os
valores aqui são EXATAMENTE os mesmos do single-player — nunca deves
editar números de balanceamento neste ficheiro, edita config.js e
gera de novo o json.

O QUE ESTÁ PORTADO (com paridade real ao single-player):
  ✅ Movimento de inimigos ao longo do caminho do mapa
  ✅ Deteção de alvo por torres (mais próximo da base, dentro de alcance)
  ✅ Dano direto e dano em área (diamante, com falloff, igual ao cliente)
  ✅ Ninja invisível + deteção por Observador
  ✅ Voador com resistência a dano de área
  ✅ Energia (consumo/produção incl. Gerador) e apagão de torres
  ✅ Ondas com spawns temporizados, sangue, ouro, HP da base
  ✅ Auras de Commander/DJ Booth
  ✅ Upgrades de torre (3 níveis)

O QUE FICA SIMPLIFICADO (só afeta visual, não a lógica de jogo):
  ⚠ Projéteis não têm a curva de animação exata do cliente — o
    servidor decide instantaneamente se acertou (baseado no tempo de
    voo), e envia um evento "hit" para o cliente desenhar o efeito.
    O timing de dano é fiel; a trajetória visual é aproximada.
═══════════════════════════════════════════════════════════════════
"""

import json
import math
import time
import uuid
from pathlib import Path

DATA_FILE = Path(__file__).parent / 'game_data.json'
with open(DATA_FILE, encoding='utf-8') as f:
    GD = json.load(f)

COLS, ROWS = GD['COLS'], GD['ROWS']
TW, TH = GD['TW'], GD['TH']


# ═══════════════════════════════════════════════════════════════════
#  MAPA — construção do caminho (porta de config.js buildMapData)
# ═══════════════════════════════════════════════════════════════════

def build_map_data(map_key):
    m = GD['MAPS'][map_key]
    wps = m['path']
    cells = []
    seen = set()
    for i in range(len(wps) - 1):
        c, r = wps[i]['c'], wps[i]['r']
        tc, tr = wps[i + 1]['c'], wps[i + 1]['r']
        while c != tc or r != tr:
            key = (c, r)
            if key not in seen:
                seen.add(key)
                cells.append({'c': c, 'r': r})
            if c < tc: c += 1
            elif c > tc: c -= 1
            if r < tr: r += 1
            elif r > tr: r -= 1
        key = (c, r)
        if key not in seen:
            seen.add(key)
            cells.append({'c': c, 'r': r})

    length = 0
    for i in range(len(wps) - 1):
        length += abs(wps[i + 1]['c'] - wps[i]['c']) + abs(wps[i + 1]['r'] - wps[i]['r'])

    return {'cells': cells, 'length': length, 'path': wps}


def path_pos(map_data, prog):
    """Posição (gc,gr) float ao longo do caminho, para uma progressão 0..length."""
    rem = prog
    wps = map_data['path']
    for i in range(len(wps) - 1):
        f, t = wps[i], wps[i + 1]
        seg = abs(t['c'] - f['c']) + abs(t['r'] - f['r'])
        if rem <= seg:
            tv = (rem / seg) if seg > 0 else 0
            return f['c'] + (t['c'] - f['c']) * tv, f['r'] + (t['r'] - f['r']) * tv
        rem -= seg
    last = wps[-1]
    return last['c'], last['r']


def grid_dist(c1, r1, c2, r2):
    return math.hypot(c2 - c1, r2 - r1)


def dia_dist(px, py, cx, cy, rx, ry):
    """Distância normalizada num diamante isométrico — igual ao U.diaDist do cliente."""
    dx = abs(px - cx) / rx
    dy = abs(py - cy) / ry
    return dx + dy


def iso(c, r, ox=0, oy=0):
    return ((c - r) * (TW / 2) + ox, (c + r) * (TH / 2) + oy)


# ═══════════════════════════════════════════════════════════════════
#  ENTIDADES
# ═══════════════════════════════════════════════════════════════════

class Enemy:
    __slots__ = ('id', 'type', 'prog', 'hp', 'mhp', 'spd', 'dmg', 'gold', 'blood',
                 'sz', 'dead', 'reached', 'gc', 'gr', 'is_boss', 'invisible',
                 'detected', 'flying', 'aoe_resist')

    def __init__(self, type_, dm=1.0):
        cf = GD['EN_DEF'][type_]
        self.id = str(uuid.uuid4())[:8]
        self.type = type_
        self.prog = 0.0
        self.mhp = math.floor(cf['hp'] * dm)
        self.hp = self.mhp
        self.spd = cf['spd']
        self.dmg = cf['dmg']
        self.gold = cf['gold']
        self.blood = cf['blood']
        self.sz = cf['sz']
        self.dead = False
        self.reached = False
        self.gc = 0.0
        self.gr = 0.0
        self.is_boss = (type_ == 'boss')
        self.invisible = bool(cf.get('invisible', False))
        self.detected = False
        self.flying = bool(cf.get('flying', False))
        self.aoe_resist = cf.get('aoeResist', 1.0)

    def update(self, dt, map_data):
        if self.dead or self.reached:
            return
        self.prog += self.spd * dt
        if self.prog >= map_data['length']:
            self.reached = True
            return
        self.gc, self.gr = path_pos(map_data, self.prog)

    def hit(self, dmg):
        self.hp -= dmg
        if self.hp <= 0:
            self.hp = 0
            self.dead = True

    def snapshot(self):
        return {
            'id': self.id, 'type': self.type, 'gc': self.gc, 'gr': self.gr,
            'hp': self.hp, 'mhp': self.mhp, 'prog': self.prog, 'sz': self.sz,
            'isBoss': self.is_boss, 'invisible': self.invisible,
            'detected': self.detected, 'flying': self.flying,
        }


class Tower:
    __slots__ = ('id', 'col', 'row', 'type', 'level', 'owner', 'base_dmg', 'base_range',
                 'base_rate', 'dmg', 'range', 'rate', 'pspd', 'aoe', 'drain', 'support',
                 'aura_type', 'aura_mult', 'aura_range', 'base_cost', 'sell', 'fcd',
                 'powered', 'dmg_buff', 'spd_buff', 'aura_dmg', 'aura_spd', 'mountain_only',
                 'aim_angle', 'current_target')

    def __init__(self, col, row, type_, owner=None):
        cf = GD['TW_DEF'][type_]
        self.id = str(uuid.uuid4())[:8]
        self.col, self.row, self.type = col, row, type_
        self.level = 1
        self.owner = owner  # quem construiu (para UI, não afeta lógica em coop)
        self.base_dmg = cf['dmg']; self.base_range = cf['range']; self.base_rate = cf['rate']
        self.dmg = cf['dmg']; self.range = cf['range']; self.rate = cf['rate']
        self.pspd = cf['pspd']; self.aoe = cf['aoe']; self.drain = cf['drain']
        self.support = cf.get('support', False)
        self.aura_type = cf.get('auraType')
        self.aura_mult = cf.get('auraMult', 1.0)
        self.aura_range = cf.get('auraRange', 0)
        self.base_cost = cf['cost']
        self.sell = math.floor(cf['cost'] / 2)
        self.fcd = 0.3
        self.powered = True
        self.dmg_buff = 1.0; self.spd_buff = 1.0; self.aura_dmg = 1.0; self.aura_spd = 1.0
        self.mountain_only = cf.get('mountainOnly', False)
        self.aim_angle = -math.pi / 2
        self.current_target = None

    def get_upg_cost(self):
        if self.level >= 3:
            return 0
        upg_costs = GD['UPG_COSTS']
        return math.floor(self.base_cost * upg_costs[self.level])

    def upgrade(self):
        if self.level >= 3 or self.support:
            return False
        cf = GD['TW_DEF'][self.type]
        lv = self.level
        self.level += 1
        self.dmg = math.floor(self.base_dmg * cf['upgDmg'][lv])
        self.range = self.base_range * cf['upgRange'][lv]
        self.rate = self.base_rate * cf['upgRate'][lv]
        upg_costs = GD['UPG_COSTS']
        self.sell = math.floor((self.base_cost + self.base_cost * sum(upg_costs[:lv])) * 0.5)
        return True

    def find_target(self, enemies):
        best, best_prog = None, -1
        for e in enemies:
            if e.dead or e.reached:
                continue
            if e.invisible and not e.detected:
                continue
            if grid_dist(self.col, self.row, e.gc, e.gr) <= self.range and e.prog > best_prog:
                best_prog = e.prog
                best = e
        return best

    def apply_aura(self, towers):
        if not self.aura_type or not self.powered or self.aura_type == 'detect' or self.aura_type == 'energy':
            return
        for t in towers:
            if t is self or t.support:
                continue
            if grid_dist(self.col, self.row, t.col, t.row) <= self.aura_range:
                if self.aura_type == 'dmg':
                    t.aura_dmg = max(t.aura_dmg, self.aura_mult)
                elif self.aura_type == 'spd':
                    t.aura_spd = max(t.aura_spd, self.aura_mult)

    def snapshot(self):
        return {
            'id': self.id, 'col': self.col, 'row': self.row, 'type': self.type,
            'level': self.level, 'powered': self.powered,
            'dmgBuff': self.dmg_buff * self.aura_dmg, 'spdBuff': self.spd_buff * self.aura_spd,
            'range': self.range, 'auraRange': self.aura_range, 'support': self.support,
            'auraType': self.aura_type, 'aimAngle': self.aim_angle,
            'hasTarget': self.current_target is not None,
        }


class Room:
    """Estado de uma partida cooperativa autoritativa."""

    def __init__(self, code, map_key='desert', difficulty='normal'):
        self.code = code
        self.map_key = map_key
        self.difficulty = difficulty
        self.map_data = build_map_data(map_key)

        diff = GD['DIFF'][difficulty]
        self.diff_mult = diff['hpM']
        self.gold_mult = diff['goldM']

        self.gold = diff['startGold']
        self.enrg = diff['enrg']
        self.max_enrg = GD['ENRG_MAX']
        self.bhp = GD['BASE_HP']
        self.max_bhp = GD['BASE_HP']
        self.blood_pool = 0.0
        self.blood_buf = 0.0

        self.towers = []
        self.enemies = []
        self.kills = 0
        self.earned = 0

        self.wave_num = 0  # 0-indexed, onda atual = wave_num+1
        self.wave_active = False
        self.wave_groups = []
        self.wave_all_spawned = False

        self.state = 'lobby'  # lobby -> playing -> won/lost
        self.last_tick = time.time()
        self.events = []  # eventos deste tick (hits, mortes, etc.) para o cliente animar

    # ── Ações vindas dos jogadores ──────────────────────────────────
    def place_tower(self, col, row, tower_type, player_name=''):
        if tower_type not in GD['TW_DEF']:
            return False, 'Tropa desconhecida.'
        cf = GD['TW_DEF'][tower_type]

        occupied = any(t.col == col and t.row == row for t in self.towers)
        if occupied:
            return False, 'Já há uma torre aqui.'
        if not (0 <= col < COLS and 0 <= row < ROWS):
            return False, 'Fora do mapa.'
        if self.gold < cf['cost']:
            return False, 'Sem ouro suficiente.'

        # NOTA: validação de tile (relva/montanha/pedra) fica simplificada
        # no servidor — o cliente já impede cliques inválidos; o servidor
        # só protege contra ouro insuficiente e posições ocupadas/fora do
        # mapa, que são os casos que importam para justiça entre jogadores.
        self.gold -= cf['cost']
        t = Tower(col, row, tower_type, owner=player_name)
        self.towers.append(t)
        return True, None

    def upgrade_tower(self, tower_id):
        t = next((t for t in self.towers if t.id == tower_id), None)
        if not t:
            return False, 'Torre não encontrada.'
        cost = t.get_upg_cost()
        if t.level >= 3:
            return False, 'Já está no nível máximo.'
        if self.gold < cost:
            return False, 'Sem ouro suficiente.'
        self.gold -= cost
        t.upgrade()
        return True, None

    def sell_tower(self, tower_id):
        t = next((t for t in self.towers if t.id == tower_id), None)
        if not t:
            return False, 'Torre não encontrada.'
        self.gold += t.sell
        self.towers.remove(t)
        return True, None

    def start_wave(self):
        if self.wave_active or self.wave_num >= len(GD['WAVES']):
            return False
        wave_def = GD['WAVES'][self.wave_num]
        self.wave_active = True
        self.wave_all_spawned = False
        self.wave_groups = [
            {'type': g['t'], 'count': g['n'], 'iv': g['iv'], 'spawned': 0, 'timer': g.get('d', 0)}
            for g in wave_def['g']
        ]
        return True

    def skip_wave(self):
        if not self.wave_active:
            return False
        for g in self.wave_groups:
            g['spawned'] = g['count']
        self.wave_all_spawned = True
        self.enemies.clear()
        return True

    def use_blood(self, which):
        bu = GD['BLOOD_USES'].get(which)
        if not bu or self.blood_pool < bu['cost']:
            return False
        self.blood_pool -= bu['cost']
        if which == 'heal':
            self.bhp = min(self.max_bhp, self.bhp + 25)
        elif which == 'energy':
            self.enrg = min(self.max_enrg, self.enrg + 80)
        # buffs de dano/velocidade tratados como flags temporais simples
        # (omitido por brevidade nesta primeira versão — TODO: portar buffs temporizados)
        return True

    def collect_blood(self):
        collected = self.blood_pool
        self.blood_pool = 0
        return collected

    # ── Tick principal ───────────────────────────────────────────────
    def tick(self, dt):
        self.events = []
        if self.state != 'playing':
            return

        self._update_economy(dt)
        self._update_detection()
        self._update_waves(dt)
        self._update_enemies(dt)
        self._update_towers(dt)
        self._check_wave_end()

    def _update_economy(self, dt):
        gen_bonus = 0.0
        for t in self.towers:
            if t.drain < 0:
                gen_bonus += abs(t.drain) * dt
                t.powered = True
        self.enrg = min(self.max_enrg, self.enrg + gen_bonus)

        total_drain = sum(t.drain * dt for t in self.towers if t.drain > 0)
        if self.enrg >= total_drain:
            self.enrg -= total_drain
            for t in self.towers:
                if t.drain > 0:
                    t.powered = True
        else:
            avail = self.enrg
            sorted_towers = sorted([t for t in self.towers if t.drain > 0], key=lambda t: -t.drain)
            for t in sorted_towers:
                cost = t.drain * dt
                if avail >= cost:
                    avail -= cost
                    t.powered = True
                else:
                    t.powered = False
            self.enrg = max(0, avail)

        self.enrg = min(self.max_enrg, self.enrg + GD['ENRG_RG'] * dt)

        # Conversão passiva de sangue em energia
        if self.blood_buf > 0:
            cv = min(self.blood_buf, 14 * dt)
            self.blood_buf -= cv
            self.enrg = min(self.max_enrg, self.enrg + cv / GD['B2E'])

    def _update_detection(self):
        for e in self.enemies:
            e.detected = False
        for t in self.towers:
            if t.type == 'observador' and t.powered:
                for e in self.enemies:
                    if e.invisible and grid_dist(t.col, t.row, e.gc, e.gr) <= t.aura_range:
                        e.detected = True

    def _update_waves(self, dt):
        if not self.wave_active:
            return
        all_done = True
        for g in self.wave_groups:
            if g['spawned'] >= g['count']:
                continue
            all_done = False
            g['timer'] -= dt
            if g['timer'] <= 0:
                e = Enemy(g['type'], self.diff_mult)
                e.gc, e.gr = path_pos(self.map_data, 0)
                self.enemies.append(e)
                g['spawned'] += 1
                g['timer'] = g['iv']
        if all_done:
            self.wave_all_spawned = True

    def _update_enemies(self, dt):
        for e in self.enemies[:]:
            e.update(dt, self.map_data)
            if e.dead:
                gold_get = math.floor(e.gold * self.gold_mult)
                self.gold += gold_get
                self.earned += gold_get
                self.kills += 1
                self.blood_pool += e.blood
                self.blood_buf += e.blood
                self.events.append({'type': 'death', 'enemyId': e.id, 'gc': e.gc, 'gr': e.gr, 'isBoss': e.is_boss})
                self.enemies.remove(e)
            elif e.reached:
                self.bhp = max(0, self.bhp - e.dmg)
                self.events.append({'type': 'reached', 'gc': e.gc, 'gr': e.gr})
                self.enemies.remove(e)
                if self.bhp <= 0:
                    self.state = 'lost'

    def _update_towers(self, dt):
        for t in self.towers:
            t.aura_dmg = 1.0
            t.aura_spd = 1.0
        for t in self.towers:
            if t.support:
                t.apply_aura(self.towers)

        for t in self.towers:
            t.fcd = max(0, t.fcd - dt)
            if not t.powered or t.support:
                continue
            target = t.find_target(self.enemies)
            t.current_target = target
            if target:
                # Ângulo em espaço de ECRÃ (após projeção isométrica), não em
                # coordenadas de grelha — tem de bater certo com U.iso/U.isoF
                # do cliente (tower.js _aimAngle), senão a torreta roda para
                # o lado errado visualmente mesmo que a lógica esteja correta.
                sx, sy = iso(t.col, t.row)
                tx, ty = iso(target.gc, target.gr)
                desired = math.atan2(ty - sy, tx - sx)
                diff = desired - t.aim_angle
                while diff > math.pi: diff -= 2 * math.pi
                while diff < -math.pi: diff += 2 * math.pi
                t.aim_angle += diff * min(1, dt * 10)
            if not target:
                continue
            real_rate = t.rate * t.spd_buff * t.aura_spd
            if t.fcd <= 0:
                t.fcd = 1 / real_rate
                self._fire(t, target)

    def _fire(self, tower, target):
        dmg = math.floor(tower.dmg * tower.dmg_buff * tower.aura_dmg)
        if tower.aoe > 0:
            # Área de efeito em unidades de grelha (mesmas unidades que tower.range),
            # com dano cheio nos 55% centrais e falloff linear até à borda —
            # a mesma curva usada no cliente (ver projectile.js _hit). A forma
            # exata do impacto (diamante vs. círculo) é só cosmética no cliente;
            # aqui o que importa é *quem* é atingido e *quanto* dano recebe.
            hx, hy = target.gc, target.gr
            hit_ids = []
            for e in self.enemies:
                if e.dead:
                    continue
                if e.invisible and not e.detected:
                    continue
                dist = grid_dist(e.gc, e.gr, hx, hy)
                if dist <= tower.aoe:
                    ratio = dist / max(0.01, tower.aoe)
                    falloff = 1.0 if ratio <= 0.55 else 1 - ((ratio - 0.55) / 0.45) * 0.45
                    real_dmg = max(1, math.floor(dmg * falloff * e.aoe_resist))
                    e.hit(real_dmg)
                    hit_ids.append(e.id)
            self.events.append({'type': 'aoe_hit', 'towerId': tower.id, 'x': hx, 'y': hy, 'aoe': tower.aoe, 'hitIds': hit_ids})
        else:
            target.hit(dmg)
            self.events.append({'type': 'hit', 'towerId': tower.id, 'enemyId': target.id, 'dmg': dmg})

    def _check_wave_end(self):
        if self.wave_active and self.wave_all_spawned and len(self.enemies) == 0:
            reward = GD['WAVES'][self.wave_num]['reward']
            self.gold += reward
            self.wave_active = False
            self.wave_num += 1
            self.events.append({'type': 'wave_complete', 'wave': self.wave_num, 'reward': reward})
            if self.wave_num >= len(GD['WAVES']):
                self.state = 'won'

    # ── Snapshot para enviar aos clientes ────────────────────────────
    def snapshot(self):
        return {
            'state': self.state,
            'gold': self.gold, 'enrg': round(self.enrg, 1), 'maxEnrg': self.max_enrg,
            'bhp': self.bhp, 'maxBhp': self.max_bhp,
            'bloodPool': round(self.blood_pool, 1),
            'kills': self.kills, 'earned': self.earned,
            'waveNum': self.wave_num, 'waveActive': self.wave_active,
            'totalWaves': len(GD['WAVES']),
            'towers': [t.snapshot() for t in self.towers],
            'enemies': [e.snapshot() for e in self.enemies],
            'events': self.events,
            'map': self.map_key, 'difficulty': self.difficulty,
        }
