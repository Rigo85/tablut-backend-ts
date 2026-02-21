import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as ioClient, Socket } from 'socket.io-client';
import { attachGameNamespace } from '../../src/ws/game-namespace';
import type { TablutState } from '../../src/domain/types';

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

class InMemoryStore {
  private games = new Map<string, TablutState>();

  async load(gameId: string): Promise<TablutState | undefined> {
    const st = this.games.get(gameId);
    return st ? (JSON.parse(JSON.stringify(st)) as TablutState) : undefined;
  }

  async save(next: TablutState): Promise<void> {
    this.games.set(next.id, JSON.parse(JSON.stringify(next)) as TablutState);
  }
}

async function emitAck<TReq, TRes>(socket: Socket, event: string, payload: TReq): Promise<AckResponse<TRes>> {
  return await new Promise((resolve) => {
    socket.emit(event, payload, (resp: AckResponse<TRes>) => resolve(resp));
  });
}

async function createHarness() {
  const httpServer = http.createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const ns = io.of('/game');

  const store = new InMemoryStore();

  let seq = 100;
  const sessionByClient = new Map<string, number>();
  const inserted: Array<{ socketId: string; clientSessionId?: string }> = [];

  attachGameNamespace(ns, {
    store,
    logger: { info: () => {}, warn: () => {} },
    insertSession: async (data) => {
      inserted.push({ socketId: data.socketId, clientSessionId: data.clientSessionId });
      if (data.clientSessionId) {
        if (!sessionByClient.has(data.clientSessionId)) {
          sessionByClient.set(data.clientSessionId, seq++);
        }
        return sessionByClient.get(data.clientSessionId)!;
      }
      return seq++;
    },
    closeSession: () => {},
    logEvent: async () => {},
    saveGameResult: () => {}
  });

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const addr = httpServer.address();
  if (!addr || typeof addr === 'string') throw new Error('failed to bind test server');
  const url = `http://127.0.0.1:${addr.port}/game`;

  async function connectClient(clientSessionId?: string): Promise<Socket> {
    const socket = ioClient(url, {
      transports: ['websocket'],
      auth: {
        clientSessionId,
        platform: 'test',
        language: 'en-US',
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 24,
        timezone: 'UTC'
      }
    });

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });

    return socket;
  }

  async function closeAll(clients: Socket[]) {
    for (const c of clients) {
      if (c.connected) c.disconnect();
    }
    await new Promise<void>((resolve, reject) => io.close((err) => (err ? reject(err) : resolve())));
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  }

  return { store, inserted, connectClient, closeAll };
}

test('ws integration: game:new + join + change diff', async () => {
  const h = await createHarness();
  const clients: Socket[] = [];

  try {
    const c1 = await h.connectClient('tablut-client-A');
    clients.push(c1);

    const created = await emitAck<{ difficulty: 2; humanSide: 'ATTACKER' }, TablutState>(c1, 'game:new', {
      difficulty: 2,
      humanSide: 'ATTACKER'
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const gameId = created.data.id;
    assert.equal(created.data.difficulty, 2);
    assert.equal(created.data.humanSide, 'ATTACKER');

    const c2 = await h.connectClient('tablut-client-B');
    clients.push(c2);

    const joined = await emitAck<{ gameId: string }, TablutState>(c2, 'join', { gameId });
    assert.equal(joined.ok, true);
    if (!joined.ok) return;

    const changed = await emitAck(c2, 'game:change:diff', { gameId, difficulty: 4 as const });
    assert.equal(changed.ok, true);
    if (changed.ok) assert.equal(changed.data.difficulty, 4);

    assert.equal(h.inserted.length >= 2, true);
  } finally {
    await h.closeAll(clients);
  }
});

test('ws integration: when human is defender bot (attacker) opens automatically', async () => {
  const h = await createHarness();
  const clients: Socket[] = [];

  try {
    const c = await h.connectClient('tablut-client-C');
    clients.push(c);

    const created = await emitAck<{ humanSide: 'DEFENDER'; difficulty: 2 }, TablutState>(c, 'game:new', {
      humanSide: 'DEFENDER',
      difficulty: 2
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    assert.equal(created.data.humanSide, 'DEFENDER');
    assert.equal(created.data.sideToMove, 'DEFENDER');
    assert.equal(created.data.moveHistory.length >= 1, true);
  } finally {
    await h.closeAll(clients);
  }
});

test('ws integration: clientSessionId is reused across reconnects', async () => {
  const h = await createHarness();
  const clients: Socket[] = [];

  try {
    const sid = 'tablut-stable-client-session';
    const c1 = await h.connectClient(sid);
    clients.push(c1);
    c1.disconnect();

    const c2 = await h.connectClient(sid);
    clients.push(c2);

    const seen = h.inserted.filter((i) => i.clientSessionId === sid);
    assert.equal(seen.length >= 2, true);
  } finally {
    await h.closeAll(clients);
  }
});
