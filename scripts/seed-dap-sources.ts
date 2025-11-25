#!/usr/bin/env tsx

/**
 * Database seeding script for Digital Adoption Platform (DAP) market research sources
 * 
 * This script:
 * 1. Deactivates existing competitor sources (from previous 7-competitor setup)
 * 2. Seeds DAP competitor sources (WalkMe, Whatfix, Pendo, Appcues, Apty - 5 competitors)
 * 3. Uses user-specified URLs with explicit category metadata
 * 
 * Run with: tsx scripts/seed-dap-sources.ts
 */

import pg from 'pg';
import { COMPETITOR_SOURCES, INDUSTRY_SOURCES } from '../shared/constants.js';

const { Pool } = pg;

interface CompetitorSourceRow {
  competitorSlug: string;
  sourceName: string;
  url: string;
  category: string;
  isActive: boolean;
  timeFilter: string;
}

interface IndustrySourceRow {
  sourceName: string;
  url: string;
  description: string;
  category: string;
  isActive: boolean;
  timeFilter: string;
}

async function seedDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mastra',
  });

  try {
    console.log('🔄 Starting DAP sources database seeding (5 competitors)...\n');

    // 1. Deactivate existing sources (preserve historical data, don't delete)
    console.log('🔒 Step 1: Deactivating existing competitor sources...');
    const deactivateResult = await pool.query('UPDATE competitor_sources SET is_active = false WHERE is_active = true');
    console.log(`   ✅ Deactivated ${deactivateResult.rowCount} competitor sources (preserved for historical queries)\n`);

    // 2. Seed competitor sources with explicit categories
    console.log('📊 Step 2: Seeding DAP competitor sources (5 competitors with user-specified URLs)...');
    let competitorCount = 0;

    for (const [slug, competitor] of Object.entries(COMPETITOR_SOURCES)) {
      console.log(`   🔹 Processing ${competitor.name} (${competitor.urls.length} sources)...`);
      
      for (const source of competitor.urls) {
        const row: CompetitorSourceRow = {
          competitorSlug: slug,
          sourceName: source.sourceName,
          url: source.url,
          category: source.category,
          isActive: true,
          timeFilter: source.timeFilter,
        };

        await pool.query(
          `INSERT INTO competitor_sources 
           (competitor_slug, source_name, url, category, is_active, time_filter) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [row.competitorSlug, row.sourceName, row.url, row.category, row.isActive, row.timeFilter]
        );

        console.log(`      ✓ ${source.sourceName} (${source.category}, ${source.timeFilter})`);
        competitorCount++;
      }
    }

    console.log(`\n   ✅ Seeded ${competitorCount} competitor sources\n`);

    // 3. Seed industry sources (upsert to avoid duplicates)
    console.log('📰 Step 3: Seeding DAP industry sources...');
    let industryCount = 0;

    for (const source of INDUSTRY_SOURCES) {
      // Determine category from description/name
      let category = 'research';
      
      if (source.name.includes('Gartner') || source.name.includes('G2')) {
        category = 'reports';
      } else if (source.name.includes('News') || source.name.includes('SaaS')) {
        category = 'news';
      } else if (source.name.includes('Alliance') || source.name.includes('Insider') || source.name.includes('UserOnboard')) {
        category = 'research';
      } else {
        category = 'research';
      }

      const row: IndustrySourceRow = {
        sourceName: source.name,
        url: source.url,
        description: source.description,
        category,
        isActive: true,
        timeFilter: '1month',
      };

      await pool.query(
        `INSERT INTO industry_sources 
         (source_name, url, description, category, is_active, time_filter) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (url) DO UPDATE SET
           source_name = EXCLUDED.source_name,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           is_active = EXCLUDED.is_active,
           time_filter = EXCLUDED.time_filter,
           updated_at = NOW()`,
        [row.sourceName, row.url, row.description, row.category, row.isActive, row.timeFilter]
      );

      industryCount++;
      console.log(`   ✅ ${source.name}`);
    }

    console.log(`\n   ✅ Seeded ${industryCount} industry sources\n`);

    // 4. Verify seeding
    console.log('🔍 Step 4: Verifying seeded data...');
    const competitorSourcesResult = await pool.query('SELECT COUNT(*) FROM competitor_sources WHERE is_active = true');
    const industrySourcesResult = await pool.query('SELECT COUNT(*) FROM industry_sources WHERE is_active = true');
    const deactivatedCount = await pool.query('SELECT COUNT(*) FROM competitor_sources WHERE is_active = false');
    
    console.log(`   ✅ Active competitor sources: ${competitorSourcesResult.rows[0].count}`);
    console.log(`   ✅ Active industry sources: ${industrySourcesResult.rows[0].count}`);
    console.log(`   📦 Deactivated (historical) sources: ${deactivatedCount.rows[0].count}\n`);

    // 5. Show breakdown by category
    console.log('📋 Step 5: Source breakdown by category...');
    const categoryBreakdown = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM competitor_sources 
      WHERE is_active = true 
      GROUP BY category 
      ORDER BY count DESC
    `);
    
    console.log('   Competitor source categories:');
    for (const row of categoryBreakdown.rows) {
      console.log(`      - ${row.category}: ${row.count}`);
    }

    console.log('\n🎉 DAP sources seeding completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - 5 DAP competitors: WalkMe, Whatfix, Pendo, Appcues, Apty`);
    console.log(`   - ${competitorCount} total competitor sources`);
    console.log(`   - ${industryCount} industry sources`);
    console.log(`   - Categories: news, case_studies, analyst_reports, changelog, g2_reviews, gartner_reviews, gartner_likes_dislikes`);
    console.log('\n✅ Database is ready for DAP market research!\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seeding script
seedDatabase().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
