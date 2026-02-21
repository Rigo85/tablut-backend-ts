import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/state';
import { applyMove, applyMoveUnchecked, computePositionHash, generateLegalMoves } from '../src/domain/rules';
import type { Piece, Pos, Side, TablutState } from '../src/domain/types';

function emptyBoard(): Array<Piece | null> {
  return new Array<Piece | null>(81).fill(null);
}

function put(board: Array<Piece | null>, row: number, col: number, p: Piece): void {
  board[row * 9 + col] = p;
}

function buildState(board: Array<Piece | null>, sideToMove: Side): TablutState {
  const st = createInitialState('t', 2, 'ATTACKER');
  st.board = board;
  st.sideToMove = sideToMove;
  st.kingHasLeftThrone = true;
  st.phase = 'IN_PROGRESS';
  st.winnerSide = null;
  st.moveHistory = [];
  st.positionCounts = {};
  st.legalMoves = [];
  const h = computePositionHash(st);
  st.positionCounts[h] = 1;
  st.legalMoves = generateLegalMoves(st, st.sideToMove);
  return st;
}

function doMove(st: TablutState, from: Pos, to: Pos): TablutState {
  return applyMove(st, st.sideToMove, { from, to }).state;
}

test('initial setup is correct and attackers start', () => {
  const st = createInitialState('g1', 4, 'DEFENDER');
  assert.equal(st.sideToMove, 'ATTACKER');
  assert.equal(st.board.filter((p) => p === 'A').length, 16);
  assert.equal(st.board.filter((p) => p === 'D').length, 8);
  assert.equal(st.board.filter((p) => p === 'K').length, 1);
});

test('throne cannot be crossed', () => {
  const st = createInitialState('g2', 2, 'ATTACKER');
  const legalFrom42 = st.legalMoves.filter((m) => m.from.row === 4 && m.from.col === 2);
  assert.equal(legalFrom42.some((m) => m.to.row === 4 && m.to.col === 6), false);
});

test('king on throne requires 4 attackers to be captured', () => {
  const board = emptyBoard();
  put(board, 4, 4, 'K');
  put(board, 4, 3, 'A');
  put(board, 3, 4, 'A');
  put(board, 5, 4, 'A');
  put(board, 4, 6, 'A');

  const st = buildState(board, 'ATTACKER');
  const outcome = applyMoveUnchecked(st, { from: { row: 4, col: 6 }, to: { row: 4, col: 5 } }, 'ATTACKER');

  assert.equal(outcome.state.phase, 'GAME_OVER');
  assert.equal(outcome.state.winnerSide, 'ATTACKER');
});

test('defender wins when king reaches edge', () => {
  const board = emptyBoard();
  put(board, 1, 4, 'K');
  put(board, 8, 8, 'A');

  const st = buildState(board, 'DEFENDER');
  const next = doMove(st, { row: 1, col: 4 }, { row: 0, col: 4 });

  assert.equal(next.phase, 'GAME_OVER');
  assert.equal(next.winnerSide, 'DEFENDER');
});

test('attacker must break repetition on third occurrence', () => {
  const board = emptyBoard();
  put(board, 2, 2, 'K');
  put(board, 0, 0, 'A');
  put(board, 8, 8, 'D');

  let st = buildState(board, 'ATTACKER');

  // cycle 1
  st = doMove(st, { row: 0, col: 0 }, { row: 0, col: 1 });
  st = doMove(st, { row: 8, col: 8 }, { row: 8, col: 7 });
  st = doMove(st, { row: 0, col: 1 }, { row: 0, col: 0 });
  st = doMove(st, { row: 8, col: 7 }, { row: 8, col: 8 });

  // cycle 2
  st = doMove(st, { row: 0, col: 0 }, { row: 0, col: 1 });
  st = doMove(st, { row: 8, col: 8 }, { row: 8, col: 7 });
  st = doMove(st, { row: 0, col: 1 }, { row: 0, col: 0 });
  st = doMove(st, { row: 8, col: 7 }, { row: 8, col: 8 });

  assert.throws(() => doMove(st, { row: 0, col: 0 }, { row: 0, col: 1 }), /attacker_must_break_repetition/);
});
