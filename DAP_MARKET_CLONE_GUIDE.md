# DAP Market Research Agent - Cloning Guide

## Step 1: Create New Replit Project

1. **Fork this Replit**: Click the three dots menu → "Fork Repl"
2. **Rename**: Change name to "DAP-Market-Research-Agent"
3. **Description**: "Automated weekly market research agent for Digital Adoption Platform market"

---

## Step 2: Update Market-Specific Configuration

### A. Define DAP Competitors (shared/constants.ts)

Replace the COMPETITORS array with 7 DAP companies:

```typescript
export const COMPETITORS = [
  'WalkMe',
  'Pendo',
  'Appcues', 
  'Whatfix',
  'UserGuiding',
  'Chameleon',
  'Userpilot'
] as const;
```

### B. Update Curated URLs Per Competitor (shared/constants.ts)

Replace COMPETITOR_SOURCES object with DAP company URLs:

```typescript
export const COMPETITOR_SOURCES: Record<string, CompetitorSource> = {
  walkme: {
    name: 'WalkMe',
    urls: [
      'https://www.walkme.com/blog/',
      'https://www.walkme.com/customers/',
      'https://www.walkme.com/press-releases/',
      'https://www.walkme.com/product/'
    ]
  },
  pendo: {
    name: 'Pendo',
    urls: [
      'https://www.pendo.io/blog/',
      'https://www.pendo.io/customers/',
      'https://www.pendo.io/newsroom/',
      'https://www.pendo.io/product/'
    ]
  },
  appcues: {
    name: 'Appcues',
    urls: [
      'https://www.appcues.com/blog',
      'https://www.appcues.com/customers',
      'https://www.appcues.com/press',
      'https://www.appcues.com/product'
    ]
  },
  whatfix: {
    name: 'Whatfix',
    urls: [
      'https://whatfix.com/blog/',
      'https://whatfix.com/customers/',
      'https://whatfix.com/newsroom/',
      'https://whatfix.com/product/'
    ]
  },
  userguiding: {
    name: 'UserGuiding',
    urls: [
      'https://userguiding.com/blog/',
      'https://userguiding.com/case-studies/',
      'https://userguiding.com/press/',
      'https://userguiding.com/features/'
    ]
  },
  chameleon: {
    name: 'Chameleon',
    urls: [
      'https://www.chameleon.io/blog',
      'https://www.chameleon.io/customers',
      'https://www.chameleon.io/press',
      'https://www.chameleon.io/product'
    ]
  },
  userpilot: {
    name: 'Userpilot',
    urls: [
      'https://userpilot.com/blog/',
      'https://userpilot.com/case-studies/',
      'https://userpilot.com/press/',
      'https://userpilot.com/features/'
    ]
  }
};
```

### C. Update Industry Sources (shared/constants.ts)

Replace INDUSTRY_SOURCES with DAP industry sources:

```typescript
export const INDUSTRY_SOURCES: IndustrySource[] = [
  {
    name: 'Gartner Digital Adoption Platforms',
    url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms',
    description: 'Gartner research and analyst reports on DAP market'
  },
  {
    name: 'G2 Digital Adoption Platform Category',
    url: 'https://www.g2.com/categories/digital-adoption-platforms',
    description: 'User reviews and DAP market trends'
  },
  {
    name: 'Product-Led Alliance',
    url: 'https://productled.com/blog',
    description: 'Product-led growth and adoption strategies'
  },
  {
    name: 'SaaS Industry News',
    url: 'https://www.saastr.com/blog/',
    description: 'SaaS industry trends and DAP market insights'
  },
  {
    name: 'UserOnboard',
    url: 'https://www.useronboard.com/blog/',
    description: 'User onboarding best practices and product adoption'
  },
  {
    name: 'Product Management Insider',
    url: 'https://www.productmanagementinsider.com/',
    description: 'Product analytics and user engagement trends'
  }
];
```

---

## Step 3: Update Agent Instructions

### File: `src/mastra/agents/dapMarketResearchAgent.ts`

Update the market focus sections:

**Change Report Title:**
```typescript
# Carbon Accounting Software Market - Weekly Intelligence Report
```
TO:
```typescript
# Digital Adoption Platform Market - Weekly Intelligence Report
```

**Update Market Context:**
Replace references to:
- "Carbon Accounting Software" → "Digital Adoption Platform"
- "climate tech" → "SaaS/product analytics"
- "emissions tracking" → "user onboarding"
- "sustainability" → "product adoption"
- "GHG Protocol" → "product-led growth"

**Update Competitor Spotlight Sections:**
- "Carbon Tracking Features" → "User Onboarding Features"
- "Sustainability Integrations" → "Third-Party Integrations"
- "Emissions Calculation" → "Product Analytics"

---

## Step 4: Update Search Queries in Workflow

### File: `src/mastra/workflows/weeklyMarketResearchWorkflow.ts`

#### Step: `performWebSearches`

**Broad Pulse Search Query:**
```typescript
// OLD:
const broadQuery = `Carbon accounting software news ${weekRangeLabel}`;

// NEW:
const broadQuery = `Digital adoption platform news ${weekRangeLabel}`;
```

**Targeted Market Data Query:**
```typescript
// OLD:
const targetedQuery = `Carbon accounting software market size growth investment ${currentMonth} ${currentYear}`;

// NEW:
const targetedQuery = `Digital adoption platform market size growth investment ${currentMonth} ${currentYear}`;
```

#### Step: `searchPerCompetitorIntelligence`

**Per-Competitor Query Template:**
```typescript
// OLD:
const query = `${competitor} carbon accounting latest news funding product updates...`;

// NEW:
const query = `${competitor} digital adoption platform latest news funding product updates launches release notes press releases new features partnerships user reviews ${timespanStr}`;
```

#### Step: `searchUserFeedback`

**User Review Query:**
```typescript
// OLD:
const query = `${competitor} carbon accounting user reviews G2 Capterra...`;

// NEW:
const query = `${competitor} digital adoption platform user reviews G2 Capterra customer feedback pros cons ${reviewTimespanStr}`;
```

#### Step: `searchMarketDataAndReports`

**Market Data Query:**
```typescript
// OLD:
const marketDataQuery = `Carbon accounting software market size growth rate ${currentMonth} ${currentYear}, investment trends, CAGR analyst reports, Forrester Gartner climate tech sustainability ESG market forecast predictions`;

// NEW:
const marketDataQuery = `Digital adoption platform market size growth rate ${currentMonth} ${currentYear}, investment trends, CAGR analyst reports, Forrester Gartner SaaS product analytics user onboarding market forecast predictions`;
```

**Industry Reports Query:**
```typescript
// OLD:
const industryReportsQuery = `Carbon accounting software industry reports ${reportDateRange}, industry analysis, analyst reviews, market research, sustainability reporting standards updates, climate tech industry trends`;

// NEW:
const industryReportsQuery = `Digital adoption platform industry reports ${reportDateRange}, industry analysis, analyst reviews, market research, product-led growth trends, SaaS onboarding industry trends`;
```

---

## Step 5: Update Project Documentation

### File: `replit.md`

**Overview Section:**
```markdown
# Overview

This project is a Mastra-based AI agent automation platform for **Digital Adoption Platform Market Research**. It automatically researches 7 key competitors and analyzes industry trends from 6 major research sources, aggregates user reviews, generates comprehensive weekly reports using GPT-5, exports them to Google Docs, and sends Slack notifications. The system runs every Monday at 8:00 AM CET.

The platform aims to provide automated, in-depth market analysis for the Digital Adoption Platform industry, leveraging AI agents for data gathering and report generation...
```

**Update External Dependencies:**
```markdown
## External Dependencies

### AI/LLM Services
- **OpenAI API**: Primary LLM provider (GPT-5 for reports, GPT-4o-mini for extraction).
- **Anthropic API**: Claude Sonnet 4.5 for structured parsing and extraction.
- **Perplexity API**: Primary data source for per-competitor intelligence, AI-powered search with citations via `webSearchTool`.
- **SerpAPI**: Fallback search provider when Perplexity rate limits are reached.
```

### File: `package.json`

```json
{
  "name": "dap-market-research-agent",
  "version": "1.0.0",
  "description": "Automated weekly market research agent for Digital Adoption Platform market",
  ...
}
```

---

## Step 6: Environment Setup

### PostgreSQL Database

1. **Create new database**: Use Replit's built-in PostgreSQL
2. **Run migrations**: `npm run db:push`
3. **Verify schema**: Check that all tables are created

### Environment Variables (Secrets)

Copy these from the original project (values will auto-sync if using same Replit account):
- `DATABASE_URL`
- `PERPLEXITY_API_KEY`
- `SERPAPI_API_KEY`
- `SLACK_BOT_TOKEN`
- `GOOGLE_DOCS_CLIENT_EMAIL`
- `GOOGLE_DOCS_PRIVATE_KEY`
- `SESSION_SECRET`

### Production Environment Variables

Already set in the original, will need to be set in new deployment:
- `NODE_OPTIONS="--max-old-space-size=4096"` (for build memory)

---

## Step 7: Update Web Report Branding

### File: `src/server/index.ts` (if you have web routes)

Update page titles and headers:
```typescript
// OLD:
<title>Carbon Accounting Market Research</title>

// NEW:
<title>Digital Adoption Platform Market Research</title>
```

---

## Step 8: Testing Checklist

After making all changes:

1. ✅ **Start workflows**: `mastra dev`
2. ✅ **Verify compilation**: No TypeScript errors
3. ✅ **Test workflow manually**: Trigger via Inngest dashboard
4. ✅ **Check database**: Verify metrics are being stored
5. ✅ **Test report generation**: Ensure GPT-5 generates DAP-focused content
6. ✅ **Verify Google Docs export**: Check formatting and content
7. ✅ **Test Slack notification**: Confirm message received

---

## Step 9: Deployment

1. **Set cron expression**: `0 7 * * 1` (Every Monday 8 AM CET)
2. **Schedule description**: "Every Monday at 8 AM CET"
3. **Deploy**: Click Publish button
4. **Monitor first run**: Check Inngest dashboard for execution logs

---

## What Stays Exactly the Same

✅ **All workflow orchestration logic**
✅ **Database schema** (no changes needed)
✅ **Google Docs export pipeline**
✅ **Slack integration setup**
✅ **Web report structure and styling**
✅ **Perplexity/SerpAPI integration code**
✅ **Claude + GPT-5 model configuration**
✅ **Memory limit fixes** (NODE_OPTIONS)
✅ **Intelligent timespan filtering logic**

---

## Quick Reference: Files to Modify

| File | What to Change |
|------|----------------|
| `shared/constants.ts` | Competitors, URLs, Industry sources |
| `src/mastra/agents/dapMarketResearchAgent.ts` | Agent instructions, market focus |
| `src/mastra/workflows/weeklyMarketResearchWorkflow.ts` | Search query keywords |
| `package.json` | Project name and description |
| `replit.md` | Project overview and documentation |

---

## Files That Don't Need Changes

- `src/mastra/storage/db.ts` (database logic)
- `src/mastra/tools/webSearchTool.ts` (search tool)
- `shared/schema.ts` (database schema)
- `scripts/build.sh` (build script)
- All infrastructure and orchestration code

---

## Summary

This is essentially a "search and replace" operation where you swap:
- **Market**: Carbon Accounting → Digital Adoption Platform
- **Competitors**: 7 carbon companies → 7 DAP companies  
- **Industry focus**: Climate/sustainability → SaaS/product adoption
- **Keywords**: emissions, carbon, climate → onboarding, adoption, analytics

The entire technical infrastructure remains identical!
