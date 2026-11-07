import { useEffect, useRef, useState } from "react";

import type { HudState } from "@/game/engine";

type EngineHandle = {
  dispose: () => void;
  start: () => void;
  init: () => Promise<void>;
  setTouch: (side: "left" | "right" | "plunger", down: boolean) => void;
};

const INITIAL_HUD: HudState = {
  phase: "title",
  paused: false,
  score: 0,
  ballNumber: 1,
  ballsRemaining: 3,
  bonus: 0,
  multiplier: 1,
  ballInPlay: false,
  plunger: 0,
  message: null,
};

function pressSpace(down: boolean) {
  window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code: "Space" }));
}

/** Tela do pinball: canvas 3D em tela cheia + HUD sobreposto (HTML/CSS com
 * tokens do design system) + controles de toque. O motor vive fora do React. */
export function PinballGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let engine: EngineHandle | null = null;
    void (async () => {
      // import dinâmico: three/rapier ficam fora do grafo SSR
      const { GameEngine } = await import("@/game/engine");
      if (disposed || !canvasRef.current) return;
      engine = new GameEngine(canvasRef.current, setHud);
      engineRef.current = engine;
      await engine.init();
      if (disposed) {
        engine.dispose();
        return;
      }
      engine.start();
      setReady(true);
    })();
    return () => {
      disposed = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const touch = (side: "left" | "right" | "plunger") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      engineRef.current?.setTouch(side, true);
    },
    onPointerUp: () => engineRef.current?.setTouch(side, false),
    onPointerCancel: () => engineRef.current?.setTouch(side, false),
    onPointerLeave: () => engineRef.current?.setTouch(side, false),
  });

  const overlay = hud.phase === "title" || hud.phase === "gameOver";

  return (
    <div className="relative h-dvh w-full touch-none overflow-hidden bg-background select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* zonas de toque: metade esquerda / direita + plunger */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-1/2" {...touch("left")} />
      <div aria-hidden className="absolute inset-y-0 right-0 w-1/2" {...touch("right")} />
      <div aria-hidden className="absolute right-0 bottom-0 z-10 h-44 w-28" {...touch("plunger")} />

      {/* HUD */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        <div className="rounded-lg border border-border bg-background/70 px-4 py-2 backdrop-blur-sm">
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Score</p>
          <p className="font-mono text-3xl leading-none font-bold text-foreground tabular-nums">
            {hud.score.toLocaleString("en-US")}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border border-border bg-background/70 px-4 py-2 text-right backdrop-blur-sm">
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Bonus</p>
            <p className="font-mono text-xl leading-none font-bold text-foreground tabular-nums">
              {hud.bonus.toLocaleString("en-US")}
              <span className="ml-1 text-sm text-primary">x{hud.multiplier}</span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/70 px-4 py-2 text-right backdrop-blur-sm">
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Ball</p>
            <p className="font-mono text-3xl leading-none font-bold text-primary tabular-nums">
              {Math.min(hud.ballNumber, 3)}
              <span className="text-base text-muted-foreground">/3</span>
            </p>
          </div>
        </div>
      </header>

      {hud.message && !overlay ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 text-center">
          <span className="inline-block rounded-md bg-primary/90 px-6 py-2 font-mono text-2xl font-black tracking-widest text-primary-foreground uppercase shadow-lg">
            {hud.message}
          </span>
        </div>
      ) : null}

      {hud.paused ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <p className="font-mono text-4xl font-black tracking-[0.4em] text-foreground uppercase">
            Paused
          </p>
        </div>
      ) : null}

      {overlay && ready ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/75 backdrop-blur-sm">
          <div className="flex max-w-sm flex-col items-center gap-5 px-6 text-center">
            {hud.phase === "title" ? (
              <>
                <p className="text-[11px] tracking-[0.5em] text-muted-foreground uppercase">
                  3D Pinball
                </p>
                <h1 className="font-mono text-5xl font-black tracking-tight text-foreground uppercase">
                  Nova <span className="text-primary">Strike</span>
                </h1>
              </>
            ) : (
              <>
                <p className="text-[11px] tracking-[0.5em] text-muted-foreground uppercase">
                  Game over
                </p>
                <p className="font-mono text-5xl font-black text-foreground tabular-nums">
                  {hud.score.toLocaleString("en-US")}
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                pressSpace(true);
                pressSpace(false);
              }}
              className="rounded-full bg-primary px-8 py-3 font-mono text-sm font-bold tracking-[0.3em] text-primary-foreground uppercase transition-transform hover:scale-105"
            >
              {hud.phase === "title" ? "Start game" : "Play again"}
            </button>
            <p className="text-xs text-muted-foreground">
              Z / ← and / / → flip · hold Space to launch · Shift nudges · P pauses
            </p>
          </div>
        </div>
      ) : null}

      {/* medidor de carga do plunger */}
      <div className="pointer-events-none absolute right-4 bottom-48 z-20 flex flex-col items-center gap-1">
        <div className="flex h-36 w-3 flex-col justify-end overflow-hidden rounded-full border border-border bg-background/70">
          <div
            className="w-full rounded-full bg-primary transition-[height] duration-75"
            style={{ height: `${Math.round(hud.plunger * 100)}%` }}
          />
        </div>
        <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">Pull</span>
      </div>

      {!ready ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background">
          <p className="animate-pulse font-mono text-sm tracking-[0.35em] text-muted-foreground uppercase">
            Loading table…
          </p>
        </div>
      ) : null}
    </div>
  );
}
