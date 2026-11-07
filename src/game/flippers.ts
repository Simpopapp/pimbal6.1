import RAPIER from "@dimforge/rapier2d-compat";

import { flipperOutline } from "./table.config";
import { TUNING } from "./tuning";
import type { FlipperSpec } from "./types";

/** Controle de um flipper: corpo cinemático por velocidade com limites de
 * ângulo. A subida é rápida (~0,08 s), a queda mais lenta; a energia chega à
 * bola pela velocidade angular do corpo no contato. */
export class FlipperController {
  readonly body: RAPIER.RigidBody;
  private pressed = false;
  /** sinal que leva do ângulo de repouso ao ângulo acionado (o flipper
   * esquerdo sobe no sentido negativo, o direito no positivo) */
  private readonly raiseSign: number;

  constructor(
    readonly spec: FlipperSpec,
    world: RAPIER.World,
  ) {
    this.raiseSign = Math.sign(spec.upAngle - spec.restAngle);
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicVelocityBased()
        .setTranslation(spec.pivot.x, spec.pivot.y)
        .setRotation(spec.restAngle),
    );
    const outline = flipperOutline(spec);
    const flat = new Float32Array(outline.length * 2);
    outline.forEach((p, i) => {
      flat[i * 2] = p.x;
      flat[i * 2 + 1] = p.y;
    });
    const hull = RAPIER.ColliderDesc.convexHull(flat);
    if (!hull) throw new Error("flipper convex hull inválido");
    world.createCollider(hull.setRestitution(0.2).setFriction(0.25), this.body);
  }

  setInput(down: boolean): void {
    this.pressed = down;
  }

  step(dt: number): void {
    const target = this.pressed ? this.spec.upAngle : this.spec.restAngle;
    const delta = target - this.angle;
    const towardUp = delta * this.raiseSign > 0;
    const maxV = towardUp ? TUNING.physics.flipper.raiseSpeed : TUNING.physics.flipper.fallSpeed;
    const w = Math.max(-maxV, Math.min(maxV, delta / dt));
    // rapier2d: angvel é escalar
    this.body.setAngvel(w, true);
  }

  get angle(): number {
    return this.body.rotation();
  }
}
