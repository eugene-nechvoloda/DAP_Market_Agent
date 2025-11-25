import { db } from '../mastra/storage/db';
import { competitorMetrics, marketMetrics } from '../../shared/schema';
import { desc, eq, and, lt } from 'drizzle-orm';

// Get the Drizzle ORM instance from DatabaseService
const orm = db.getOrm();

/**
 * Trend indicator types
 */
export type TrendDirection = 'up' | 'down' | 'unchanged' | 'new';

export interface TrendIndicator {
  direction: TrendDirection;
  percentChange: number | null;
  absoluteChange: number | null;
  formattedChange: string; // e.g., "▲ +15.3%" or "▼ -$2.5M"
  previousValue: number | null;
  currentValue: number | null;
}

/**
 * Format a trend indicator with emoji and percentage
 */
export function formatTrend(
  current: number | null,
  previous: number | null,
  formatType: 'percent' | 'currency' | 'count' = 'percent'
): TrendIndicator {
  // Handle null or undefined current value
  if (current === null || current === undefined) {
    return {
      direction: 'unchanged',
      percentChange: null,
      absoluteChange: null,
      formattedChange: '━ No data',
      previousValue: previous,
      currentValue: current,
    };
  }

  // Handle null or undefined previous value (truly new data)
  if (previous === null || previous === undefined) {
    return {
      direction: 'new',
      percentChange: null,
      absoluteChange: null,
      formattedChange: '🆕 New data',
      previousValue: previous,
      currentValue: current,
    };
  }

  const absoluteChange = current - previous;
  // Handle divide-by-zero case: if previous is 0, we can't compute meaningful percentage
  // Set percentChange to null and rely on absoluteChange for direction
  const percentChange = previous === 0 
    ? null  // Can't compute percentage from zero baseline
    : (absoluteChange / previous) * 100;

  let direction: TrendDirection = 'unchanged';
  let indicator = '━';

  // Determine direction based on absoluteChange (works even when percentChange is null)
  if (Math.abs(absoluteChange) < 0.01) {
    direction = 'unchanged';
    indicator = '━';
  } else if (absoluteChange > 0) {
    direction = 'up';
    indicator = '▲';
  } else {
    direction = 'down';
    indicator = '▼';
  }

  // Format the change based on type
  let formattedValue = '';
  if (formatType === 'percent') {
    // Special case: previous was 0 (can't show percentage)
    if (previous === 0) {
      if (current === 0) {
        formattedValue = 'No change';
      } else if (current > 0) {
        formattedValue = 'New activity';
      } else {
        formattedValue = 'New decline'; // Edge case: 0 → negative
      }
    } else {
      formattedValue = `${percentChange! >= 0 ? '+' : ''}${percentChange!.toFixed(1)}%`;
    }
  } else if (formatType === 'currency') {
    const absChange = Math.abs(absoluteChange);
    const sign = absoluteChange >= 0 ? '+' : '-';
    if (absChange >= 1_000_000_000) {
      formattedValue = `${sign}$${(absChange / 1_000_000_000).toFixed(1)}B`;
    } else if (absChange >= 1_000_000) {
      formattedValue = `${sign}$${(absChange / 1_000_000).toFixed(1)}M`;
    } else if (absChange >= 1_000) {
      formattedValue = `${sign}$${(absChange / 1_000).toFixed(1)}K`;
    } else {
      formattedValue = `${sign}$${absChange.toFixed(0)}`;
    }
  } else if (formatType === 'count') {
    const absChange = Math.abs(absoluteChange);
    const sign = absoluteChange >= 0 ? '+' : '-';
    if (absChange >= 1_000_000) {
      formattedValue = `${sign}${(absChange / 1_000_000).toFixed(1)}M`;
    } else if (absChange >= 1_000) {
      formattedValue = `${sign}${(absChange / 1_000).toFixed(1)}K`;
    } else {
      formattedValue = `${sign}${Math.floor(absChange)}`;
    }
  }

  return {
    direction,
    percentChange,
    absoluteChange,
    formattedChange: `${indicator} ${formattedValue}`,
    previousValue: previous,
    currentValue: current,
  };
}

/**
 * Get competitor metrics for the current and previous week
 */
export async function getCompetitorTrends(
  competitorSlug: string,
  currentWeekStart: Date
): Promise<{
  current: typeof competitorMetrics.$inferSelect | null;
  previous: typeof competitorMetrics.$inferSelect | null;
  trends: {
    revenue?: TrendIndicator;
    valuation?: TrendIndicator;
    employeeCount?: TrendIndicator;
    fundingTotal?: TrendIndicator;
    customerCount?: TrendIndicator;
    churnRate?: TrendIndicator;
    retentionRate?: TrendIndicator;
    userBase?: TrendIndicator;
    userGrowthRate?: TrendIndicator;
    organicTraffic?: TrendIndicator;
    organicKeywords?: TrendIndicator;
  };
}> {
  // Get current week's metrics
  const currentMetrics = await orm
    .select()
    .from(competitorMetrics)
    .where(
      and(
        eq(competitorMetrics.competitorSlug, competitorSlug),
        eq(competitorMetrics.reportingWeekStart, currentWeekStart)
      )
    )
    .limit(1);

  // Get previous week's metrics (7 days earlier)
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const previousMetrics = await orm
    .select()
    .from(competitorMetrics)
    .where(
      and(
        eq(competitorMetrics.competitorSlug, competitorSlug),
        lt(competitorMetrics.reportingWeekStart, currentWeekStart)
      )
    )
    .orderBy(desc(competitorMetrics.reportingWeekStart))
    .limit(1);

  const current = currentMetrics[0] || null;
  const previous = previousMetrics[0] || null;

  // Calculate trends for each metric
  const trends = {
    revenue: formatTrend(
      current?.revenueUsd != null ? Number(current.revenueUsd) : null,
      previous?.revenueUsd != null ? Number(previous.revenueUsd) : null,
      'currency'
    ),
    valuation: formatTrend(
      current?.valuationUsd != null ? Number(current.valuationUsd) : null,
      previous?.valuationUsd != null ? Number(previous.valuationUsd) : null,
      'currency'
    ),
    employeeCount: formatTrend(
      current?.employeeCount ?? null,
      previous?.employeeCount ?? null,
      'count'
    ),
    fundingTotal: formatTrend(
      current?.fundingTotalUsd != null ? Number(current.fundingTotalUsd) : null,
      previous?.fundingTotalUsd != null ? Number(previous.fundingTotalUsd) : null,
      'currency'
    ),
    customerCount: formatTrend(
      current?.customerCount ?? null,
      previous?.customerCount ?? null,
      'count'
    ),
    churnRate: formatTrend(
      current?.churnRate != null ? Number(current.churnRate) : null,
      previous?.churnRate != null ? Number(previous.churnRate) : null,
      'percent'
    ),
    retentionRate: formatTrend(
      current?.retentionRate != null ? Number(current.retentionRate) : null,
      previous?.retentionRate != null ? Number(previous.retentionRate) : null,
      'percent'
    ),
    userBase: formatTrend(
      current?.userBase ?? null,
      previous?.userBase ?? null,
      'count'
    ),
    userGrowthRate: formatTrend(
      current?.userGrowthRate != null ? Number(current.userGrowthRate) : null,
      previous?.userGrowthRate != null ? Number(previous.userGrowthRate) : null,
      'percent'
    ),
    organicTraffic: formatTrend(
      current?.organicTraffic ?? null,
      previous?.organicTraffic ?? null,
      'count'
    ),
    organicKeywords: formatTrend(
      current?.organicKeywords ?? null,
      previous?.organicKeywords ?? null,
      'count'
    ),
  };

  return { current, previous, trends };
}

/**
 * Get market-level trends
 */
export async function getMarketTrends(currentWeekStart: Date): Promise<{
  current: typeof marketMetrics.$inferSelect | null;
  previous: typeof marketMetrics.$inferSelect | null;
  trends: {
    marketSize?: TrendIndicator;
    yoyGrowth?: TrendIndicator;
    totalSearchVolume?: TrendIndicator;
    aggregateFunding?: TrendIndicator;
  };
}> {
  // Get current week's metrics
  const currentMetrics = await orm
    .select()
    .from(marketMetrics)
    .where(eq(marketMetrics.reportingWeekStart, currentWeekStart))
    .limit(1);

  // Get previous week's metrics
  const previousMetrics = await orm
    .select()
    .from(marketMetrics)
    .where(lt(marketMetrics.reportingWeekStart, currentWeekStart))
    .orderBy(desc(marketMetrics.reportingWeekStart))
    .limit(1);

  const current = currentMetrics[0] || null;
  const previous = previousMetrics[0] || null;

  // Calculate trends for each metric
  const trends = {
    marketSize: formatTrend(
      current?.marketSizeUsd != null ? Number(current.marketSizeUsd) : null,
      previous?.marketSizeUsd != null ? Number(previous.marketSizeUsd) : null,
      'currency'
    ),
    yoyGrowth: formatTrend(
      current?.yoyGrowthPct != null ? Number(current.yoyGrowthPct) : null,
      previous?.yoyGrowthPct != null ? Number(previous.yoyGrowthPct) : null,
      'percent'
    ),
    totalSearchVolume: formatTrend(
      current?.totalSearchVolume ?? null,
      previous?.totalSearchVolume ?? null,
      'count'
    ),
    aggregateFunding: formatTrend(
      current?.aggregateFundingUsd != null ? Number(current.aggregateFundingUsd) : null,
      previous?.aggregateFundingUsd != null ? Number(previous.aggregateFundingUsd) : null,
      'currency'
    ),
  };

  return { current, previous, trends };
}

/**
 * Get all competitors' latest metrics with trends
 */
export async function getAllCompetitorTrends(currentWeekStart: Date) {
  const competitors = ['walkme', 'whatfix', 'pendo', 'appcues', 'apty'];

  const results = await Promise.all(
    competitors.map((slug) => getCompetitorTrends(slug, currentWeekStart))
  );

  return competitors.reduce(
    (acc, slug, idx) => {
      acc[slug] = results[idx];
      return acc;
    },
    {} as Record<string, Awaited<ReturnType<typeof getCompetitorTrends>>>
  );
}
