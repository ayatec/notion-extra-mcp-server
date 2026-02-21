import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../rate-limiter.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RateLimiter', () => {
  it('初回呼び出しは即座に通過する', async () => {
    const limiter = new RateLimiter(3);
    const start = Date.now();

    await limiter.wait();

    // 初回は待機なし
    expect(Date.now() - start).toBeLessThan(10);
  });

  it('連続呼び出しでインターバル分だけ待機する', async () => {
    const limiter = new RateLimiter(3);
    // 3req/s = 333ms 間隔

    await limiter.wait();

    const waitPromise = limiter.wait();
    // setTimeout が呼ばれているはず
    await vi.advanceTimersByTimeAsync(334);
    await waitPromise;
  });

  it('インターバル経過後は即座に通過する', async () => {
    const limiter = new RateLimiter(3);

    await limiter.wait();

    // 十分な時間を進める
    await vi.advanceTimersByTimeAsync(500);

    const start = Date.now();
    await limiter.wait();
    // 間隔が十分空いているので待機なし
    expect(Date.now() - start).toBeLessThan(10);
  });

  it('カスタムレートを受け付ける', async () => {
    const limiter = new RateLimiter(1);
    // 1req/s = 1000ms 間隔

    await limiter.wait();

    const waitPromise = limiter.wait();
    // 500msでは足りない
    await vi.advanceTimersByTimeAsync(500);

    // まだ解決されていないので、さらに進める
    await vi.advanceTimersByTimeAsync(501);
    await waitPromise;
  });
});
