# ClinQuery

ClinQuery is a standalone Next.js app for chatting with PDFs, images, and text files. Upload sources, extract text (digital PDF layer or vision OCR), index them, and ask questions. Answers stream back with numbered citations that open the exact page and highlight the cited figure or phrase.

## What you can do

- Upload PDF, PNG, JPEG, TXT, or Markdown files (25 MB max).
- Check which sources the model may use. Unchecked files stay out of retrieval.
- Ask a question in the chat, or pick a starter prompt on the empty screen.
- Read a streaming answer with `[1]`, `[2]`, … chips.
- Click a chip to open **See in document**: the PDF page, fit to width, with a translucent highlight on the cited text.

## How it works end to end

```
Upload
  → SHA-256 cache lookup
  → extract text (PDF) or keep image
  → digital pages skip vision; scans/images go to GPT-4o-mini vision
  → Markdown pages stored on the document record
  → chunk (~1200 chars, 150 overlap) + embed (text-embedding-3-small)
  → chat: embed query → cosine retrieve from checked docs → stream GPT-5.6 Luna
  → bind [N] citations to the chunk that contains that figure
  → click chip → in-app PDF.js viewer on that page + highlight
```

### 1. Upload and cache

`POST /api/documents` accepts a multipart file.

1. MIME type and 25 MB size are validated.
2. The file bytes are hashed with SHA-256 (`src/lib/hash.ts`).
3. If the same hash was processed before, ClinQuery reuses stored pages, chunks, and embeddings. OCR and embedding are not billed twice.
4. Otherwise the original file is saved (`docs/<id>/file`) and a document record is created (`docs/<id>/meta.json`).

Locally, files live under `.data/`. In production, set `BLOB_READ_WRITE_TOKEN` to use Vercel Blob instead.

### 2. OCR (dual path)

Born-digital PDFs usually already have a text layer. Scanned pages and photos do not.

**Digital path (`lite`)**

- `unpdf` extracts per-page text on the server (`src/lib/ocr/pdf.ts`).
- `isDigitalPage` (`src/lib/ocr/inspect.ts`) treats a page as digital when it has enough characters and a low “junk” ratio (broken-font glyph soup and empty pages fail this check).
- If the whole file already has usable extracted text, vision OCR is skipped for every page so indexing can start immediately.
- Markdown is cleaned in `src/lib/ocr/normalize.ts`.

**Vision path**

- Pages that fail the digital check are rendered to images in the browser (PDF.js) and sent to `POST /api/documents/:id/ocr-page`.
- Vision uses `OPENAI_OCR_MODEL` (default `gpt-4o-mini`).
- The client OCRs pending pages in a pool of 4 (`OCR_PAGE_CONCURRENCY`) with a lock around PDF.js so Safari does not race the document.

**When chat unlocks**

Chat is enabled as soon as a selected document is `ready` (indexed). Leftover background OCR on sparse pages does not block asking questions if there is already enough text to index (`src/lib/rag/index-ready.ts`).

### 3. Indexing (RAG)

`POST /api/documents/:id/index` (also called automatically after upload when text is already present):

1. Pages are split with a recursive character splitter: 1200 character chunks, 150 overlap, preferring paragraph / sentence breaks (`src/lib/rag/chunker.ts`).
2. Each chunk is embedded with `text-embedding-3-small` (`src/lib/rag/embeddings.ts`).
3. Vectors are stored as `docs/<id>/chunks.json`.
4. Document status becomes `ready`.

### 4. Chat

`POST /api/chat` with `{ query, documentIds, history }`:

1. Loads chunks only for the **checked** documents.
2. Embeds the question.
3. Cosine similarity, top 16 chunks (`RETRIEVE_TOP_K` in `src/lib/types.ts`).
4. Builds a system prompt that says: answer only from numbered passages; cite the passage that contains the exact figure (`src/lib/rag/prompt.ts`).
5. Streams **GPT-5.6 Luna** (`gpt-5.6-luna`) as SSE `chunk` events.
6. After the stream, `bindCitations` rewrites markers so each figure gets its own `[N]`, and each number maps to the chunk that actually contains that figure — not a nearby table cell (`src/lib/rag/citations.ts`).
7. SSE `citations` event sends `{ text, citations }` so the UI can replace the streamed text if numbering was rewritten.

Follow-up chips after an answer come from `POST /api/suggestions` (same chat model, JSON list of short questions).

### 5. See in document

Citation chips (`src/components/CitationChip.tsx`) open `ViewerModal` with `documentId`, `pageNumber`, and `searchTerm`.

The viewer (`src/components/DocumentViewer.tsx`):

- Loads PDF bytes from `/api/documents/:id/file`.
- Uses PDF.js **legacy** build with a main-thread worker (`globalThis.pdfjsWorker`) and stream polyfills so Safari does not crash on `readableStream`.
- Renders canvas + a custom text layer (not PDF.js `TextLayer` streams).
- Fits page width; only vertical scroll.
- Highlights the search term (translucent yellow).
- Falls back to a native iframe `#page=N` if PDF.js fails.

Plain text / Markdown files render as HTML with the same highlight. Images show the file itself.

### 6. Auth (optional)

If `APP_PASSWORD` is set, `src/proxy.ts` requires a session cookie before the UI or APIs (except `/login` and `/api/login`). Local development can leave this empty.

## User interface

| Area | Behavior |
| --- | --- |
| **Sources** | Search, select all, per-file checkbox on the right. Add More stays at the bottom. Uncheck a file to exclude it from answers. |
| **Empty chat** | Title **Chat with your docs**, ask bar, then a 2×3 grid of medical-document starter prompts with icons. |
| **Thread** | User (green **N**, Nathan Sekar) vs assistant (sparkle **AI**). |
| **Composer** | Pill input, centered up-arrow send. After the first message, follow-up chips sit above the bar. |

Starter prompts live in `src/lib/suggestions.ts`.

## API surface

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/documents` | List document summaries |
| `POST` | `/api/documents` | Upload one file |
| `GET` | `/api/documents/:id` | Full document record (pages, status) |
| `DELETE` | `/api/documents/:id` | Delete document + chunks + file |
| `GET` | `/api/documents/:id/file` | Original bytes (viewer) |
| `POST` | `/api/documents/:id/ocr-page` | OCR one page (text and/or image) |
| `POST` | `/api/documents/:id/index` | Chunk + embed + mark ready |
| `POST` | `/api/chat` | SSE answer + citations |
| `POST` | `/api/suggestions` | Follow-up questions |
| `POST` | `/api/login` | Set session cookie |
| `POST` | `/api/logout` | Clear session |

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- OpenAI: chat (`gpt-5.6-luna`), OCR (`gpt-4o-mini`), embeddings (`text-embedding-3-small`)
- `unpdf` for digital PDF text; `pdfjs-dist` (legacy) for client render + viewer
- Vitest for unit tests

`next.config.ts` must keep `serverExternalPackages: ["unpdf", "pdfjs-dist"]` only. Do **not** also put `pdfjs-dist` in `transpilePackages` — Turbopack panics.

## Setup

```bash
cp .env.example .env.local
```

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | yes | — | Chat, OCR, embeddings |
| `OPENAI_CHAT_MODEL` | no | `gpt-5.6-luna` | Q&A + suggestions |
| `OPENAI_OCR_MODEL` | no | `gpt-4o-mini` | Vision OCR |
| `OPENAI_EMBEDDING_MODEL` | no | `text-embedding-3-small` | Chunk + query vectors |
| `BLOB_READ_WRITE_TOKEN` | no | empty | Vercel Blob in production |
| `APP_PASSWORD` | no | empty | Gate the UI if you host a public URL |

Never commit `.env.local`. It is gitignored.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Tests cover chunking, retrieval, citation binding, digital-page inspect, normalize, hashing, index-ready, and the async pool.

## Deploy (Vercel)

1. Import this GitHub repo on [Vercel](https://vercel.com).
2. Set `OPENAI_API_KEY`.
3. Create a Blob store and set `BLOB_READ_WRITE_TOKEN`.
4. Optionally set `APP_PASSWORD`.

Notes:

- Hobby functions time out around 10 seconds. OCR is **one page per request** so a large scan can take several round trips.
- Hobby also caps request bodies at about 4.5 MB. Keep uploads small, or run locally with `.data/`.
- Digital PDFs are cheap (no vision). Scanned pages cost OCR tokens.

## Repository layout

```
src/app/api/          HTTP routes listed above
src/app/login/        Password gate
src/app/viewer/       Standalone viewer URL (also used as fallback)
src/components/       Sources sidebar, chat, citations, PDF modal
src/lib/ocr/          Inspect, normalize, vision, PDF extract, pipeline
src/lib/rag/          Chunk, embed, retrieve, citations, prompt, index
src/lib/client/       Browser API client, PDF.js helpers, highlight
src/lib/storage.ts    Local .data/ or Vercel Blob
src/proxy.ts          Optional password middleware
tests/                Vitest unit tests
public/pdf.worker.min.mjs   PDF.js worker served to the browser
```

## License

Private / personal use unless you add a license file.
