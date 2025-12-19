import { z } from 'zod';

export const ValidatedCitationSchema = z.object({
  url: z.string().url(),
  isAccessible: z.boolean(),
  statusCode: z.number().optional(),
  finalUrl: z.string().url().optional(), // After redirects
  isValid: z.boolean(),
  validationErrors: z.array(z.string()),
  checkedAt: z.date(),
});

export type ValidatedCitation = z.infer<typeof ValidatedCitationSchema>;

/**
 * CitationValidator - Validates URLs before use in reports
 *
 * Validation checks:
 * 1. URL format validation
 * 2. Accessibility check (HTTP status)
 * 3. Redirect resolution
 * 4. Broken link detection
 */
export class CitationValidator {
  private static cache = new Map<string, ValidatedCitation>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Validate a single URL
   */
  static async validate(url: string): Promise<ValidatedCitation> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) {
      const age = Date.now() - cached.checkedAt.getTime();
      if (age < this.CACHE_TTL) {
        return cached;
      }
    }

    const validationErrors: string[] = [];
    let isValid = true;

    // 1. Format validation
    try {
      new URL(url);
    } catch (error) {
      validationErrors.push('Invalid URL format');
      isValid = false;
      const result: ValidatedCitation = {
        url,
        isAccessible: false,
        isValid,
        validationErrors,
        checkedAt: new Date(),
      };
      this.cache.set(url, result);
      return result;
    }

    // 2. Accessibility check
    let statusCode: number | undefined;
    let finalUrl: string | undefined;
    let isAccessible = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DAP-Market-Research-Bot/1.0)',
        },
      });

      clearTimeout(timeoutId);

      statusCode = response.status;
      finalUrl = response.url;

      if (statusCode >= 200 && statusCode < 400) {
        isAccessible = true;
      } else if (statusCode === 404) {
        validationErrors.push('URL not found (404)');
        isValid = false;
      } else if (statusCode >= 400 && statusCode < 500) {
        validationErrors.push(`Client error (${statusCode})`);
        isValid = false;
      } else if (statusCode >= 500) {
        validationErrors.push(`Server error (${statusCode})`);
        isValid = false;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        validationErrors.push('Request timeout');
      } else {
        validationErrors.push(`Network error: ${(error as Error).message}`);
      }
      isValid = false;
      isAccessible = false;
    }

    // 3. Check for suspicious redirects
    if (finalUrl && finalUrl !== url) {
      const originalDomain = new URL(url).hostname;
      const finalDomain = new URL(finalUrl).hostname;

      if (originalDomain !== finalDomain) {
        // Different domain redirect - might be suspicious
        validationErrors.push(`Redirects to different domain: ${finalDomain}`);
        // Don't mark as invalid, just warn
      }
    }

    const result: ValidatedCitation = {
      url,
      isAccessible,
      statusCode,
      finalUrl,
      isValid,
      validationErrors,
      checkedAt: new Date(),
    };

    // Cache result
    this.cache.set(url, result);

    return ValidatedCitationSchema.parse(result);
  }

  /**
   * Validate multiple URLs in batch
   */
  static async validateBatch(urls: string[]): Promise<ValidatedCitation[]> {
    // Deduplicate URLs
    const uniqueUrls = [...new Set(urls)];

    // Validate in parallel with concurrency limit
    const concurrency = 10;
    const results: ValidatedCitation[] = [];

    for (let i = 0; i < uniqueUrls.length; i += concurrency) {
      const batch = uniqueUrls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.validate(url))
      );
      results.push(...batchResults);

      // Small delay between batches
      if (i + concurrency < uniqueUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Filter out invalid citations
   */
  static filterValid(citations: ValidatedCitation[]): ValidatedCitation[] {
    return citations.filter(c => c.isValid && c.isAccessible);
  }

  /**
   * Get validation summary statistics
   */
  static getSummary(citations: ValidatedCitation[]): {
    total: number;
    valid: number;
    accessible: number;
    broken: number;
    invalidFormat: number;
    redirected: number;
  } {
    return {
      total: citations.length,
      valid: citations.filter(c => c.isValid).length,
      accessible: citations.filter(c => c.isAccessible).length,
      broken: citations.filter(c => !c.isAccessible).length,
      invalidFormat: citations.filter(c => c.validationErrors.includes('Invalid URL format')).length,
      redirected: citations.filter(c => c.finalUrl && c.finalUrl !== c.url).length,
    };
  }

  /**
   * Extract all URLs from markdown text
   */
  static extractUrls(markdown: string): string[] {
    const urls: string[] = [];

    // Match markdown links: [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownLinkRegex.exec(markdown)) !== null) {
      urls.push(match[2]);
    }

    // Match plain URLs
    const urlRegex = /https?:\/\/[^\s)]+/g;
    while ((match = urlRegex.exec(markdown)) !== null) {
      urls.push(match[0]);
    }

    return [...new Set(urls)]; // Deduplicate
  }

  /**
   * Validate all citations in a markdown report
   */
  static async validateMarkdownReport(markdown: string): Promise<{
    citations: ValidatedCitation[];
    summary: ReturnType<typeof CitationValidator.getSummary>;
    hasIssues: boolean;
  }> {
    const urls = this.extractUrls(markdown);
    const citations = await this.validateBatch(urls);
    const summary = this.getSummary(citations);

    return {
      citations,
      summary,
      hasIssues: summary.broken > 0 || summary.invalidFormat > 0,
    };
  }

  /**
   * Clear validation cache (useful for testing)
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
