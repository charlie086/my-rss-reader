export type RssSourceConfig = {
  id: string;
  name: string;
  feedUrl: string;
};

/** 單篇文章的乾淨 JSON 輸出 */
export type RssArticleRecord = {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  sourceId: string;
  sourceName: string;
};

export type RssFetchError = {
  sourceId: string;
  sourceName: string;
  feedUrl: string;
  message: string;
};

export type RssRecentFetchResult = {
  fetchedAt: string;
  windowHours: number;
  articles: RssArticleRecord[];
  errors: RssFetchError[];
};
