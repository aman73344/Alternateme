import { logger } from '@/utils/logger';

interface MetricPoint {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

class MetricsCollector {
  private metrics: MetricPoint[] = [];

  record(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({ name, value, tags, timestamp: Date.now() });
    logger.debug({ metric: name, value, tags }, 'metric recorded');
  }

  increment(name: string, tags?: Record<string, string>): void {
    this.record(name, 1, tags);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record(name, value, tags);
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record(name, durationMs, { ...tags, unit: 'ms' });
  }

  flush(): MetricPoint[] {
    const batch = [...this.metrics];
    this.metrics = [];
    return batch;
  }
}

export const metrics = new MetricsCollector();
