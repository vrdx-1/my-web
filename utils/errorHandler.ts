/**
 * Error Handling Utilities
 * Provides centralized error handling and logging
 */

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Handle and log errors consistently
 */
export function handleError(
  error: Error | unknown,
  context?: ErrorContext
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', {
      message: errorMessage,
      stack: errorStack,
      context,
    });
  }
  
  // TODO: Send to error tracking service in production
  // if (process.env.NODE_ENV === 'production') {
  //   Sentry.captureException(error, {
  //     tags: {
  //       component: context?.component,
  //       action: context?.action,
  //     },
  //     user: context?.userId ? { id: context.userId } : undefined,
  //     extra: context?.metadata,
  //   });
  // }
}

/**
 * Create error handler with context
 */
export function createErrorHandler(context: ErrorContext) {
  return (error: Error | unknown) => {
    handleError(error, context);
  };
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Safe async operation that returns null on error
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    return null;
  }
}
