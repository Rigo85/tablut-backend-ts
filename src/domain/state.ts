import type { Difficulty, Side, TablutState } from './types';
import { computePositionHash, generateLegalMoves } from './rules';

const BOARD_SIZE = 9;

function idx(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

function makeInitialBoard(): Array<'A' | 'D' | 'K' | null> {
  const board = new Array<'A' | 'D' | 'K' | null>(BOARD_SIZE * BOARD_SIZE).fill(null);

  // Defenders + king
  board[idx(4, 4)] = 'K';
  board[idx(4, 3)] = 'D';
  board[idx(4, 5)] = 'D';
  board[idx(3, 4)] = 'D';
  board[idx(5, 4)] = 'D';
  board[idx(4, 2)] = 'D';
  board[idx(4, 6)] = 'D';
  board[idx(2, 4)] = 'D';
  board[idx(6, 4)] = 'D';

  // Attackers
  board[idx(0, 3)] = 'A';
  board[idx(0, 4)] = 'A';
  board[idx(0, 5)] = 'A';
  board[idx(1, 4)] = 'A';

  board[idx(8, 3)] = 'A';
  board[idx(8, 4)] = 'A';
  board[idx(8, 5)] = 'A';
  board[idx(7, 4)] = 'A';

  board[idx(3, 0)] = 'A';
  board[idx(4, 0)] = 'A';
  board[idx(5, 0)] = 'A';
  board[idx(4, 1)] = 'A';

  board[idx(3, 8)] = 'A';
  board[idx(4, 8)] = 'A';
  board[idx(5, 8)] = 'A';
  board[idx(4, 7)] = 'A';

  return board;
}

export function createInitialState(gameId: string, difficulty: Difficulty = 4, humanSide: Side): TablutState {
  const botSide: Side = humanSide === 'ATTACKER' ? 'DEFENDER' : 'ATTACKER';

  const state: TablutState = {
    __typename: 'TablutState',
    id: gameId,
    version: 0,
    phase: 'IN_PROGRESS',
    sideToMove: 'ATTACKER',
    board: makeInitialBoard(),
    kingHasLeftThrone: false,
    humanSide,
    botSide,
    players: {
      ATTACKER: { side: 'ATTACKER', isHuman: humanSide === 'ATTACKER' },
      DEFENDER: { side: 'DEFENDER', isHuman: humanSide === 'DEFENDER' }
    },
    winnerSide: null,
    difficulty,
    legalMoves: [],
    moveHistory: [],
    positionCounts: {}
  };

  const hash = computePositionHash(state);
  state.positionCounts[hash] = 1;
  state.legalMoves = generateLegalMoves(state, state.sideToMove);

  return state;
}
