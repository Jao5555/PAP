"""
VOID DEFENSE — Integrações Externas (Base de Dados, Webhooks, APIs)
═══════════════════════════════════════════════════════════════════
Este ficheiro é o local ÚNICO onde deve viver toda a lógica de ligação
a serviços externos: Supabase (base de dados), webhooks recebidos de
fora, e qualquer outra API de terceiros que o projeto venha a precisar.

PORQUÊ EXISTE ESTE FICHEIRO SEPARADO (em vez de meter tudo em server.py):
  - server.py trata da lógica DO JOGO (salas, leaderboard local, etc.)
  - Este ficheiro trata de tudo o que fala com o MUNDO EXTERIOR
  - Mantém as responsabilidades separadas — mais fácil de testar,
    mais fácil de desligar/religar uma integração sem mexer no resto
  - Se um serviço externo mudar de API ou cair, o dano fica contido aqui
  - Torna óbvio, só de olhar para a estrutura de ficheiros, ONDE
    procurar quando algo relacionado com um serviço externo parte

ESTADO ATUAL: nada disto está ligado a sério ainda. É a estrutura/
esqueleto, pronta a preencher. NÃO INVENTES integrações que o João não
pediu — isto existe para organizar o que ele vier a pedir, não para tu
decidires sozinho que serviços externos o projeto "deveria" ter.

O QUE FALTA ANTES DE QUALQUER COISA AQUI FUNCIONAR A SÉRIO:
  1. A chave 'anon' do projeto Supabase — só temos o URL do projeto
     (https://wwawwsaiibtxwrwdjzbe.supabase.co), falta a API key.
     PERGUNTA AO JOÃO por ela antes de tentar ligar isto a sério.
  2. Decidir COM O JOÃO que tabelas/esquema a base de dados vai ter
     (perfis de utilizador? progresso guardado? leaderboard global?
     scores por modo de jogo?)
  3. Se webhooks vierem a ser necessários, decidir de onde e porquê
     (ex: notificações, integração com outro serviço) — não inventar
     isto sem o João pedir explicitamente.

SEGURANÇA — importante: se este repositório for público no GitHub
(é — está em jao5555.github.io/PAP), NUNCA hardcodes chaves API
diretamente no código-fonte. Usa variáveis de ambiente (os.environ)
ou um ficheiro .env local adicionado ao .gitignore. A chave 'anon' do
Supabase é normalmente segura para expor no cliente (é feita para
isso, tem Row Level Security a proteger os dados), mas outras chaves
(ex: 'service_role' do Supabase, que ignora RLS) NUNCA devem ir para
um repositório público nem para código que corre no browser.
═══════════════════════════════════════════════════════════════════
"""

import os

# ═══════════════════════════════════════════════════════════════════
#  SUPABASE — base de dados
# ═══════════════════════════════════════════════════════════════════
# Projeto do João: https://wwawwsaiibtxwrwdjzbe.supabase.co

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://wwawwsaiibtxwrwdjzbe.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')  # None até estar definida


def supabase_configured():
    """Verifica se há chave configurada, sem rebentar se não houver."""
    return SUPABASE_ANON_KEY is not None


async def supabase_request(session, method, table, **kwargs):
    """
    Esqueleto de um pedido genérico à REST API do Supabase.
    'session' é um aiohttp.ClientSession já aberto (reutiliza o mesmo
    padrão já usado no resto do servidor, não abras uma sessão nova
    por pedido).

    POR IMPLEMENTAR — exemplo de como isto deve ficar quando a chave
    anon estiver disponível:

        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
            'Content-Type': 'application/json',
        }
        url = f'{SUPABASE_URL}/rest/v1/{table}'
        async with session.request(method, url, headers=headers, **kwargs) as resp:
            return await resp.json()

    Exemplos de uso futuro (uma vez implementado):
        await supabase_request(session, 'GET', 'profiles', params={'id': f'eq.{user_id}'})
        await supabase_request(session, 'POST', 'scores', json={'name': name, 'score': score})
    """
    if not supabase_configured():
        raise RuntimeError(
            'SUPABASE_ANON_KEY não está definida. Pede ao João a chave '
            '\'anon\' do projeto Supabase (dashboard → Project Settings → '
            'API) antes de usar isto. Não inventes/adivinhes a chave.'
        )
    raise NotImplementedError('Por implementar — ver exemplo no docstring acima.')


# ═══════════════════════════════════════════════════════════════════
#  WEBHOOKS — receber notificações de serviços externos
# ═══════════════════════════════════════════════════════════════════
# Se um serviço externo precisar de AVISAR o teu servidor de algo
# (ex: um pagamento, uma ação noutro sistema), regista a rota aqui.
#
# Esqueleto de como um handler de webhook deve ficar:
#
#   async def handle_algum_webhook(request):
#       payload = await request.json()
#       # IMPORTANTE: valida sempre a assinatura/segredo do webhook
#       # antes de confiar no payload — qualquer um pode fazer POST
#       # para um endpoint público se não houver validação.
#       # TODO: processar payload conforme o serviço que o enviou
#       return web.json_response({'ok': True})

def register_webhook_routes(app):
    """
    Chamado a partir de server.py::create_app() para registar rotas de
    webhook, se/quando existirem. Por agora não regista nada — este
    é o ÚNICO sítio a mexer quando um webhook for necessário, para
    server.py não ficar poluído com lógica de serviços externos.

    Exemplo de como usar quando tiveres um webhook real:
        app.router.add_post('/webhook/nome-do-servico', handle_algum_webhook)
    """
    pass  # TODO: nada registado ainda — não inventar rotas sem pedido explícito


# ═══════════════════════════════════════════════════════════════════
#  OUTRAS APIS DE TERCEIROS (espaço reservado)
# ═══════════════════════════════════════════════════════════════════
# Qualquer outro serviço externo (email, notificações push, analytics,
# etc.) que o João venha a pedir deve ter a lógica de ligação aqui
# também, seguindo o mesmo padrão: função async, token via variável
# de ambiente, nunca hardcoded no código-fonte, nunca inventado sem
# pedido explícito do João.
