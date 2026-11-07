// Regras de pontuação, bônus, bolas e tilt (Fase 3). Sem dependência de
// física/DOM: testável de forma pura.

export const BALLS_PER_GAME = 3;
const BONUS_UNIT = 100;
const MAX_MULTIPLIER = 5;
const TILT_LIMIT = 3;
const TILT_LOCK_S = 2;
const TILT_WARN_TTL_S = 2.5;

export interface BallEndResult {
  awarded: number;
  multiplier: number;
  gameOver: boolean;
}

/** Pontuação e bônus de uma partida completa.
 * - rollover acende a lane e acumula unidade de bônus;
 * - todas as lanes acesas sobem o multiplicador (até 5×) e reapagam;
 * - no fim da bola: pontos += bônus × multiplicador, e ambos resetam. */
export class Rules {
  score = 0;
  ballNumber = 1;
  bonusUnits = 0;
  multiplier = 1;
  tiltLockedUntil = 0;
  private litLanes = new Set<string>();
  private tiltWarnings: number[] = [];

  constructor(private laneCount: number) {}

  addPoints(points: number): void {
    this.score += points;
  }

  /** @returns true quando a lane completa subiu o multiplicador */
  rollover(id: string): boolean {
    this.bonusUnits += BONUS_UNIT;
    this.litLanes.add(id);
    if (this.litLanes.size >= this.laneCount) {
      this.multiplier = Math.min(MAX_MULTIPLIER, this.multiplier + 1);
      this.litLanes.clear();
      return true;
    }
    return false;
  }

  get bonusValue(): number {
    return this.bonusUnits * this.multiplier;
  }

  /** fim da bola: aplica bônus e avança a contagem */
  endOfBall(): BallEndResult {
    const awarded = this.bonusValue;
    this.score += awarded;
    const multiplier = this.multiplier;
    this.bonusUnits = 0;
    this.multiplier = 1;
    this.litLanes.clear();
    this.ballNumber++;
    return { awarded, multiplier, gameOver: this.ballNumber > BALLS_PER_GAME };
  }

  get ballsRemaining(): number {
    return BALLS_PER_GAME - this.ballNumber + 1;
  }

  /** nudge do jogador; @returns true quando passou do limite (TILT) */
  nudge(now: number): boolean {
    this.tiltWarnings.push(now);
    this.tiltWarnings = this.tiltWarnings.filter((t) => now - t < TILT_WARN_TTL_S);
    if (this.tiltWarnings.length >= TILT_LIMIT) {
      this.tiltWarnings = [];
      this.tiltLockedUntil = now + TILT_LOCK_S;
      return true;
    }
    return false;
  }

  isTilted(now: number): boolean {
    return now < this.tiltLockedUntil;
  }

  reset(): void {
    this.score = 0;
    this.ballNumber = 1;
    this.bonusUnits = 0;
    this.multiplier = 1;
    this.litLanes.clear();
    this.tiltWarnings = [];
    this.tiltLockedUntil = 0;
  }
}
