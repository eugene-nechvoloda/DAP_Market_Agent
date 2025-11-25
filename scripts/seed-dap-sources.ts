#!/usr/bin/env tsx

/**
 * Database seeding script for Digital Adoption Platform (DAP) market research sources
 * 
 * This script:
 * 1. Clears existing competitor and industry sources (from previous carbon accounting setup)
 * 2. Seeds DAP competitor sources (WalkMe, Pendo, Appcues, Whatfix, UserGuiding, Chameleon, Userpilot)
 * 3. Seeds DAP industry sources (Gartner, G2, Product-Led Alliance, etc.)
 * 
 * Run with: npm run seed-dap-sources
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
    console.log('🔄 Starting DAP sources database seeding...\n');

    // 1. Clear existing sources
    console.log('🗑️  Step 1: Clearing existing sources...');
    const deleteCompetitorResult = await pool.query('DELETE FROM competitor_sources');
    const deleteIndustryResult = await pool.query('DELETE FROM industry_sources');
    console.log(`   ✅ Deleted ${deleteCompetitorResult.rowCount} competitor sources`);
    console.log(`   ✅ Deleted ${deleteIndustryResult.rowCount} industry sources\n`);

    // 2. Seed competitor sources
    console.log('📊 Step 2: Seeding DAP competitor sources...');
    let competitorCount = 0;

    for (const [slug, competitor] of Object.entries(COMPETITOR_SOURCES)) {
      console.log(`   🔹 Processing ${competitor.name}...`);
      
      for (const url of competitor.urls) {
        // Determine category and source name from URL
        let category = 'blog';
        let sourceName = 'Blog';
        let timeFilter = '7days';

        if (url.includes('/blog')) {
          category = 'blog';
          sourceName = 'Blog';
          timeFilter = '7days';
        } else if (url.includes('/customers') || url.includes('/case-studies')) {
          category = 'case_studies';
          sourceName = 'Case Studies';
          timeFilter = '1month';
        } else if (url.includes('/press') || url.includes('/newsroom')) {
          category = 'press';
          sourceName = 'Press Releases';
          timeFilter = 'current_month';
        } else if (url.includes('/product') || url.includes('/features')) {
          category = 'product_updates';
          sourceName = 'Product Updates';
          timeFilter = '1month';
        }

        const row: CompetitorSourceRow = {
          competitorSlug: slug,
          sourceName,
          url,
          category,
          isActive: true,
          timeFilter,
        };

        await pool.query(
          `INSERT INTO competitor_sources 
           (competitor_slug, source_name, url, category, is_active, time_filter) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [row.competitorSlug, row.sourceName, row.url, row.category, row.isActive, row.timeFilter]
        );

        competitorCount++;
      }
    }

    // Add G2 review URLs for each competitor
    console.log('   🔹 Adding G2 review URLs...');
    for (const [slug, competitor] of Object.entries(COMPETITOR_SOURCES)) {
      const g2Url = `https://www.g2.com/products/${slug}/reviews`;
      
      await pool.query(
        `INSERT INTO competitor_sources 
         (competitor_slug, source_name, url, category, is_active, time_filter) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [slug, 'G2 Reviews', g2Url, 'reviews', true, 'current_month']
      );

      competitorCount++;
    }

    console.log(`   ✅ Seeded ${competitorCount} competitor sources\n`);

    // 3. Seed industry sources
    console.log('📰 Step 3: Seeding DAP industry sources...');
    let industryCount = 0;

    for (const source of INDUSTRY_SOURCES) {
      // Determine category from description/name
      let category = 'research';
      
      if (source.name.includes('Gartner') || source.name.includes('G2')) {
        category = 'reports';
      } else if (source.name.includes('News') || source.name.includes('SaaS')) {
        category = 'news';
      } else if (source.name.includes('Alliance') || source.name.includes('Insider')) {
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
    
    console.log(`   ✅ Active competitor sources: ${competitorSourcesResult.rows[0].count}`);
    console.log(`   ✅ Active industry sources: ${industrySourcesResult.rows[0].count}\n`);

    console.log('🎉 DAP sources seeding completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - 7 DAP competitors: WalkMe, Pendo, Appcues, Whatfix, UserGuiding, Chameleon, Userpilot`);
    console.log(`   - ${competitorCount} total competitor sources (including G2 reviews)`);
    console.log(`   - ${industryCount} industry sources`);
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
