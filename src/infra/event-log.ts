import { getPool } from './pg';
import { logger } from './logger';
import type { Side } from '../domain/types';

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

export interface ResultPlayersPayload {
  ATTACKER: { isHuman: boolean };
  DEFENDER: { isHuman: boolean };
}

export async function insertSession(data: SessionData): Promise<number> {
  if (data.clientSessionId) {
    const { rows } = await getPool().query(
      `INSERT INTO sessions
        (socket_id, client_session_id, ip, user_agent, accept_language, platform, language,
         screen_width, screen_height, color_depth, timezone, connected_at, disconnected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW(), NULL)
       ON CONFLICT (client_session_id)
       DO UPDATE SET
         socket_id = EXCLUDED.socket_id,
         ip = EXCLUDED.ip,
         user_agent = EXCLUDED.user_agent,
         accept_language = EXCLUDED.accept_language,
         platform = EXCLUDED.platform,
         language = EXCLUDED.language,
         screen_width = EXCLUDED.screen_width,
         screen_height = EXCLUDED.screen_height,
         color_depth = EXCLUDED.color_depth,
         timezone = EXCLUDED.timezone,
         connected_at = NOW(),
         disconnected_at = NULL
       RETURNING id`,
      [
        data.socketId,
        data.clientSessionId,
        data.ip ?? null,
        data.userAgent ?? null,
        data.acceptLanguage ?? null,
        data.platform ?? null,
        data.language ?? null,
        data.screenWidth ?? null,
        data.screenHeight ?? null,
        data.colorDepth ?? null,
        data.timezone ?? null
      ]
    );
    return Number(rows[0].id);
  }

  const { rows } = await getPool().query(
    `INSERT INTO sessions
      (socket_id, client_session_id, ip, user_agent, accept_language, platform, language,
       screen_width, screen_height, color_depth, timezone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      data.socketId,
      null,
      data.ip ?? null,
      data.userAgent ?? null,
      data.acceptLanguage ?? null,
      data.platform ?? null,
      data.language ?? null,
      data.screenWidth ?? null,
      data.screenHeight ?? null,
      data.colorDepth ?? null,
      data.timezone ?? null
    ]
  );

  return Number(rows[0].id);
}

export function closeSession(sessionId: number): void {
  getPool()
    .query('UPDATE sessions SET disconnected_at = NOW() WHERE id = $1', [sessionId])
    .catch((err: unknown) => logger.error({ ns: 'pg', ev: 'close_session_error', err: String((err as Error)?.message ?? err) }));
}

export async function logEvent(
  sessionId: number | undefined,
  event: string,
  gameId?: string,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO game_events (session_id, game_id, event, payload)
       VALUES ($1, $2, $3, $4)`,
      [sessionId ?? null, gameId ?? null, event, JSON.stringify(payload ?? {})]
    );
  } catch (err: unknown) {
    logger.error({ ns: 'pg', ev: 'log_event_error', err: String((err as Error)?.message ?? err) });
  }
}

export function saveGameResult(gameId: string, winnerSide: Side, moveCount: number, players: ResultPlayersPayload): void {
  getPool()
    .query(
      `INSERT INTO game_results (game_id, winner_side, move_count, players)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id)
       DO UPDATE SET
         winner_side = EXCLUDED.winner_side,
         move_count = EXCLUDED.move_count,
         players = EXCLUDED.players,
         finished_at = NOW()`,
      [gameId, winnerSide, moveCount, JSON.stringify(players)]
    )
    .catch((err: unknown) => logger.error({ ns: 'pg', ev: 'save_game_result_error', err: String((err as Error)?.message ?? err) }));
}
