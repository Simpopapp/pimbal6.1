import RAPIER from "@dimforge/rapier2d-compat";

import { FlipperController } from "./flippers";
import { flipperOutline } from "./table.config";
import { TUNING } from "./tuning";
import type {
  BumperSpec,
  DropTargetSpec,
  GameEvent,
  RampSpec,
  SlingshotSpec,
  TableConfig,
  Vec2,
} from "./types";

export interface BallState {
  x: number;
  y: number;
  /** translação do passo anterior (interpolação do render) */
  px: number;
  py: number;
  /** altura acima do playfield (0 no campo; >0 dentro da rampa) */
  h: number;
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

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const len2 = abx * abx + aby * aby;
  let u = len2 > 0 ? (apx * abx + apy * aby) / len2 : 0;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(apx - u * abx, apy - u * aby);
}

function distToRect(p: Vec2, t: DropTargetSpec): number {
  const dx = Math.max(Math.abs(p.x - t.pos.x) - t.halfW, 0);
  const dy = Math.max(Math.abs(p.y - t.pos.y) - t.halfH, 0);
  return Math.hypot(dx, dy);
}

interface RampTransport {
  spec: RampSpec;
  dist: number;
  speed: number;
  total: number;
  cum: number[];
}

/** Mundo de física 2D da mesa (plano inclinado simulado em 2D). Passo fixo
 * chamado pelo engine; a bola tem CCD ligado — nunca atravessa parede.
 * Sem DOM: roda também nos testes headless. */
export class PhysicsWorld {
  private world: RAPIER.World;
  private ball: RAPIER.RigidBody | null = null;
  private flippers: FlipperController[] = [];
  private events: GameEvent[] = [];
  private plungerCharge = 0;
  private plungerCharging = false;
  private ballPrev: Vec2 = { x: 0, y: 0 };
  private ballCur: Vec2 = { x: 0, y: 0 };
  private ballHeight = 0;
  private ballInPlay = false;
  private cooldowns = new Map<string, number>();
  private downTargets = new Set<string>();
  private rampTransport: RampTransport | null = null;
  private rampPaths = new Map<string, { cum: number[]; total: number }>();

  private constructor(
    private readonly config: TableConfig,
    world: RAPIER.World,
  ) {
    this.world = world;
    for (const ramp of config.ramps) {
      const cum: number[] = [0];
      let total = 0;
      for (let i = 0; i < ramp.waypoints.length - 1; i++) {
        const a = ramp.waypoints[i];
        const b = ramp.waypoints[i + 1];
        if (!a || !b) continue;
        total += Math.hypot(b.x - a.x, b.y - a.y);
        cum.push(total);
      }
      this.rampPaths.set(ramp.id, { cum, total });
    }
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
    this.ballHeight = 0;
    this.ballInPlay = true;
    this.events.push({ type: "ballSpawned" });
  }

  private removeBall(): void {
    if (this.ball) {
      this.world.removeRigidBody(this.ball);
      this.ball = null;
    }
    this.ballInPlay = false;
  }

  /** reposiciona a bola (testes/respawn manual) */
  placeBall(pos: Vec2): void {
    this.removeBall();
    this.rampTransport = null;
    this.spawnBall(pos);
  }

  /** recoloca a bola no plunger após drenagem */
  respawnBall(): void {
    this.removeBall();
    this.rampTransport = null;
    this.spawnBall(this.config.plunger.spawn);
  }

  /** helper para testes: lança a bola do canal com velocidade dada */
  testLaunch(speed: number): void {
    if (!this.ball) return;
    this.ball.setLinvel({ x: 0, y: speed }, true);
  }

  /** helper para testes: define a velocidade da bola */
  testSetVelocity(vx: number, vy: number): void {
    if (!this.ball) return;
    this.ball.setLinvel({ x: vx, y: vy }, true);
  }

  step(dt: number, input: StepInput): void {
    this.tickCooldowns(dt);
    for (const f of this.flippers) {
      f.setInput(f.spec.side === "left" ? input.left : input.right);
      f.step(dt);
    }
    this.updatePlunger(dt, input.plunger);
    this.world.timestep = dt;
    this.world.step();
    if (!this.ballInPlay) return;
    if (this.rampTransport) {
      this.stepRamp(dt);
      return;
    }
    if (this.ball) {
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
        this.removeBall();
        this.events.push({ type: "ballLost", at: { x: t.x, y: t.y } });
        return;
      }
      this.checkElements();
    }
  }

  private tickCooldowns(dt: number): void {
    for (const [k, v] of this.cooldowns) {
      const next = v - dt;
      if (next <= 0) this.cooldowns.delete(k);
      else this.cooldowns.set(k, next);
    }
  }

  private onCooldown(key: string): boolean {
    return this.cooldowns.has(key);
  }

  private trigger(key: string, seconds: number): void {
    this.cooldowns.set(key, seconds);
  }

  private ballPos(): Vec2 {
    return this.ballCur;
  }

  private ballVel(): Vec2 {
    if (!this.ball) return { x: 0, y: 0 };
    const v = this.ball.linvel();
    return { x: v.x, y: v.y };
  }

  /** sensores e reações dos elementos (distância + cooldown, determinístico) */
  private checkElements(): void {
    const p = this.ballPos();
    const v = this.ballVel();
    const speed = Math.hypot(v.x, v.y);
    const br = TUNING.physics.ball.radius;
    const cd = TUNING.physics.elements;

    for (const bumper of this.config.bumpers) {
      const d = Math.hypot(p.x - bumper.pos.x, p.y - bumper.pos.y);
      if (d < br + bumper.radius + 0.05 && !this.onCooldown(`bumper:${bumper.id}`)) {
        const nx = (p.x - bumper.pos.x) / (d || 1);
        const ny = (p.y - bumper.pos.y) / (d || 1);
        if (this.ball) {
          this.ball.setLinvel(
            {
              x: nx * bumper.kickSpeed + v.x * 0.2,
              y: ny * bumper.kickSpeed + v.y * 0.2,
            },
            true,
          );
        }
        this.trigger(`bumper:${bumper.id}`, cd.bumperCooldownS);
        this.events.push({
          type: "bumperHit",
          id: bumper.id,
          at: { ...bumper.pos },
        });
      }
    }

    for (const sling of this.config.slingshots) {
      const d = distToSegment(p, sling.a, sling.b);
      if (d < br + 0.12 && !this.onCooldown(`sling:${sling.id}`)) {
        const n = sling.kickNormal;
        const nl = Math.hypot(n.x, n.y) || 1;
        const kick = sling.kickSpeed;
        if (this.ball) {
          this.ball.setLinvel(
            {
              x: (n.x / nl) * kick + v.x * 0.15,
              y: (n.y / nl) * kick + v.y * 0.15,
            },
            true,
          );
        }
        this.trigger(`sling:${sling.id}`, cd.slingshotCooldownS);
        this.events.push({
          type: "slingshotHit",
          id: sling.id,
          at: { x: (sling.a.x + sling.b.x) / 2, y: (sling.a.y + sling.b.y) / 2 },
        });
      }
    }

    for (const roll of this.config.rollovers) {
      const d = Math.hypot(p.x - roll.pos.x, p.y - roll.pos.y);
      if (d < br + roll.radius && !this.onCooldown(`roll:${roll.id}`)) {
        this.trigger(`roll:${roll.id}`, cd.rolloverCooldownS);
        this.events.push({ type: "rolloverHit", id: roll.id });
      }
    }

    for (const bank of this.config.dropTargetBanks) {
      for (const target of bank.targets) {
        if (this.downTargets.has(target.id)) continue;
        const d = distToRect(p, target);
        if (d < br + 0.05 && !this.onCooldown(`dt:${target.id}`)) {
          this.trigger(`dt:${target.id}`, cd.dropTargetCooldownS);
          this.downTargets.add(target.id);
          this.events.push({
            type: "dropTargetHit",
            bankId: bank.id,
            targetId: target.id,
          });
          if (bank.targets.every((t) => this.downTargets.has(t.id))) {
            this.events.push({ type: "bankCompleted", bankId: bank.id });
            // banco completo → todos os alvos voltam
            for (const t of bank.targets) this.downTargets.delete(t.id);
          }
        }
      }
    }

    for (const ramp of this.config.ramps) {
      const d = Math.hypot(p.x - ramp.entry.pos.x, p.y - ramp.entry.pos.y);
      if (
        d < br + ramp.entry.radius &&
        speed >= ramp.entry.minSpeed &&
        !this.onCooldown(`ramp:${ramp.id}`)
      ) {
        const path = this.rampPaths.get(ramp.id);
        if (!path || path.total <= 0) continue;
        this.trigger(`ramp:${ramp.id}`, cd.rampEntryCooldownS);
        this.removeBall();
        this.ballInPlay = true; // em transporte; o render continua mostrando a bola
        this.rampTransport = {
          spec: ramp,
          dist: 0,
          speed: Math.max(speed, ramp.entry.minSpeed),
          total: path.total,
          cum: path.cum,
        };
        this.events.push({ type: "rampCaptured", id: ramp.id });
      }
    }
  }

  private stepRamp(dt: number): void {
    const rt = this.rampTransport;
    if (!rt) return;
    rt.dist += rt.speed * dt;
    const wps = rt.spec.waypoints;
    if (rt.dist >= rt.total) {
      const last = wps[wps.length - 1];
      const prev = wps[wps.length - 2];
      if (!last || !prev) return;
      const dx = last.x - prev.x;
      const dy = last.y - prev.y;
      const l = Math.hypot(dx, dy) || 1;
      const exitSpeed = Math.max(rt.speed * rt.spec.exitSpeedFactor, rt.spec.minExitSpeed);
      this.rampTransport = null;
      this.ballHeight = 0;
      this.spawnBall(last);
      this.ball?.setLinvel({ x: (dx / l) * exitSpeed, y: (dy / l) * exitSpeed }, true);
      this.events.push({ type: "rampCompleted", id: rt.spec.id });
      return;
    }
    // posição ao longo dos waypoints
    let seg = 0;
    while (seg < rt.cum.length - 1 && rt.cum[seg + 1]! < rt.dist) seg++;
    const a = wps[seg];
    const b = wps[seg + 1];
    if (!a || !b) return;
    const segLen = rt.cum[seg + 1]! - rt.cum[seg]!;
    const u = segLen > 0 ? (rt.dist - rt.cum[seg]!) / segLen : 0;
    const x = a.x + (b.x - a.x) * u;
    const y = a.y + (b.y - a.y) * u;
    this.ballPrev = this.ballCur;
    this.ballCur = { x, y };
    this.ballHeight = rt.spec.height;
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
    if (!this.ballInPlay) {
      return { x: 0, y: 0, px: 0, py: 0, h: 0, vx: 0, vy: 0, inPlay: false };
    }
    const v = this.ball ? this.ball.linvel() : { x: 0, y: 0 };
    return {
      x: this.ballCur.x,
      y: this.ballCur.y,
      px: this.ballPrev.x,
      py: this.ballPrev.y,
      h: this.ballHeight,
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

  getDropTargetsDown(): string[] {
    return [...this.downTargets];
  }

  takeEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** contorno do flipper i, para o render usar a mesma geometria da física */
  flipperOutlineAt(i: number): Vec2[] {
    const spec = this.config.flippers[i];
    if (!spec) return [];
    return flipperOutline(spec);
  }
}

// SlingshotSpec/BumperSpec ficam referenciados via config; type-only imports
// preservam a tipagem sem custo em runtime.
export type { BumperSpec, SlingshotSpec };
