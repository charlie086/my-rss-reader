import Parser from "rss-parser";

import { RSS_SOURCE_CONFIG } from "./sources";
import type {
  RssArticleRecord,
  RssFetchError,
  RssRecentFetchResult,
  RssSourceConfig,
} from "./types";

const parser = new Parser({
  timeout: 20_000,
  headers: {
    "User-Agent":
      "my-rss-reader/1.0 (+https://example.com; RSS aggregator; respectful fetch)",
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
});

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getContentSnippet(item: Parser.Item): string {
  const rawSnippet =
    typeof item.contentSnippet === "string" ? item.contentSnippet.trim() : "";
  if (rawSnippet.length > 0) return rawSnippet;

  const raw =
    (typeof item.content === "string" && item.content) ||
    (typeof item.summary === "string" && item.summary) ||
    "";
  const plain = stripHtml(raw);
  return plain.length > 500 ? `${plain.slice(0, 497)}…` : plain;
}

function getItemTimestampMs(item: Parser.Item): number | null {
  const raw = item.isoDate || item.pubDate;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function isWithinLastHours(ms: number, hours: number): boolean {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return ms >= cutoff;
}

function normalizeLink(item: Parser.Item): string | null {
  const link = item.link;
  if (typeof link === "string" && link.trim().length > 0) return link.trim();

  const enclosure = item.enclosure;
  const encUrl =
    enclosure &&
    typeof enclosure === "object" &&
    typeof enclosure.url === "string"
      ? enclosure.url.trim()
      : "";
  if (encUrl.length > 0) return encUrl;

  return null;
}

/**
 * 遍歷 RSS 來源，抓取過去 `windowHours` 小時內發布的文章，回傳整理後的 JSON 結構。
 */
export async function fetchRecentRssArticles(options?: {
  sources?: RssSourceConfig[];
  windowHours?: number;
}): Promise<RssRecentFetchResult> {
  const windowHours = options?.windowHours ?? 24;
  const sources = options?.sources ?? RSS_SOURCE_CONFIG;

  const errors: RssFetchError[] = [];
  const articles: RssArticleRecord[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.feedUrl);
        const items = Array.isArray(feed.items) ? feed.items : [];

        for (const item of items) {
          const title = typeof item.title === "string" ? item.title.trim() : "";
          const link = normalizeLink(item);
          const ts = getItemTimestampMs(item);

          if (!title || !link || ts === null) continue;
          if (!isWithinLastHours(ts, windowHours)) continue;

          articles.push({
            title,
            link,
            pubDate: new Date(ts).toISOString(),
            contentSnippet: getContentSnippet(item),
            sourceId: source.id,
            sourceName: source.name,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({
          sourceId: source.id,
          sourceName: source.name,
          feedUrl: source.feedUrl,
          message,
        });
      }
    }),
  );

  articles.sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));

  return {
    fetchedAt: new Date().toISOString(),
    windowHours,
    articles,
    errors,
  };
}
