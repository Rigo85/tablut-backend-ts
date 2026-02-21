export type Side = 'ATTACKER' | 'DEFENDER';
export type Piece = 'A' | 'D' | 'K';
export type Difficulty = 2 | 4;

export interface Pos {
  row: number;
  col: number;
}

export interface PlayerBinding {
  side: Side;
  isHuman: boolean;
}

export interface TablutMove {
  from: Pos;
  to: Pos;
  capturesPreview: Pos[];
}

export interface MoveRecord {
  turn: number;
  side: Side;
  from: Pos;
  to: Pos;
  captures: Pos[];
  capturedPieces: Piece[];
}

export interface ApplyMoveOutcome {
  state: TablutState;
  captured: Array<{ pos: Pos; piece: Piece }>;
  winner: Side | null;
  illegalByRepetition: boolean;
}

export interface TablutState {
  __typename: 'TablutState';
  id: string;
  version: number;
  phase: 'IN_PROGRESS' | 'GAME_OVER';
  sideToMove: Side;
  board: Array<Piece | null>;
  kingHasLeftThrone: boolean;
  humanSide: Side;
  botSide: Side;
  players: {
    ATTACKER: PlayerBinding;
    DEFENDER: PlayerBinding;
  };
  winnerSide: Side | null;
  difficulty: Difficulty;
  legalMoves: TablutMove[];
  moveHistory: MoveRecord[];
  positionCounts: Record<string, number>;
}
