import * as cheerio from 'cheerio';
import { z } from 'zod';

export const RawContentSchema = z.object({
  url: z.string().url(),
  html: z.string(),
  fetchedAt: z.date(),
  statusCode: z.number(),
});

export const ExtractedContentSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  plainText: z.string(),
  publishDate: z.date().optional(),
  author: z.string().optional(),
  wordCount: z.number(),
  mainContent: z.string(),
  images: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
});

export type RawContent = z.infer<typeof RawContentSchema>;
export type ExtractedContent = z.infer<typeof ExtractedContentSchema>;

/**
 * ContentExtractor - Extracts clean, structured content from raw HTML
 *
 * Features:
 * - Removes navigation, footer, ads, and other non-content elements
 * - Extracts metadata (title, author, publish date)
 * - Cleans and normalizes text
 * - Validates output structure
 */
export class ContentExtractor {
  /**
   * Extract content from raw HTML
   */
  static extract(rawContent: RawContent): ExtractedContent {
    const $ = cheerio.load(rawContent.html);

    // Remove non-content elements
    this.removeNonContentElements($);

    // Extract metadata
    const title = this.extractTitle($);
    const author = this.extractAuthor($);
    const publishDate = this.extractPublishDate($);

    // Extract main content
    const mainContent = this.extractMainContent($);
    const plainText = this.extractPlainText($);

    // Extract additional data
    const images = this.extractImages($);
    const links = this.extractLinks($);

    // Calculate word count
    const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;

    const extracted: ExtractedContent = {
      url: rawContent.url,
      title,
      plainText,
      publishDate,
      author,
      wordCount,
      mainContent,
      images,
      links,
    };

    // Validate output
    return ExtractedContentSchema.parse(extracted);
  }

  /**
   * Remove navigation, footer, ads, and other non-content elements
   */
  private static removeNonContentElements($: cheerio.CheerioAPI): void {
    // Remove common non-content elements
    $('nav, header, footer, aside, .sidebar, .nav, .menu, .advertisement, .ad, .social-share, .comments, .related-posts').remove();

    // Remove scripts and styles
    $('script, style, noscript').remove();

    // Remove elements with common ad-related classes/ids
    $('[class*="ad-"], [class*="advertisement"], [id*="ad-"], [id*="advertisement"]').remove();

    // Remove cookie banners and popups
    $('[class*="cookie"], [class*="popup"], [class*="modal"], [class*="overlay"]').remove();
  }

  /**
   * Extract page title
   */
  private static extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple selectors in order of preference
    let title = $('h1').first().text().trim();

    if (!title) {
      title = $('meta[property="og:title"]').attr('content')?.trim() || '';
    }

    if (!title) {
      title = $('title').first().text().trim();
    }

    if (!title) {
      title = 'Untitled';
    }

    // Clean up title (remove site name suffixes like " | Company Name")
    title = title.split('|')[0].split('–')[0].split('-')[0].trim();

    return title;
  }

  /**
   * Extract author information
   */
  private static extractAuthor($: cheerio.CheerioAPI): string | undefined {
    // Try multiple selectors
    let author = $('meta[name="author"]').attr('content')?.trim();

    if (!author) {
      author = $('meta[property="article:author"]').attr('content')?.trim();
    }

    if (!author) {
      author = $('[class*="author"], [class*="byline"]').first().text().trim();
    }

    // Clean up author text (remove "By " prefix, etc.)
    if (author) {
      author = author.replace(/^(by|written by|author:)\s*/i, '').trim();
    }

    return author;
  }

  /**
   * Extract publish date
   */
  private static extractPublishDate($: cheerio.CheerioAPI): Date | undefined {
    // Try multiple selectors
    let dateStr = $('meta[property="article:published_time"]').attr('content');

    if (!dateStr) {
      dateStr = $('meta[name="publishdate"]').attr('content');
    }

    if (!dateStr) {
      dateStr = $('time[datetime]').attr('datetime');
    }

    if (!dateStr) {
      dateStr = $('[class*="date"], [class*="published"]').first().text().trim();
    }

    if (dateStr) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        // Invalid date, return undefined
      }
    }

    return undefined;
  }

  /**
   * Extract main content area
   */
  private static extractMainContent($: cheerio.CheerioAPI): string {
    // Try to find main content area
    let mainContent = '';

    // Try common content selectors
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        mainContent = element.text().trim();
        if (mainContent.length > 100) {
          break;
        }
      }
    }

    // Fallback: use body if no main content found
    if (!mainContent || mainContent.length < 100) {
      mainContent = $('body').text().trim();
    }

    // Clean up whitespace
    mainContent = mainContent.replace(/\s+/g, ' ').trim();

    return mainContent;
  }

  /**
   * Extract plain text from entire page
   */
  private static extractPlainText($: cheerio.CheerioAPI): string {
    const text = $('body').text().trim();

    // Clean up whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract image URLs
   */
  private static extractImages($: cheerio.CheerioAPI): string[] {
    const images: string[] = [];

    $('img').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && src.startsWith('http')) {
        images.push(src);
      }
    });

    return images.slice(0, 10); // Limit to 10 images
  }

  /**
   * Extract links
   */
  private static extractLinks($: cheerio.CheerioAPI): string[] {
    const links: string[] = [];

    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && href.startsWith('http')) {
        links.push(href);
      }
    });

    // Deduplicate and limit
    return [...new Set(links)].slice(0, 50);
  }

  /**
   * Validate extracted content quality
   */
  static validateQuality(content: ExtractedContent): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (content.wordCount < 50) {
      issues.push('Content too short (< 50 words)');
    }

    if (content.title === 'Untitled') {
      issues.push('No title found');
    }

    if (content.mainContent.length < 100) {
      issues.push('Main content too short');
    }

    // Check for excessive whitespace (indicates poor extraction)
    const whitespaceRatio = (content.plainText.match(/\s/g) || []).length / content.plainText.length;
    if (whitespaceRatio > 0.5) {
      issues.push('Excessive whitespace in extracted text');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
