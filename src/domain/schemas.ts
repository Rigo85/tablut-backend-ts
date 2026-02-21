import { z } from 'zod';

const SideSchema = z.union([z.literal('ATTACKER'), z.literal('DEFENDER')]);
const AllowedDifficultySchema = z.union([z.literal(2), z.literal(4)]);

export const GameIdSchema = z.object({ gameId: z.string().min(1) });

export const GameNewSchema = z.object({
  gameId: z.string().min(1).optional(),
  difficulty: AllowedDifficultySchema.optional(),
  humanSide: SideSchema
});

export const GameChangeDifficultySchema = z.object({
  gameId: z.string().min(1),
  difficulty: AllowedDifficultySchema
});

export const MovePlaySchema = z.object({
  gameId: z.string().min(1),
  from: z.object({ row: z.number().int().min(0).max(8), col: z.number().int().min(0).max(8) }),
  to: z.object({ row: z.number().int().min(0).max(8), col: z.number().int().min(0).max(8) })
});
