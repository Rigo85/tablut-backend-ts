import { v4 as uuidv4 } from 'uuid';
import type { Namespace } from 'socket.io';
import { withAck } from '../infra/errors';
import {
  GameChangeDifficultySchema,
  GameIdSchema,
  GameNewSchema,
  MovePlaySchema
} from '../domain/schemas';
import { createInitialState } from '../domain/state';
import { onChangeDifficulty, onHumanMove, runBotTurn } from '../game/engine';
import type { Difficulty, Side, TablutState } from '../domain/types';

export interface GameStoreLike {
  load(gameId: string): Promise<TablutState | undefined>;
  save(next: TablutState): Promise<void>;
}

export interface SessionData {
  socketId: string;
  clientSessionId?: string;
  ip?: string;
  userAgent?: string;
  acceptLanguage?: string;
  platform?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  colorDepth?: number;
  timezone?: string;
}

export interface GameNamespaceDeps {
  store: GameStoreLike;
  logger: {
    info: (payload: Record<string, unknown>) => void;
    warn: (payload: Record<string, unknown>) => void;
  };
  insertSession: (data: SessionData) => Promise<number>;
  closeSession: (sessionId: number) => void;
  logEvent: (
    sessionId: number | undefined,
    event: string,
    gameId?: string,
    payload?: Record<string, unknown>
  ) => Promise<void> | void;
  saveGameResult: (
    gameId: string,
    winnerSide: Side,
    moveCount: number,
    players: { ATTACKER: { isHuman: boolean }; DEFENDER: { isHuman: boolean } }
  ) => void;
}

async function maybePersistGameResult(deps: GameNamespaceDeps, sessionId: number | undefined, st: TablutState): Promise<void> {
  if (st.phase !== 'GAME_OVER' || !st.winnerSide) return;
  await deps.logEvent(sessionId, 'game_over', st.id, {
    winnerSide: st.winnerSide,
    moveCount: st.moveHistory.length,
    players: {
      ATTACKER: { isHuman: st.players.ATTACKER.isHuman },
      DEFENDER: { isHuman: st.players.DEFENDER.isHuman }
    }
  });

  deps.saveGameResult(st.id, st.winnerSide, st.moveHistory.length, {
    ATTACKER: { isHuman: st.players.ATTACKER.isHuman },
    DEFENDER: { isHuman: st.players.DEFENDER.isHuman }
  });
}

function emitMoves(ns: Namespace, gameId: string, moves: Array<{ side: Side; from: any; to: any; captures: any[] }>): void {
  for (const mv of moves) {
    ns.to(gameId).emit('move:result', mv);
  }
}

export function attachGameNamespace(ns: Namespace, deps: GameNamespaceDeps): void {
  ns.on('connection', async (socket) => {
    deps.logger.info({ ns: 'ws', ev: 'connected', sid: socket.id });

    const headers = socket.handshake.headers;
    const auth = socket.handshake.auth ?? {};
    const ip = (headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? socket.handshake.address;

    let sessionId: number | undefined;
    let disconnected = false;

    void deps
      .insertSession({
        socketId: socket.id,
        clientSessionId: typeof auth.clientSessionId === 'string' ? auth.clientSessionId : undefined,
        ip,
        userAgent: headers['user-agent'] as string | undefined,
        acceptLanguage: headers['accept-language'] as string | undefined,
        platform: auth.platform,
        language: auth.language,
        screenWidth: auth.screenWidth,
        screenHeight: auth.screenHeight,
        colorDepth: auth.colorDepth,
        timezone: auth.timezone
      })
      .then((id) => {
        sessionId = id;
        (socket.data as any).sessionId = sessionId;
        if (disconnected) deps.closeSession(sessionId);
      })
      .catch((err: any) => {
        deps.logger.warn({ ns: 'pg', ev: 'insert_session_error', err: String(err?.message ?? err) });
      });

    socket.on('join', withAck(GameIdSchema, async ({ gameId }) => {
      await deps.logEvent(sessionId, 'join', gameId);
      socket.join(gameId);

      const st = await deps.store.load(gameId);
      if (!st) throw new Error(`game_not_found: id=${gameId}`);

      socket.emit('state', st);
      return st;
    }));

    socket.on('game:new', withAck(GameNewSchema, async ({ gameId, difficulty, humanSide }) => {
      const gid = gameId ?? uuidv4();
      const finalDifficulty: Difficulty = difficulty ?? 4;
      await deps.logEvent(sessionId, 'game_new', gid, { difficulty: finalDifficulty, humanSide });

      let state = createInitialState(gid, finalDifficulty, humanSide);
      await deps.store.save(state);
      socket.join(gid);
      socket.emit('state', state);

      // Attackers always start. If bot is attacker, play the opening move immediately.
      if (state.phase !== 'GAME_OVER' && state.sideToMove === state.botSide) {
        const beforeMoveCount = state.moveHistory.length;
        const actionId = uuidv4();
        ns.to(gid).emit('bot:thinking', { active: true });
        try {
          const botResult = runBotTurn(state, state.difficulty);
          state = botResult.state;
          await deps.store.save(state);

          for (const [idx, mv] of botResult.effects.moveEvents.entries()) {
            const rec = state.moveHistory[beforeMoveCount + idx];
            await deps.logEvent(sessionId, 'move_play', gid, {
              actionId,
              side: mv.side,
              isHuman: state.players[mv.side].isHuman,
              turnNumber: rec?.turn ?? null,
              from: mv.from,
              to: mv.to,
              captures: mv.captures
            });
          }

          emitMoves(ns, gid, botResult.effects.moveEvents);
          for (const note of botResult.effects.notes) {
            ns.to(gid).emit('turn:note', { message: note });
          }
          ns.to(gid).emit('state', state);

          await maybePersistGameResult(deps, sessionId, state);
          if (state.phase === 'GAME_OVER' && state.winnerSide) {
            ns.to(gid).emit('game:over', { winnerSide: state.winnerSide });
          }
        } finally {
          ns.to(gid).emit('bot:thinking', { active: false });
        }
      }
      return state;
    }));

    socket.on('game:change:diff', withAck(GameChangeDifficultySchema, async ({ gameId, difficulty }) => {
      const st = await deps.store.load(gameId);
      if (!st) throw new Error(`game_not_found: id=${gameId}`);

      const next = onChangeDifficulty(st, difficulty);
      await deps.store.save(next);

      await deps.logEvent(sessionId, 'game_change_difficulty', gameId, { difficulty });
      ns.to(gameId).emit('state', next);
      return next;
    }));

    socket.on('move:play', withAck(MovePlaySchema, async ({ gameId, from, to }) => {
      deps.logger.info({ ns: 'ws', ev: 'move_play', sid: socket.id, gameId, from, to });
      let st = await deps.store.load(gameId);
      if (!st) throw new Error(`game_not_found: id=${gameId}`);
      const actionId = uuidv4();
      const beforeMoveCount = st.moveHistory.length;

      if (st.phase !== 'IN_PROGRESS') throw new Error('game_over');
      if (st.sideToMove !== st.humanSide) throw new Error('invalid_turn');

      const result = onHumanMove(st, from, to);
      st = result.state;
      await deps.store.save(st);

      for (const [idx, mv] of result.effects.moveEvents.entries()) {
        const rec = st.moveHistory[beforeMoveCount + idx];
        await deps.logEvent(sessionId, 'move_play', gameId, {
          actionId,
          side: mv.side,
          isHuman: st.players[mv.side].isHuman,
          turnNumber: rec?.turn ?? null,
          from: mv.from,
          to: mv.to,
          captures: mv.captures
        });
      }

      emitMoves(ns, gameId, result.effects.moveEvents);
      for (const note of result.effects.notes) {
        ns.to(gameId).emit('turn:note', { message: note });
      }

      ns.to(gameId).emit('state', st);

      await maybePersistGameResult(deps, sessionId, st);
      if (st.phase === 'GAME_OVER' && st.winnerSide) {
        ns.to(gameId).emit('game:over', { winnerSide: st.winnerSide });
      }

      return st;
    }));

    socket.on('disconnect', (reason) => {
      disconnected = true;
      deps.logger.warn({ ns: 'ws', ev: 'disconnected', sid: socket.id, reason });
      void deps.logEvent(sessionId, 'disconnected', undefined, { reason });
      if (sessionId) deps.closeSession(sessionId);
    });
  });
}
