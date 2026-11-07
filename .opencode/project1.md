# PRD — Pinball 3D (referência: Space Cadet / Pinball 3D)

## Objetivo

Pinball 3D jogável no navegador, com física crível e acabamento visual no nível de um jogo comercial. Referência de sensação: Space Cadet (mesa inclinada em perspectiva, bola pesada, flippers rápidos, rampas, bumpers com feedback forte).

## Stack (fixa, não trocar)

- Vite + TypeScript
- Three.js (render) + pós-processamento (EffectComposer, UnrealBloomPass)
- Rapier 2D (@dimforge/rapier2d-compat) para a física. Pinball é física num plano inclinado: simular em 2D e renderizar em 3D. Não usar física 3D.
- Web Audio API para som (sintetizado ou samples curtos)
- Sem frameworks de UI. HUD em HTML/CSS sobre o canvas.

## Princípios inegociáveis

- **Física separada do render.** Passo fixo (ex: 240 Hz lógico), render interpolado. Nunca atrelar física ao framerate.
- **Substepping + CCD na bola.** A bola nunca pode atravessar parede ou flipper em nenhuma velocidade.
- **Tudo é dado.** Layout da mesa vive em um arquivo de configuração (table.config.ts) com coordenadas, não espalhado no código. Trocar a mesa = trocar o arquivo.
- **Unidades:** 1 unidade = 1 polegada-equivalente de mesa. Mesa ~ 20 de largura × 40 de altura, origem no centro, Y positivo para o topo. Bola com raio 0.5. Gravidade efetiva = g · sin(inclinação), inclinação ~6,5°.
- **Cada fase termina jogável.** Nada de fase que deixa o jogo quebrado.

## Fase 1 — Núcleo de física (sem arte)

Entrega: retângulo vazio com paredes, bola, gravidade inclinada, dois flippers controláveis, lançador (plunger).

- Mundo Rapier com gravidade ao longo do eixo da inclinação
- Bola: dinâmica, CCD ligado, restituição ~0.4 nas paredes, atrito baixo, damping linear mínimo
- Flippers: corpo cinemático/revoluto controlado por motor com limites de ângulo. Velocidade angular alta no acionamento (~ 0.08 s para subir), queda mais lenta. Geometria cônica (base larga, ponta estreita) como colisor.
- Plunger: carga proporcional ao tempo segurando a tecla, lança a bola pelo canal direito
- Canal de lançamento + curva superior que devolve a bola ao campo
- Drain (perda de bola) e respawn no plunger
- Controles: Z / ← flipper esquerdo, / / → flipper direito, Espaço plunger. Touch: metade esquerda/direita da tela + área de plunger.
- Câmera 3D inclinada já nesta fase (ver Fase 5 para refino), com placeholders simples (caixas e esfera)

Critério de aceite: bola rola com peso, quica de forma previsível, flipper responde instantaneamente e transfere energia à bola de forma crível, plunger lança com força proporcional à carga, bola perdida drena e respawna. Nenhum atravessamento de parede em velocidade alta.

## Fase 2 — Elementos de mesa

Entrega: mesa populada com os elementos clássicos, todos com física e pontuação.

- Bumpers (3–4, formato cogumelo): kick forte ao contato, pontos por hit
- Slingshots (2, triângulos acima dos flippers): kick angular, pontos
- Rollovers (sensores de passagem) e lanes superiores
- Drop targets (banco de 3–5 alvos que caem ao serem atingidos e resetam ao completar o banco)
- Rampas (1–2): guiam a bola por um caminho elevado e devolvem em ponto específico (física 2D com "túnel" de waypoints; render 3D mostra a rampa)
- Outlanes e inlanes com guias

Critério de aceite: cada elemento responde ao contato da bola com física correta (kick, queda, passagem) e pontua; uma partida completa usa todos os elementos sem travamentos.

## Fase 3 — Regras e pontuação

Entrega: loop de jogo completo.

- Sistema de pontos com multiplicador de bônus (aumenta por rollovers/lanes, aplica no fim da bola)
- 3 bolas por partida, contagem de bolas restantes
- Condição de fim de jogo e tela de game over com pontuação final
- Detecção de tilt/nudge (opcional, com penalidade)
- Estado de jogo centralizado (máquina de estados: título → jogando → bola perdida → game over)

Critério de aceite: partida completa do início ao fim com pontuação coerente, multiplicador funcionando, 3 bolas, game over e reinício sem recarregar a página.

## Fase 4 — Missões e combos

Entrega: objetivos que dão direção à partida.

- Sistema de missões (ex.: acertar rampa N vezes, derrubar banco de drop targets, acender todos os rollovers)
- Combos: sequências rápidas de acertos valem multiplicador temporário
- Luzes indicadoras de progresso de missão na mesa
- Recompensas: bola extra, pontos altos, liberação de multibola (física da Fase 7)

Critério de aceite: pelo menos 2 missões funcionais com início, progresso visível e recompensa; combos registram e expiram corretamente.

## Fase 5 — Visual 3D completo

Entrega: a mesa parece um produto comercial.

- Modelagem 3D da mesa: playfield com textura/arte, paredes, elementos com geometria própria (bumpers cilíndricos com capa, flippers cônicos, rampas com tubos/trilhos)
- Materiais: playfield com textura, plásticos translúcidos, metal na bola (env map), borracha nos posts
- Iluminação: luz ambiente + spots sobre os elementos, GI falso com lightmap ou emissivos
- Pós-processamento: bloom nos elementos acesos, leve vinheta, tone mapping
- Câmera: inclinada seguindo a bola sutilmente (pan vertical suave), opção de visão fixa da mesa inteira
- Cenário ao redor: mesa dentro de um gabinete escuro com gradiente, partículas de fundo

Critério de aceite: screenshot da mesa em jogo é visualmente rico (densidade de elementos, profundidade, brilho nos lugares certos) e mantém 60 fps em notebook mediano.

## Fase 6 — Game feel (juice)

Entrega: cada ação tem resposta sensorial.

- Partículas em impacto de bumper, slingshot, rampa completa, drop target caindo
- Screen shake proporcional à força do impacto (curto, amortecido)
- Hit-stop de 1–2 frames em impactos fortes
- Flash de luz nos elementos atingidos, com decaimento
- Texto flutuante de pontos na posição do impacto
- Som por evento: flipper (clique seco), bumper (pitch varia por combo), slingshot, rampa, drop target, bola perdida, bola extra, ambiente de fundo em loop baixo
- Vibração no mobile (Vibration API) em impactos
- Animações de display: HUD com contagem rolante de pontos, mensagens grandes de evento ("RAMP COMPLETE", "MULTIBALL")

Critério de aceite: ao jogar sem som e depois com som, a diferença é enorme. Nenhum impacto forte acontece "mudo" ou "parado".

## Fase 7 — Profundidade de jogo

Entrega: motivo para jogar de novo.

- Multibola: ao cumprir missão, libera 2–3 bolas simultâneas (física precisa suportar várias bolas)
- Ball saver: poucos segundos de proteção após lançar a bola
- Kickback / save lane nos outlanes, ativável por missão
- Modos de missão encadeados (3–4 modos distintos com objetivo, tempo e recompensa)
- Tela de título, pausa, configurações (volume, qualidade gráfica, sensibilidade de câmera)
- Ranking local (top 10 em localStorage)
- Adaptação mobile: layout vertical em tela cheia, botões de flipper grandes, plunger por arrastar

Critério de aceite: partida de 5+ minutos sem repetição óbvia, com momentos de pico (multibola, combo alto) e fluxo claro de começo a fim.

## Ordem de dependência

Fase 1 → 2 → 3 → 4 (4 depende de 2 e 3) → 5 e 6 (podem andar em paralelo após 4) → 7 (depende de tudo).

## Regras para o agente

- Não pular fase nem misturar entregas de fases diferentes no mesmo passo
- Se a física parecer "de brinquedo" (flutuando, atravessando, quicando demais), corrigir na Fase 1 antes de seguir. Nenhuma arte compensa física ruim.
- Parâmetros de física (restituição, atrito, força dos kicks, torque do flipper) ficam centralizados em um arquivo de tuning para ajuste fino
- Ao final de cada fase, rodar o jogo e validar o critério de aceite descrito antes de avançar
