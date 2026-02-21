import { applyMoveUnchecked, countPieces, generateLegalMoves, kingAdjacentAttackers, shortestKingDistanceToEdge } from '../domain/rules';
import type { Difficulty, Side, TablutMove, TablutState } from '../domain/types';

function evaluateState(state: TablutState, botSide: Side): number {
  if (state.phase === 'GAME_OVER') {
    if (state.winnerSide === botSide) return 1_000_000;
    if (state.winnerSide) return -1_000_000;
  }

  const { attackers, defenders, king } = countPieces(state.board);
  const kingDist = shortestKingDistanceToEdge(state.board);
  const kingThreat = kingAdjacentAttackers(state.board);

  const attackerScore =
    attackers * 40 +
    (8 - kingDist) * -60 +
    kingThreat * 45 +
    (1 - king) * 8000;

  const defenderScore =
    defenders * 55 +
    king * 500 +
    (8 - kingDist) * 85 +
    kingThreat * -40;

  const raw = attackerScore - defenderScore;
  return botSide === 'ATTACKER' ? raw : -raw;
}

function minimax(state: TablutState, depth: number, alpha: number, beta: number, botSide: Side): number {
  if (depth === 0 || state.phase === 'GAME_OVER') {
    return evaluateState(state, botSide);
  }

  const side = state.sideToMove;
  const moves = selectCandidateMoves(state, side, depth);
  if (moves.length === 0) {
    return evaluateState(state, botSide);
  }

  if (side === botSide) {
    let best = Number.NEGATIVE_INFINITY;
    for (const move of moves) {
      const outcome = applyMoveUnchecked(state, move, side);
      if (outcome.illegalByRepetition) continue;
      const score = minimax(outcome.state, depth - 1, alpha, beta, botSide);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Number.POSITIVE_INFINITY;
  for (const move of moves) {
    const outcome = applyMoveUnchecked(state, move, side);
    if (outcome.illegalByRepetition) continue;
    const score = minimax(outcome.state, depth - 1, alpha, beta, botSide);
    if (score < best) best = score;
    if (score < beta) beta = score;
    if (beta <= alpha) break;
  }
  return best;
}

export function pickBotMoveAlphaBeta(state: TablutState, difficulty: Difficulty, botSide: Side): TablutMove {
  const side = state.sideToMove;
  if (side !== botSide) {
    throw new Error('bot_not_on_turn');
  }

  const moves = selectCandidateMoves(state, side, difficulty);
  if (moves.length === 0) throw new Error('bot_no_legal_moves');

  let bestScore = Number.NEGATIVE_INFINITY;
  const bestMoves: TablutMove[] = [];

  for (const move of moves) {
    const outcome = applyMoveUnchecked(state, move, side);
    if (outcome.illegalByRepetition) continue;

    const score = minimax(outcome.state, difficulty - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, botSide);

    if (score > bestScore) {
      bestScore = score;
      bestMoves.length = 0;
      bestMoves.push(move);
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  if (bestMoves.length === 0) {
    throw new Error('bot_no_legal_moves');
  }

  // Non-deterministic tie-break avoids repetitive patterns.
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function quickMoveHeuristic(move: TablutMove): number {
  const advancement = Math.abs(move.to.row - move.from.row) + Math.abs(move.to.col - move.from.col);
  return move.capturesPreview.length * 100 + advancement;
}

function selectCandidateMoves(state: TablutState, side: Side, depth: number): TablutMove[] {
  const moves = generateLegalMoves(state, side);
  if (moves.length <= 20) return moves;

  const sorted = [...moves].sort((a, b) => quickMoveHeuristic(b) - quickMoveHeuristic(a));
  const cap = depth >= 4 ? 18 : 24;
  return sorted.slice(0, cap);
}
