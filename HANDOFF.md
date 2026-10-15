# VOID DEFENSE — Relatório Completo de Desenvolvimento / Handoff

**Para quem lê isto:** és uma IA nova (ou nova sessão) sem memória da conversa que produziu este projeto. Este documento tenta espelhar TODO o processo de desenvolvimento, não só o estado atual — o João pediu explicitamente que fosse assim, para quem continuar perceber não só O QUE existe, mas COMO e PORQUÊ chegou a ser assim.

**Nota de honestidade sobre este documento:** esta conversa foi extremamente longa e passou por várias compactações de contexto. Para a fase mais recente (a maior parte das correções de bugs, testes, e decisões documentadas abaixo), tenho o detalhe exato — descrevo-o com precisão. Para as fases mais antigas do projeto (arquitetura inicial, primeiras versões das torres/mapas/etc.), tenho um resumo estruturado mas não o registo literal linha-a-linha de cada troca de mensagens. Onde a minha certeza é menor, digo isso explicitamente em vez de inventar detalhe que não tenho a certeza que seja exato.

---

## 1. O QUE É ESTE PROJETO

**Void Defense** é um jogo tower defense isométrico 2.5D (Canvas HTML5), feito em JavaScript puro (sem frameworks no cliente), com um backend Python (aiohttp) opcional para multiplayer cooperativo e leaderboard.

**Contexto crítico:** isto é o **PAP** (Prova de Aptidão Profissional) do João — o projeto final de um curso profissional em Portugal (tipicamente 12º ano). Vai ser **apresentado e avaliado formalmente**. O João pediu explicitamente que no futuro vai querer ajuda a:
- **Preparar uma apresentação** sobre este projeto (provavelmente slides — a decidir formato quando ele pedir)
- **Escrever o relatório da PAP** (o documento formal que acompanha a apresentação/defesa do projeto)

Quando ele pedir isto, não é uma tarefa de programação — é escrita/comunicação sobre o trabalho já feito. Vais precisar de perceber bem este projeto (lendo este documento e o código) para conseguires explicar as decisões técnicas de forma clara para um júri que pode não ser 100% técnico.

**Deployment:**
- Repositório GitHub, jogo publicado via GitHub Pages em: `jao5555.github.io/PAP/login.html`
- Base de dados: Supabase, projeto em `supabase.com/dashboard/project/wwawwsaiibtxwrwdjzbe` — URL do projeto conhecido, chave `anon`/API key NÃO fornecida ainda. Não integres nada a sério sem pedir essa chave primeiro.
- Servidor multiplayer corre localmente no PC do João (`server/server.py`, Python/aiohttp). Para amigos jogarem por fora da rede local, precisa de port-forward ou ngrok (já documentado dentro de `multiplayer.html`).

---

## 2. HISTÓRICO — COMO O PROJETO CHEGOU A ESTE PONTO

(Resumo estrutural das fases anteriores — não literal, mas fiel ao que aconteceu)

1. **Fase inicial:** o jogo começou como um protótipo mais simples, provavelmente num único ficheiro HTML, com mecânicas base de tower defense.
2. **Migração para arquitetura multi-ficheiro (v5):** o código foi reorganizado na estrutura atual (js/config.js, js/tower.js, js/enemy.js, etc.) para ser mais fácil de manter e expandir — esta é a versão sobre a qual todo o trabalho recente foi feito.
3. **Expansão de conteúdo:** ao longo do desenvolvimento foram adicionados progressivamente: mais tipos de torre (chegando aos 11 atuais, incluindo torres exclusivas de montanha — Artilharia/Observador), mais tipos de inimigo (chegando aos 7 atuais, incluindo o Ninja invisível e o Voador resistente a área), 4 mapas distintos, sistema de Codex/conquistas, sistema de perfis locais, sistema de itens de campo, e por fim a infraestrutura multiplayer cooperativa.
4. **Pipeline de modelos 3D (Meshy.ai):** foi decidido gerar modelos 3D reais (GLB) para substituir eventualmente as formas geométricas Canvas atuais. Foram escritos 17 prompts (7 inimigos + 10 torres) respeitando o limite de geração do Meshy.ai. O João já recebeu e já foram processados (decimação de malha, ~279k para ~4k triângulos por modelo) os primeiros 10 modelos (todos os 7 inimigos + Pistola/Sniper/Minigun). Faltam 7 modelos de torres. Os modelos otimizados estão em models/optimized/ mas ainda não estão integrados no motor de jogo — o jogo continua a usar geometria Canvas, não os GLB.
5. **Sessão de "limpeza visual"** — antes da sessão mais recente, houve trabalho dedicado a reduzir ruído visual: texturas do mapa (relva/caminho) foram simplificadas, cores do HUD foram unificadas (só se usa cor onde há informação real a transmitir, não decorativamente). O João continua a achar a interface confusa mesmo depois disto — ver secção 7, pendência #9.
6. **Sessão mais recente (esta, mais detalhada abaixo):** focou-se em (a) construir e testar rigorosamente o backend multiplayer cooperativo de ponta a ponta, (b) uma ronda grande de correção de bugs reportados pelo João depois de testar no GitHub Pages real, (c) balanceamento económico, (d) preparação de infraestrutura para integrações externas futuras (Supabase/webhooks).

---

## 3. ARQUITETURA COMPLETA DE FICHEIROS

```
void-defense-v5/
├── index.html            Capa/ecrã inicial (animado, título do jogo, sem lógica de jogo)
├── login.html             Seleção/criação de perfil local — SEM password ainda (ver pendência #1)
├── menu.html               Menu principal: separadores Jogar / Equipamento / Loja / Manual
├── game.html               O JOGO (single-player) — canvas + HUD + modais HTML sobrepostos
├── multiplayer.html      Lobby de salas coop (criar/entrar com código) + leaderboard + jogo coop ao vivo
├── admin.html               Painel admin (editar preços, créditos, torres desbloqueadas) — login: Dev_Ori123
├── HANDOFF.md               Este ficheiro
├── start_server.bat       Launcher Windows — instala aiohttp automaticamente se faltar, corre server.py
├── css/style.css           CSS base partilhado entre páginas
├── js/
│   ├── config.js             FONTE DA VERDADE de todo o balanceamento — TW_DEF (torres), EN_DEF (inimigos),
│   │                         MAPS (4 mapas), WAVES (8 ondas), ITEM_DEFS, BLOOD_USES, DIFF (dificuldades)
│   ├── utils.js                Matemática isométrica (U.iso projeta grelha->ecrã, U.inv o inverso,
│   │                         U.diaDist para dano em área em forma de diamante, não círculo)
│   ├── particles.js          Sistema de partículas (PS) — explosões, texto flutuante de dano/gold,
│   │                         gotas de sangue coletáveis
│   ├── items.js                Sistema de itens de campo (ITEMS) — drops aleatórios de inimigos mortos:
│   │                         Núcleo de Energia, Bolsa de Ouro, Sobrecarga, Granada de Gelo, Ogiva Aérea,
│   │                         Kit Médico. Testado com 6 testes comportamentais.
│   ├── map.js                   Renderização isométrica do mapa — 4 mapas (Deserto/Labirinto/Espiral/
│   │                         Montanha), tiles especiais (montanha = só Artilharia/Observador, pedra =
│   │                         destrutível por ouro)
│   ├── codex.js                 Enciclopédia + conquistas (CODEX) — 18 entradas (11 torres + 7 inimigos),
│   │                         19+ conquistas incluindo as ligadas ao sistema de itens
│   ├── enemy.js                 Classe Enemy — 7 tipos, animação de andar procedural (balanço de
│   │                         pernas/braços via seno), Ninja fica invisível a menos que um Observador
│   │                         esteja por perto, Voador resiste 45% a dano de área
│   ├── tower.js                 Classe Tower — 11 tipos, torreta roda suavemente para o alvo,
│   │                         auras entre torres de suporte (Commander=dano, DJ Booth=velocidade,
│   │                         Observador=deteção do Ninja)
│   ├── projectile.js          Classe Proj — balas/granadas/mísseis, dano em área calculado como
│   │                         diamante (não círculo) para bater certo com a grelha isométrica
│   ├── economy.js             Ouro/Energia/Sangue (ECO) — energia só drena ao ritmo total quando a
│   │                         torre tem alvo ATIVO; torres sem alvo drenam só 15% do custo
│   ├── waves.js                  Sistema de 8 ondas (WV) — spawn temporizado por grupos, skip (para
│   │                         reforços futuros mas NÃO apaga inimigos já no mapa), bónus de rapidez
│   ├── save.js                   Save/load local (3 slots) — guarda mapa/dificuldade/torres/economia
│   ├── profile.js               Perfis locais (PROFILE) — trocar de "conta" no mesmo dispositivo,
│   │                         SEM password ainda (crypto.subtle.digest SHA-256 já confirmado que
│   │                         funciona tanto em Node como browser, mas a implementação real não foi
│   │                         feita — ver pendência #1)
│   └── ui.js                      Painel direito do jogo desenhado no canvas (Ondas/Sangue/Estatísticas)
└── server/
    ├── server.py               Servidor aiohttp — ficheiros estáticos, leaderboard REST API
    │                         (GET/POST /api/score, /api/leaderboard), WebSocket de salas multiplayer
    │                         (/ws) com sistema completo de lobby (criar sala, entrar com código,
    │                         ready-up, lista de jogadores)
    ├── simulation.py        Motor de jogo AUTORITATIVO para o modo cooperativo — espelha TODA a lógica
    │                         de game.js/tower.js/enemy.js/economy.js/waves.js em Python, usando os
    │                         MESMOS números que o cliente (via game_data.json). Corre a 15 ticks/seg,
    │                         testado com ligações WebSocket reais entre 2 jogadores simultâneos.
    ├── integrations.py      NOVO nesta sessão — esqueleto/estrutura para ligações externas futuras
    │                         (Supabase, webhooks, outras APIs). Ver secção 6.
    └── game_data.json     Extração automática de config.js (via Node vm) — garante que o servidor
                              Python usa exatamente os mesmos números do cliente JS. REGENERAR sempre
                              que config.js for editado (comando no fim desta secção).
```

Comando para regenerar game_data.json depois de editar config.js:
```
node -e "var vm=require('vm'),fs=require('fs'); var sb={}; vm.createContext(sb); vm.runInContext(fs.readFileSync('js/config.js','utf8'),sb); fs.writeFileSync('server/game_data.json', JSON.stringify(sb.C,null,2));"
```

---

## 4. VALORES ATUAIS DE BALANCEAMENTO (config.js)

Aplicado nesta sessão, depois do João achar a economia desequilibrada:

| Torre | Custo | Torre | Custo |
|---|---|---|---|
| Pistola | $90 | Commander | $460 |
| Sniper | $260 | DJ Booth | $430 |
| L.Granada | $210 | Gerador | $320 |
| Morteiro | $370 | Artilharia | $480 |
| Minigun | $400 | Observador | $300 |
| L.Chamas | $290 | | |

- Ouro por zombie morto: 8 (era 12)
- Ouro inicial por dificuldade (DIFF.startGold) — não foi tocado, só custo de torres e ritmo de ganho por kill
- Se o João continuar a achar desequilibrado, a próxima coisa a ajustar é provavelmente DIFF.startGold ou goldM por dificuldade — não repetir o aumento de custo de torres sem ele pedir explicitamente outra vez

---

## 5. TODOS OS BUGS ENCONTRADOS E CORRIGIDOS NESTA SESSÃO — DETALHE COMPLETO

Cada um destes foi encontrado por auditoria de código depois do João reportar sintomas no jogo real (testado por ele em jao5555.github.io/PAP), e corrigido + testado com uma metodologia concreta (não só inspeção visual do código). Ver secção 8 para as ferramentas de teste usadas.

### Bug 1 — Clique não funcionava na barra de tropas (só teclas 1-5 funcionavam)
- Sintoma reportado: "para selecionar uma torre dentro do jogo e preciso utilizar as teclas... quero que dê com as teclas e clicando lá"
- Causa raiz: setInterval(updateTroopBar, 100) em game.html destruía e recriava TODOS os elementos DOM da barra a cada 100ms (bar.innerHTML = '' seguido de recriação). Se o gesto de clique (mousedown->mouseup, tipicamente 80-200ms) calhasse a meio de um destes ciclos, o elemento onde o utilizador tinha carregado desaparecia antes do evento click disparar. Intermitente, difícil de notar por inspeção — só aparece sob teste real de timing.
- Correção: separei construção do DOM (buildTroopBar(), só corre quando o loadout muda de facto) de atualização visual (refreshTroopBarVisuals(), corre a cada 100ms, só mexe em className/textContent/style de elementos JÁ EXISTENTES, nunca os recria).
- Teste: instalei jsdom (via npm, não persiste entre sessões de terminal — reinstalar sempre que precisares), extraí o script REAL de game.html, criei um DOM real com o HTML real do jogo, e simulei a condição de corrida exata (chamar refreshTroopBarVisuals() a meio de um gesto de clique). Confirmei: elemento permanece o MESMO objeto através de 50 atualizações consecutivas; clique sobrevive a um refresh a meio do gesto; mudar de loadout ainda reconstrói corretamente quando precisa.
- Bug secundário encontrado ao testar isto: a variável troopBarLoadoutSig começava a null mas só era definida dentro do caminho condicional de refreshTroopBarVisuals() — a chamada inicial incondicional a buildTroopBar() no fundo do ficheiro não a definia, causando UMA reconstrução extra e desnecessária logo a seguir ao carregamento da página. Corrigido trocando a chamada inicial de buildTroopBar() para refreshTroopBarVisuals() (que já trata da construção inicial sozinha via o mesmo caminho condicional).

### Bug 2 — Sistema de upgrade "quebrado" (exatamente o mesmo padrão de bug, sítio diferente)
- Sintoma reportado: "o sistema de upgrade está quebrado este bug ainda acontece"
- Causa raiz: idêntica ao Bug 1, mas em syncUpgradeModal() — fazia body.innerHTML = '...' com botões onclick="..." inline a cada 100ms via setInterval(syncUpgradeModal, 100), destruindo os botões UPGRADE/VENDER pelo mesmo motivo.
- Correção: reescrevi para construir os 3 "formatos" possíveis do corpo do modal (torre de suporte / nível máximo / normal-com-upgrade) UMA VEZ, com botões persistentes usando addEventListener (não onclick inline), e a função que corre a cada 100ms só alterna qual bloco está visível (style.display) e atualiza texto dentro dos blocos, nunca recria os botões.
- Teste: mesma metodologia jsdom — extraí o corpo HTML real + script real, testei 50 sincronizações consecutivas confirmando o mesmo elemento de botão, testei o clique real disparar ECO.spend+t.upgrade(), simulei a condição de corrida exata, e testei alternar entre torre de suporte/normal/nível-máximo sem recriar nada.

### Bug 3 — "Tudo desaparece" e não recupera nem com "retomar"
- Sintoma reportado: ecrã fica em branco/congelado, persiste mesmo depois de tentar retomar o jogo. Reportado como acontecendo especialmente "quando começo a colocar várias tropas".
- Causa raiz (confirmada por análise, não por reprodução direta — ver nota abaixo): o loop principal (G._loop em game.js) chamava this._update(dt) e this._draw(this.ctx) sem qualquer proteção contra exceções. Se QUALQUER destas funções lançasse uma exceção não apanhada, a linha seguinte (requestAnimationFrame(...)) nunca executava — o loop de animação morria PARA SEMPRE. Nenhuma ação do utilizador (incluindo "retomar") consegue reviver um loop requestAnimationFrame morto, porque não há nenhum código a correr para responder a esse clique.
- Correção: envolvi _update/_draw num try/catch. Se uma exceção ocorrer, é apanhada, mostrada NO ECRÃ (mensagem + primeira linha da stack trace) em vez de morrer em silêncio, e o loop CONTINUA a tentar o frame seguinte (requestAnimationFrame continua a ser chamado independentemente do resultado do try/catch).
- Teste: forcei exceções deliberadas em frames específicos e confirmei que requestAnimationFrame continua a ser chamado em TODOS os frames seguintes, mesmo com erros a repetir-se.
- ISTO É UMA REDE DE SEGURANÇA, NÃO A CORREÇÃO DA CAUSA RAIZ. Não sei qual é a exceção exata que estava a acontecer — não consegui reproduzir o cenário específico do João (colocar várias tropas) sem um browser real. A próxima vez que isto acontecer, o overlay de erro vai mostrar a mensagem exata — pede ao João print disso e usa essa informação para corrigir a causa raiz real. Ver também secção 7 pendência #10 (performance com muitos inimigos), que pode estar relacionada.

### Bug 4 — Skip de onda apagava TODOS os inimigos (devia só parar reforços futuros)
- Sintoma/pedido: "quando dou skip na onda ele apaga todos os inimigos e apenas manda os da próxima onda quando deveria de manter os dessa onda"
- Causa: WV.skip() em waves.js fazia G.enemies.length = 0 — apagava tudo instantaneamente. O comportamento desejado é: parar de gerar MAIS inimigos dessa onda, mas deixar os que já estão no mapa continuarem a ter de ser combatidos normalmente (mortos ou a chegarem à base).
- Correção: removida a linha que limpa G.enemies. Agora skip() só marca todos os grupos de spawn como concluídos (g.done = true / g.spawned = g.count), impedindo reforços futuros, mas os inimigos já spawnados sobrevivem e a onda só "acaba de vez" quando forem todos derrotados ou alcançarem a base (verificação normal de canEnd()).
- Aplicado em DOIS sítios para consistência: js/waves.js (single-player) E server/simulation.py (multiplayer coop) — testado nos dois motores separadamente.
- Texto da UI atualizado: o botão dizia "SALTAR ONDA (sem bónus)", agora diz "PARAR REFORÇOS (sem bónus)" para refletir o comportamento real. O texto do tutorial inicial também foi atualizado.

### Bug 5 — Energia esvaziava-se mesmo com torres paradas, sem inimigos por perto
Corrigido numa sessão anterior a esta mais recente, documentado aqui porque é relevante para perceber o estado atual de economy.js. Torres agora só pagam o custo TOTAL de energia quando têm um alvo ativo (tower.tgt definido); sem alvo, pagam só 15% do custo listado ("standby"). Torres de suporte (aura contínua) não entram nesta redução — pagam sempre o custo cheio, porque o efeito delas está sempre ativo independentemente de haver inimigos por perto.

### Bug 6 — Mapa não persistia corretamente ao continuar um save (confirmado e corrigido nesta sessão)
- Sintoma reportado: "agora eu voltei para o menu cliquei em continuar partida... também mudei de mapa ou seja precisas de colocar algo para guardar o mapa"
- Causa raiz: em game.js, startGame(diff, fromLoad, mapKey) só chamava MAP.init(mapKey) dentro do bloco if (!fromLoad). Ou seja, ao CONTINUAR um save (fromLoad = true), a grelha do mapa (MAP.grid, MAP.currentMap) nunca era reinicializada para bater com o mapa guardado — ficava com o que estivesse carregado antes. O jogo "achava" (via G.selectedMap) que estava no mapa certo, mas a grelha real usada para posicionar torres e traçar o caminho dos inimigos era outra — dessincronização silenciosa.
- Correção: movida a chamada MAP.init(mapKey) para fora do condicional — corre sempre, tanto em jogo novo como ao continuar um save.
- Teste: simulei isoladamente o fluxo startGame('normal', false, 'desert') seguido de startGame('hard', true, 'montanha'), rastreando todas as chamadas a MAP.init(). Confirmado: MAP.currentMap acaba corretamente em 'montanha' depois do segundo startGame.

### Bug 7 (menor, cosmético) — Falso positivo na verificação de balanço de divs
Ao validar game.html antes de empacotar, o meu script simples de contagem de tags (grep -o '<div' vs grep -o '</div>') acusou desequilíbrio. Investigação revelou: um COMENTÁRIO de JavaScript dentro de uma tag script continha literalmente o texto "<div>" como parte de uma frase explicativa, sendo contado erradamente como markup real. A estrutura HTML real estava sempre correta. Reescrevi o comentário para não conter essa substring literal. Nota para quem reusar este método: é um limite conhecido de grep simples — não distingue HTML real de texto dentro de comentários/strings em blocos script.

---

## 6. INTEGRAÇÕES EXTERNAS — server/integrations.py (NOVO)

Criado nesta sessão a pedido do João, para organizar TODA a lógica de ligação a serviços externos (bases de dados, webhooks, APIs de terceiros) num único sítio, separado da lógica do jogo em server.py.

Estado atual: esqueleto vazio, mas já ligado ao servidor. server.py importa integrations e chama integrations.register_webhook_routes(app) dentro de create_app() — atualmente não faz nada (a função está vazia, só com pass), mas a estrutura está pronta. Testado: o servidor arranca sem problemas com este import, e todas as rotas existentes continuam a responder normalmente.

O que está preparado dentro do ficheiro (documentado com exemplos de código, por implementar):
- supabase_request() — esqueleto de pedido genérico à REST API do Supabase, com aviso claro que falta a chave anon
- register_webhook_routes() — ponto único onde adicionar rotas de webhook no futuro, sem poluir server.py
- Nota de segurança explícita: nunca hardcodar chaves API no código-fonte (o repo é público), usar variáveis de ambiente

Antes de implementar isto a sério:
1. Pedir ao João a chave anon do Supabase (Project Settings -> API no dashboard dele)
2. Decidir COM ELE que tabelas a base de dados vai ter (perfis? progresso? leaderboard global?)
3. Não inventar webhooks ou integrações que ele não pediu explicitamente

---

## 7. PENDENTE — TUDO O QUE O JOÃO PEDIU E AINDA NÃO FOI FEITO

### Alta prioridade

1. Sistema de password + sessão persistente por dispositivo (perfis locais, profile.js/login.html). Já confirmei que crypto.subtle.digest('SHA-256', ...) funciona tanto em Node como em browser para hash de password (nunca guardar em texto simples). Implementação NÃO começada. Plano: campo de password opcional ao criar perfil -> hash SHA-256 guardado -> sessão "confiada" nesse dispositivo depois de login correto (localStorage) -> opção de logout/esquecer sessão por perfil.

2. Responsividade mobile/tablet/laptop/PC — "está meio horrível" no telemóvel (palavras do João). Páginas HTML simples (menu.html, login.html, multiplayer.html, index.html) são mais fáceis (flexbox/grid + media queries). game.html (canvas fixo 1280x720 com escala proporcional) é o mais difícil — precisa de decisão de design para portrait/ecrãs pequenos.

3. Seletor de idioma + menu de configurações (som, efeitos, outros). Não existe nada disto ainda. Precisa de sistema de i18n (dicionário PT/EN pelo menos) + painel de definições novo.

4. Sons/efeitos sonoros — o João quer que a IA os faça. Não há ferramenta de geração de áudio neste ambiente. Abordagem viável: sintetizar via Web Audio API (osciladores/ruído programático — técnica legítima, sem precisar de ficheiros de áudio externos). Não começado.

5. Câmara com órbita/zoom — "andar à volta do mapa... fazer zoom e outros". A projeção isométrica é atualmente fixa (fórmula em utils.js). Zoom é relativamente simples (fator de escala). Rotação em incrementos de 90° é mais trabalho (troca de que eixo da grelha mapeia para X/Y no ecrã). Não começado.

6. Mini-janela "estilo Opera GX" — já existe uma versão em-página (botão MINI-JANELA em game.html, arrastável/redimensionável DENTRO do browser). O João parece querer mais forte: flutuar por CIMA de outras janelas/apps do sistema operativo. Existe API real para isto no Chrome — Document Picture-in-Picture API (documentPictureInPicture.requestWindow()), permite HTML arbitrário numa janela verdadeiramente flutuante ao nível do SO. Implementar como progressive enhancement. Não começado.

7. Login/registo "a sério" ligado a Supabase — distinto dos perfis locais atuais. Precisa da chave anon (ver secção 6). Decisão a tomar com o João: perfis locais e contas Supabase coexistem, ou uma substitui a outra?

8. Animações/parallax no menu e outras partes do jogo — mais movimento/vida visual: camadas de fundo a velocidades diferentes ao fazer scroll/hover (parallax), transições animadas entre ecrãs/abas, hover states mais elaborados, fundo animado mais rico na capa (index.html). Maioritariamente CSS. Não começado.

9. Interface dentro do jogo (game.html) continua confusa — já houve uma sessão de limpeza visual anterior e o João continua a pedir mais. Antes de adivinhar o que ainda está confuso e repetir trabalho já feito sem resolver o problema real, pede exemplos concretos (screenshot + apontar) ao João.

10. Performance/congelamento com muitos inimigos — sintoma: "eu comecei a colocar várias tropas e bugou de novo" / jogo congela com muitos inimigos no ecrã. Investigação feita nesta sessão (sem conseguir reproduzir/testar num browser real — ambiente sem Playwright funcional):
    - Onda 8 gera 140 inimigos ao longo da onda, em 7 grupos com spawns simultâneos a intervalos de 0.3-0.7s — se as torres não derem conta, dezenas podem estar vivas ao mesmo tempo.
    - Enemy.drw() tem cerca de 97 operações de desenho por inimigo, incluindo 14 chamadas a shadowBlur (operação conhecida por ser cara em Canvas 2D). Tower.drw() tem 19 chamadas a shadowBlur.
    - Com 40-60 inimigos simultâneos num momento mau da onda 8, isto facilmente ultrapassa alguns milhares de operações de canvas por frame — hipótese plausível para quebra de framerate que se sente como "congelar".
    - NÃO tentei uma correção às cegas — sem conseguir testar visualmente numa render real, o risco de piorar sem saber é alto. Hipóteses concretas para a próxima IA (que deve ter acesso a browser real): (a) reduzir/tornar condicional o uso de shadowBlur por inimigo (talvez só em Boss/Tank), (b) LOD — desenho mais simples quando há muitos inimigos ao mesmo tempo, (c) usar DevTools de Performance do browser para confirmar onde o tempo está mesmo a ir antes de otimizar às cegas.
    - A rede de segurança do Bug 3 já devia impedir que isto pareça "desaparecer para sempre" — se ainda assim continuar a parecer um crash total, o overlay de erro deve mostrar a exceção real da próxima vez.

11. Modo de ondas infinitas — pedido novo do João. Depois da onda 8, permitir continuar indefinidamente com ondas geradas processualmente. Considerações de design por resolver: é um modo separado selecionável no menu, ou a campanha continua para "infinito" depois da onda 8? Fórmula de escala necessária. IMPORTANTE: este modo está diretamente ligado à pendência #10 (performance) — um modo infinito vai eventualmente gerar mais inimigos simultâneos do que a onda 8 alguma vez gera. Recomendo resolver ou mitigar #10 antes de ou em conjunto com construir #11.

### Modelos 3D (Meshy.ai)
LEMBRETE EXPLÍCITO — O JOÃO PEDIU PARA NUNCA SE ESQUECER DISTO: só pode fazer 10 downloads por mês no Meshy.ai. Já tem 10 de 17 (7 inimigos completos + Pistola/Sniper/Minigun). Faltam 7 torres: Morteiro, Lança-Chamas, Commander, DJ Booth, Artilharia, Observador, Gerador. Prompts já foram dados ao João em mensagens anteriores desta conversa. Nunca sugerir gastar downloads sem necessidade.

Modelos já recebidos: decimados (~279k para ~4k triângulos) em models/optimized/, ainda não integrados no motor de jogo (continua tudo em geometria Canvas). Integração é trabalho substancial (provavelmente migração para Three.js), não começada.

### Modo Competitivo (PvP)
Só existe a infraestrutura de sala (criar sala modo 'pvp', entrar, ready-up) em server.py. A MECÂNICA de jogo (como funciona "enviar inimigos ao adversário", duas bases separadas, condição de vitória) não está desenhada nem implementada. Precisa de conversa de design com o João antes de codificar.

### Futuro conhecido (já avisado, não é para já)
- Ajuda a preparar uma apresentação sobre o projeto (provavelmente slides)
- Ajuda a escrever o relatório da PAP (documento formal da avaliação)

---

## 8. METODOLOGIA DE TESTE ESTABELECIDA — SEGUE ISTO

O João valoriza correções pequenas e específicas, não reescritas completas de ficheiros. Quando fores mexer em código:

- Testa antes de dizeres que algo está corrigido. Este projeto tem histórico de bugs subtis (condições de corrida, valores dessincronizados entre ficheiros) que só apareceram através de testes reais, nunca só por inspeção visual do código.
- Ferramentas usadas nesta sessão, todas funcionais neste tipo de ambiente sandboxed:
  - node -c ficheiro.js — sintaxe
  - node com vm.createContext() — testar lógica isolada com stubs mínimos das dependências
  - jsdom (npm install jsdom — não persiste entre sessões de terminal separadas, reinstala sempre que precisares na MESMA sessão onde vais correr o teste) — para testar DOM real quando o bug envolve cliques/elementos HTML. Extrai o script REAL do ficheiro .html (via regex) em vez de reescrever à mão.
  - Para o servidor: corre python3 server.py & em background e testa com websockets/curl reais — tudo isto tem de acontecer NA MESMA chamada de bash, processos em segundo plano não sobrevivem entre chamadas de ferramentas separadas
  - Instalação de dependências Python (pip install aiohttp websockets --break-system-packages) também não persiste entre sessões
- Playwright/browser headless NÃO funciona neste ambiente (a rede bloqueia o download do Chromium) — para bugs que precisam mesmo de um browser real a renderizar, não vais conseguir testar aqui. Sê honesto sobre essa limitação em vez de fingir que testaste.
- Quando encontrares um bug ao testar (vais encontrar — aconteceu várias vezes nesta sessão, incluindo bugs nos MEUS próprios testes/stubs, não só no código do jogo), corrige e volta a testar.

---

## 9. PRÓXIMOS PASSOS SUGERIDOS (ordem razoável)

1. Implementa o sistema de password/sessão em profile.js + login.html (secção 7, #1)
2. Pergunta ao João pela chave anon do Supabase se for avançar com contas reais (secção 6)
3. Decide com o João qual login "vence" — perfis locais, Supabase, ou os dois coexistem
4. Antes de mexer na interface do jogo outra vez (#9), pede exemplos concretos ao João
5. Investiga a performance com muitos inimigos (#10) — idealmente com browser real e DevTools — antes ou em conjunto com construir o modo infinito (#11)
6. Ataca responsividade mobile primeiro nas páginas simples, depois decide estratégia para game.html
7. Animações/parallax (#8) combinam bem com o trabalho de responsividade
8. Language selector + settings panel podem ser construídos juntos
9. Sons via Web Audio API síntese
10. Câmara orbital/zoom, modo infinito (depois de #5), e PvP ficam para depois
11. Quando o João pedir ajuda com a apresentação/relatório da PAP, isso é trabalho de comunicação, não código

Boa sorte. O João é um aluno esforçado a construir isto sozinho para o projeto final dele — trata isto com o cuidado que merece.
