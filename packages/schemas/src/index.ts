// Client-side form validation. The server re-validates everything (FormRequests);
// these only give quick feedback. Error messages are i18n keys from @whyme/i18n.
import { z } from 'zod';

/**
 * Normalises a Nigerian mobile number to E.164 (+234…). Accepts 0803…, 803…,
 * 234803… and +234803…, with spaces or dashes. Returns null if it isn't valid.
 */
export function normaliseNigerianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  let national: string;
  if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  else return null;
  // Nigerian mobile prefixes start with 7, 8 or 9 (e.g. 703, 803, 906, 913).
  return /^[789][01]\d{8}$/.test(national) ? `+234${national}` : null;
}

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => normaliseNigerianPhone(v) !== null, { message: 'errors:phone_invalid' })
  .transform((v) => normaliseNigerianPhone(v)!);

export const otpSchema = z.string().trim().regex(/^\d{6}$/, { message: 'errors:otp_invalid' });

export const passwordSchema = z.string().min(8, { message: 'errors:validation_failed' }).max(128);

export const nameSchema = z.string().trim().min(2).max(120);

export const registerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
