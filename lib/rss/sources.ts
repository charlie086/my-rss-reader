import type { RssSourceConfig } from "./types";

/**
 * 測試用科技媒體 RSS（可依需求增刪）。
 * 若某 feed 404 或改版，API 仍會回傳其他來源與 errors 陣列說明失敗原因。
 */
export const RSS_SOURCE_CONFIG: RssSourceConfig[] = [
  {
    id: "techcrunch-ai",
    name: "TechCrunch — Artificial Intelligence",
    feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    id: "the-verge-ai",
    name: "The Verge — AI / Artificial Intelligence",
    feedUrl: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
  {
    id: "wired-ai",
    name: "Wired — AI",
    feedUrl: "https://www.wired.com/feed/tag/ai/latest/rss",
  },
  {
    id: "ars-technica",
    name: "Ars Technica — All",
    feedUrl: "https://feeds.arstechnica.com/arstechnica/index",
  },
  {
    id: "mit-tr-ai",
    name: "MIT Technology Review — Artificial Intelligence",
    feedUrl: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
  },
];
