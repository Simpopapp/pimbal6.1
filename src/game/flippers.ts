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

  constructor(
    readonly spec: FlipperSpec,
    world: RAPIER.World,
  ) {
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
    world.createCollider(
      hull.setRestitution(0.2).setFriction(0.6),
      this.body,
    );
  }

  setInput(down: boolean): void {
    this.pressed = down;
  }

  step(dt: number): void {
    const target = this.pressed ? this.spec.upAngle : this.spec.restAngle;
    const delta = target - this.angle;
    let w = 0;
    if (delta > 0) {
      w = Math.min(delta / dt, TUNING.physics.flipper.raiseSpeed);
    } else if (delta < 0) {
      w = Math.max(delta / dt, -TUNING.physics.flipper.fallSpeed);
    }
    // rapier2d: angvel é escalar
    this.body.setAngvel(w, true);
  }

  get angle(): number {
    return this.body.rotation();
  }
}
