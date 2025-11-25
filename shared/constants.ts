export const COMPETITORS = [
  'WalkMe',
  'Pendo',
  'Appcues',
  'Whatfix',
  'UserGuiding',
  'Chameleon',
  'Userpilot'
] as const;

export type Competitor = typeof COMPETITORS[number];

export interface CompetitorSource {
  name: string;
  urls: string[];
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
    'pendo': 'pendo',
    'appcues': 'appcues',
    'whatfix': 'whatfix',
    'userguiding': 'userguiding',
    'user guiding': 'userguiding',
    'chameleon': 'chameleon',
    'userpilot': 'userpilot',
  };
  
  const normalized = name.toLowerCase().trim();
  return slugMap[normalized] || normalized.replace(/\s+/g, '');
}

export function getAllCompetitorSlugs(): string[] {
  return COMPETITORS.map(getCompetitorSlug);
}
