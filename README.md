# Workspace — local AI-chat document reader

A private, local-first reading workspace that presents TXT, PDF, and EPUB documents as an AI-style conversation. **Imported documents are processed locally in the browser.** Their files, extracted text, search data, aliases, and reading position stay in IndexedDB on the current device and are never uploaded by this app.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Development mode includes an optional generated demo document; production builds start empty.

## Checks and production build

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The static production site is written to `dist/`. The Vite base is relative (`./`), so static assets work at project-site URLs such as `https://USERNAME.github.io/REPOSITORY_NAME/`. The application is a single-page workspace without URL routes, so browser refreshes do not require a server fallback and do not produce route 404s.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push to `main`, or open **Actions → Deploy to GitHub Pages → Run workflow** for a manual deployment.
5. After the workflow finishes, the site URL appears in the deployment summary and in **Settings → Pages**.

The workflow at `.github/workflows/deploy.yml` runs `npm ci`, builds the app, uploads `dist`, and deploys using GitHub’s official Pages actions. No Vercel, Netlify, Cloudflare, Firebase, backend, database server, API key, or server installation is needed.

## Features

- Local TXT import with UTF-8 and GB18030 fallback, Chinese/English chapter recognition, and automatic large-text sectioning
- PDF.js text extraction with source page indices and EPUB metadata, spine, TOC, and HTML text extraction
- IndexedDB book, block, alias, reading position, scroll offset, and percentage persistence
- Progressive chapter rendering for long documents; only the current chapter is loaded from IndexedDB
- Local commands: `继续`, `下一段`, `下一章`, `上一章`, `搜索 xxx`, `跳到第 20 章`, and English equivalents
- Local document/content search, disguised aliases, optional real-title display, appearance settings, light/dark themes
- Quick Hide with `Esc` or `Ctrl/Cmd + Shift + H`; Search with `Ctrl/Cmd + K`; New chat with `Ctrl/Cmd + N`
- Drag-and-drop import, keyboard focus states, reduced-motion support, and responsive desktop-first layout

AI-dependent actions are intentionally optional. The `AIProvider` interface is present for a future opt-in integration, but reading never depends on an external AI service.
