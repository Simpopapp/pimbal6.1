import { describe, expect, it } from "vitest";

import { BALLS_PER_GAME, Rules } from "@/game/rules";
import { TABLE_CONFIG } from "@/game/table.config";

describe("Regras de jogo (Fase 3)", () => {
  it("lanes completas sobem o multiplicador até 5×", () => {
    const lanes = TABLE_CONFIG.rollovers.map((r) => r.id);
    const rules = new Rules(lanes.length);
    expect(rules.multiplier).toBe(1);
    // duas lanes acesas: sem multiplicador novo
    expect(rules.rollover(lanes[0]!)).toBe(false);
    expect(rules.rollover(lanes[1]!)).toBe(false);
    // terceira lane completa o banco → multiplicador 2
    expect(rules.rollover(lanes[2]!)).toBe(true);
    expect(rules.multiplier).toBe(2);
    // lanes reapagaram
    expect(rules.rollover(lanes[0]!)).toBe(false);
    expect(rules.rollover(lanes[1]!)).toBe(false);
    expect(rules.rollover(lanes[2]!)).toBe(true);
    expect(rules.multiplier).toBe(3);
  });

  it("rollovers acumulam bônus e o fim da bola aplica bônus × multiplicador", () => {
    const lanes = TABLE_CONFIG.rollovers.map((r) => r.id);
    const rules = new Rules(lanes.length);
    rules.addPoints(1000);
    rules.rollover(lanes[0]!); // 100
    rules.rollover(lanes[1]!); // 200
    expect(rules.bonusValue).toBe(300);
    rules.rollover(lanes[2]!); // +100 → 300, multiplicador sobe para 2
    expect(rules.bonusValue).toBe(600); // 300 × 2
    const result = rules.endOfBall();
    expect(result.awarded).toBe(600);
    expect(rules.score).toBe(1600);
    // bônus e multiplicador resetam para a próxima bola
    expect(rules.bonusValue).toBe(0);
    expect(rules.multiplier).toBe(1);
    expect(rules.ballNumber).toBe(2);
  });

  it("game over após 3 bolas e reinício limpa o estado", () => {
    const rules = new Rules(TABLE_CONFIG.rollovers.length);
    rules.addPoints(5000);
    for (let i = 1; i < BALLS_PER_GAME; i++) {
      const r = rules.endOfBall();
      expect(r.gameOver).toBe(false);
    }
    expect(rules.endOfBall().gameOver).toBe(true);
    expect(rules.ballsRemaining).toBe(0);
    rules.reset();
    expect(rules.score).toBe(0);
    expect(rules.ballNumber).toBe(1);
    expect(rules.ballsRemaining).toBe(BALLS_PER_GAME);
  });

  it("3 nudges rápidos disparam TILT com trava temporária", () => {
    const rules = new Rules(TABLE_CONFIG.rollovers.length);
    expect(rules.nudge(0)).toBe(false);
    expect(rules.nudge(0.5)).toBe(false);
    expect(rules.isTilted(0.6)).toBe(false);
    expect(rules.nudge(1.0)).toBe(true); // TILT
    expect(rules.isTilted(1.5)).toBe(true);
    // após a trava de 2 s (a partir de 1.0), volta ao normal
    expect(rules.isTilted(3.1)).toBe(false);
    // avisos antigos expiraram: novos nudges não herdam os anteriores
    expect(rules.nudge(3.2)).toBe(false);
  });

  it("nudges espaçados no tempo não acumulam tilt", () => {
    const rules = new Rules(TABLE_CONFIG.rollovers.length);
    expect(rules.nudge(0)).toBe(false);
    expect(rules.nudge(3)).toBe(false); // o aviso de t=0 já expirou
    expect(rules.nudge(6)).toBe(false);
    expect(rules.isTilted(6.1)).toBe(false);
  });
});
