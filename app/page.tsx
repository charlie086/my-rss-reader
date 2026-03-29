import articlesJson from "@/data/articles.json";

import { groupArticlesByLocalDay } from "@/lib/articles/group-by-day";
import type { StoredArticle } from "@/lib/articles/types";

function formatDateLine(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Taipei",
  }).format(d);
}

function getArticles(): StoredArticle[] {
  if (!Array.isArray(articlesJson)) return [];
  return articlesJson as StoredArticle[];
}

export default function Home() {
  const articles = getArticles();
  const groups = groupArticlesByLocalDay(articles);

  return (
    <div className="flex-1">
      <header className="border-b border-zinc-200">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <p className="text-xs font-medium tracking-[0.22em] text-zinc-500">
            AI BRIEF
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            AI 資訊速覽
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700">
            每天 3 分鐘，客觀解讀 AI 前沿資訊
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        {groups.length === 0 ? (
          <p className="text-sm leading-7 text-zinc-600">
            尚無已儲存文章。請在本機執行{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.8rem] text-zinc-800">
              npm run fetch:summarize
            </code>
            並推送更新後的{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.8rem] text-zinc-800">
              data/articles.json
            </code>
            ；正式站會在下次 Build（例如 GitHub Actions 排程）後顯示新內容。
          </p>
        ) : (
          <div className="space-y-14">
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={`day-${group.id}`}>
                <div className="flex items-baseline justify-between gap-6">
                  <h2
                    id={`day-${group.id}`}
                    className="text-sm font-semibold tracking-wide text-zinc-950"
                  >
                    {group.label}
                  </h2>
                  <p className="text-xs tabular-nums tracking-wide text-zinc-500">
                    {formatDateLine(group.dateKey)}
                  </p>
                </div>

                <ol className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
                  {group.items.map((item) => (
                    <li key={item.link} className="py-7">
                      <article className="space-y-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-lg font-semibold leading-7 text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-800"
                          >
                            {item.title}
                          </a>
                          <span className="text-xs tracking-wide text-zinc-500">
                            {item.source}
                          </span>
                        </div>

                        <p className="text-sm leading-7 text-zinc-700">
                          {item.summaryZh}
                        </p>

                        <p className="text-xs text-zinc-500">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-800"
                          >
                            原文連結
                          </a>
                        </p>
                      </article>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 text-xs text-zinc-500 sm:px-6">
          內容於 Build 時自{" "}
          <code className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-[0.7rem]">
            data/articles.json
          </code>{" "}
          打包；更新腳本為{" "}
          <code className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-[0.7rem]">
            npm run update-data
          </code>{" "}
          ／{" "}
          <code className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-[0.7rem]">
            npm run fetch:summarize
          </code>
          。
        </div>
      </footer>
    </div>
  );
}
