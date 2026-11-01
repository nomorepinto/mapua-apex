import { AsyncLocalStorage } from 'node:async_hooks';
import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

const budgets = new AsyncLocalStorage<{
  signal: AbortSignal;
  deadline: number;
}>();

export function reportTimeout(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'REPORT_TIMEOUT',
    retryable: true,
    message:
      'Report retrieval timed out. Narrow the date range or filters and retry.',
  });
}

export function reportTooLarge(): never {
  throw new UnprocessableEntityException({
    code: 'REPORT_TOO_LARGE',
    message:
      'Report exceeds the synchronous limit. Narrow the date range or filters, or select summary only.',
  });
}

export function reportRequestOptions(): { abortSignal?: AbortSignal } {
  const budget = budgets.getStore();
  if (budget && (budget.signal.aborted || Date.now() >= budget.deadline))
    throw reportTimeout();
  return budget ? { abortSignal: budget.signal } : {};
}

export async function withReportBudget<T>(work: () => Promise<T>): Promise<T> {
  if (budgets.getStore()) {
    reportRequestOptions();
    return work();
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(reportTimeout());
    }, 20_000);
  });
  try {
    return await Promise.race([
      budgets.run(
        { signal: controller.signal, deadline: Date.now() + 20_000 },
        work,
      ),
      timeout,
    ]);
  } catch (error) {
    if (controller.signal.aborted) throw reportTimeout();
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
