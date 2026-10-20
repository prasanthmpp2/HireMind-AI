# Interactive AI Resume Builder

Professional resume builder with a human-centered interface, live preview, AI assistance, and PDF export.

## Highlights

- Clean header with top-right quick controls:
  Completion, Light/Dark toggle, Download PDF
- Handcrafted visual rhythm:
  consistent card spacing, stronger section hierarchy, and cleaner reading flow
- Improved responsive layout alignment:
  consistent control heights, cleaner spacing, and better wrapping on small screens
- Categorized template system with instant switch:
  category dropdown, template selector, Prev/Next, Random Style
- Categorized typography controls:
  font category, font family, size category, font size
- Aligned two-panel control bar:
  Template Layout and Font groups for faster styling changes
- Live preview with sample fallback when the form is empty
- Better preview usability:
  sticky preview column on large screens with cleaner badge alignment
- Clear workspace framing:
  Editor Panel and Preview Panel labels for faster navigation
- About section supports up to 500 characters
- Optional profile photo with crop modal and OK/Cancel flow
- AI tools:
  improve About, rewrite experience, generate bullets, grammar improve
- Import existing resume from PDF/PPTX/JPG/PNG and auto-fill sections
- Typed skill suggestions in Skills section as user enters keywords
- Drag-and-drop section ordering
- Auto-save + restore via LocalStorage and IndexedDB
- Multi-page, high-quality PDF export

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS + PostCSS + Autoprefixer
- React Hook Form + Zod
- Zustand
- Framer Motion + Lucide React
- React Beautiful DnD
- Hugging Face Inference API + Axios
- dom-to-image + jsPDF
- react-easy-crop

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` (see `.env.example`):

```env
VITE_API_BASE_URL=/api/v1
```

Vite proxies this path to `http://localhost:5001` during local development. For production, configure `VITE_API_BASE_URL` with the deployed API's absolute `/api/v1` URL.

Provider credentials are configured in `backend/.env` only. Never add Groq, Hugging Face, or other provider keys to frontend Vite variables.

3. Start development server:

```bash
npm run dev
```

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - type-check and build production bundle
- `npm run lint` - run ESLint
- `npm run preview` - preview production build

## Project Structure

```text
src/
  components/
    ai/
    form/
    preview/
  data/
  hooks/
  lib/
  store/
  types/
  App.tsx
  main.tsx
  index.css
docs/
  template-design-prompt.md
```
