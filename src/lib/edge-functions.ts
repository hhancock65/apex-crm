import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js"

interface InvokeRetryOptions {
  retries?: number
  baseDelayMs?: number
}

/**
 * Wraps supabase.functions.invoke() with retry/backoff on transient failures.
 * A FunctionsHttpError with a 4xx status (bad request, not found, auth) means
 * the request itself is wrong and will fail identically every time, so those
 * are not retried — only network failures and 5xx are, since the edge
 * functions themselves already retry the flaky part (calls to the Retell API).
 */
export async function invokeWithRetry<T = unknown>(
  supabase: SupabaseClient,
  functionName: string,
  body: Record<string, unknown>,
  { retries = 2, baseDelayMs = 600 }: InvokeRetryOptions = {}
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.functions.invoke<T>(functionName, { body })
    if (!error) return data as T

    lastError = error

    const isClientError = error instanceof FunctionsHttpError && error.context.status < 500
    if (isClientError || attempt === retries) break

    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt))
  }

  if (lastError instanceof FunctionsHttpError) {
    const body = await lastError.context.json().catch(() => null)
    const message = body?.error ?? lastError.message
    throw new Error(message)
  }

  throw lastError instanceof Error ? lastError : new Error(`${functionName} failed`)
}
