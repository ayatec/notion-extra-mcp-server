// 固定間隔方式のレートリミッター（Notion API: 平均3req/s）
export class RateLimiter {
  private lastRequestTime = 0;
  private readonly intervalMs: number;

  constructor(requestsPerSecond: number = 3) {
    this.intervalMs = 1000 / requestsPerSecond;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.intervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.intervalMs - elapsed));
    }

    this.lastRequestTime = Date.now();
  }
}
