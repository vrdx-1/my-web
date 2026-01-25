/**
 * Performance Monitoring Utilities
 * Provides utilities for tracking performance metrics
 */

/**
 * Measure and log performance of async operations
 */
export async function measurePerformance<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    }
    
    // TODO: Send to monitoring service in production
    // if (process.env.NODE_ENV === 'production' && duration > 1000) {
    //   // Log slow operations
    //   Sentry.addBreadcrumb({
    //     category: 'performance',
    //     message: `${name} took ${duration}ms`,
    //     level: 'warning',
    //   });
    // }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if device is on slow connection
 */
export function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return false;
  }
  
  const connection = (navigator as any).connection;
  if (!connection) return false;
  
  // Check effective type
  const effectiveType = connection.effectiveType;
  return effectiveType === 'slow-2g' || effectiveType === '2g';
}

/**
 * Get connection info for optimization
 */
export function getConnectionInfo(): {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
} {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return {};
  }
  
  const connection = (navigator as any).connection;
  if (!connection) return {};
  
  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
  };
}
