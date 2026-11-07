# Roadmap — Pinball 3D (proj1)

Fases em ordem de dependência. Gates por fase: build + tipos + lint + testes de física + browser. Marcar `[x]` só com gates verdes.

## Fase 1 — Núcleo de física (sem arte) — CONCLUÍDA 2026-11-07

- [x] deps: three, @dimforge/rapier2d-compat, @types/three
- [x] src/game/{types,tuning,table.config}.ts (contratos fundação)
- [x] física: mundo Rapier, gravidade inclinada 43,7 u/s², bola c/ CCD, paredes restituição 0,4
- [x] flippers cinemáticos (subida ~0,08 s, descida lenta, geometria cônica) — pontas varrem para DENTRO
- [x] plunger com carga proporcional (90–155 u/s, escala real) + canal + curva superior
- [x] drain + respawn no plunger
- [x] input: Z/←, /→, Espaço; touch metade esquerda/direita + plunger
- [x] render 3D inclinado com placeholders + loop 240 Hz interpolado
- [x] rota `/` substitui placeholder; HUD mínimo (score, bolas)
- [x] testes: queda livre g_eff ✓ · sem atravessamento ✓ · drain/respawn ✓ · flipper sobe ✓ · flipper chuta ✓
- Gates: build OK · tipos OK (oj typecheck limpo) · lint 0 erros · 6/6 testes · browser sem erro de console (screenshots em /tmp/browser/pinball)
- Correções registradas: plunger em escala real (90–155 u/s); canal sai em y=8 (bolso na curva prendia a bola); guias ~15° até os flippers; pontas dos flippers para dentro.

## Fase 2 — Elementos de mesa

- [ ] bumpers 3–4 (kick forte + pontos), slingshots 2 (kick angular)
- [ ] rollovers + lanes superiores (sensores, pontos)
- [ ] drop targets (banco 3–5, reset ao completar)
- [ ] rampa(s) com túnel de waypoints (física 2D, render 3D)
- [ ] outlanes/inlanes com guias
- [ ] teste: cada elemento pontua e responde; partida usa todos sem travar
- Gates: build OK · tipos OK · lint OK · testes verdes · browser

## Fase 3 — Regras e pontuação

- [ ] state.ts: máquina title→playing→ball_lost→game_over (+paused)
- [ ] pontos + multiplicador de bônus (rollovers/lanes), aplica no fim da bola
- [ ] 3 bolas, contagem, game over, reinício sem reload
- [ ] tilt/nudge opcional com penalidade
- [ ] teste: multiplicador aplica; game over após 3 drenagens; reinício limpa estado
- Gates: build OK · tipos OK · lint OK · testes verdes · browser

## Fase 4 — Missões e combos

- [ ] missions.ts: ≥2 missões com progresso visível e recompensa
- [ ] combos com janela de tempo e multiplicador temporário
- [ ] luzes de progresso na mesa
- [ ] recompensas: bola extra, pontos, multibola (hook p/ Fase 7)
- [ ] teste: missão inicia/progresso/expira; combo expira corretamente
- Gates: build OK · tipos OK · lint OK · testes verdes · browser

## Fase 5 — Visual 3D completo

- [ ] geometria própria (bumpers capa, flippers cônicos, rampas tubo/trilho)
- [ ] materiais: playfield textura procedural, metal env map, translúcidos, borracha
- [ ] luz ambiente + spots + emissivos; bloom, vinheta, ACES
- [ ] câmera: fixa default + pan sutil seguindo bola; gabinete escuro + partículas
- [ ] screenshot rico + 60 fps alvo (qualidade configurável)
- Gates: build OK · tipos OK · lint OK · browser (screenshot verificado)

## Fase 6 — Game feel (juice)

- [ ] partículas por evento; screen shake amortizado; hit-stop 1–2 frames
- [ ] flash de luz com decaimento; texto flutuante de pontos
- [ ] áudio sintetizado por evento (flipper, bumper, slingshot, rampa, drop, drain, extra, ambiente)
- [ ] vibração mobile (Vibration API)
- [ ] HUD: contagem rolante + mensagens grandes ("RAMP COMPLETE", "MULTIBALL")
- [ ] teste: eventos de impacto emitem sinal de áudio/efeito
- Gates: build OK · tipos OK · lint OK · testes verdes · browser

## Fase 7 — Profundidade de jogo

- [ ] multibola 2–3 bolas (física N bolas) via recompensa de missão
- [ ] ball saver pós-lançamento; kickback/save lane nos outlanes
- [ ] 3–4 modos de missão encadeados (objetivo, tempo, recompensa)
- [ ] título, pausa, configurações (volume, qualidade, sensibilidade de câmera)
- [ ] ranking local top 10 (localStorage, só no cliente)
- [ ] mobile: tela cheia vertical, flipper buttons grandes, plunger por arrastar
- [ ] teste: multibola estável; saver ativa na janela; ranking persiste e ordena
- Gates: build OK · tipos OK · lint OK · testes verdes · browser

## Encerramento

- [ ] aceite global: partida 5+ min, screenshot vitrine, 60 fps, juice audível, zero atravessamento
- Próximo remix: primeira fase não concluída acima.
