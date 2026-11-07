# PRD — Pinball 3D (derivado de project1.md, v1)

> Fonte de verdade do "como": decisões técnicas, escopo por fase e critérios de aceite.
> Precedência de escopo: project1.md (planejamento) > este PRD > roadmap-proj1.md.

## 1. Visão do produto

Um pinball 3D jogável no navegador com física crível e acabamento visual comercial.
Sensação de referência: **Space Cadet (Full Tilt! Pinball)** — mesa inclinada em
perspectiva, bola com peso, flippers rápidos e precisos, rampas, bumpers com
feedback forte. A partira completa tem loop fechado: título → jogo → game over →
reinício, com missões, combos, multibola e ranking local.

## 2. Ambiente confirmado no código (fatos, não suposições)

- Projeto **TanStack Start v1**: React 19, Vite 8, TypeScript estrito, Tailwind v4
  (tokens em `src/styles.css`, tudo em oklch), roteamento file-based em
  `src/routes/`. `src/routeTree.gen.ts` é gerado — nunca editar.
- O jogo é **100% client-side** (render + física + áudio no browser). Nenhum dado
  de jogo vai ao servidor; não há necessidade de Lovable Cloud nesta fase. O
  ranking da Fase 7 usa `localStorage` (leitura/escrita apenas em `useEffect`).
- `src/routes/index.tsx` está como placeholder e será substituído pela tela do
  jogo (o jogo vive em `/`). `head()` do `__root.tsx` contém metadados genéricos
  que serão substituídos por metadados do pinball.
- `src/routes/__root.tsx` deve continuar renderizando `<Outlet />`; o jogo é
  montado por `<ClientOnly>` para não rodar WebGL/Rapier no SSR.
- Fonts remotas (se usadas) entram por `<link>` no `head()` da raiz — nunca
  `@import` de URL remoto no CSS.
- Pacotes a instalar: `three`, `@dimforge/rapier2d-compat`, tipos `@types/three`.
  O wrapper `@lovable.dev/vite-tanstack-config` já injeta os plugins — não
  adicionar plugins Vite manualmente.

## 3. Decisões técnicas (o "como")

### 3.1 Stack

| Papel | Escolha | Por quê |
|---|---|---|
| Render 3D | Three.js (+ `EffectComposer`/`UnrealBloomPass` na Fase 5) | padrão de mercado, maduro em Vite |
| Física | `@dimforge/rapier2d-compat` | pinball é física em plano inclinado: simular 2D e renderizar 3D; `compat` embute o WASM em base64, funciona no bundle Vite sem fetch externo |
| Áudio | Web Audio API (síntese) | zero assets externos, latência baixa |
| HUD | HTML/CSS sobre o canvas (sem framework de UI do jogo) | conforme planejamento; usa tokens do design system |
| Estado | módulo de estado próprio (máquina de estados) | sem React re-renderizando o loop de física |

Nunca trocar Three.js/Rapier por alternativas; nunca usar física 3D.

### 3.2 Unidades e escala

- 1 unidade = 1 polegada-equivalente de mesa. Mesa ~20 de largura × 40 de altura,
  origem no centro, Y positivo para o topo.
- Bola: raio 0,5 u (~1" de diâmetro, como a bola real de 1 1/16").
- Gravidade efetiva ao longo da inclinação: `g_eff = 386,09 · sin(inclinação)`
  u/s² (a unidade é polegada, não metro). Com inclinação 6,5° → **≈ 43,7 u/s²**.
  Isto é crítico: usar 9,81 daria uma bola flutuante de brinquedo.
- Velocidade de lançamento do plunger: 200–320 u/s conforme a carga.
- Todas as constantes de tuning vivem em `src/game/tuning.ts` (nada de números
  mágicos espalhados).

### 3.3 Loop de simulação

- Física separada do render: **passo fixo de 240 Hz** (dt = 1/240 s) com
  acumulador; render interpolado entre o estado anterior e o atual da bola.
- **Substepping + CCD ligado na bola** (Rapier `setCcdEnabled(true)`): a bola
  nunca atravessa parede nem flipper em nenhuma velocidade.
- Velocidade máxima de segurança (clamp de velocidade da bola) registrada no
  tuning; se o teste de penetração falhar, reduzir o clamp antes de mexer no
  timestep.
- O loop vive fora do React (classe `GameEngine`); o React só monta/desmonta e
  reflete o HUD via assinatura de eventos (score, bolas, mensagens).

### 3.4 Flippers

- Corpos **cinemáticos** controlados por set-rotation/velocity por passo (motor
  com limites de ângulo). Subir em ~0,08 s (ω ≈ 11–13 rad/s), descer mais lento
  (~3× mais lento). Geometria cônica: base larga junto ao pivô, ponta estreita
  (colisor por convex hull ou série de cápsulas).
- Energia transferida à bola: velocidade linear do ponto de contato via
  velocidade angular do flipper (crível, não "explosiva").
- Cooldown de acionamento mínimo para evitar jitter de tecla.

### 3.5 Plunger e canal de lançamento

- Carga proporcional ao tempo segurando a tecla (Espaço / área de toque),
  com curva de carga (rápida no início, saturando) e lança pelo canal direito.
- Canal direito + curva superior devolvem a bola ao campo (paredes do config).
- Drain (perda de bola): sensor no fundo central → bola removida → respawn no
  plunger após breve pausa.

### 3.6 Elementos de mesa (Fase 2)

- **Bumpers** (3–4, cogumelo): círculo estático com sensores + kick forte
  (impulso normalizado na direção bola→bumper invertida + velocidade mínima de
  saída), pontos por hit.
- **Slingshots** (2 triângulos acima dos flippers): kick angular, pontos.
- **Rollovers/lanes**: sensores de passagem (áreas); ligam/desligam luz, pontos,
  completar todos dá multiplicador.
- **Drop targets**: banco de 3–5 alvos dinâmico-estático que somem ao hit e
  resetam ao completar o banco.
- **Rampas (1–2)**: física 2D com "túnel" de waypoints — a bola entra por um
  sensor, é transportada por caminho parametrizado (velocidade constante) e
  devolvida em ponto de saída. Render 3D desenha a rampa com tubos/trilhos.
- **Outlanes/inlanes** com guias (paredes do config).

### 3.7 Regras (Fase 3)

- Máquina de estados central: `title → playing → ball_lost → game_over`
  (+ `paused`). Estados em `src/game/state.ts`, eventos para o HUD.
- Multiplicador de bônus acumulado por rollovers/lanes, aplicado no fim da bola.
- 3 bolas por partida; contagem no HUD; game over com pontuação final.
- Tilt/nudge opcional: acionável com limite, penalidade (desligar flippers
  2 s) ao exceder.

### 3.8 Missões e combos (Fase 4)

- Missões como objetos `{ id, objetivo, progresso, recompensa }`; pelo menos 2
  funcionais (ex.: acertar rampa N vezes; derrubar banco de drop targets;
  acender todos os rollovers).
- Combos: janela de tempo entre acertos; multiplica temporariamente.
- Recompensas: bola extra, pontos altos, liberação de multibola.
- Luzes de progresso: emissivos na mesa + HUD.

### 3.9 Visual (Fase 5)

- Playfield com textura procedural (Canvas 2D → texture), paredes, bumpers
  cilíndricos com capa, flippers cônicos, rampas com tubos.
- Materiais: metal na bola (env map procedural), plásticos translúcidos,
  borracha nos posts.
- Iluminação: ambiente + spots por elemento; emissivos como GI falso.
- Pós: bloom nos acesos, vinheta leve, tone mapping ACES.
- Câmera inclinada (fixa da mesa inteira é a default; pan vertical sutil
  seguindo a bola é a opção "dinâmica").
- Cenário: gabinete escuro com gradiente, partículas de fundo.

### 3.10 Game feel (Fase 6)

- Partículas em impactos, screen shake amortizado, hit-stop 1–2 frames,
  flash de luz com decaimento, texto flutuante de pontos.
- Áudio por evento (flipper, bumper, slingshot, rampa, drop, drenagem, bola
  extra, ambiente baixo) via Web Audio sintetizado.
- Vibração no mobile (Vibration API) em impactos fortes.
- HUD com contagem rolante e mensagens grandes ("RAMP COMPLETE", "MULTIBALL").

### 3.11 Profundidade (Fase 7)

- Multibola (2–3 bolas simultâneas — a física já suporta N bolas por design).
- Ball saver pós-lançamento (janela de segundos), kickback nos outlanes.
- 3–4 modos de missão encadeados; título/pausa/configurações (volume,
  qualidade, sensibilidade de câmera).
- Ranking local (top 10 em `localStorage`, lido/escrito só no cliente).
- Mobile: layout vertical em tela cheia, botões grandes de flipper,
  plunger por arrastar.

## 4. Arquitetura de módulos e contratos

```
src/game/
├── table.config.ts     # layout da mesa: paredes, bumpers, targets, rampas (dados)
├── tuning.ts           # TODA constante de física/áudio/visual
├── types.ts            # tipos compartilhados (Vec2, elementos, eventos)
├── physics.ts          # mundo Rapier: criação a partir do config + step fixo
├── flippers.ts         # controle de flippers (ângulos, motor, cooldown)
├── plunger.ts          # carga/lançamento e canal
├── engine.ts           # loop principal (acumulador, interpolação, eventos de jogo)
├── render3d.ts         # cena Three.js construída do config + sync com física
├── effects.ts          # partículas/shake/hit-stop/flash (Fase 6)
├── audio.ts            # síntese Web Audio por evento (Fase 6+)
├── rules.ts            # pontos, multiplicador, bolas, tilt (Fase 3+)
├── missions.ts         # missões/combos (Fase 4+)
├── state.ts            # máquina de estados + pub/sub para o HUD
└── input.ts            # teclado + touch unificados
```

Contratos principais:

- `table.config.ts` exporta `TABLE_CONFIG: TableConfig` — a única fonte de
  geometria. Trocar a mesa = trocar o arquivo (render e física leem o mesmo
  dado; nada de coordenadas no código de lógica).
- `physics.ts` expõe `createWorld(config)`, `stepWorld(dt)`, `getBallState(id)`,
  e eventos de contato (`onContact(event)`) para regras/efeitos.
- `engine.ts` é o único dono do requestAnimationFrame; expõe `start/stop`,
  `setInput`, e emite eventos de estado para o HUD.
- Todos os módulos importam de `types.ts`; nenhum importa diretamente de outro
  além do fluxo `engine → physics/render/rules`.

## 5. Gates de verificação (obrigatórios por fase)

1. **Build verde** (o build do projeto roda automaticamente; conferir
   `/tmp/observability/build-errors.log` sem erros).
2. **Tipos** estritos sem erro (`oj typecheck -b --noEmit` quando aplicável).
3. **Lint** (`bun run lint`) sem erro novo.
4. **Testes**: testes de física em `src/game/__tests__/physics.test.ts`
   (vitest + jsdom): (a) bola em queda livre ganha velocidade compatível com
   g_eff; (b) a bola nunca atravessa a parede em velocidade máxima (CCD);
   (c) drain detecta e respawna. Um teste por regra, executado antes de marcar
   fase no roadmap.
5. **Browser (Playwright)**: página carrega sem erro de console, canvas
   renderiza, controles respondem (screenshot em `/tmp/browser/`).

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Bola atravessa flipper em alta velocidade | CCD + substepping + clamp de velocidade; teste de regressão dedicado |
| Física "de brinquedo" (flutuante) | g_eff em polegadas (43,7 u/s²), tuning centralizado; ajuste antes da Fase 2 |
| WASM do Rapier no SSR | import do jogo atrás de `<ClientOnly>` + `React.lazy`; nada de Rapier no grafo SSR |
| Interpolação com artefatos | guardar posição anterior/atual da bola por passo; render lerp |
| Performance em notebook mediano | bloom só na Fase 5 com opção de qualidade; geometria low-poly; draw calls agrupados |

## 7. Estratégia de enxame (subagentes)

- Ondas: **Onda 0 (fundação, agente principal)** — deps + tipos + tuning +
  table.config + esqueleto de física/render/engine; contratos fixados antes de
  qualquer paralelo.
- Ondas seguintes (spawn_agent, nunca `oc`): pacotes verticais independentes
  com dono exclusivo de arquivos — ex.: elementos de mesa (Fase 2), regras
  (Fase 3), missões (Fase 4), visual (Fase 5), juice (Fase 6), profundidade
  (Fase 7). Cada subagente recebe os 3 pilares centrais + os 3 pilares próprios
  em `.opencode/work/sub/{K}/` e não toca arquivos de outro.
- Todo relato de subagente é verificado no disco + gates antes de marcar `[x]`.
- Se o remix terminar antes do roadmap completo, deixar o roadmap com o estado
  exato e a linha "Próximo remix: …".

## 8. Aceite global do produto

- Partida de 5+ minutos com começo→fim coerente (3 bolas, multiplicador,
  missões, multibola, game over, reinício sem recarregar a página).
- Screenshot da mesa em jogo com densidade e brilho dignos de vitrine; 60 fps
  em notebook mediano.
- Nenhum impacto forte "mudo" ou "parado" (juice da Fase 6).
- Zero atravessamento de parede/flipper em qualquer velocidade (Fase 1, sempre).
