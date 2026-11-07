// Contratos compartilhados do jogo. Toda a geometria da mesa vive em
// table.config.ts; toda constante em tuning.ts. Nada de coordenadas soltas.

export interface Vec2 {
  x: number;
  y: number;
}

export interface WallSegment {
  from: Vec2;
  to: Vec2;
  kind: "outer" | "inner" | "guide" | "curve";
}

export interface FlipperSpec {
  side: "left" | "right";
  pivot: Vec2;
  length: number;
  baseHalfWidth: number;
  tipHalfWidth: number;
  /** ângulo de repouso (radianos, CCW positivo) */
  restAngle: number;
  /** ângulo acionado (radianos) */
  upAngle: number;
}

export interface TableConfig {
  width: number;
  height: number;
  wallThickness: number;
  walls: WallSegment[];
  launchLane: { innerX: number; outerX: number; bottomY: number };
  flippers: FlipperSpec[];
  /** bola drena quando center.y < drain.y E center.x < drain.maxX */
  drain: { y: number; maxX: number };
  plunger: { spawn: Vec2 };
}

export type GameEvent =
  | { type: "ballLost"; at: Vec2 }
  | { type: "ballLaunched"; speed: number }
  | { type: "ballSpawned" };
