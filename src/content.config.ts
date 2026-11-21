import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * A file in this directory does NOT become a published article by default.
 * Only items explicitly signed off as approved can reach public routes.
 * This checks the content metadata, not the authenticity of an editor's identity:
 * GitHub permissions/branch rules must enforce who can approve a pull request.
 */
const reviewFields = {
  status: z.enum(["draft", "in_review", "approved"]).default("draft"),
  approvedBy: z.string().optional(),
  approvedAt: z.coerce.date().optional(),
  publishedAt: z.coerce.date().optional(),
  sourceUrls: z.array(z.string().url()).default([]),
};

type Reviewable = {
  status: "draft" | "in_review" | "approved";
  approvedBy?: string;
  approvedAt?: Date;
  publishedAt?: Date;
  sourceUrls: string[];
};

function validateApproval(value: Reviewable, ctx: z.RefinementCtx) {
  if (value.status !== "approved") return;
  if (value.approvedBy !== "syleriofficial") {
    ctx.addIssue({ code: "custom", path: ["approvedBy"], message: "Only owner-marked content can be published." });
  }
  if (!value.approvedAt || !value.publishedAt) {
    ctx.addIssue({ code: "custom", path: ["approvedAt"], message: "Approval and publication dates are required." });
  }
  if (value.sourceUrls.length === 0) {
    ctx.addIssue({ code: "custom", path: ["sourceUrls"], message: "Approved content must provide at least one source URL." });
  }
}

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string().min(10).max(180),
    description: z.string().min(25).max(320),
    category: z.enum(["desh", "duniya", "tech-ai", "vigyan", "entertainment", "video"]),
    author: z.string().min(2),
    image: z.string().startsWith("/images/").optional(),
    imageAlt: z.string().optional(),
    imageCredit: z.string().optional(),
    imageRights: z.string().optional(),
    ...reviewFields,
  }).superRefine((value, ctx) => {
    validateApproval(value, ctx);
    if (value.status !== "approved") return;
    if (value.image && (!value.imageAlt?.trim() || !value.imageRights?.trim())) {
      ctx.addIssue({ code: "custom", path: ["image"], message: "Approved articles with images need alt text and image rights details." });
    }
  }),
});

const stories = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/stories" }),
  schema: z.object({
    title: z.string().min(10).max(170),
    description: z.string().min(25).max(320),
    category: z.enum(["desh", "duniya", "tech-ai", "vigyan", "entertainment", "video"]),
    image: z.string().startsWith("/images/"),
    imageAlt: z.string().min(5),
    imageCredit: z.string().optional(),
    imageRights: z.string().min(5),
    slides: z.array(z.object({
      title: z.string().min(4).max(130),
      text: z.string().min(12).max(450),
    })).min(5).max(8),
    ...reviewFields,
  }).superRefine(validateApproval),
});

export const collections = { news, stories };
