import { describe, expect, it } from 'vitest';
import { normaliseNigerianPhone, phoneSchema } from '../src';

describe('normaliseNigerianPhone', () => {
  it.each([
    ['0803 123 4567', '+2348031234567'],
    ['08031234567', '+2348031234567'],
    ['+234 803 123 4567', '+2348031234567'],
    ['2349061234567', '+2349061234567'],
    ['7031234567', '+2347031234567'],
  ])('accepts %s', (input, expected) => {
    expect(normaliseNigerianPhone(input)).toBe(expected);
  });

  it.each(['0803123456', '01234567890', '+447911123456', 'abc'])('rejects %s', (input) => {
    expect(normaliseNigerianPhone(input)).toBeNull();
  });

  it('returns the i18n error key on failure', () => {
    const result = phoneSchema.safeParse('123');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('errors:phone_invalid');
  });
});
