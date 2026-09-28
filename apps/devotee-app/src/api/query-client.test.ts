import { ApiError } from './client';
import { shouldRetry } from './query-client';

describe('shouldRetry', () => {
  it('retries network errors and 5xx twice', () => {
    const network = new ApiError(0, 'NETWORK_ERROR', 'x');
    expect(shouldRetry(0, network)).toBe(true);
    expect(shouldRetry(1, network)).toBe(true);
    expect(shouldRetry(2, network)).toBe(false);
    expect(shouldRetry(1, new ApiError(503, 'INTERNAL', 'x'))).toBe(true);
  });

  it('does not retry client errors', () => {
    expect(shouldRetry(0, new ApiError(404, 'DEITY_NOT_AVAILABLE', 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(402, 'COINS_INSUFFICIENT', 'x'))).toBe(false);
  });

  it('retries 429 once', () => {
    const limited = new ApiError(429, 'RATE_LIMITED', 'x');
    expect(shouldRetry(0, limited)).toBe(true);
    expect(shouldRetry(1, limited)).toBe(false);
  });
});
