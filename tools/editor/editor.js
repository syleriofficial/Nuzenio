(function () {
  "use strict";
  const Model = globalThis.NuzenioDraftModel;
  const feedback = document.querySelector("#feedback");
  if (!Model) {
    if (feedback) feedback.textContent = "एडिटर की आवश्यक स्क्रिप्ट नहीं मिली।";
    return;
  }
  const form = document.querySelector("#draft-form");
  const buttons = Array.from(document.querySelectorAll("[data-kind]"));
  const storyFields = document.querySelector("#story-fields");
  const slideList = document.querySelector("#slide-list");
  const slideCount = document.querySelector("#slide-count-label");
  const addSlide = document.querySelector("#add-slide");
  const fields = ["title", "description", "slug", "category", "author", "sourceUrls", "image", "imageAlt", "imageCredit", "imageRights", "body"];
  const fieldByName = (name) => form.elements.namedItem(name);
  const drafts = { news: Model.draftTemplate("news"), stories: Model.draftTemplate("stories") };
  let kind = "news";

  function collect() {
    const draft = { kind };
    for (const name of fields) draft[name] = fieldByName(name)?.value ?? "";
    if (kind === "stories") {
      draft.slides = Array.from(slideList.querySelectorAll("[data-slide]")).map((row) => ({
        title: row.querySelector('[data-slide-field="title"]').value,
        text: row.querySelector('[data-slide-field="text"]').value,
      }));
    }
    return draft;
  }
  function line(name, index, value, label, max, rows) {
    const wrap = document.createElement("div");
    wrap.className = "slide-field";
    const id = "slide-" + index + "-" + name;
    const lab = document.createElement("label");
    lab.htmlFor = id;
    lab.textContent = label;
    const control = name === "text" ? document.createElement("textarea") : document.createElement("input");
    if (name === "text") control.rows = rows || 3;
    else control.type = "text";
    control.maxLength = max;
    control.id = id;
    control.dataset.slideField = name;
    control.value = value ?? "";
    const error = document.createElement("small");
    error.className = "error";
    error.dataset.error = id;
    wrap.append(lab, control, error);
    return wrap;
  }
  function renderSlides(slides) {
    slideList.replaceChildren();
    slides.forEach((slide, index) => {
      const box = document.createElement("div");
      box.className = "slide-input-card";
      box.dataset.slide = String(index);
      const row = document.createElement("div");
      row.className = "slide-input-title";
      const label = document.createElement("strong");
      label.textContent = "स्लाइड " + (index + 1);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-slide";
      remove.textContent = "हटाएँ";
      remove.disabled = slides.length <= 5;
      remove.setAttribute("aria-label", "स्लाइड " + (index + 1) + " हटाएँ");
      remove.addEventListener("click", () => {
        const next = collect().slides;
        if (next.length <= 5) return;
        next.splice(index, 1);
        renderSlides(next);
        refreshPreview();
      });
      row.append(label, remove);
      box.append(row, line("title", index, slide.title, "स्लाइड का शीर्षक", 130),
        line("text", index, slide.text, "स्लाइड का विवरण", 450, 3));
      slideList.append(box);
    });
    slideCount.textContent = slides.length + " स्लाइड्स · 5 से 8 आवश्यक";
    addSlide.disabled = slides.length >= 8;
  }
  function resetErrorMessages() {
    document.querySelectorAll("[data-error]").forEach((el) => { el.textContent = ""; });
    form.querySelectorAll(".invalid").forEach((el) => { el.classList.remove("invalid"); });
    feedback.textContent = "";
    feedback.classList.remove("success");
  }
  function loadKind(nextKind) {
    kind = nextKind;
    const data = drafts[kind];
    for (const name of fields) {
      const field = fieldByName(name);
      if (field) field.value = data[name] ?? "";
    }
    buttons.forEach((button) => {
      const selected = button.dataset.kind === kind;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll(".news-only").forEach((el) => { el.hidden = kind !== "news"; });
    document.querySelectorAll(".story-required").forEach((el) => { el.hidden = kind !== "stories"; });
    storyFields.hidden = kind !== "stories";
    if (kind === "stories") renderSlides(data.slides);
    resetErrorMessages();
    refreshPreview();
  }
  function text(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }
  function refreshPreview() {
    const data = collect();
    drafts[kind] = data;
    const category = Model.CATEGORIES.find(([slug]) => slug === data.category)?.[1] || "न्यूज़";
    text("#preview-category", category + " / ड्राफ्ट");
    text("#preview-title", data.title.trim() || "यहाँ आपकी खबर का शीर्षक दिखाई देगा");
    text("#preview-description", data.description.trim() || "जैसे-जैसे आप जानकारी भरेंगे, उसका प्रीव्यू यहाँ दिखाई देगा।");
    if (kind === "news") {
      const body = data.body.trim().slice(0, 800);
      text("#preview-body", body || "लेख का शुरुआती हिस्सा यहाँ आएगा।");
    } else {
      text("#preview-body", data.slides[0]?.text.trim() || "स्टोरी की स्लाइड का विवरण यहाँ आएगा।");
    }
    const list = document.querySelector("#preview-slides");
    list.hidden = kind !== "stories";
    list.replaceChildren();
    if (kind === "stories") {
      data.slides.forEach((slide, index) => {
        const item = document.createElement("div");
        item.className = "preview-slide";
        const title = document.createElement("strong");
        title.textContent = String(index + 1) + ". " + (slide.title.trim() || "स्लाइड शीर्षक");
        const body = document.createElement("p");
        body.textContent = slide.text.trim() || "स्लाइड के बारे में यहाँ लिखें।";
        item.append(title, body);
        list.append(item);
      });
    }
  }
  function showErrors(errors) {
    let firstInvalid = null;
    for (const [field, message] of Object.entries(errors)) {
      const label = document.querySelector('[data-error="' + field + '"]');
      if (!label) continue;
      label.textContent = message;
      if (!firstInvalid) {
        firstInvalid = document.getElementById(field) || (field.startsWith("slide-")
          ? document.getElementById(field.replace(/-(title|text)$/, "-$1")) : null);
      }
      const wrapper = label.closest(".field, .slide-field");
      wrapper?.classList.add("invalid");
    }
    feedback.textContent = "कुछ आवश्यक जानकारियाँ अधूरी या गलत हैं। ऊपर बताए गए बिंदुओं को सुधारें।";
    if (firstInvalid) firstInvalid.focus();
  }
  buttons.forEach((button) => button.addEventListener("click", () => {
    const nextKind = button.dataset.kind;
    if (!nextKind || nextKind === kind) return;
    drafts[kind] = collect();
    loadKind(nextKind);
  }));
  form.addEventListener("input", () => { resetErrorMessages(); refreshPreview(); });
  form.addEventListener("change", refreshPreview);
  addSlide.addEventListener("click", () => {
    const next = collect().slides;
    if (next.length >= 8) return;
    next.push({ title: "", text: "" });
    renderSlides(next);
    refreshPreview();
  });
  document.querySelector("#clear-form").addEventListener("click", () => {
    if (!confirm("इस प्रकार का वर्तमान, एक्सपोर्ट न किया गया ड्राफ्ट हटाकर नया शुरू करें?")) return;
    drafts[kind] = Model.draftTemplate(kind);
    loadKind(kind);
    feedback.textContent = "नया खाली ड्राफ्ट शुरू किया गया है।";
    feedback.classList.add("success");
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    resetErrorMessages();
    const result = Model.createFile(collect());
    if (!result.ok) { showErrors(result.errors); return; }
    // Download happens only after direct click on the save button.
    const blob = new Blob([result.content], { type: result.mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    // Keep the temporary URL valid through the end of the download gesture.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback.classList.add("success");
    feedback.textContent = "ड्राफ्ट डाउनलोड किया गया: " + result.filename + " । आगे इसे " + result.directory + " में जोड़कर समीक्षा के लिए PR बनाना होगा। अभी कोई खबर प्रकाशित नहीं हुई।";
  });
  loadKind(kind);
})();
