# Repository Guidelines

## Project Structure & Module Organization
- Root: VS Code extension in TypeScript.
- `src/`: source code
  - `extension.ts`: activation entrypoint
  - `commands/`: feature commands (e.g., `searchCommand.ts`, `replaceCommand.ts`)
  - `services/`, `models/`: core logic and types
  - `omniBufferProvider.ts`: virtual document provider
- `test/suite/`: extension tests (`*.test.ts`)
- `syntaxes/`, `language-configuration.json`: language grammar and config
- `out/`: compiled JS (generated)
- `build.sh`: helper for lint/build/test tasks

## Build, Test, and Development Commands
- `npm install`: install dependencies
- `npm run compile`: type-check and build to `out/`
- `npm run watch`: rebuild on file changes
- `npm run lint`: run ESLint on `src/**/*.ts`
- `npm test`: run extension tests
- `./build.sh full`: lint + compile + test (see `./build.sh help`)

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode per `tsconfig.json`)
- Indentation: 2 spaces; no tabs
- Linting: ESLint via `npm run lint`
- Filenames: lowerCamelCase with domain suffix (e.g., `searchService.ts`, `applyChangesCommand.ts`)
- Classes/Types: PascalCase; functions/variables: camelCase; constants: UPPER_SNAKE_CASE
- Commands: use `omniBuffer.*` IDs; keep titles under the “Omni-Buffer” category

## Testing Guidelines
- Location: `test/suite/*.test.ts`
- Style: Mocha-style `suite`/`test` with Node `assert`
- Run: `npm test` (ensure `npm run compile` first if running manually)
- Aim for meaningful coverage of services/formatters and command flows

## Commit & Pull Request Guidelines
- Messages: imperative mood, concise scope (e.g., "Add search range validation")
- Prohibited: AI tool signatures, ads, boilerplate, or co-authored-by tags from AI tools
- PRs: include a clear description, linked issues, screenshots/GIFs for UX changes, and test notes
- Keep changes focused; update README or settings docs when commands/config change

## Configuration Tips
- User settings (package.json contributes):
  - `omniBuffer.contextBefore` / `omniBuffer.contextAfter`
  - `omniBuffer.incrementalUpdates.enabled` and `...debounceDelay`
- When adding settings, document them and provide sane defaults.

## Agent-Specific Instructions
- Follow these guidelines; prefer small, reviewable PRs.
- Never include AI tool identifiers in commits/PRs.
- Align new files with the structure and naming above.
