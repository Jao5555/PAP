"""
VOID DEFENSE — Servidor Multiplayer
═══════════════════════════════════════════════════════════════════
Um único servidor (um processo, uma porta) que faz três coisas:

  1. Serve os ficheiros do jogo (substitui o antigo `python -m http.server`)
  2. API de Leaderboard (HTTP REST simples, guardado em leaderboard.json)
  3. WebSocket de Salas/Lobby — base partilhada para Cooperativo e
     Competitivo (ver TODOs abaixo para o que falta ligar)

REQUER: pip install aiohttp
  (o start_server.bat tenta instalar isto automaticamente se faltar)

═══════════════════════════════════════════════════════════════════
ESTADO ATUAL DESTE SERVIDOR (importante ler antes de mexer):

✅ FUNCIONAL:
  - Serve ficheiros estáticos (login.html, index.html, game.html, etc.)
  - Leaderboard: submeter pontuação + ver tabela classificativa
  - Salas: criar sala, entrar com código, lista de jogadores, ready-up
  - Reencaminhamento de eventos genéricos entre jogadores da mesma sala

🔜 PRÓXIMO PASSO (não feito ainda — é o trabalho da próxima sessão):
  - COOPERATIVO: o servidor não corre a simulação do jogo (ondas,
    inimigos, HP da base). Isso ainda corre só no browser de cada
    jogador (game.js → G._update). Para coop real, o servidor
    precisa de se tornar "autoritativo": ele é que decide onde estão
    os inimigos e quanto HP a base tem, e os clientes só mostram esse
    estado e enviam inputs (colocar torre, etc). Isto é uma mudança
    grande ao game.js, não só ao servidor.
  - COMPETITIVO 1v1: precisa de lógica nova — "matar inimigos gera
    recursos para enviar um inimigo ao adversário", duas grelhas
    (uma por jogador), condição de vitória = HP do adversário a 0.
    Nada disto existe ainda; o protocolo de salas abaixo serve de
    base (mode='pvp' já é guardado na sala) mas a mecânica de jogo
    em si não está implementada.
═══════════════════════════════════════════════════════════════════
"""

import asyncio
import json
import random
import socket
import string
import time
import uuid
from pathlib import Path

from aiohttp import web, WSMsgType

import simulation as sim

# ── Caminhos ──────────────────────────────────────────────────────
SERVER_DIR = Path(__file__).parent
BASE_DIR = SERVER_DIR.parent  # pasta void-defense-v5 (onde estão os .html)
LEADERBOARD_FILE = SERVER_DIR / 'leaderboard.json'

PORT = 8000
MAX_PLAYERS_PER_ROOM = 4


# ═══════════════════════════════════════════════════════════════════
#  LEADERBOARD — persistência simples em ficheiro JSON
# ═══════════════════════════════════════════════════════════════════

def load_leaderboard():
    if LEADERBOARD_FILE.exists():
        try:
            return json.loads(LEADERBOARD_FILE.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            return []
    return []


def save_leaderboard(entries):
    try:
        LEADERBOARD_FILE.write_text(
            json.dumps(entries, ensure_ascii=False, indent=2), encoding='utf-8'
        )
    except OSError as e:
        print(f'[AVISO] Não foi possível guardar leaderboard.json: {e}')


leaderboard = load_leaderboard()


async def api_get_leaderboard(request):
    """GET /api/leaderboard?mode=solo&limit=50 — devolve o top N."""
    mode = request.query.get('mode', 'solo')
    limit = min(int(request.query.get('limit', 50)), 200)

    entries = [e for e in leaderboard if e.get('mode') == mode]
    # Ordena por ondas completas (desc), depois por pontuação (desc)
    entries.sort(key=lambda e: (-e.get('wavesCompleted', 0), -e.get('score', 0)))

    return web.json_response(entries[:limit])


async def api_post_score(request):
    """POST /api/score — regista uma pontuação no leaderboard."""
    try:
        data = await request.json()
    except json.JSONDecodeError:
        return web.json_response({'ok': False, 'error': 'JSON inválido'}, status=400)

    entry = {
        'id': str(uuid.uuid4())[:8],
        'name': str(data.get('name', 'Jogador'))[:24],
        'mode': data.get('mode', 'solo') if data.get('mode') in ('solo', 'coop', 'pvp') else 'solo',
        'difficulty': data.get('difficulty', 'normal'),
        'map': data.get('map', 'desert'),
        'wavesCompleted': max(0, int(data.get('wavesCompleted', 0))),
        'kills': max(0, int(data.get('kills', 0))),
        'goldEarned': max(0, int(data.get('goldEarned', 0))),
        'won': bool(data.get('won', False)),
        'timestamp': time.time(),
    }
    # Pontuação simples: prioriza ondas completas, depois ouro e abates
    entry['score'] = entry['wavesCompleted'] * 1000 + entry['goldEarned'] + entry['kills'] * 5

    leaderboard.append(entry)
    save_leaderboard(leaderboard)
    return web.json_response({'ok': True, 'entry': entry})


# ═══════════════════════════════════════════════════════════════════
#  SALAS / LOBBY — WebSocket
# ═══════════════════════════════════════════════════════════════════
# Estrutura de uma sala:
#   rooms[code] = {
#     'mode': 'coop' | 'pvp',
#     'players': { websocket: {'id':str, 'name':str, 'ready':bool} },
#     'host': websocket,
#     'started': bool,
#   }

rooms = {}


def gen_room_code():
    """Código de 5 letras/números, fácil de ditar/escrever (ex: 'X7K2P')."""
    alphabet = string.ascii_uppercase.replace('O', '').replace('I', '') + '23456789'
    return ''.join(random.choices(alphabet, k=5))


async def broadcast_room(code, message, exclude=None):
    room = rooms.get(code)
    if not room:
        return
    dead = []
    for player_ws in list(room['players'].keys()):
        if player_ws is exclude:
            continue
        try:
            await player_ws.send_json(message)
        except ConnectionResetError:
            dead.append(player_ws)
    for d in dead:
        room['players'].pop(d, None)


def room_player_list(room):
    return [{'name': p['name'], 'ready': p['ready']} for p in room['players'].values()]


TICK_RATE = 15  # ticks/segundo — suficiente para o jogo parecer fluido sem sobrecarregar a rede


async def game_loop(code):
    """Corre a simulação autoritativa de uma sala coop, transmitindo o
    estado a todos os jogadores ligados a cada tick. Para sozinho quando
    o jogo acaba (won/lost) ou a sala deixa de existir."""
    room = rooms.get(code)
    if not room or not room.get('sim'):
        return
    dt = 1.0 / TICK_RATE
    try:
        while True:
            room = rooms.get(code)
            if not room or not room.get('sim'):
                break
            simulation = room['sim']
            if simulation.state != 'playing':
                # Ainda transmite o estado final (won/lost) uma vez antes de parar
                await broadcast_room(code, {'type': 'game_state', 'snapshot': simulation.snapshot()})
                break
            simulation.tick(dt)
            await broadcast_room(code, {'type': 'game_state', 'snapshot': simulation.snapshot()})
            await asyncio.sleep(dt)
    except Exception as e:
        print(f'[AVISO] game_loop da sala {code} terminou com erro: {e}')


async def leave_room(ws, code):
    room = rooms.get(code)
    if not room:
        return
    was_host = room.get('host') is ws
    room['players'].pop(ws, None)

    if not room['players']:
        # Sala vazia: cancela o loop de simulação em curso (se houver) antes
        # de a apagar, para não deixar uma tarefa asyncio órfã a correr.
        task = room.get('loop_task')
        if task and not task.done():
            task.cancel()
        rooms.pop(code, None)
        return

    # Se o host saiu, passa a posse ao jogador seguinte
    if was_host:
        room['host'] = next(iter(room['players'].keys()))

    await broadcast_room(code, {'type': 'player_list', 'players': room_player_list(room)})


async def ws_handler(request):
    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)

    player_id = str(uuid.uuid4())[:8]
    current_room = None

    async for msg in ws:
        if msg.type != WSMsgType.TEXT:
            if msg.type == WSMsgType.ERROR:
                print(f'[WS] erro de ligação: {ws.exception()}')
            continue

        try:
            data = json.loads(msg.data)
        except json.JSONDecodeError:
            continue

        action = data.get('action')

        # ── Criar sala ──────────────────────────────────────────
        if action == 'create_room':
            code = gen_room_code()
            while code in rooms:
                code = gen_room_code()
            mode = data.get('mode') if data.get('mode') in ('coop', 'pvp') else 'coop'
            map_key = data.get('map') if data.get('map') in sim.GD['MAPS'] else 'desert'
            difficulty = data.get('difficulty') if data.get('difficulty') in sim.GD['DIFF'] else 'normal'
            rooms[code] = {
                'mode': mode,
                'map': map_key,
                'difficulty': difficulty,
                'players': {ws: {'id': player_id, 'name': str(data.get('name', 'Jogador'))[:20], 'ready': False}},
                'host': ws,
                'started': False,
                'sim': None,
                'loop_task': None,
            }
            current_room = code
            await ws.send_json({'type': 'room_created', 'code': code, 'playerId': player_id, 'mode': mode})

        # ── Entrar numa sala existente ──────────────────────────
        elif action == 'join_room':
            code = (data.get('code') or '').upper().strip()
            room = rooms.get(code)
            if not room:
                await ws.send_json({'type': 'error', 'message': 'Sala não encontrada. Verifica o código.'})
                continue
            if room['started']:
                await ws.send_json({'type': 'error', 'message': 'Essa partida já começou.'})
                continue
            if len(room['players']) >= MAX_PLAYERS_PER_ROOM:
                await ws.send_json({'type': 'error', 'message': 'Sala cheia (máx. %d jogadores).' % MAX_PLAYERS_PER_ROOM})
                continue

            room['players'][ws] = {'id': player_id, 'name': str(data.get('name', 'Jogador'))[:20], 'ready': False}
            current_room = code
            await ws.send_json({'type': 'room_joined', 'code': code, 'playerId': player_id, 'mode': room['mode']})
            await broadcast_room(code, {'type': 'player_list', 'players': room_player_list(room)})

        # ── Marcar como pronto ───────────────────────────────────
        elif action == 'ready':
            room = rooms.get(current_room)
            if room and ws in room['players']:
                room['players'][ws]['ready'] = True
                all_ready = len(room['players']) >= 2 and all(p['ready'] for p in room['players'].values())
                await broadcast_room(current_room, {
                    'type': 'ready_update',
                    'allReady': all_ready,
                    'players': room_player_list(room),
                })
                if all_ready:
                    room['started'] = True
                    if room['mode'] == 'coop':
                        # Cria a simulação autoritativa e arranca o loop de jogo
                        simulation = sim.Room(current_room, room['map'], room['difficulty'])
                        simulation.state = 'playing'
                        room['sim'] = simulation
                        room['loop_task'] = asyncio.create_task(game_loop(current_room))
                        await broadcast_room(current_room, {
                            'type': 'game_start', 'mode': 'coop',
                            'map': room['map'], 'difficulty': room['difficulty'],
                        })
                    else:
                        # PvP: infraestrutura de sala pronta, mecânica de jogo
                        # ainda por desenhar/implementar — ver notas no topo do ficheiro.
                        await broadcast_room(current_room, {
                            'type': 'game_start', 'mode': 'pvp', 'notImplemented': True,
                        })

        # ── Ações de jogo (colocar torre, upgrade, etc.) ─────────
        # Só válidas em salas coop com uma simulação já a correr.
        elif action == 'game_action':
            room = rooms.get(current_room)
            if not room or not room.get('sim'):
                await ws.send_json({'type': 'action_result', 'ok': False, 'error': 'Jogo não está a decorrer.'})
                continue
            simulation = room['sim']
            sub = data.get('sub')
            payload = data.get('payload', {})
            player_name = room['players'].get(ws, {}).get('name', '')

            ok, err = False, 'Ação desconhecida.'
            if sub == 'place_tower':
                ok, err = simulation.place_tower(
                    int(payload.get('col', -1)), int(payload.get('row', -1)),
                    str(payload.get('towerType', '')), player_name,
                )
            elif sub == 'upgrade_tower':
                ok, err = simulation.upgrade_tower(str(payload.get('towerId', '')))
            elif sub == 'sell_tower':
                ok, err = simulation.sell_tower(str(payload.get('towerId', '')))
            elif sub == 'start_wave':
                ok = simulation.start_wave()
                err = None if ok else 'Não é possível iniciar onda agora.'
            elif sub == 'skip_wave':
                ok = simulation.skip_wave()
                err = None if ok else 'Nenhuma onda ativa para saltar.'
            elif sub == 'use_blood':
                ok = simulation.use_blood(str(payload.get('which', '')))
                err = None if ok else 'Sangue insuficiente ou ação inválida.'
            elif sub == 'collect_blood':
                collected = simulation.collect_blood()
                ok, err = True, None
                await ws.send_json({'type': 'action_result', 'ok': True, 'sub': sub, 'collected': collected})
                continue

            await ws.send_json({'type': 'action_result', 'ok': ok, 'sub': sub, 'error': err})

        # ── Encaminha eventos de jogo entre jogadores da sala ────
        # (canal genérico já pronto a usar quando a sincronização real
        # for implementada — por agora só reencaminha o payload tal e qual)
        elif action == 'game_event':
            if current_room:
                await broadcast_room(current_room, {
                    'type': 'game_event',
                    'from': player_id,
                    'payload': data.get('payload'),
                }, exclude=ws)

        # ── Sair da sala ──────────────────────────────────────────
        elif action == 'leave_room':
            await leave_room(ws, current_room)
            current_room = None

    # Limpeza ao desligar (fecho de separador, queda de rede, etc.)
    if current_room:
        await leave_room(ws, current_room)

    return ws


# ═══════════════════════════════════════════════════════════════════
#  ARRANQUE DO SERVIDOR
# ═══════════════════════════════════════════════════════════════════

def get_local_ip():
    """Tenta descobrir o IP local (para mostrar aos amigos na mesma rede)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


def create_app():
    app = web.Application()
    app.router.add_get('/ws', ws_handler)
    app.router.add_get('/api/leaderboard', api_get_leaderboard)
    app.router.add_post('/api/score', api_post_score)
    # Serve todos os ficheiros estáticos do jogo (.html, .js, .css)
    app.router.add_static('/', path=str(BASE_DIR), name='static', show_index=False)
    return app


if __name__ == '__main__':
    local_ip = get_local_ip()
    print('=' * 64)
    print('  VOID DEFENSE — Servidor Multiplayer')
    print('=' * 64)
    print(f'  Para ti (este PC):      http://localhost:{PORT}/login.html')
    print(f'  Amigos na mesma WiFi:   http://{local_ip}:{PORT}/login.html')
    print(f'  Amigos pela Internet:   precisas de port forward na porta {PORT}')
    print(f'                          (ou usar ngrok — ver multiplayer.html)')
    print('=' * 64)
    print('  Não feches esta janela enquanto jogarem.')
    print('=' * 64)

    app = create_app()
    web.run_app(app, host='0.0.0.0', port=PORT, print=None)
