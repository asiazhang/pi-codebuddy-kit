# AGENTS.md

pi extension package: Tencent CodeBuddy provider + custom footer, for the pi coding agent.

## Commands

```bash
npm run typecheck       # tsc --noEmit, run after every TS edit
npm run lint            # biome check .
npm run lint:fix        # biome check --write . (auto-fix formatting)
npm run footer-preview  # render tc-footer layout in terminal (no live session needed)
npm run footer-preview 60                # preview at 60 columns
PI_THEME=light npm run footer-preview    # preview with light theme
```

After editing any TypeScript file, run `typecheck` and `lint` before considering the change done.

## Formatting

Biome (`biome.json`) owns formatting and linting for `extensions/**` and `scripts/**`:

- Tabs for indentation, double quotes, no semicolons in `.ts` (semicolons kept in `.mjs`).
- Never hand-format; run `npm run lint:fix` instead.
- `package.json` is formatted by Biome too (tabs). Use a JSON-aware edit (e.g. python `json`) and re-run `lint:fix`.

## Footer rendering rules

`extensions/tc-footer.ts` renders one ANSI-safe line:

```
<cwd>  <pct>% <10-cell bar>  <model-id> ⚡<thinking> (<git-branch>)
```

- cwd: `~`-relative inside `$HOME`, otherwise the last two path segments (`user/repo`).
- Context percent: rounded to integer; color matches the bar thresholds — green < 60, yellow ≥ 60, red ≥ 85.
- Model id: default foreground. Branch: dim. Thinking: accent. Cwd: dim.
- `scripts/footer-preview.mjs` mirrors this logic function-by-function (`formatCwd`, `contextBar`, `renderLine`). When changing render logic in `tc-footer.ts`, update the mirrors in the preview script and re-run it.

## Edit discipline

- Read the target region before using exact-match edits; file content must be copied, not recalled.
- For lines containing box-drawing characters or irregular alignment whitespace, prefer a python anchor-based replacement over exact-match editing.
- Keep edits small and independently verifiable.
- Verify package exports before importing unfamiliar APIs:
  `node -e "import('pkg').then(m=>console.log(Object.keys(m)))"`
