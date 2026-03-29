import path from "path";

import { FinishReason, GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerativeModel } from "@google/generative-ai";
import { config } from "dotenv";

import { loadStoredArticles } from "../lib/articles/load-articles";
import { saveStoredArticles } from "../lib/articles/save-articles";
import type { StoredArticle } from "../lib/articles/types";
import { fetchRecentRssArticles } from "../lib/rss/fetch-recent";
import type { RssSourceConfig } from "../lib/rss/types";

config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

const args = process.argv.slice(2);
const REPAIR_MODE = args.includes("--repair");

/** 測試用：TechCrunch AI + Hacker News 官方 RSS */
const SUMMARIZE_SOURCES: RssSourceConfig[] = [
  {
    id: "techcrunch-ai",
    name: "TechCrunch — Artificial Intelligence",
    feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    id: "hacker-news",
    name: "Hacker News",
    feedUrl: "https://news.ycombinator.com/rss",
  },
];

const SYSTEM_PROMPT =
  "你是一個資深的科技新聞編輯。將英文科技新聞稿總結為中文。規則：絕對客觀冷靜、不帶主觀情緒、嚴禁標題黨詞彙（如炸裂、殺瘋了）。請用約 180～250 字寫成一段語意完整的摘要：須交代核心事實或主張、關鍵主體（公司／機構／產品）與影響或後續；句末需自然收尾，禁止半成品句子。請只輸出正文一段，不要副標題或編號。";

/** 僅作資安／成本防呆；正常應由模型在限定內寫完 */
const SUMMARY_HARD_MAX_CHARS = 380;

/**
 * Gemini 2.x 可能因內部推理耗用 token，導致 MAX_TOKENS 時正文極短；拉高上限。
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 */
const MAX_OUTPUT_TOKENS = 8192;

/**
 * 節省成本：預設用 Flash。`gemini-2.0-flash` 對新 API Key 常回 404，改用最後一代 Flash。
 * 若仍報錯，請到 https://ai.google.dev/gemini-api/docs/models 查可用 ID，並在 .env.local 設 GEMINI_MODEL。
 */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function resolveApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "缺少 Gemini API Key。請在 .env.local 設定 GEMINI_API_KEY（或 GOOGLE_API_KEY）後再執行。\n" +
        "取得方式：https://aistudio.google.com/apikey",
    );
  }
  return key;
}

function resolveModel(): string {
  return (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL).trim();
}

/** 用於偵測模型或舊版程式造成的半成品摘要 */
function isIncompleteSummary(text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length < 100) return true;
  if (!/[。！？…]\s*$/.test(t)) return true;
  return false;
}

function clampSummaryToMaxChars(text: string, maxChars: number): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) return normalized;

  const head = chars.slice(0, maxChars).join("");
  const sentenceEnders = ["。", "！", "？", ".", "!", "?"];
  let bestEnd = -1;
  for (const mark of sentenceEnders) {
    const idx = head.lastIndexOf(mark);
    if (idx > bestEnd) bestEnd = idx;
  }
  if (bestEnd >= 60) {
    return head.slice(0, bestEnd + 1).trim();
  }

  const commaIdx = head.lastIndexOf("，");
  if (commaIdx >= 60) {
    return `${head.slice(0, commaIdx + 1).trim()}…`;
  }

  return `${head.trim()}…`;
}

async function generateSummaryOnce(
  model: GenerativeModel,
  userPayload: string,
): Promise<{ text: string; finishReason?: FinishReason }> {
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPayload }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });

  const response = result.response;
  const finishReason = response.candidates?.[0]?.finishReason;
  const text = response.text()?.trim() ?? "";

  return { text, finishReason };
}

async function summarizeArticle(
  genAI: GoogleGenerativeAI,
  modelId: string,
  title: string,
  contentSnippet: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: SYSTEM_PROMPT,
  });

  const baseUser = `標題：${title}\n\n摘要：${contentSnippet}`;

  let { text: raw, finishReason } = await generateSummaryOnce(model, baseUser);

  if (
    finishReason === FinishReason.MAX_TOKENS ||
    isIncompleteSummary(raw)
  ) {
    console.warn(
      `Gemini 摘要可能不完整（finishReason=${finishReason ?? "UNKNOWN"}），自動重試一次…`,
    );
    raw = (
      await generateSummaryOnce(
        model,
        `${baseUser}\n\n【校正】上一輪輸出過短、未以句號結尾或未寫完。請「只輸出一整段」完整中文摘要，約 180～250 字；最後一個字必須是「。」；不要重複英文標題、不要加前言。`,
      )
    ).text;
  }

  if (isIncompleteSummary(raw)) {
    console.warn(
      "重試後摘要仍偏短或缺句號；已寫入目前最佳結果。若為舊資料，請執行 npm run fetch:summarize:repair",
    );
  }

  return clampSummaryToMaxChars(raw, SUMMARY_HARD_MAX_CHARS);
}

async function runIngest(genAI: GoogleGenerativeAI, modelId: string): Promise<void> {
  const existing = loadStoredArticles();
  const knownLinks = new Set(existing.map((a) => a.link));

  const { articles: rssItems, errors } = await fetchRecentRssArticles({
    sources: SUMMARIZE_SOURCES,
    windowHours: 24,
  });

  if (errors.length > 0) {
    console.warn("部分 RSS 來源失敗：");
    for (const e of errors) {
      console.warn(`- [${e.sourceId}] ${e.message}`);
    }
  }

  const additions: StoredArticle[] = [];

  for (const item of rssItems) {
    if (knownLinks.has(item.link)) continue;

    console.log(`須總結（新連結）：${item.link}`);

    const summaryZh = await summarizeArticle(
      genAI,
      modelId,
      item.title,
      item.contentSnippet,
    );

    const summarizedAt = new Date().toISOString();
    const record: StoredArticle = {
      link: item.link,
      title: item.title,
      source: item.sourceName,
      pubDate: item.pubDate,
      summaryZh,
      summarizedAt,
    };

    additions.push(record);
    knownLinks.add(item.link);
  }

  const merged: StoredArticle[] = [...additions, ...existing];
  saveStoredArticles(merged);

  console.log(
    `完成：模型 ${modelId}；RSS 筆數 ${rssItems.length}，本次新增 ${additions.length}，資料庫共 ${merged.length} 筆 → data/articles.json`,
  );
}

async function runRepair(genAI: GoogleGenerativeAI, modelId: string): Promise<void> {
  const { articles: rssItems, errors } = await fetchRecentRssArticles({
    sources: SUMMARIZE_SOURCES,
    windowHours: 24 * 14,
  });

  if (errors.length > 0) {
    console.warn("部分 RSS 來源失敗（修復仍會保留無 RSS 比對的條目）：");
    for (const e of errors) {
      console.warn(`- [${e.sourceId}] ${e.message}`);
    }
  }

  const rssByLink = new Map(rssItems.map((r) => [r.link, r] as const));

  const existing = loadStoredArticles();
  let repaired = 0;
  const next: StoredArticle[] = [];

  for (const article of existing) {
    if (!isIncompleteSummary(article.summaryZh)) {
      next.push(article);
      continue;
    }

    const rss = rssByLink.get(article.link);
    const title = rss?.title ?? article.title;
    const snippet =
      rss?.contentSnippet?.trim() ||
      "（RSS 已無此則摘要，請依標題與你所知的公開背景寫作，仍須符合長度與句號結尾要求。）";

    console.log(`修復摘要：${article.link}`);

    const summaryZh = await summarizeArticle(genAI, modelId, title, snippet);

    next.push({
      ...article,
      title,
      summaryZh,
      summarizedAt: new Date().toISOString(),
    });
    repaired += 1;
  }

  saveStoredArticles(next);
  console.log(
    `修復完成：模型 ${modelId}；共修復 ${repaired} 則不完整摘要，資料庫 ${next.length} 筆 → data/articles.json`,
  );
}

async function main(): Promise<void> {
  const apiKey = resolveApiKey();
  const modelId = resolveModel();
  const genAI = new GoogleGenerativeAI(apiKey);

  if (REPAIR_MODE) {
    await runRepair(genAI, modelId);
  } else {
    await runIngest(genAI, modelId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
