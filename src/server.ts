import express from 'express';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Server } from 'socket.io';
import type { NextFunction, Request, Response } from 'express';
import { safeHttp } from './infra/errors';
import { config } from './infra/config';
import { logger } from './infra/logger';
import { GameStore } from './game/store';
import { closeSession, insertSession, logEvent, saveGameResult } from './infra/event-log';
import { pgConnect, pgDisconnect, pgIsConnected, pgPing } from './infra/pg';
import { attachGameNamespace } from './ws/game-namespace';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const frontendDistDir = path.join(__dirname, 'browser');
const frontendIndexPath = path.join(frontendDistDir, 'index.html');

app.use(
  express.static(frontendDistDir, {
    maxAge: 31557600000,
    immutable: true,
    index: false
  })
);

app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  const wildcard = config.corsOrigins.includes('*');
  if (origin && (wildcard || config.corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', wildcard ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/health', safeHttp((_req, res) => {
  res.json({ ok: true, env: config.env, node: process.version });
}));

const store = new GameStore();

app.get('/ready', safeHttp(async (_req, res) => {
  let redisOk = false;
  let postgresOk = false;

  try {
    redisOk = store.isConnected();
    if (redisOk) await store.ping();
  } catch {
    redisOk = false;
  }

  try {
    postgresOk = pgIsConnected();
    if (postgresOk) await pgPing();
  } catch {
    postgresOk = false;
  }

  const ok = redisOk && postgresOk;
  res.status(ok ? 200 : 503).json({
    ok,
    env: config.env,
    checks: {
      redis: redisOk ? 'ok' : 'down',
      postgres: postgresOk ? 'ok' : 'down'
    }
  });
}));

app.get('/help/how-to-play', safeHttp(async (_req, res) => {
  const mdPath = path.join(__dirname, 'assets', 'doc', 'How-To-Play.md');
  const content = await readFile(mdPath, 'utf8');
  res.type('text/markdown; charset=utf-8').send(content);
}));

app.get('/{*path}', safeHttp((req, res) => {
  if (!req.accepts('html')) {
    res.status(404).json({ ok: false, error: 'not_found' });
    return;
  }
  if (!existsSync(frontendIndexPath)) {
    res.status(404).json({ ok: false, error: 'frontend_not_built' });
    return;
  }
  res.sendFile(frontendIndexPath);
}));

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ ns: 'http', ev: 'unhandled_error', err: String((err as Error)?.message ?? err) });
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: 'internal_error' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigins } });
const ns = io.of('/game');

attachGameNamespace(ns, {
  store,
  logger,
  insertSession,
  closeSession,
  logEvent,
  saveGameResult
});

async function main(): Promise<void> {
  await store.connect();
  await pgConnect();

  server.listen(config.port, config.host, () => {
    logger.info({ ns: 'http', ev: 'listening', host: config.host, port: config.port, env: config.env });
  });

  let shuttingDown = false;
  const shutdown = async (signal: 'SIGINT' | 'SIGTERM') => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ ns: 'proc', ev: 'shutdown', signal });

    const forceExitTimer = setTimeout(() => {
      logger.error({ ns: 'proc', ev: 'shutdown_timeout_forced_exit' });
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        io.close((err?: Error) => (err ? reject(err) : resolve()));
      });
      await store.disconnect();
      await pgDisconnect();
      await new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => (err ? reject(err) : resolve()));
      });
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (err: any) {
      clearTimeout(forceExitTimer);
      logger.error({ ns: 'proc', ev: 'shutdown_error', err: String(err?.message ?? err) });
      process.exit(1);
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((err) => {
  logger.fatal({ ns: 'proc', ev: 'startup_error', err: String(err?.message ?? err) });
  process.exit(1);
});
