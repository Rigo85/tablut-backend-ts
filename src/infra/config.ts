import 'dotenv/config';
import { z } from 'zod';

const Envs = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3009),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.coerce.number().int().min(0).max(1).default(0),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  PG_URL: z.string().default('postgresql://localhost:5432/tablut')
});

const parsed = Envs.parse(process.env);

export const config = {
  env: parsed.NODE_ENV,
  isDev: parsed.NODE_ENV === 'development',
  isProd: parsed.NODE_ENV === 'production',
  host: parsed.HOST,
  port: parsed.PORT,
  corsOrigins: parsed.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  logLevel: parsed.LOG_LEVEL,
  logPretty: parsed.LOG_PRETTY === 1,
  redisUrl: parsed.REDIS_URL,
  pgUrl: parsed.PG_URL
} as const;
