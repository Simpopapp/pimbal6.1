// Layout da mesa — ÚNICA fonte de geometria (física e render leem isto).
// Trocar a mesa = trocar este arquivo. Coordenadas: origem no centro,
// Y positivo para o topo. Mesa ~20 × 40 u (1 u = 1 polegada).

import type { FlipperSpec, TableConfig, Vec2, WallSegment } from "./types";

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
    segs.push({ from: pts[i], to: pts[i + 1], kind });
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
    seg({ x: -10, y: 10 }, { x: -10, y: -14.6 }, "outer"), // parede esquerda
    seg({ x: 10, y: 10 }, { x: 10, y: -20 }, "outer"), // parede direita (canal)
    seg({ x: 10, y: -20 }, { x: LANE_INNER_X, y: -20 }, "outer"), // piso do canal
    seg({ x: LANE_INNER_X, y: -20 }, { x: LANE_INNER_X, y: 8 }, "inner"), // parede interna do canal
    // curva do canal: (8.5,8) → (4.5,12), tangente horizontal no fim
    ...arc(4.5, 8, 4, 0, 90, 10),
    ...polyline([{ x: 4.5, y: 12 }, { x: 0.5, y: 12 }], "inner"), // guia de saída do canal
    // guias inferiores até os flippers (inclinação ~15° para a bola rolar)
    ...polyline([{ x: -10, y: -13.5 }, { x: -4.45, y: -15.0 }], "guide"),
    ...polyline([{ x: LANE_INNER_X, y: -13.5 }, { x: 4.45, y: -15.0 }], "guide"),
  ],
  launchLane: { innerX: LANE_INNER_X, outerX: LANE_OUTER_X, bottomY: LANE_BOTTOM_Y },
  flippers: [
    {
      side: "left",
      pivot: { x: -FLIPPER_PIVOT_X, y: FLIPPER_PIVOT_Y },
      length: FLIPPER_LEN,
      baseHalfWidth: 0.55,
      tipHalfWidth: 0.28,
      restAngle: FLIPPER_SWEEP,
      upAngle: -FLIPPER_SWEEP,
    },
    {
      side: "right",
      pivot: { x: FLIPPER_PIVOT_X, y: FLIPPER_PIVOT_Y },
      length: FLIPPER_LEN,
      baseHalfWidth: 0.55,
      tipHalfWidth: 0.28,
      restAngle: -FLIPPER_SWEEP,
      upAngle: FLIPPER_SWEEP,
    },
  ],
  drain: { y: -18, maxX: LANE_INNER_X - 0.15 },
  plunger: { spawn: { x: 9.25, y: -19.3 } },
};

/** Contorno cônicco do flipper em coordenadas locais (pivô na origem,
 * ponta em +length no eixo x; espelhado para o flipper esquerdo). */
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
  return spec.side === "left" ? pts.map((p) => ({ x: -p.x, y: p.y })) : pts;
}
