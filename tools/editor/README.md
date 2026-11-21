# Nuzenio Offline Editorial Studio

A practical offline editor for drafting Nuzenio news articles and short Web Stories. **It is not the /admin CMS, has no login, and cannot publish**.

## Use

1. Download or clone the Nuzenio repository.
2. Open \`tools/editor/index.html\` locally in a browser (Chrome or Firefox).
3. Select **समाचार लेख** or **वेब स्टोरी**. Write and preview your own original content.
4. Fill necessary metadata and source links. Enter correct usage rights for any image.
5. Click **ड्राफ्ट फाइल सेव करें**. This downloads a Markdown or JSON file only to your computer.
6. When you're ready for review, put the file into \`src/content/news/\` or \`src/content/stories/\` in a local checkout and open a draft PR through GitHub. Do **not** use the public repo for confidential drafts.
7. A real publication requires independent source checking, rights verification, explicit owner approval and a manually authorized merge / deploy.

No auto-save is enabled: switch between article/story to keep each current draft in this open tab, but closing/reloading the page loses unexported changes. Downloading uses a user-initiated click only.

## Technical

- Browser CSP blocks network connections, forms, remote assets, and embedding.
- \`editor-model.cjs\` is a small dependency-free pure validation/export model shared by Node tests and the browser.
- Export is always **status: draft**. The tool cannot mark something approved, merge PRs, or set publication dates.
- Preview uses DOM \`textContent\` rather than \`innerHTML\` to prevent executing untrusted content.
- No browser storage; no servers; no API tokens; no OAuth.
- Required data matches the Astro content schemas in \`src/content.config.ts\`.

Run checks with \`npm run editor:check\`.

## Before enabling a proper authenticated /admin CMS

Follow \`docs/editorial-cms.md\` and implement GitHub OAuth/Cloudflare Access and owner-only branch approval before making any writeable CMS publicly accessible. This offline tool is deliberately kept outside \`public/\` and \`src/pages/\`, so the Astro production build does not ship it.
