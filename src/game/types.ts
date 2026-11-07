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

export interface BumperSpec {
  id: string;
  pos: Vec2;
  radius: number;
  kickSpeed: number;
}

export interface SlingshotSpec {
  id: string;
  a: Vec2;
  b: Vec2;
  c: Vec2;
  /** direção do kick (normalizada em runtime) */
  kickNormal: Vec2;
  kickSpeed: number;
}

export interface RolloverSpec {
  id: string;
  pos: Vec2;
  radius: number;
}

export interface DropTargetSpec {
  id: string;
  pos: Vec2;
  halfW: number;
  halfH: number;
}

export interface DropTargetBankSpec {
  id: string;
  targets: DropTargetSpec[];
}

export interface RampSpec {
  id: string;
  entry: { pos: Vec2; radius: number; minSpeed: number };
  waypoints: Vec2[];
  /** altura acima do playfield durante o transporte */
  height: number;
  exitSpeedFactor: number;
  minExitSpeed: number;
}

export interface TableConfig {
  width: number;
  height: number;
  wallThickness: number;
  walls: WallSegment[];
  launchLane: { innerX: number; outerX: number; bottomY: number };
  flippers: FlipperSpec[];
  bumpers: BumperSpec[];
  slingshots: SlingshotSpec[];
  rollovers: RolloverSpec[];
  dropTargetBanks: DropTargetBankSpec[];
  ramps: RampSpec[];
  /** bola drena quando center.y < drain.y E center.x < drain.maxX */
  drain: { y: number; maxX: number };
  plunger: { spawn: Vec2 };
}

export type GameEvent =
  | { type: "ballLost"; at: Vec2 }
  | { type: "ballLaunched"; speed: number }
  | { type: "ballSpawned" }
  | { type: "bumperHit"; id: string; at: Vec2 }
  | { type: "slingshotHit"; id: string; at: Vec2 }
  | { type: "rolloverHit"; id: string }
  | { type: "dropTargetHit"; bankId: string; targetId: string }
  | { type: "bankCompleted"; bankId: string }
  | { type: "rampCaptured"; id: string }
  | { type: "rampCompleted"; id: string };
