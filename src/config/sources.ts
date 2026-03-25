import type { RssSource, NaverSearchConfig } from '../types/index.js';

export const RSS_SOURCES: RssSource[] = [
  {
    name: 'techcrunch',
    url: 'https://techcrunch.com/feed/',
    language: 'en',
  },
  {
    name: 'theverge',
    url: 'https://www.theverge.com/rss/index.xml',
    language: 'en',
  },
  {
    name: 'arstechnica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    language: 'en',
  },
  {
    name: 'hackernews',
    url: 'https://hnrss.org/frontpage',
    language: 'en',
  },
];

export const NAVER_CONFIG: NaverSearchConfig = {
  keywords: ['AI', '인공지능', '테크', 'IT'],
  display: 10,
  sort: 'date',
};
