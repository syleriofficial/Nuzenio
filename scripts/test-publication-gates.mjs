/**
 * Isolated acceptance check: content in draft / in_review must not reach dist.
 * Uses disposable fixture files and cleans up even when a check fails.
 * No production publish, credentials, network news or remote writes.
 */
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const newsDir = "src/content/news";
const storiesDir = "src/content/stories";
const approvedNews = join(newsDir, "ci-approved-news.md");
const draftNews = join(newsDir, "ci-draft-news.md");
const approvedStory = join(storiesDir, "ci-approved-story.json");
const draftStory = join(storiesDir, "ci-draft-story.json");

function check(test, message) {
  if (!test) throw new Error(message);
}
function jsonStory(status) {
  return {
    title: "CI test example story not a real news report",
    description: "CI preview fixture, not a real report. Created only during the build test.",
    category: "tech-ai",
    image: "/images/ai.svg",
    imageAlt: "Original illustration of computer circuits",
    imageRights: "CI-only original fixture reference",
    sourceUrls: status === "approved" ? ["https://example.com/fixture"] : [],
    status,
    ...(status === "approved" ? {
      approvedBy: "syleriofficial",
      approvedAt: "2026-11-21T08:00:00Z",
      publishedAt: "2026-11-21T08:10:00Z",
    } : {}),
    slides: Array.from({ length: 5 }, (_, i) => ({ title: "Test slide " + (i+1), text: "This is a disposable CI fixture slide with example text only." })),
  };
}
try {
  mkdirSync(newsDir, { recursive: true });
  mkdirSync(storiesDir, { recursive: true });
  writeFileSync(approvedNews, [
    "---",
    "title: 'CI fixture example — approved article'",
    "description: 'CI disposable example article for static publication-gate testing only.'",
    "category: tech-ai",
    "author: 'Test runner'",
    "status: approved",
    "approvedBy: syleriofficial",
    "approvedAt: '2026-11-21T08:00:00Z'",
    "publishedAt: '2026-11-21T08:10:00Z'",
    "sourceUrls:",
    "  - https://example.com/fixture",
    "---",
    "",
    "This is a disposable test article, not a report of an actual event.",
  ].join("\n"));
  writeFileSync(draftNews, [
    "---",
    "title: 'CI fixture example — private draft'",
    "description: 'CI disposable example that must not create a public news route.'",
    "category: desh",
    "author: 'Test runner'",
    "status: draft",
    "---",
    "",
    "This draft must never be built as public content.",
  ].join("\n"));
  writeFileSync(approvedStory, JSON.stringify(jsonStory("approved")));
  writeFileSync(draftStory, JSON.stringify(jsonStory("in_review")));

  const result = spawnSync("npm", ["run", "build"], { stdio: "inherit", shell: process.platform === "win32" });
  check(result.status === 0, "Astro failed during publication-gate fixture build.");

  check(existsSync("dist/news/ci-approved-news/index.html"), "Approved article route missing.");
  check(!existsSync("dist/news/ci-draft-news/index.html"), "Draft article was published.");
  check(existsSync("dist/web-stories/ci-approved-story/index.html"), "Approved story route missing.");
  check(!existsSync("dist/web-stories/ci-draft-story/index.html"), "In-review story was published.");
  check(readFileSync("dist/index.html","utf8").includes("noindex, nofollow"), "Preview indexing safeguard missing.");
  check(readFileSync("dist/admin/index.html","utf8").includes("लॉगिन अभी बंद है"), "Closed CMS placeholder missing.");
  console.log("PASS: approved entries visible, drafts excluded, preview/noindex and admin deny-by-default retained.");
} finally {
  [approvedNews, draftNews, approvedStory, draftStory].forEach((file) => rmSync(file, { force: true }));
}
