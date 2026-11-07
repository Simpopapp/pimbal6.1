// Layout da mesa — ÚNICA fonte de geometria (física e render leem isto).
// Trocar a mesa = trocar este arquivo. Coordenadas: origem no centro,
// Y positivo para o topo. Mesa ~20 × 40 u (1 u = 1 polegada).

import type {
  BumperSpec,
  DropTargetBankSpec,
  FlipperSpec,
  RampSpec,
  RolloverSpec,
  SlingshotSpec,
  TableConfig,
  Vec2,
  WallSegment,
} from "./types";

const DEG = Math.PI / 180;

const HALF_W = 10;
const HALF_H = 20;
const LANE_INNER_X = 8.5;
const LANE_OUTER_X = HALF_W;
const LANE_BOTTOM_Y = -HALF_H;
const FLIPPER_PIVOT_X = 4.4;
const FLIPPER_PIVOT_Y = -15.0;
const FLIPPER_LEN = 4.2;
const FLIPPER_SWEEP = 30 * DEG;

/** arco aproximado por segmentos retos */
function arc(
  cx: number,
  cy: number,
  r: number,
  a0Deg: number,
  a1Deg: number,
  steps: number,
): WallSegment[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (a0Deg + ((a1Deg - a0Deg) * i) / steps) * DEG;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return polyline(pts, "curve");
}

function polyline(pts: Vec2[], kind: WallSegment["kind"]): WallSegment[] {
  const segs: WallSegment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    segs.push({ from: a, to: b, kind });
  }
  return segs;
}

function seg(from: Vec2, to: Vec2, kind: WallSegment["kind"]): WallSegment {
  return { from, to, kind };
}

export const TABLE_CONFIG: TableConfig = {
  width: HALF_W * 2,
  height: HALF_H * 2,
  wallThickness: 0.3,
  walls: [
    // curva superior externa: (-10,10) → ápice (0,20) → (10,10)
    ...arc(0, 10, 10, 180, 0, 16),
    seg({ x: -10, y: 10 }, { x: -10, y: -13.5 }, "outer"), // parede esquerda
    seg({ x: 10, y: 10 }, { x: 10, y: -20 }, "outer"), // parede direita (canal)
    seg({ x: 10, y: -20 }, { x: LANE_INNER_X, y: -20 }, "outer"), // piso do canal
    seg({ x: LANE_INNER_X, y: -20 }, { x: LANE_INNER_X, y: 8 }, "inner"), // parede interna do canal
    // curva do canal: (8.5,8) → (4.5,12), tangente horizontal no fim
    ...arc(4.5, 8, 4, 0, 90, 10),
    ...polyline(
      [
        { x: 4.5, y: 12 },
        { x: 0.5, y: 12 },
      ],
      "inner",
    ), // guia de saída do canal
    // guias inferiores até os flippers (inclinação ~15° para a bola rolar)
    ...polyline(
      [
        { x: -10, y: -13.5 },
        { x: -4.45, y: -15.0 },
      ],
      "guide",
    ),
    ...polyline(
      [
        { x: LANE_INNER_X, y: -13.5 },
        { x: 4.45, y: -15.0 },
      ],
      "guide",
    ),
    // divisórias de outlane (selam o canal externo; a bola que cai do lado de
    // fora drena)
    ...polyline(
      [
        { x: -7.7, y: -14.1 },
        { x: -7.3, y: -16.6 },
      ],
      "guide",
    ),
    ...polyline(
      [
        { x: 7.7, y: -13.8 },
        { x: 7.35, y: -16.6 },
      ],
      "guide",
    ),
  ],
  launchLane: { innerX: LANE_INNER_X, outerX: LANE_OUTER_X, bottomY: LANE_BOTTOM_Y },
  flippers: [
    {
      // pivô junto à parede esquerda; a ponta varre para dentro (direita-baixo)
      side: "left",
      pivot: { x: -FLIPPER_PIVOT_X, y: FLIPPER_PIVOT_Y },
      length: FLIPPER_LEN,
      baseHalfWidth: 0.55,
      tipHalfWidth: 0.28,
      restAngle: -FLIPPER_SWEEP,
      upAngle: FLIPPER_SWEEP,
    },
    {
      side: "right",
      pivot: { x: FLIPPER_PIVOT_X, y: FLIPPER_PIVOT_Y },
      length: FLIPPER_LEN,
      baseHalfWidth: 0.55,
      tipHalfWidth: 0.28,
      restAngle: FLIPPER_SWEEP,
      upAngle: -FLIPPER_SWEEP,
    },
  ],
  bumpers: [
    { id: "bumper-a", pos: { x: -3.5, y: 6.5 }, radius: 1.15, kickSpeed: 95 },
    { id: "bumper-b", pos: { x: 0, y: 9.5 }, radius: 1.15, kickSpeed: 95 },
    { id: "bumper-c", pos: { x: 3.5, y: 5.5 }, radius: 1.15, kickSpeed: 95 },
  ] satisfies BumperSpec[],
  slingshots: [
    {
      id: "sling-left",
      a: { x: -6.6, y: -12.6 },
      b: { x: -4.3, y: -13.4 },
      c: { x: -5.2, y: -11.5 },
      kickNormal: { x: 0.33, y: 0.94 },
      kickSpeed: 85,
    },
    {
      id: "sling-right",
      a: { x: 6.6, y: -12.6 },
      b: { x: 4.3, y: -13.4 },
      c: { x: 5.2, y: -11.5 },
      kickNormal: { x: -0.33, y: 0.94 },
      kickSpeed: 85,
    },
  ] satisfies SlingshotSpec[],
  rollovers: [
    { id: "lane-l", pos: { x: -4, y: 15.8 }, radius: 0.55 },
    { id: "lane-c", pos: { x: 0, y: 16.6 }, radius: 0.55 },
    { id: "lane-r", pos: { x: 4, y: 15.8 }, radius: 0.55 },
  ] satisfies RolloverSpec[],
  dropTargetBanks: [
    {
      id: "bank-left",
      targets: [
        { id: "dt-1", pos: { x: -6.5, y: 3.5 }, halfW: 0.25, halfH: 0.9 },
        { id: "dt-2", pos: { x: -6.5, y: 1.5 }, halfW: 0.25, halfH: 0.9 },
        { id: "dt-3", pos: { x: -6.5, y: -0.5 }, halfW: 0.25, halfH: 0.9 },
      ],
    },
  ] satisfies DropTargetBankSpec[],
  ramps: [
    {
      id: "ramp-orbit",
      entry: { pos: { x: -8.2, y: 6 }, radius: 1.1, minSpeed: 45 },
      waypoints: [
        { x: -8.2, y: 6 },
        { x: -9.1, y: 9.5 },
        { x: -8.6, y: 13.5 },
        { x: -5.5, y: 16.8 },
        { x: -0.5, y: 18.0 },
        { x: 4.5, y: 17.2 },
        { x: 7.2, y: 14.8 },
        { x: 7.9, y: 12.2 },
      ],
      height: 2.6,
      exitSpeedFactor: 0.85,
      minExitSpeed: 55,
    },
  ] satisfies RampSpec[],
  drain: { y: -18, maxX: LANE_INNER_X - 0.15 },
  plunger: { spawn: { x: 9.25, y: -19.3 } },
};

/** Contorno cônico do flipper em coordenadas locais (pivô na origem, ponta em
 * +length no eixo x). O flipper esquerdo usa a ponta para +x (varre para
 * dentro); o direito é espelhado. */
export function flipperOutline(spec: FlipperSpec): Vec2[] {
  const { length: L, baseHalfWidth: b, tipHalfWidth: t } = spec;
  const midX = L * 0.35;
  const midW = b + (t - b) * 0.35;
  const pts: Vec2[] = [
    { x: 0, y: b },
    { x: midX, y: midW },
    { x: L, y: t },
    { x: L, y: -t },
    { x: midX, y: -midW },
    { x: 0, y: -b },
  ];
  return spec.side === "right" ? pts.map((p) => ({ x: -p.x, y: p.y })) : pts;
}
