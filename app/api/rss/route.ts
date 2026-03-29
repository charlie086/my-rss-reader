import { fetchRecentRssArticles } from "@/lib/rss/fetch-recent";

export const runtime = "nodejs";

export async function GET() {
  const data = await fetchRecentRssArticles({ windowHours: 24 });
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
