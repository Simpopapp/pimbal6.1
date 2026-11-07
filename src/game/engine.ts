import { PhysicsWorld, type StepInput } from "./physics";
import { Rules } from "./rules";
import { SceneRenderer } from "./render3d";
import { GameState } from "./state";
import { TABLE_CONFIG } from "./table.config";
import { TUNING } from "./tuning";
import type { GameEvent } from "./types";

export interface HudState {
  phase: "title" | "playing" | "ballLost" | "gameOver";
  paused: boolean;
  score: number;
  ballNumber: number;
  ballsRemaining: number;
  bonus: number;
  multiplier: number;
  ballInPlay: boolean;
  /** 0..1 carga do plunger */
  plunger: number;
  message: string | null;
}

/** Pontos por evento (Fase 6 adiciona juice; valores vivem aqui por ora). */
const EVENT_POINTS: Partial<Record<GameEvent["type"], number>> = {
  bumperHit: 100,
  slingshotHit: 50,
  dropTargetHit: 50,
  bankCompleted: 500,
  rampCompleted: 1000,
};

const NUDGE_IMPULSE = 14;

/** Dono exclusivo do requestAnimationFrame e do fluxo de jogo:
 * passo fixo de 240 Hz, render interpolado e máquina de estados. */
export class GameEngine {
  private physics: PhysicsWorld | null = null;
  private renderer: SceneRenderer | null = null;
  private rules = new Rules(TABLE_CONFIG.rollovers.length);
  private state = new GameState();
  private paused = false;
  private rafId = 0;
  private running = false;
  private acc = 0;
  private lastTime = 0;
  private simTime = 0;
  private respawnAt: number | null = null;
  private message: string | null = null;
  private input: StepInput = { left: false, right: false, plunger: false };
  private lastHud: HudState | null = null;
  private hudCb: (s: HudState) => void;

  constructor(
    private canvas: HTMLCanvasElement,
    hud: (s: HudState) => void,
  ) {
    this.hudCb = hud;
  }

  async init(): Promise<void> {
    this.physics = await PhysicsWorld.create(TABLE_CONFIG);
    this.renderer = new SceneRenderer(this.canvas, TABLE_CONFIG);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.state.set("title");
    this.pushHud();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.renderer?.dispose();
    this.renderer = null;
    this.physics = null;
  }

  /** controles de toque (mobile): metades da tela + área do plunger */
  setTouch(side: "left" | "right" | "plunger", down: boolean): void {
    if (side === "left") this.input.left = down;
    else if (side === "right") this.input.right = down;
    else this.input.plunger = down;
    this.pushHud();
  }

  private startGame(): void {
    this.rules.reset();
    this.physics?.respawnBall();
    this.message = null;
    this.respawnAt = null;
    this.paused = false;
    this.state.set("playing");
    this.pushHud();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.code === "Space" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight" ||
      e.code === "KeyZ" ||
      e.code === "Slash"
    ) {
      e.preventDefault();
    }
    if (e.repeat) return;
    if (e.code === "Space") {
      if (this.state.is("title") || this.state.is("gameOver")) {
        this.startGame();
        return;
      }
      this.input.plunger = true;
    }
    if (e.code === "KeyP" && this.state.is("playing")) {
      this.paused = !this.paused;
      this.pushHud();
      return;
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      this.nudge();
      return;
    }
    if (e.code === "KeyZ" || e.code === "ArrowLeft") this.input.left = true;
    if (e.code === "Slash" || e.code === "ArrowRight") this.input.right = true;
    this.pushHud();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "KeyZ" || e.code === "ArrowLeft") this.input.left = false;
    if (e.code === "Slash" || e.code === "ArrowRight") this.input.right = false;
    if (e.code === "Space") this.input.plunger = false;
    this.pushHud();
  };

  private nudge(): void {
    if (!this.physics || !this.state.is("playing") || this.paused) return;
    const tilted = this.rules.nudge(this.simTime);
    if (tilted) {
      this.message = "TILT";
    } else {
      this.physics.applyNudge(0, NUDGE_IMPULSE);
    }
    this.pushHud();
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const p = this.physics;
    const r = this.renderer;
    if (!p || !r) return;

    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameDt > 0.1) frameDt = 0.1;
    this.acc += frameDt;

    const dt = TUNING.physics.fixedDt;
    const active = this.state.is("playing") && !this.paused;
    let steps = 0;
    if (active) {
      while (this.acc >= dt && steps < TUNING.physics.maxStepsPerFrame) {
        const tilted = this.rules.isTilted(this.simTime);
        p.step(
          dt,
          tilted ? { left: false, right: false, plunger: this.input.plunger } : this.input,
        );
        this.simTime += dt;
        this.acc -= dt;
        steps++;
        this.postStep();
      }
      if (steps >= TUNING.physics.maxStepsPerFrame) this.acc = 0;
    } else {
      this.acc = 0;
    }

    const alpha = Math.min(1, Math.max(0, this.acc / dt));
    const ball = p.getBall();
    if (ball.inPlay) r.syncBall(ball, alpha);
    else r.hideBall();
    r.syncFlippers(p.getFlipperAngles());
    r.syncPlunger(p.getPlungerCharge());
    r.syncDropTargets(p.getDropTargetsDown());
    r.render();
  };

  private postStep(): void {
    const p = this.physics;
    if (!p) return;
    for (const ev of p.takeEvents()) {
      this.rules.addPoints(EVENT_POINTS[ev.type] ?? 0);
      if (ev.type === "ballLost") {
        const result = this.rules.endOfBall();
        if (result.gameOver) {
          this.state.set("gameOver");
          this.message = `GAME OVER — ${this.rules.score.toLocaleString("en-US")}`;
        } else {
          this.state.set("ballLost");
          this.message = `BONUS +${result.awarded.toLocaleString("en-US")}`;
          this.respawnAt = this.simTime + TUNING.physics.drain.respawnDelayS;
        }
      } else if (ev.type === "rolloverHit") {
        if (this.rules.rollover(ev.id)) {
          this.message = `MULTIPLIER x${this.rules.multiplier}`;
        }
      } else if (ev.type === "bankCompleted") {
        this.message = "BANK DOWN";
      } else if (ev.type === "rampCompleted") {
        this.message = "RAMP COMPLETE";
      } else if (ev.type === "ballSpawned") {
        this.message = null;
      }
    }
    if (
      this.respawnAt !== null &&
      this.state.is("ballLost") &&
      !p.isBallInPlay() &&
      this.simTime >= this.respawnAt
    ) {
      p.respawnBall();
      this.respawnAt = null;
      this.state.set("playing");
      this.message = null;
    }
    this.pushHud();
  }

  private pushHud(): void {
    const p = this.physics;
    if (!p) return;
    const hud: HudState = {
      phase: this.state.get(),
      paused: this.paused,
      score: this.rules.score,
      ballNumber: this.rules.ballNumber,
      ballsRemaining: this.rules.ballsRemaining,
      bonus: this.rules.bonusValue,
      multiplier: this.rules.multiplier,
      ballInPlay: p.isBallInPlay(),
      plunger: Math.round(p.getPlungerCharge() * 100) / 100,
      message: this.message,
    };
    const last = this.lastHud;
    if (
      last &&
      last.score === hud.score &&
      last.ballsRemaining === hud.ballsRemaining &&
      last.ballInPlay === hud.ballInPlay &&
      last.plunger === hud.plunger &&
      last.message === hud.message &&
      last.bonus === hud.bonus &&
      last.multiplier === hud.multiplier &&
      last.paused === hud.paused
    ) {
      return;
    }
    this.lastHud = hud;
    this.hudCb(hud);
  }
}
