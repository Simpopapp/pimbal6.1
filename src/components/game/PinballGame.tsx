import { useEffect, useRef, useState } from "react";

import type { HudState } from "@/game/engine";

type EngineHandle = {
  dispose: () => void;
  start: () => void;
  setTouch: (side: "left" | "right" | "plunger", down: boolean) => void;
};

/** Tela do pinball: canvas 3D em tela cheia + HUD sobreposto (HTML/CSS com
 * tokens do design system) + controles de toque. O motor vive fora do React. */
export function PinballGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const [hud, setHud] = useState<HudState>({
    score: 0,
    balls: 3,
    ballInPlay: false,
    plunger: 0,
    message: null,
  });
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

  const touch = (side: "left" | "right" | "plunger", down: boolean) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      engineRef.current?.setTouch(side, true);
    },
    onPointerUp: () => engineRef.current?.setTouch(side, false),
    onPointerCancel: () => engineRef.current?.setTouch(side, false),
    onPointerLeave: () => engineRef.current?.setTouch(side, false),
  });

  return (
    <div className="relative h-dvh w-full touch-none overflow-hidden bg-background select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* zonas de toque: metade esquerda / direita */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-1/2" {...touch("left", true)} />
      <div aria-hidden className="absolute inset-y-0 right-0 w-1/2" {...touch("right", true)} />

      {/* área do plunger (canto inferior direito, acima da zona direita) */}
      <div
        aria-hidden
        className="absolute right-0 bottom-0 z-10 h-44 w-28"
        {...touch("plunger", true)}
      />

      {/* HUD */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
        <div className="rounded-lg border border-border bg-background/70 px-4 py-2 backdrop-blur-sm">
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Score</p>
          <p className="font-mono text-3xl leading-none font-bold text-foreground tabular-nums">
            {hud.score.toLocaleString("en-US")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/70 px-4 py-2 text-right backdrop-blur-sm">
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Ball</p>
          <p className="font-mono text-3xl leading-none font-bold text-primary tabular-nums">
            {hud.balls}
          </p>
        </div>
      </header>

      {hud.message ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 text-center">
          <span className="inline-block rounded-md bg-destructive/90 px-6 py-2 font-mono text-2xl font-black tracking-widest text-destructive-foreground uppercase shadow-lg">
            {hud.message}
          </span>
        </div>
      ) : null}

      {/* medidor de carga do plunger */}
      <div className="pointer-events-none absolute right-4 bottom-48 z-20 flex flex-col items-center gap-1">
        <div className="h-36 w-3 overflow-hidden rounded-full border border-border bg-background/70">
          <div
            className="w-full rounded-full bg-primary transition-[height] duration-75"
            style={{ height: `${Math.round(hud.plunger * 100)}%`, marginTop: "auto" }}
          />
        </div>
        <span className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase">Pull</span>
      </div>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-3">
        <p className="rounded-full bg-background/60 px-4 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
          <span className="font-semibold text-foreground">Z</span>/
          <span className="font-semibold text-foreground">←</span> left flipper ·{" "}
          <span className="font-semibold text-foreground">/</span>/
          <span className="font-semibold text-foreground">→</span> right flipper ·{" "}
          <span className="font-semibold text-foreground">Space</span> hold & release to launch
        </p>
      </footer>

      {!ready ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background">
          <p className="animate-pulse font-mono text-sm tracking-[0.35em] text-muted-foreground uppercase">
            Loading table…
          </p>
        </div>
      ) : null}
    </div>
  );
}
