import { z } from 'zod';

export const roleSchema = z.enum(['USER', 'ADMIN', 'MODERATOR']);
export type Role = z.infer<typeof roleSchema>;

export const languageSchema = z.enum(['hi', 'en']);
export type Language = z.infer<typeof languageSchema>;

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
