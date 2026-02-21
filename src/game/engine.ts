import { applyMove, computePositionHash, generateLegalMoves } from '../domain/rules';
import type { Difficulty, Side, TablutState } from '../domain/types';
import { pickBotMoveAlphaBeta } from './bot';

export interface EngineEffects {
  moveEvents: Array<{
    side: Side;
    from: { row: number; col: number };
    to: { row: number; col: number };
    captures: Array<{ row: number; col: number }>;
  }>;
  notes: string[];
}

function bumpVersion(state: TablutState): TablutState {
  state.version += 1;
  return state;
}

function sideLabel(side: Side): string {
  return side === 'ATTACKER' ? 'atacante' : 'defensor';
}

export function onHumanMove(
  state: TablutState,
  from: { row: number; col: number },
  to: { row: number; col: number }
): { state: TablutState; effects: EngineEffects } {
  if (state.phase === 'GAME_OVER') throw new Error('game_over');
  if (state.sideToMove !== state.humanSide) throw new Error('invalid_turn');

  let next = bumpVersion(applyMove(state, state.humanSide, { from, to }).state);
  const effects: EngineEffects = {
    moveEvents: [
      {
        side: state.humanSide,
        from,
        to,
        captures: next.moveHistory[next.moveHistory.length - 1]?.captures ?? []
      }
    ],
    notes: []
  };

  if (next.phase !== 'GAME_OVER' && next.sideToMove === next.botSide) {
    const botResult = runBotTurn(next, next.difficulty);
    next = botResult.state;
    effects.moveEvents.push(...botResult.effects.moveEvents);
    effects.notes.push(...botResult.effects.notes);
  }

  return { state: next, effects };
}

export function onChangeDifficulty(state: TablutState, difficulty: Difficulty): TablutState {
  if (state.phase === 'GAME_OVER') throw new Error('game_over');
  state.difficulty = difficulty;
  state.version += 1;
  return state;
}

export function runBotTurn(state: TablutState, difficulty: Difficulty): { state: TablutState; effects: EngineEffects } {
  if (state.phase === 'GAME_OVER') return { state, effects: { moveEvents: [], notes: [] } };
  if (state.sideToMove !== state.botSide) return { state, effects: { moveEvents: [], notes: [] } };

  if (state.legalMoves.length === 0) {
    // Fallback defensivo: cede turno si no hay movimiento legal.
    const passed = {
      ...state,
      sideToMove: state.humanSide,
      legalMoves: [] as TablutState['legalMoves'],
      positionCounts: { ...state.positionCounts }
    };
    const hash = computePositionHash(passed);
    passed.positionCounts[hash] = (passed.positionCounts[hash] ?? 0) + 1;
    passed.legalMoves = generateLegalMoves(passed, passed.sideToMove);
    passed.version += 1;
    return {
      state: passed,
      effects: { moveEvents: [], notes: [`El ${sideLabel(state.botSide)} no tiene jugadas legales.`] }
    };
  }

  const botMove = pickBotMoveAlphaBeta(state, difficulty, state.botSide);
  const next = bumpVersion(applyMove(state, state.botSide, botMove).state);

  return {
    state: next,
    effects: {
      moveEvents: [
        {
          side: state.botSide,
          from: botMove.from,
          to: botMove.to,
          captures: next.moveHistory[next.moveHistory.length - 1]?.captures ?? []
        }
      ],
      notes: []
    }
  };
}
