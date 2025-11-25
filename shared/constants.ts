export const COMPETITORS = [
  'WalkMe',
  'Whatfix',
  'Pendo',
  'Appcues',
  'Apty'
] as const;

export type Competitor = typeof COMPETITORS[number];

export interface CompetitorSourceWithCategory {
  url: string;
  category: 'news' | 'case_studies' | 'analyst_reports' | 'changelog' | 'g2_reviews' | 'gartner_reviews' | 'gartner_likes_dislikes' | 'product_updates';
  timeFilter: '7days' | '1month' | 'current_month' | 'quarter';
  sourceName: string;
}

export interface CompetitorSource {
  name: string;
  urls: CompetitorSourceWithCategory[];
}

export interface IndustrySource {
  name: string;
  url: string;
  description: string;
}

export const COMPETITOR_SOURCES: Record<string, CompetitorSource> = {
  walkme: {
    name: 'WalkMe',
    urls: [
      {
        url: 'https://www.walkme.com/news/',
        category: 'news',
        timeFilter: 'current_month',
        sourceName: 'WalkMe News'
      },
      {
        url: 'https://www.walkme.com/customer-stories/',
        category: 'case_studies',
        timeFilter: '1month',
        sourceName: 'Customer Stories'
      },
      {
        url: 'https://www.g2.com/products/walkme/reviews',
        category: 'g2_reviews',
        timeFilter: 'current_month',
        sourceName: 'G2 Reviews'
      },
      {
        url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/walkme/product/walkme-digital-adoption-platform/reviews',
        category: 'gartner_reviews',
        timeFilter: 'current_month',
        sourceName: 'Gartner Reviews'
      },
      {
        url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/walkme/product/walkme-digital-adoption-platform/likes-dislikes',
        category: 'gartner_likes_dislikes',
        timeFilter: 'current_month',
        sourceName: 'Gartner Likes & Dislikes'
      }
    ]
  },
  whatfix: {
    name: 'Whatfix',
    urls: [
      {
        url: 'https://whatfix.com/newsroom/',
        category: 'news',
        timeFilter: 'current_month',
        sourceName: 'Newsroom'
      },
      {
        url: 'https://whatfix.com/resources/case-studies/',
        category: 'case_studies',
        timeFilter: '1month',
        sourceName: 'Case Studies'
      },
      {
        url: 'https://whatfix.com/resources/analyst-reports/',
        category: 'analyst_reports',
        timeFilter: 'quarter',
        sourceName: 'Analyst Reports'
      },
      {
        url: 'https://www.g2.com/products/whatfix/reviews',
        category: 'g2_reviews',
        timeFilter: 'current_month',
        sourceName: 'G2 Reviews'
      },
      {
        url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/whatfix/product/whatfix-digital-adoption-platform/reviews',
        category: 'gartner_reviews',
        timeFilter: 'current_month',
        sourceName: 'Gartner Reviews'
      },
      {
        url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/whatfix/product/whatfix-digital-adoption-platform/likes-dislikes',
        category: 'gartner_likes_dislikes',
        timeFilter: 'current_month',
        sourceName: 'Gartner Likes & Dislikes'
      }
    ]
  },
  pendo: {
    name: 'Pendo',
    urls: [
      {
        url: 'https://www.pendo.io/new/',
        category: 'product_updates',
        timeFilter: '1month',
        sourceName: 'What\'s New'
      },
      {
        url: 'https://www.pendo.io/customers/',
        category: 'case_studies',
        timeFilter: '1month',
        sourceName: 'Customer Stories'
      },
      {
        url: 'https://www.g2.com/products/pendo-io-pendo/reviews',
        category: 'g2_reviews',
        timeFilter: 'current_month',
        sourceName: 'G2 Reviews'
      },
      {
        url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/pendo/product/pendo/reviews',
        category: 'gartner_reviews',
        timeFilter: 'current_month',
        sourceName: 'Gartner Reviews'
      },
      {
        url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/pendo/product/pendo/likes-dislikes',
        category: 'gartner_likes_dislikes',
        timeFilter: 'current_month',
        sourceName: 'Gartner Likes & Dislikes'
      }
    ]
  },
  appcues: {
    name: 'Appcues',
    urls: [
      {
        url: 'https://feedback.appcues.com/changelog',
        category: 'changelog',
        timeFilter: '1month',
        sourceName: 'Changelog'
      },
      {
        url: 'https://www.g2.com/products/appcues/reviews',
        category: 'g2_reviews',
        timeFilter: 'current_month',
        sourceName: 'G2 Reviews'
      }
    ]
  },
  apty: {
    name: 'Apty',
    urls: [
      {
        url: 'https://apty.ai/newsroom/',
        category: 'news',
        timeFilter: 'current_month',
        sourceName: 'Newsroom'
      },
      {
        url: 'https://apty.ai/digital-adoption-case-studies/',
        category: 'case_studies',
        timeFilter: '1month',
        sourceName: 'Case Studies'
      },
      {
        url: 'https://www.g2.com/products/apty/reviews',
        category: 'g2_reviews',
        timeFilter: 'current_month',
        sourceName: 'G2 Reviews'
      },
      {
        url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/apty/product/apty/reviews',
        category: 'gartner_reviews',
        timeFilter: 'current_month',
        sourceName: 'Gartner Reviews'
      },
      {
        url: 'https://www.gartner.com/reviews/market/digital-adoption-platforms/vendor/apty/product/apty/likes-dislikes',
        category: 'gartner_likes_dislikes',
        timeFilter: 'current_month',
        sourceName: 'Gartner Likes & Dislikes'
      }
    ]
  }
};

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

export function getAllCompetitorNames(): string[] {
  return COMPETITORS.slice();
}

export function getCompetitorSlug(name: string): string {
  const slugMap: Record<string, string> = {
    'walkme': 'walkme',
    'whatfix': 'whatfix',
    'pendo': 'pendo',
    'appcues': 'appcues',
    'apty': 'apty',
  };
  
  const normalized = name.toLowerCase().trim();
  return slugMap[normalized] || normalized.replace(/\s+/g, '');
}

export function getAllCompetitorSlugs(): string[] {
  return COMPETITORS.map(getCompetitorSlug);
}
