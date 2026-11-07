// Máquina de estados central do jogo (Fase 3). O engine manda; o HUD escuta.

export type GamePhase = "title" | "playing" | "ballLost" | "gameOver";

export class GameState {
  private phase: GamePhase = "title";
  private listeners = new Set<(p: GamePhase) => void>();

  get(): GamePhase {
    return this.phase;
  }

  set(phase: GamePhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    for (const l of this.listeners) l(phase);
  }

  is(phase: GamePhase): boolean {
    return this.phase === phase;
  }

  subscribe(l: (p: GamePhase) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
