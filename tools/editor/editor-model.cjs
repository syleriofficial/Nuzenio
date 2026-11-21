/**
 * Nuzenio Editorial Studio — export-only content model.
 *
 * Runs offline in browsers and in Node.js test runner.
 * No storage, no fetch, no GitHub credentials, no publishing.
 */
(function (root, makeModel) {
  const model = makeModel();
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  if (root) root.NuzenioDraftModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATEGORIES = [
    ["desh", "देश"], ["duniya", "दुनिया"], ["tech-ai", "टेक और AI"],
    ["vigyan", "विज्ञान"], ["entertainment", "एंटरटेनमेंट"], ["video", "वीडियो"],
  ];
  const CATEGORY_SLUGS = CATEGORIES.map((value) => value[0]);
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const IMAGE_RE = /^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:avif|jpg|jpeg|png|webp|svg)$/i;

  function clean(value) { return String(value ?? "").trim(); }
  function valueLength(value) { return Array.from(clean(value)).length; }
  function safeSlug(value) { return clean(value).toLowerCase(); }
  function parseUrls(value) {
    const raw = Array.isArray(value) ? value : clean(value).split(/\r?\n/);
    return raw.map(clean).filter(Boolean);
  }
  function isValidSourceUrl(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) &&
        Boolean(url.hostname) && !url.username && !url.password &&
        !/\s/.test(value);
    } catch { return false; }
  }
  function yamlQuote(value) {
    return JSON.stringify(clean(value)).replace(/\u2028/g, "\\u2028").replace(/\u2029/g,"\\u2029");
  }
  function requiredRange(field, value, min, max, label, errors) {
    const n = valueLength(value);
    if (n < min || n > max) errors[field] = label + " में " + min + "–" + max + " अक्षर होने चाहिए।";
  }
  function normalizeArticle(input) {
    return {
      kind: "news", slug: safeSlug(input.slug), title: clean(input.title),
      description: clean(input.description), author: clean(input.author),
      category: clean(input.category), body: String(input.body ?? "").trim(),
      image: clean(input.image), imageAlt: clean(input.imageAlt),
      imageCredit: clean(input.imageCredit), imageRights: clean(input.imageRights),
      sourceUrls: parseUrls(input.sourceUrls),
    };
  }
  function normalizeStory(input) {
    return {
      kind: "stories", slug: safeSlug(input.slug), title: clean(input.title),
      description: clean(input.description), category: clean(input.category),
      image: clean(input.image), imageAlt: clean(input.imageAlt),
      imageCredit: clean(input.imageCredit), imageRights: clean(input.imageRights),
      sourceUrls: parseUrls(input.sourceUrls),
      slides: (Array.isArray(input.slides) ? input.slides : []).map((slide) => ({
        title: clean(slide?.title), text: clean(slide?.text),
      })),
    };
  }
  function validate(input) {
    const value = input.kind === "stories" ? normalizeStory(input) : normalizeArticle(input);
    const errors = {};
    if (!SLUG_RE.test(value.slug) || value.slug.length > 90) {
      errors.slug = "URL slug केवल छोटे अंग्रेज़ी अक्षर, संख्या और हाइफ़न से बनाएँ (अधिकतम 90)।";
    }
    requiredRange("title", value.title, 10, 180, "शीर्षक", errors);
    requiredRange("description", value.description, 25, 320, "विवरण", errors);
    if (!CATEGORY_SLUGS.includes(value.category)) errors.category = "एक मान्य न्यूज़ कैटेगरी चुनें।";
    if (value.sourceUrls.some((url) => !isValidSourceUrl(url))) errors.sourceUrls = "केवल http/https लिंक लिखें, एक पंक्ति में एक URL।";
    if (value.image && !IMAGE_RE.test(value.image)) errors.image = "चित्र का पथ /images/filename.webp जैसे प्रारूप में हो।";
    if (value.kind === "news") {
      requiredRange("author", value.author, 2, 120, "लेखक का नाम", errors);
      if (valueLength(value.body) < 60) errors.body = "लेख के लिए कम-से-कम 60 अक्षर का मूल पाठ लिखें।";
      if (value.image && (valueLength(value.imageAlt) < 5 || valueLength(value.imageRights) < 5)) {
        errors.image = "चित्र होने पर Alt Text और चित्र के उपयोग-अधिकार की जानकारी दें।";
      }
    } else {
      if (!IMAGE_RE.test(value.image)) errors.image = "Web Story के लिए /images/ से शुरू होने वाला स्थानीय चित्र आवश्यक है।";
      requiredRange("imageAlt", value.imageAlt, 5, 240, "चित्र Alt Text", errors);
      requiredRange("imageRights", value.imageRights, 5, 600, "चित्र अधिकार", errors);
      if (value.slides.length < 5 || value.slides.length > 8) errors.slides = "5 से 8 स्लाइड्स आवश्यक हैं।";
      value.slides.forEach((slide, i) => {
        requiredRange("slide-" + i + "-title", slide.title, 4, 130, "स्लाइड " + (i+1) + " का शीर्षक", errors);
        requiredRange("slide-" + i + "-text", slide.text, 12, 450, "स्लाइड " + (i+1) + " का विवरण", errors);
      });
    }
    return { value, errors, valid: Object.keys(errors).length === 0 };
  }

  /** All exports intentionally have status:draft; approval cannot be created in the editor. */
  function createFile(input) {
    const { value, errors, valid } = validate(input);
    if (!valid) return { ok: false, errors };
    if (value.kind === "stories") {
      const json = {
        title: value.title,
        description: value.description,
        category: value.category,
        image: value.image,
        imageAlt: value.imageAlt,
        ...(value.imageCredit && { imageCredit: value.imageCredit }),
        imageRights: value.imageRights,
        status: "draft",
        sourceUrls: value.sourceUrls,
        slides: value.slides,
      };
      return {
        ok: true, filename: value.slug + ".json",
        directory: "src/content/stories/",
        content: JSON.stringify(json, null, 2) + "\n",
        mime: "application/json;charset=utf-8",
      };
    }
    const lines = [
      "---",
      "title: " + yamlQuote(value.title),
      "description: " + yamlQuote(value.description),
      "category: " + yamlQuote(value.category),
      "author: " + yamlQuote(value.author),
      ...(value.image ? [
        "image: " + yamlQuote(value.image),
        "imageAlt: " + yamlQuote(value.imageAlt),
        ...(value.imageCredit ? ["imageCredit: " + yamlQuote(value.imageCredit)] : []),
        "imageRights: " + yamlQuote(value.imageRights),
      ] : []),
      "status: draft",
      "sourceUrls:",
      ...(value.sourceUrls.length ? value.sourceUrls.map((url) => "  - " + yamlQuote(url)) : ["  []"]),
      "---", "", value.body, "",
    ];
    // Handle an empty YAML sourceUrl array as a scalar, not a sequence item.
    if (value.sourceUrls.length === 0) {
      const pos = lines.indexOf("sourceUrls:");
      lines.splice(pos, 2, "sourceUrls: []");
    }
    return {
      ok: true, filename: value.slug + ".md", directory: "src/content/news/",
      content: lines.join("\n"), mime: "text/markdown;charset=utf-8",
    };
  }

  function draftTemplate(kind) {
    if (kind === "stories") return {
      kind: "stories", slug: "", title: "", description: "", category: "desh",
      image: "", imageAlt: "", imageCredit: "", imageRights: "",
      sourceUrls: "", slides: Array.from({ length: 5 }, () => ({ title: "", text: "" })),
    };
    return {
      kind: "news", slug: "", title: "", description: "", category: "desh",
      author: "Nuzenio Desk", image: "", imageAlt: "", imageCredit: "",
      imageRights: "", sourceUrls: "", body: "",
    };
  }
  return {
    CATEGORIES, SLUG_RE, IMAGE_RE, safeSlug, parseUrls,
    validate, createFile, draftTemplate, normalizeArticle, normalizeStory,
  };
});
