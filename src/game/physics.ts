import RAPIER from "@dimforge/rapier2d-compat";

import { FlipperController } from "./flippers";
import { flipperOutline } from "./table.config";
import { TUNING } from "./tuning";
import type { GameEvent, TableConfig, Vec2 } from "./types";

export interface BallState {
  x: number;
  y: number;
  /** translação do passo anterior (interpolação do render) */
  px: number;
  py: number;
  vx: number;
  vy: number;
  inPlay: boolean;
}

export interface StepInput {
  left: boolean;
  right: boolean;
  plunger: boolean;
}

export const NO_INPUT: StepInput = { left: false, right: false, plunger: false };

let rapierReady = false;
async function ensureRapier(): Promise<void> {
  if (!rapierReady) {
    await RAPIER.init();
    rapierReady = true;
  }
}

/** Mundo de física 2D da mesa (plano inclinado simulado em 2D). Passo fixo
 * chamado pelo engine; a bola tem CCD ligado — nunca atravessa parede. */
export class PhysicsWorld {
  private world: RAPIER.World;
  private ball: RAPIER.RigidBody | null = null;
  private flippers: FlipperController[] = [];
  private events: GameEvent[] = [];
  private plungerCharge = 0;
  private plungerCharging = false;
  private ballPrev: Vec2 = { x: 0, y: 0 };
  private ballCur: Vec2 = { x: 0, y: 0 };
  private ballInPlay = false;

  private constructor(
    private readonly config: TableConfig,
    world: RAPIER.World,
  ) {
    this.world = world;
  }

  static async create(config: TableConfig): Promise<PhysicsWorld> {
    await ensureRapier();
    const world = new RAPIER.World({ x: 0, y: TUNING.physics.gravityY });
    const pw = new PhysicsWorld(config, world);
    pw.buildWalls();
    pw.buildFlippers();
    pw.spawnBall(config.plunger.spawn);
    return pw;
  }

  private buildWalls(): void {
    const t = this.config.wallThickness;
    for (const w of this.config.walls) {
      const dx = w.to.x - w.from.x;
      const dy = w.to.y - w.from.y;
      const len = Math.hypot(dx, dy);
      const mid = { x: (w.from.x + w.to.x) / 2, y: (w.from.y + w.to.y) / 2 };
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(mid.x, mid.y).setRotation(Math.atan2(dy, dx)),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(len / 2 + t / 2, t / 2)
          .setRestitution(TUNING.physics.walls.restitution)
          .setFriction(TUNING.physics.walls.friction),
        body,
      );
    }
  }

  private buildFlippers(): void {
    for (const spec of this.config.flippers) {
      this.flippers.push(new FlipperController(spec, this.world));
    }
  }

  private spawnBall(pos: Vec2): void {
    const b = TUNING.physics.ball;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y)
        .setCcdEnabled(true)
        .setLinearDamping(b.linearDamping)
        .setAngularDamping(0.6),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(b.radius)
        .setRestitution(b.restitution)
        .setFriction(b.friction)
        .setDensity(b.density),
      body,
    );
    this.ball = body;
    this.ballCur = { x: pos.x, y: pos.y };
    this.ballPrev = { x: pos.x, y: pos.y };
    this.ballInPlay = true;
    this.events.push({ type: "ballSpawned" });
  }

  /** reposiciona a bola (testes/respawn manual) */
  placeBall(pos: Vec2): void {
    if (this.ball) {
      this.world.removeRigidBody(this.ball);
      this.ball = null;
      this.ballInPlay = false;
    }
    this.spawnBall(pos);
  }

  /** recoloca a bola no plunger após drenagem */
  respawnBall(): void {
    if (this.ball) {
      this.world.removeRigidBody(this.ball);
      this.ball = null;
      this.ballInPlay = false;
    }
    this.spawnBall(this.config.plunger.spawn);
  }

  /** helper para testes: lança a bola do canal com velocidade dada */
  testLaunch(speed: number): void {
    if (!this.ball) return;
    this.ball.setLinvel({ x: 0, y: speed }, true);
  }

  step(dt: number, input: StepInput): void {
    for (const f of this.flippers) {
      f.setInput(f.spec.side === "left" ? input.left : input.right);
      f.step(dt);
    }
    this.updatePlunger(dt, input.plunger);
    this.world.timestep = dt;
    this.world.step();
    if (this.ballInPlay && this.ball) {
      const t = this.ball.translation();
      const v = this.ball.linvel();
      const speed = Math.hypot(v.x, v.y);
      const max = TUNING.physics.ball.maxSpeed;
      if (speed > max) {
        const s = max / speed;
        this.ball.setLinvel({ x: v.x * s, y: v.y * s }, true);
      }
      this.ballPrev = this.ballCur;
      this.ballCur = { x: t.x, y: t.y };
      const d = this.config.drain;
      if (t.y < d.y && t.x < d.maxX) {
        this.world.removeRigidBody(this.ball);
        this.ball = null;
        this.ballInPlay = false;
        this.events.push({ type: "ballLost", at: { x: t.x, y: t.y } });
      }
    }
  }

  private updatePlunger(dt: number, held: boolean): void {
    const b = this.ball;
    if (!b) {
      this.plungerCharging = false;
      return;
    }
    const laneX = this.config.launchLane.innerX + 0.05;
    const t = b.translation();
    const inLane = t.x > laneX && t.y < -14;
    if (held && inLane) {
      this.plungerCharging = true;
      this.plungerCharge = Math.min(
        1,
        this.plungerCharge + dt / TUNING.physics.plunger.chargeTimeS,
      );
      b.setTranslation({ x: this.config.plunger.spawn.x, y: this.config.plunger.spawn.y }, true);
      b.setLinvel({ x: 0, y: 0 }, true);
    } else if (this.plungerCharging && !held) {
      this.plungerCharging = false;
      const t2 = b.translation();
      if (t2.x > laneX && t2.y < -14) {
        const speed =
          TUNING.physics.plunger.minLaunch +
          (TUNING.physics.plunger.maxLaunch - TUNING.physics.plunger.minLaunch) *
            this.plungerCharge;
        b.setLinvel({ x: 0, y: speed }, true);
        this.events.push({ type: "ballLaunched", speed });
      }
      this.plungerCharge = 0;
    } else if (!held) {
      this.plungerCharge = 0;
    }
  }

  getBall(): BallState {
    if (!this.ballInPlay || !this.ball) {
      return { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, inPlay: false };
    }
    const v = this.ball.linvel();
    return {
      x: this.ballCur.x,
      y: this.ballCur.y,
      px: this.ballPrev.x,
      py: this.ballPrev.y,
      vx: v.x,
      vy: v.y,
      inPlay: true,
    };
  }

  isBallInPlay(): boolean {
    return this.ballInPlay;
  }

  getPlungerCharge(): number {
    return this.plungerCharge;
  }

  getFlipperAngles(): number[] {
    return this.flippers.map((f) => f.angle);
  }

  takeEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** contorno do flipper i, para o render usar a mesma geometria da física */
  flipperOutlineAt(i: number): Vec2[] {
    return flipperOutline(this.config.flippers[i]);
  }
}
