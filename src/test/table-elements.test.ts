import { describe, expect, it } from "vitest";

import { PhysicsWorld, type StepInput } from "@/game/physics";
import { TABLE_CONFIG } from "@/game/table.config";
import { TUNING } from "@/game/tuning";
import type { GameEvent } from "@/game/types";

const DT = 1 / TUNING.physics.fixedStepHz;
const NO_INPUT: StepInput = { left: false, right: false, plunger: false };

function runSteps(pw: PhysicsWorld, seconds: number, input: StepInput = NO_INPUT) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) pw.step(DT, input);
}

function eventsOf(pw: PhysicsWorld): GameEvent[] {
  return pw.takeEvents();
}

describe("Elementos de mesa (Fase 2)", () => {
  it("bumper chuta a bola para longe e registra o hit", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    const bumper = TABLE_CONFIG.bumpers[0]!;
    // bola a 4 u do bumper, indo em direção a ele
    pw.placeBall({ x: bumper.pos.x + 4, y: bumper.pos.y });
    pw.testSetVelocity(-60, 0);
    let hit = false;
    let kickSpeed = 0;
    for (let i = 0; i < Math.round(1.0 / DT) && !hit; i++) {
      pw.step(DT, NO_INPUT);
      for (const ev of eventsOf(pw)) {
        if (ev.type === "bumperHit" && ev.id === bumper.id) {
          hit = true;
          const b = pw.getBall();
          kickSpeed = Math.hypot(b.vx, b.vy);
        }
      }
    }
    expect(hit).toBe(true);
    expect(kickSpeed).toBeGreaterThan(bumper.kickSpeed * 0.6);
  }, 30000);

  it("slingshot dispara quando a bola acerta a face", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    const sling = TABLE_CONFIG.slingshots[0]!;
    // bola caindo sobre a face do sling
    pw.placeBall({ x: (sling.a.x + sling.b.x) / 2, y: sling.a.y + 2.5 });
    pw.testSetVelocity(0, -40);
    let hit = false;
    for (let i = 0; i < Math.round(1.0 / DT) && !hit; i++) {
      pw.step(DT, NO_INPUT);
      hit = eventsOf(pw).some((e) => e.type === "slingshotHit" && e.id === sling.id);
    }
    expect(hit).toBe(true);
  }, 30000);

  it("rollover registra a passagem da bola", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    const roll = TABLE_CONFIG.rollovers[0]!;
    pw.placeBall({ x: roll.pos.x, y: roll.pos.y + 3 });
    pw.testSetVelocity(0, -40);
    let hit = false;
    for (let i = 0; i < Math.round(1.0 / DT) && !hit; i++) {
      pw.step(DT, NO_INPUT);
      hit = eventsOf(pw).some((e) => e.type === "rolloverHit" && e.id === roll.id);
    }
    expect(hit).toBe(true);
  }, 30000);

  it("drop targets caem ao hit e o banco completo reseta", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    const bank = TABLE_CONFIG.dropTargetBanks[0]!;
    const collected: GameEvent[] = [];
    for (const target of bank.targets) {
      pw.placeBall({ x: target.pos.x + 1.5, y: target.pos.y });
      pw.testSetVelocity(-50, 0);
      let hit = false;
      for (let i = 0; i < Math.round(1.0 / DT) && !hit; i++) {
        pw.step(DT, NO_INPUT);
        const evs = eventsOf(pw);
        collected.push(...evs);
        hit = evs.some(
          (e) => e.type === "dropTargetHit" && e.targetId === target.id,
        );
      }
      expect(hit).toBe(true);
    }
    // o último hit deve ter completado o banco (evento bankCompleted)
    expect(collected.some((e) => e.type === "bankCompleted")).toBe(true);
    // banco reseta: nenhum alvo caído
    expect(pw.getDropTargetsDown()).toHaveLength(0);
  }, 30000);

  it("rampa captura a bola, transporta e devolve com evento", async () => {
    const pw = await PhysicsWorld.create(TABLE_CONFIG);
    const ramp = TABLE_CONFIG.ramps[0]!;
    pw.placeBall({ x: ramp.entry.pos.x + 1.2, y: ramp.entry.pos.y });
    pw.testSetVelocity(-70, 20);
    let completed = false;
    let sim = 0;
    while (sim < 4 && !completed) {
      pw.step(DT, NO_INPUT);
      sim += DT;
      completed = eventsOf(pw).some(
        (e) => e.type === "rampCompleted" && e.id === ramp.id,
      );
    }
    expect(completed).toBe(true);
    // bola de volta em jogo, dentro da mesa
    expect(pw.isBallInPlay()).toBe(true);
    const b = pw.getBall();
    expect(b.x).toBeGreaterThanOrEqual(-10.5);
    expect(b.x).toBeLessThanOrEqual(10.5);
  }, 30000);
});
