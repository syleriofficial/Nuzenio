import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Model = require("../tools/editor/editor-model.cjs");
const validNews = {
  kind: "news",
  slug: "important-explainer",
  title: "यह केवल संपादकीय परीक्षण का एक नमूना शीर्षक है",
  description: "यह समाचार नहीं, बल्कि Nuzenio संपादकीय ड्राफ्ट टूल की जाँच के लिए एक विवरण है।",
  category: "tech-ai",
  author: "Nuzenio Desk",
  body: "यह Nuzenio डेमो के लिए बनाया गया मूल नमूना लेख है। यह किसी वास्तविक घटना या व्यक्ति के बारे में दावा नहीं करता।",
  sourceUrls: "https://example.com/fixture\nhttps://example.org/document",
};

const validStory = {
  kind: "stories", slug: "scientific-explainer",
  title: "यह केवल परीक्षण के लिए एक उदाहरण वेब स्टोरी है",
  description: "यह Nuzenio के लिए एक परीक्षण कथा है, कोई प्रकाशित या सत्यापित समाचार रिपोर्ट नहीं।",
  category: "vigyan", image: "/images/ai.svg",
  imageAlt: "कंप्यूटर चिप का मूल सांकेतिक चित्र",
  imageRights: "परीक्षण फ़ाइल, मौलिक चित्र",
  slides: Array.from({ length: 5 }, (_, i) => ({
    title: "स्लाइड क्रमांक " + (i+1),
    text: "यह एक परीक्षण स्लाइड का सामान्य उदाहरण पाठ है। कोई वास्तविक रिपोर्टिंग नहीं।",
  })),
};
test("creates news Markdown with explicit draft-only status", () => {
  const file = Model.createFile(validNews);
  assert.equal(file.ok, true, JSON.stringify(file.errors));
  assert.equal(file.directory, "src/content/news/");
  assert.equal(file.filename, "important-explainer.md");
  assert.match(file.content, /^---\ntitle:/);
  assert.match(file.content, /\nstatus: draft\n/);
  assert.doesNotMatch(file.content, /status: approved/);
  assert.match(file.content, /  - "https:\/\/example.org\/document"/);
});
test("no sources serializes to a real empty YAML list", () => {
  const file = Model.createFile({ ...validNews, sourceUrls: "" });
  assert.equal(file.ok, true);
  assert.match(file.content, /sourceUrls: \[\]/);
  assert.doesNotMatch(file.content, /sourceUrls:\n\s+\[\]/);
});
test("YAML quoting blocks frontmatter injection from a title", () => {
  const file = Model.createFile({ ...validNews, title: 'Reported "test" :\nstatus: approved\n---' });
  assert.equal(file.ok, true);
  assert.equal((file.content.match(/\nstatus: draft\n/g) || []).length, 1);
  assert.equal((file.content.match(/\nstatus: approved\n/g) || []).length, 0);
});
test("allows only safe slugs and rejects traversal", () => {
  for (const slug of ["../private", "draft/secret", "hello WORLD", "--x", ""]) {
    assert.equal(Model.createFile({ ...validNews, slug }).ok, false, slug);
  }
  assert.equal(Model.createFile({ ...validNews, slug: "valid-news-2026" }).ok, true);
});
test("rejects invalid source URLs including javascript and embedded credentials", () => {
  for (const sourceUrls of ["javascript:alert(1)", "https://someone:secret@example.com", "data:text/html,ok"]) {
    assert.equal(Model.createFile({ ...validNews, sourceUrls }).ok, false);
  }
});
test("image with no stated rights cannot be exported", () => {
  const file = Model.createFile({ ...validNews, image: "/images/uploads/photo.webp", imageAlt: "चित्र का वर्णन" });
  assert.equal(file.ok, false);
  assert.ok(file.errors.image);
});
test("story export creates 5–8 slide JSON, only draft", () => {
  const file = Model.createFile(validStory);
  assert.equal(file.ok, true, JSON.stringify(file.errors));
  const data = JSON.parse(file.content);
  assert.equal(data.slides.length, 5);
  assert.equal(data.status, "draft");
  assert.ok(!("approvedBy" in data));
});
test("rejects story with fewer than five slides", () => {
  const file = Model.createFile({ ...validStory, slides: validStory.slides.slice(0, 4) });
  assert.equal(file.ok, false);
  assert.ok(file.errors.slides);
});
test("rejects story with image URLs, path traversal, or missing rights", () => {
  for (const image of ["https://example.com/photo.jpg", "/images/../secret.jpg", "javascript:alert(1)"]) {
    assert.equal(Model.createFile({ ...validStory, image }).ok, false);
  }
  assert.equal(Model.createFile({ ...validStory, imageRights: "" }).ok, false);
});
test("story slide validation catches empty fields", () => {
  const slides = validStory.slides.map(s => ({ ...s }));
  slides[2].text = "";
  const file = Model.createFile({ ...validStory, slides });
  assert.equal(file.ok, false);
  assert.ok(file.errors["slide-2-text"]);
});
test("browser export model runs without external dependencies", () => {
  const source = readFileSync("tools/editor/editor-model.cjs", "utf8");
  const sandbox = { URL };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { timeout: 1000 });
  assert.equal(sandbox.NuzenioDraftModel.createFile(validNews).ok, true);
});
test("editor is local-only, without any network/credential/publish wiring", () => {
  const ui = readFileSync("tools/editor/editor.js", "utf8");
  const html = readFileSync("tools/editor/index.html", "utf8");
  assert.doesNotMatch(ui, /\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\bsessionStorage\b|\bWebSocket\b/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /कोई ऑटो-पब्लिशिंग नहीं/);
  assert.match(html, /<script src="\.\/editor-model\.cjs" defer>/);
  assert.match(html, /<script src="\.\/editor\.js" defer>/);
});
