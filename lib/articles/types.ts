/** 寫入 data/articles.json 的單筆紀錄（link 為唯一識別） */
export type StoredArticle = {
  link: string;
  title: string;
  source: string;
  pubDate: string;
  summaryZh: string;
  summarizedAt: string;
};
