# @whyme/i18n

Shared English/Igbo catalogs for web and mobile. See `docs/03-i18n-english-igbo.md`.

- **English (`en`) is the source.** Every key must exist in `locales/en`.
- **Igbo (`ig`) may lag behind.** Missing keys fall back to English at runtime. `pnpm i18n:check` reports how many are missing; from Phase 5 it fails the build (`--strict`).
- **The current Igbo values are drafts.** They need the native reviewer's approval (DEC20) before release.
- **Keys:** namespaced and meaningful (`sync.item.pending`), never English sentences.
- **Plurals:** use i18next suffixes (`_one`, `_other`).
- **Variables:** use `{{name}}`. Never build a sentence by joining strings.
- **API errors:** translated by their `code` in `errors.json`.
