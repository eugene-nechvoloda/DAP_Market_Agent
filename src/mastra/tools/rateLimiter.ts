/**
 * Rate Limiter for External API Calls
 * 
 * Prevents hitting API rate limits by:
 * - Limiting requests per minute
 * - Adding delays between consecutive requests
 * - Batching requests to spread them over time
 */

interface RateLimiterOptions {
  requestsPerMinute: number;
  delayBetweenRequests: number; // milliseconds
}

class RateLimiter {
  private requestTimestamps: number[] = [];
  private options: RateLimiterOptions;
  private lastRequestTime: number = 0;

  constructor(options: RateLimiterOptions) {
    this.options = options;
  }

  /**
   * Wait if necessary to respect rate limits
   * Returns a promise that resolves when it's safe to make the next request
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    
    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 60000
    );

    // Check if we've hit the per-minute limit
    if (this.requestTimestamps.length >= this.options.requestsPerMinute) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestRequest) + 100; // Add 100ms buffer
      
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
      
      // Remove the oldest timestamp since we've waited
      this.requestTimestamps.shift();
    }

    // Enforce minimum delay between consecutive requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.options.delayBetweenRequests) {
      const delayNeeded = this.options.delayBetweenRequests - timeSinceLastRequest;
      await this.sleep(delayNeeded);
    }

    // Record this request
    this.lastRequestTime = Date.now();
    this.requestTimestamps.push(this.lastRequestTime);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  reset(): void {
    this.requestTimestamps = [];
    this.lastRequestTime = 0;
  }

  /**
   * Get current status
   */
  getStatus(): { requestsInLastMinute: number; canMakeRequest: boolean } {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      timestamp => now - timestamp < 60000
    );

    return {
      requestsInLastMinute: recentRequests.length,
      canMakeRequest: recentRequests.length < this.options.requestsPerMinute,
    };
  }
}

// Create a shared rate limiter instance for Perplexity API
// Settings: 3 requests per minute, 30 second delay between requests
// This ensures requests are spread over 90+ seconds total, avoiding rate limits
export const perplexityRateLimiter = new RateLimiter({
  requestsPerMinute: 3,
  delayBetweenRequests: 30000, // 30 seconds between requests
});
