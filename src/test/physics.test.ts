import { describe, expect, it } from "vitest";

import { PhysicsWorld, type StepInput } from "@/game/physics";
import { TABLE_CONFIG } from "@/game/table.config";
import { TUNING } from "@/game/tuning";

const DT = 1 / TUNING.physics.fixedStepHz;
const NO_INPUT: StepInput = { left: false, right: false, plunger: false };

function runSteps(pw: PhysicsWorld, seconds: number, input: StepInput = NO_INPUT) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) pw.step(DT, input);
}

describe("Pinball physics (Fase 1)", () => {
  it("bola em queda livre acelera próximo de g·sin(inclinação)", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    pw.placeBall({ x: 0, y: 12 });
    runSteps(pw, 0.5);
    const v = pw.getBall();
    const expected = 386.09 * Math.sin((TUNING.physics.inclineDeg * Math.PI) / 180) * 0.5;
    expect(v.vy).toBeLessThan(0);
    expect(Math.abs(v.vy)).toBeGreaterThan(expected * 0.8);
  }, 30000);

  it("bola nunca atravessa paredes, mesmo na velocidade máxima do plunger", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    pw.testLaunch(TUNING.physics.plunger.maxLaunch);
    let sim = 0;
    let drains = 0;
    while (sim < 8) {
      pw.step(DT, NO_INPUT);
      sim += DT;
      if (pw.isBallInPlay()) {
        const b = pw.getBall();
        // fora desses limites a bola atravessou alguma parede
        expect(b.x).toBeGreaterThanOrEqual(-10.51);
        expect(b.x).toBeLessThanOrEqual(10.51);
        expect(b.y).toBeGreaterThanOrEqual(-20.6);
        expect(b.y).toBeLessThanOrEqual(20.6);
      } else {
        drains++;
        pw.respawnBall();
        pw.testLaunch(TUNING.physics.plunger.maxLaunch);
      }
    }
    expect(drains).toBeGreaterThan(0);
  }, 60000);

  it("drain detecta a perda e o respawn recoloca a bola no plunger", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    pw.placeBall({ x: 0, y: -16 });
    let lost = false;
    for (let i = 0; i < 240 && !lost; i++) {
      pw.step(DT, NO_INPUT);
      lost = !pw.isBallInPlay();
    }
    expect(lost).toBe(true);
    pw.respawnBall();
    expect(pw.isBallInPlay()).toBe(true);
    expect(pw.getBall().y).toBeGreaterThan(-19.6);
  }, 30000);

  it("flipper sobe até o limite em ~0,1 s ao ser acionado", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    const upAngle = TABLE_CONFIG.flippers[0].upAngle;
    const input: StepInput = { ...NO_INPUT, left: true };
    runSteps(pw, 0.2, input);
    const angle = pw.getFlipperAngles()[0];
    expect(Math.abs(angle - upAngle)).toBeLessThan(0.05);
  }, 30000);

  it("flipper transfer energia à bola (chuta para cima)", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    // bola caindo sobre o meio do flipper esquerdo, acionado no mesmo instante
    pw.placeBall({ x: -2.2, y: -15.5 });
    const startY = pw.getBall().y;
    let maxY = startY;
    const input: StepInput = { ...NO_INPUT, left: true };
    for (let i = 0; i < Math.round(0.4 / DT); i++) {
      pw.step(DT, input);
      if (!pw.isBallInPlay()) break;
      const b = pw.getBall();
      if (b.y > maxY) maxY = b.y;
    }
    expect(maxY - startY).toBeGreaterThan(1.5);
  }, 30000);
});
