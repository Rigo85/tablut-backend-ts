import { createClient, type RedisClientType } from 'redis';
import { config } from '../infra/config';
import type { TablutState } from '../domain/types';

export class GameStore {
  private client: RedisClientType;
  private readonly prefix = 'tablut:game:';

  constructor() {
    this.client = createClient({ url: config.redisUrl });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }

  isConnected(): boolean {
    return this.client.isOpen;
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  private key(id: string): string {
    return `${this.prefix}${id}`;
  }

  async load(gameId: string): Promise<TablutState | undefined> {
    const raw = await this.client.get(this.key(gameId));
    return raw ? (JSON.parse(raw) as TablutState) : undefined;
  }

  async save(next: TablutState): Promise<void> {
    const key = this.key(next.id);
    await this.client.watch(key);

    const currentRaw = await this.client.get(key);
    const current = currentRaw ? (JSON.parse(currentRaw) as TablutState) : undefined;

    if (!current) {
      if (next.version !== 0) {
        await this.client.unwatch();
        throw new Error('first_save_must_be_version_0');
      }

      const res = await this.client.multi().set(key, JSON.stringify(next), { EX: 3600 * 6 }).exec();
      if (res === undefined) throw new Error('concurrent_update_detected');
      return;
    }

    if (next.version <= current.version) {
      await this.client.unwatch();
      throw new Error(`version_conflict: expected_gt=${current.version}, got=${next.version}`);
    }

    const res = await this.client.multi().set(key, JSON.stringify(next), { EX: 3600 * 6 }).exec();
    if (res === undefined) throw new Error('concurrent_update_detected');
  }
}
