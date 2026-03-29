import fs from "fs";
import path from "path";

import type { StoredArticle } from "./types";

const DATA_REL = ["data", "articles.json"] as const;

function getArticlesPath(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), ...DATA_REL);
}

export function loadStoredArticles(): StoredArticle[] {
  const filePath = getArticlesPath();
  if (!fs.existsSync(filePath)) return [];

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data as StoredArticle[];
  } catch {
    return [];
  }
}
