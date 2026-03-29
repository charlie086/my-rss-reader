import fs from "fs";
import path from "path";

import type { StoredArticle } from "./types";

export function saveStoredArticles(articles: StoredArticle[]): void {
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "articles.json");
  const body = `${JSON.stringify(articles, null, 2)}\n`;
  fs.writeFileSync(filePath, body, "utf8");
}
