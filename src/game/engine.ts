import { PhysicsWorld, type StepInput } from "./physics";
import { SceneRenderer } from "./render3d";
import { TABLE_CONFIG } from "./table.config";
import { TUNING } from "./tuning";

export interface HudState {
  score: number;
  balls: number;
  ballInPlay: boolean;
  /** 0..1 carga do plunger */
  plunger: number;
  message: string | null;
}

/** Dono exclusivo do requestAnimationFrame: acumulador com passo fixo de
 * 240 Hz e render interpolado. O React apenas recebe estados para o HUD. */
export class GameEngine {
  private physics: PhysicsWorld | null = null;
  private renderer: SceneRenderer | null = null;
  private rafId = 0;
  private running = false;
  private acc = 0;
  private lastTime = 0;
  private simTime = 0;
  private respawnAt: number | null = null;
  private ballsLost = 0;
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
    if (e.code === "KeyZ" || e.code === "ArrowLeft") this.input.left = true;
    if (e.code === "Slash" || e.code === "ArrowRight") this.input.right = true;
    if (e.code === "Space") this.input.plunger = true;
    this.pushHud();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "KeyZ" || e.code === "ArrowLeft") this.input.left = false;
    if (e.code === "Slash" || e.code === "ArrowRight") this.input.right = false;
    if (e.code === "Space") this.input.plunger = false;
    this.pushHud();
  };

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
    let steps = 0;
    while (this.acc >= dt && steps < TUNING.physics.maxStepsPerFrame) {
      p.step(dt, this.input);
      this.simTime += dt;
      this.acc -= dt;
      steps++;
      this.postStep();
    }
    if (steps >= TUNING.physics.maxStepsPerFrame) this.acc = 0;

    const alpha = Math.min(1, Math.max(0, this.acc / dt));
    const ball = p.getBall();
    if (ball.inPlay) r.syncBall(ball, alpha);
    else r.hideBall();
    r.syncFlippers(p.getFlipperAngles());
    r.syncPlunger(p.getPlungerCharge());
    r.render();
  };

  private postStep(): void {
    const p = this.physics;
    if (!p) return;
    for (const ev of p.takeEvents()) {
      if (ev.type === "ballLost") {
        this.ballsLost++;
        this.respawnAt = this.simTime + TUNING.physics.drain.respawnDelayS;
        this.message = "BALL LOST";
      } else if (ev.type === "ballSpawned") {
        this.message = null;
      }
    }
    if (
      this.respawnAt !== null &&
      !p.isBallInPlay() &&
      this.simTime >= this.respawnAt
    ) {
      p.respawnBall();
      this.respawnAt = null;
    }
    this.pushHud();
  }

  private pushHud(): void {
    const p = this.physics;
    if (!p) return;
    const hud: HudState = {
      score: 0,
      balls: Math.max(1, 3 - this.ballsLost),
      ballInPlay: p.isBallInPlay(),
      plunger: Math.round(p.getPlungerCharge() * 100) / 100,
      message: this.message,
    };
    const last = this.lastHud;
    if (
      last &&
      last.score === hud.score &&
      last.balls === hud.balls &&
      last.ballInPlay === hud.ballInPlay &&
      last.plunger === hud.plunger &&
      last.message === hud.message
    ) {
      return;
    }
    this.lastHud = hud;
    this.hudCb(hud);
  }
}
