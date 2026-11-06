import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';
import { ApiRequestError } from './api';

/**
 * React Hook Form with a Zod schema from @whyme/schemas. Error messages are i18n
 * keys (e.g. "errors:phone_invalid"), so forms render them with `t(message)`.
 */
export function useZodForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  props?: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, 'resolver'>,
): UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>> {
  // TypeScript can't relate a generic Zod schema to the resolver's internal Zod4Type,
  // so the resolver is cast once here; callers still get fully typed forms.
  const resolver = zodResolver(schema) as unknown as Resolver<z.input<TSchema>, unknown, z.output<TSchema>>;

  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({ ...props, resolver });
}

/**
 * Puts the server's field errors (422 `fields`) onto the form. Returns false when
 * the error has no field errors, so the caller can show a general message instead.
 */
export function applyServerErrors<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, 'setError'>,
  error: unknown,
): boolean {
  if (!(error instanceof ApiRequestError) || !error.body?.fields) return false;
  const entries = Object.entries(error.body.fields);
  for (const [field, messages] of entries) {
    form.setError(field as Path<T>, { type: 'server', message: messages[0] ?? error.code });
  }
  return entries.length > 0;
}
