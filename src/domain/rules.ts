import type { ApplyMoveOutcome, Piece, Pos, Side, TablutMove, TablutState } from './types';

export const BOARD_SIZE = 9;
export const THRONE: Pos = { row: 4, col: 4 };

const DIRS: Pos[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 }
];

function idx(pos: Pos): number {
  return pos.row * BOARD_SIZE + pos.col;
}

function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isInside(pos: Pos): boolean {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
}

export function isThrone(pos: Pos): boolean {
  return pos.row === THRONE.row && pos.col === THRONE.col;
}

export function isEdge(pos: Pos): boolean {
  return pos.row === 0 || pos.row === BOARD_SIZE - 1 || pos.col === 0 || pos.col === BOARD_SIZE - 1;
}

function posAdd(a: Pos, b: Pos): Pos {
  return { row: a.row + b.row, col: a.col + b.col };
}

function getPiece(board: Array<Piece | null>, pos: Pos): Piece | null {
  return board[idx(pos)] ?? null;
}

function setPiece(board: Array<Piece | null>, pos: Pos, piece: Piece | null): void {
  board[idx(pos)] = piece;
}

export function sideOfPiece(piece: Piece): Side {
  return piece === 'A' ? 'ATTACKER' : 'DEFENDER';
}

function isFriendly(piece: Piece | null, side: Side): boolean {
  if (!piece) return false;
  return sideOfPiece(piece) === side;
}

function isEnemy(piece: Piece | null, side: Side): boolean {
  if (!piece) return false;
  return sideOfPiece(piece) !== side;
}

function switchSide(side: Side): Side {
  return side === 'ATTACKER' ? 'DEFENDER' : 'ATTACKER';
}

function orthNeighbors(pos: Pos): Pos[] {
  return DIRS.map((d) => posAdd(pos, d)).filter(isInside);
}

export function findKing(board: Array<Piece | null>): Pos | null {
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === 'K') {
      return { row: Math.floor(i / BOARD_SIZE), col: i % BOARD_SIZE };
    }
  }
  return null;
}

function countAttackersAdjacentToThrone(board: Array<Piece | null>): number {
  let count = 0;
  for (const n of orthNeighbors(THRONE)) {
    if (getPiece(board, n) === 'A') count += 1;
  }
  return count;
}

export function isThroneHostile(board: Array<Piece | null>, kingHasLeftThrone: boolean): boolean {
  if (kingHasLeftThrone) return true;
  const kingOnThrone = getPiece(board, THRONE) === 'K';
  if (!kingOnThrone) return false;
  return countAttackersAdjacentToThrone(board) >= 3;
}

function isKingOnOrAdjacentThrone(pos: Pos): boolean {
  if (isThrone(pos)) return true;
  return orthNeighbors(THRONE).some((n) => samePos(n, pos));
}

function hasRookPath(board: Array<Piece | null>, from: Pos, to: Pos): boolean {
  if (from.row !== to.row && from.col !== to.col) return false;
  const dr = Math.sign(to.row - from.row);
  const dc = Math.sign(to.col - from.col);
  let cur: Pos = { row: from.row + dr, col: from.col + dc };

  while (!samePos(cur, to)) {
    if (!isInside(cur)) return false;
    if (isThrone(cur)) return false;
    if (getPiece(board, cur) !== null) return false;
    cur = { row: cur.row + dr, col: cur.col + dc };
  }

  if (isThrone(to)) return false;
  return getPiece(board, to) === null;
}

function canCaptureUsingBeyond(
  board: Array<Piece | null>,
  side: Side,
  beyond: Pos,
  throneHostile: boolean
): boolean {
  if (!isInside(beyond)) return false;
  if (isThrone(beyond)) return throneHostile;
  return isFriendly(getPiece(board, beyond), side);
}

function kingCapturedSpecial(board: Array<Piece | null>, kingPos: Pos): boolean {
  if (isThrone(kingPos)) {
    return orthNeighbors(THRONE).every((p) => getPiece(board, p) === 'A');
  }

  if (orthNeighbors(THRONE).some((p) => samePos(p, kingPos))) {
    const required = orthNeighbors(kingPos).filter((p) => !isThrone(p));
    return required.every((p) => getPiece(board, p) === 'A');
  }

  return false;
}

export function computePositionHash(state: Pick<TablutState, 'board' | 'sideToMove' | 'kingHasLeftThrone'>): string {
  const boardKey = state.board.map((p) => p ?? '.').join('');
  return `${boardKey}|${state.sideToMove}|${state.kingHasLeftThrone ? 1 : 0}`;
}

function positionsEqual(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

function moveEquals(a: { from: Pos; to: Pos }, b: { from: Pos; to: Pos }): boolean {
  return positionsEqual(a.from, b.from) && positionsEqual(a.to, b.to);
}

function cloneState(state: TablutState): TablutState {
  return {
    ...state,
    board: [...state.board],
    moveHistory: [...state.moveHistory],
    legalMoves: [...state.legalMoves],
    positionCounts: { ...state.positionCounts },
    players: {
      ATTACKER: { ...state.players.ATTACKER },
      DEFENDER: { ...state.players.DEFENDER }
    }
  };
}

export function applyMoveUnchecked(
  state: TablutState,
  move: { from: Pos; to: Pos },
  side: Side,
  options?: { recomputeLegalMoves?: boolean }
): ApplyMoveOutcome {
  const next = cloneState(state);
  const piece = getPiece(next.board, move.from);

  if (!piece) throw new Error('empty_source');
  if (!isFriendly(piece, side)) throw new Error('piece_not_owned');
  if (!hasRookPath(next.board, move.from, move.to)) throw new Error('invalid_path');

  setPiece(next.board, move.from, null);
  setPiece(next.board, move.to, piece);

  if (piece === 'K' && isThrone(move.from)) {
    next.kingHasLeftThrone = true;
  }

  const throneHostile = isThroneHostile(next.board, next.kingHasLeftThrone);
  const captured: Array<{ pos: Pos; piece: Piece }> = [];
  let kingCaptured = false;

  for (const d of DIRS) {
    const adj = posAdd(move.to, d);
    const beyond = posAdd(adj, d);
    if (!isInside(adj)) continue;

    const adjPiece = getPiece(next.board, adj);
    if (!isEnemy(adjPiece, side)) continue;

    if (adjPiece === 'K') {
      if (side !== 'ATTACKER') continue;
      if (isKingOnOrAdjacentThrone(adj)) continue;
      if (canCaptureUsingBeyond(next.board, side, beyond, throneHostile)) {
        captured.push({ pos: adj, piece: 'K' });
        kingCaptured = true;
      }
      continue;
    }

    if (adjPiece && canCaptureUsingBeyond(next.board, side, beyond, throneHostile)) {
      captured.push({ pos: adj, piece: adjPiece });
    }
  }

  if (!kingCaptured && side === 'ATTACKER') {
    const kingPos = findKing(next.board);
    if (kingPos && isKingOnOrAdjacentThrone(kingPos) && kingCapturedSpecial(next.board, kingPos)) {
      captured.push({ pos: kingPos, piece: 'K' });
      kingCaptured = true;
    }
  }

  for (const c of captured) {
    setPiece(next.board, c.pos, null);
  }

  const kingNow = findKing(next.board);
  let winner: Side | null = null;
  if (!kingNow) {
    winner = 'ATTACKER';
  } else if (isEdge(kingNow)) {
    winner = 'DEFENDER';
  }

  next.winnerSide = winner;
  next.phase = winner ? 'GAME_OVER' : 'IN_PROGRESS';

  if (!winner) {
    next.sideToMove = switchSide(side);

    const hash = computePositionHash(next);
    const count = next.positionCounts[hash] ?? 0;

    if (side === 'ATTACKER' && count >= 2) {
      return { state, captured: [], winner: null, illegalByRepetition: true };
    }

    next.positionCounts[hash] = count + 1;
    if (options?.recomputeLegalMoves !== false) {
      next.legalMoves = generateLegalMoves(next, next.sideToMove);
    } else {
      next.legalMoves = [];
    }
  } else {
    next.legalMoves = [];
  }

  return { state: next, captured, winner, illegalByRepetition: false };
}

export function generateLegalMoves(state: TablutState, side: Side): TablutMove[] {
  if (state.phase === 'GAME_OVER') return [];

  const out: TablutMove[] = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const from = { row, col };
      const piece = getPiece(state.board, from);
      if (!isFriendly(piece, side)) continue;

      for (const d of DIRS) {
        let cur = posAdd(from, d);

        while (isInside(cur)) {
          if (isThrone(cur)) break;
          if (getPiece(state.board, cur) !== null) break;

          const outcome = applyMoveUnchecked(state, { from, to: cur }, side, { recomputeLegalMoves: false });
          if (!outcome.illegalByRepetition) {
            out.push({
              from,
              to: cur,
              capturesPreview: outcome.captured.map((c) => c.pos)
            });
          }

          cur = posAdd(cur, d);
        }
      }
    }
  }

  return out;
}

export function applyMove(state: TablutState, side: Side, move: { from: Pos; to: Pos }): ApplyMoveOutcome {
  if (state.phase === 'GAME_OVER') throw new Error('game_over');
  if (state.sideToMove !== side) throw new Error('invalid_turn');

  const legal = state.legalMoves.find((m) => moveEquals(m, move));
  if (!legal) {
    try {
      const outcome = applyMoveUnchecked(state, move, side, { recomputeLegalMoves: false });
      if (outcome.illegalByRepetition) {
        throw new Error('attacker_must_break_repetition');
      }
    } catch (err: any) {
      if (err?.message === 'attacker_must_break_repetition') throw err;
      // ignore path/ownership errors here and report as illegal_move
    }
    throw new Error('illegal_move');
  }

  const outcome = applyMoveUnchecked(state, move, side);
  if (outcome.illegalByRepetition) throw new Error('attacker_must_break_repetition');

  outcome.state.moveHistory.push({
    turn: outcome.state.moveHistory.length + 1,
    side,
    from: move.from,
    to: move.to,
    captures: outcome.captured.map((c) => c.pos),
    capturedPieces: outcome.captured.map((c) => c.piece)
  });

  return outcome;
}

export function countPieces(board: Array<Piece | null>): { attackers: number; defenders: number; king: number } {
  let attackers = 0;
  let defenders = 0;
  let king = 0;

  for (const cell of board) {
    if (cell === 'A') attackers += 1;
    if (cell === 'D') defenders += 1;
    if (cell === 'K') king += 1;
  }

  return { attackers, defenders, king };
}

export function shortestKingDistanceToEdge(board: Array<Piece | null>): number {
  const king = findKing(board);
  if (!king) return 0;

  return Math.min(king.row, king.col, BOARD_SIZE - 1 - king.row, BOARD_SIZE - 1 - king.col);
}

export function kingAdjacentAttackers(board: Array<Piece | null>): number {
  const king = findKing(board);
  if (!king) return 0;
  return orthNeighbors(king).filter((n) => getPiece(board, n) === 'A').length;
}
