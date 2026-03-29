import type { StoredArticle } from "./types";

const DISPLAY_TZ = "Asia/Taipei";

export type DayGroup = {
  id: string;
  label: string;
  dateKey: string;
  items: StoredArticle[];
};

function formatDateKeyInTz(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function getTodayYesterdayKeys(now: Date): { todayKey: string; yesterdayKey: string } {
  const todayKey = formatDateKeyInTz(now.toISOString());

  const startTodayTaipeiMs = Date.parse(`${todayKey}T00:00:00+08:00`);
  const yesterdayMs = startTodayTaipeiMs - 24 * 60 * 60 * 1000;
  const yesterdayKey = formatDateKeyInTz(new Date(yesterdayMs).toISOString());

  return { todayKey, yesterdayKey };
}

function formatDateZh(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: DISPLAY_TZ,
  }).format(d);
}

function labelForDateKey(
  dateKey: string,
  todayKey: string,
  yesterdayKey: string,
): string {
  if (dateKey === todayKey) return "今天";
  if (dateKey === yesterdayKey) return "昨天";
  return formatDateZh(dateKey);
}

/**
 * 依台灣時區的「日」分組；新聞已假設為陣列前段較新。
 */
export function groupArticlesByLocalDay(articles: StoredArticle[]): DayGroup[] {
  const now = new Date();
  const { todayKey, yesterdayKey } = getTodayYesterdayKeys(now);

  const map = new Map<string, StoredArticle[]>();
  for (const a of articles) {
    const key = formatDateKeyInTz(a.pubDate);
    const list = map.get(key);
    if (list) list.push(a);
    else map.set(key, [a]);
  }

  const keys = [...map.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  return keys.map((dateKey) => ({
    id: dateKey,
    label: labelForDateKey(dateKey, todayKey, yesterdayKey),
    dateKey,
    items: map.get(dateKey) ?? [],
  }));
}
