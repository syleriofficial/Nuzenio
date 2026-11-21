import { getCollection } from "astro:content";

export async function getApprovedNews() {
  const entries = await getCollection("news", ({ data }) =>
    data.status === "approved" &&
    data.approvedBy === "syleriofficial" &&
    Boolean(data.approvedAt && data.publishedAt) &&
    data.sourceUrls.length > 0
  );
  return entries.sort((a, b) => (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0));
}

export async function getApprovedStories() {
  const entries = await getCollection("stories", ({ data }) =>
    data.status === "approved" &&
    data.approvedBy === "syleriofficial" &&
    Boolean(data.approvedAt && data.publishedAt) &&
    data.sourceUrls.length > 0
  );
  return entries.sort((a, b) => (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0));
}

export function formatHindiDate(date: Date): string {
  return new Intl.DateTimeFormat("hi-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}
