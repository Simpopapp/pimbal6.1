// Toda constante de física/visual do jogo. Ajuste fino acontece AQUI, nunca
// espalhado no código. Unidade: 1 u = 1 polegada de mesa.

const DEG = Math.PI / 180;
/** 1 g em polegadas/s² (a unidade do jogo é polegada, não metro) */
const G_IN_PER_S2 = 386.09;

export const INCLINE_DEG = 6.5;

export const TUNING = {
  physics: {
    fixedStepHz: 240,
    fixedDt: 1 / 240,
    /** limite de passos por frame para evitar spiral of death */
    maxStepsPerFrame: 10,
    inclineDeg: INCLINE_DEG,
    /** g efetiva ao longo da mesa: g · sin(inclinação) ≈ 43,7 u/s² */
    gravityY: -(G_IN_PER_S2 * Math.sin(INCLINE_DEG * DEG)),
    ball: {
      radius: 0.5,
      restitution: 0.3,
      friction: 0.05,
      linearDamping: 0.08,
      density: 1.2,
      maxSpeed: 260,
    },
    walls: { restitution: 0.4, friction: 0.05 },
    flipper: {
      /** 60° em ~0,08 s ≈ 13,1 rad/s */
      raiseSpeed: Math.PI / 3 / 0.08,
      /** queda mais lenta: 60° em ~0,26 s */
      fallSpeed: Math.PI / 3 / 0.26,
    },
    plunger: {
      chargeTimeS: 1.15,
      // bola real deixa o plunger a ~2-4 m/s ≈ 90-160 in/s
      minLaunch: 90,
      maxLaunch: 155,
    },
    drain: { respawnDelayS: 1.0 },
    elements: {
      bumperCooldownS: 0.12,
      slingshotCooldownS: 0.25,
      rolloverCooldownS: 0.4,
      dropTargetCooldownS: 0.2,
      rampEntryCooldownS: 1.0,
    },
  },
  visual: {
    tableTiltDeg: INCLINE_DEG,
    colors: {
      bg: 0x05060c,
      playfield: 0x0d1226,
      playfieldAccent: 0x131b38,
      wall: 0x39456e,
      guide: 0x274a5e,
      flipper: 0xe8535f,
      ball: 0xdfe4ee,
      plunger: 0x38d9f0,
    },
    camera: {
      fov: 40,
      position: [0, 27, 31] as const,
      lookAt: [0, 0, 1] as const,
    },
  },
} as const;
