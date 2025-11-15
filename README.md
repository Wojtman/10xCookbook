## 10xCookbook

> Frictionless Paste → Parse → Adjust → Save workflow for turning messy recipe text into a structured personal cookbook. Anonymous-first usage, AI-assisted parsing, manual control, accessible dual‑pane editing, and a clean two‑page reading experience.

---

## Table of Contents

1. [Project Name](#10xcookbook)
2. [Project Description](#project-description)
3. [Tech Stack](#tech-stack)
4. [Getting Started Locally](#getting-started-locally)
5. [Available Scripts](#available-scripts)
6. [Project Scope](#project-scope)
7. [Project Status](#project-status)
8. [License](#license)

---

## Project Description

10xCookbook lets hobby cooks rapidly convert unstructured recipe text (blogs, videos, notes) into consistent, structured entries inside a personal cookbook interface.

Core concepts:

- Dual Modes:
  - Preview Mode: two-page, book‑style layout for comfortable reading.
  - Edit Mode: left pane for raw pasted text + editable fields; right pane for AI‑generated structured draft.
- Anonymous-first: Explore freely; ephemeral local storage until you register.
- AI Parsing: Extracts title, ingredients, tags, description, prep time with <10s hard timeout (target median <6s) and graceful fallback.
- Manual Integrity: All fields remain editable; AI never blocks saving.
- Strong Validation: Title required, description ≤5,000 chars, ≤50 ingredients.
- Image Handling: Upload, size/dimension validation, square normalization, WebP compression, accessible alt text defaulting to title.
- Tag Taxonomy: Predefined tags (including auto suggestions like quick or long_rest).
- Analytics Events: Session and recipe lifecycle (parse_requested, parse_success, save, delete, registration_complete, etc.).
- Accessibility & Security: Keyboard navigable, alt text, WCAG AA contrast, hashed passwords, CSRF protection.

For full functional and user story details, see the Product Requirements Document (PRD): `./.ai/prd.md`.

---

## Tech Stack

| Layer             | Technologies                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| Frontend          | Astro 5 (hybrid rendering), React 19 (interactive components), TypeScript 5 |
| Styling/UI        | Tailwind CSS v4, Shadcn/ui, Radix primitives, lucide-react icons            |
| Backend (planned) | Supabase (PostgreSQL, Auth, Storage)                                        |
| AI                | OpenRouter.ai (multi-model access, cost controls)                           |
| Tooling           | ESLint 9 + plugins, Prettier (Astro plugin), Husky + lint-staged            |
| Deployment        | GitHub Actions (CI/CD), DigitalOcean (Docker image target)                  |
| Misc              | Image normalization (client), analytics events (custom instrumentation)     |

Detailed rationale: `./.ai/tech-stack.md`.

---

## Getting Started Locally

### Prerequisites

- Node.js v24.2.0 (see `.nvmrc`)
- Git
- Package manager: npm (default). You may choose pnpm or yarn; not currently configured.

### Optional: Use nvm (Windows with `nvm-windows`)

```powershell
nvm install 24.2.0
nvm use 24.2.0
```

### Clone & Install

```powershell
git clone https://github.com/Wojtman/10xCookbook.git
cd 10xCookbook
npm install
```

### Run Development Server

```powershell
npm run dev
```

Open http://localhost:4321 (Astro default) in your browser.

### Build for Production

```powershell
npm run build
```

Preview the built site:

```powershell
npm run preview
```

### Lint & Format

```powershell
npm run lint
npm run lint:fix
npm run format
```

### Environment Variables (Planned)

Supabase and OpenRouter API keys will be required for full functionality. A `.env` schema (e.g., `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`) will be documented once backend wiring is added.

Image upload pipeline configuration:

- `SUPABASE_RECIPE_IMAGES_BUCKET` — Supabase Storage bucket name for processed recipe images (required by `/api/images/upload`).
- Uploads log an `image_upload` analytics event per success; rate limiting counts those events (20 per hour per user/session).

---

## Available Scripts

| Script     | Purpose                                                 |
| ---------- | ------------------------------------------------------- |
| `dev`      | Start Astro development server with live reload         |
| `build`    | Production build (static + server output as configured) |
| `preview`  | Serve the production build locally                      |
| `astro`    | Direct access to Astro CLI commands                     |
| `lint`     | Run ESLint over project sources                         |
| `lint:fix` | Auto-fix lint issues where possible                     |
| `format`   | Run Prettier write over supported files                 |

Automated pre-commit formatting is handled by `husky` + `lint-staged`.

---

## Project Scope

### In Scope (MVP)

- Anonymous ephemeral cookbook (local only).
- Registration & login (email + password hashing).
- Two-page Preview Mode layout.
- Dual-pane Edit Mode with AI parsing & manual editing.
- AI parse with timeout and fallback.
- Manual CRUD for recipes.
- Predefined tag selection & AI suggestions.
- Image upload + normalization (≤2MB, ≤1024×1024, square + WebP).
- Validation rules (title, description length, ingredient limits).
- Analytics events (session, parse, save, auth, etc.).
- Registration prompt logic (after first parse success OR ≥2 temporary recipes).
- Accessibility basics (keyboard navigation, alt text).

### Out of Scope (Initial MVP)

- Multiple user cookbooks.
- Social/sharing features.
- Dietary transformations (e.g., veganization).
- Custom user-defined tags.
- Version history / rollback.
- Advanced search & filtering UI.
- PDF export / printing.
- Nutrition profiling.
- Multi-region scaling considerations.
- Video embedding.

Refer to the PRD for full boundaries and user stories: `./.ai/prd.md`.

---

## Project Status

| Aspect             | Status                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| Version            | 0.0.1 (pre-release / scaffold)                                          |
| Implementation     | Frontend scaffold present; backend & AI integration pending             |
| Performance Target | AI parse median <6s (≤10s hard timeout)                                 |
| Access Model       | Anonymous first, persistence via registration (not yet wired)           |
| Deployment         | Planned: GitHub Actions → DigitalOcean (Docker)                         |
| Data Persistence   | Supabase planned; temporary local storage for anonymous usage initially |

### Immediate Next Steps

- Implement Supabase client & auth flows.
- Add AI parsing service integration + timeout logic.
- Build recipe data model & local → persistent migration on registration.
- Add image processing pipeline (client-side).
- Introduce analytics event dispatcher.
- Add accessibility audits.

### Future Enhancements (Post-MVP)

- Advanced search & filters
- Dietary / transformation utilities
- Multi-cookbook support
- Export (PDF) & sharing
- Tag customization
- Nutrition data enrichment

---

## Security & Privacy (Planned)

- Password hashing (bcrypt or Argon2) with salted hash.
- CSRF mitigation for state-changing endpoints.
- Anonymous data remains strictly client-side until registration.
- Field validation & server-side re-check for defense in depth.
- Clear ephemeral session banner for anonymous users.

---

## Accessibility Commitment

- Keyboard-accessible interactive elements.
- Alt text defaults to recipe title; user override allowed.
- WCAG AA color contrast target.
- ARIA roles/labels for non-semantic controls (per PRD guidelines).

---

## Contributing

Early-stage project: formal contribution guide forthcoming.

- Feel free to open issues for clarifications or missing documentation.
- PRs welcome once core MVP pieces are merged (auth, AI parse, persistence).

---

## Badges

(Replace placeholders with real badge URLs once CI & license defined.)

| Badge   | Placeholder                                                           |
| ------- | --------------------------------------------------------------------- |
| Build   | ![Build Status](https://img.shields.io/badge/build-pending-lightgrey) |
| Version | ![Version](https://img.shields.io/badge/version-0.0.1-blue)           |
| License | ![License](https://img.shields.io/badge/license-MIT-green)            |
| Node    | ![Node](https://img.shields.io/badge/node-24.2.0-43853d)              |

---

## Additional Documentation

- PRD: `./.ai/prd.md`
- Tech Stack Rationale: `./.ai/tech-stack.md`

(Consider adding `/docs` directory for API schemas, environment setup, and data migration notes.)

---

## License

MIT License (placeholder).  
Add a `LICENSE` file (e.g., MIT) to finalize licensing. If a different license is intended, update this section and badge accordingly.

---

## Acknowledgements

- Astro & React teams for hybrid performance patterns.
- Supabase for streamlined backend services.
- OpenRouter.ai for flexible multi-model AI access.
- Shadcn/ui & Radix for accessible component foundations.

---

## Disclaimer

Several features (AI parsing, auth persistence, image normalization, analytics) are outlined but not yet implemented in this repository snapshot. This README reflects intended MVP functionality per the PRD.

---

Happy cooking & coding! 🍳
