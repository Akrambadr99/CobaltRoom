# Atlas Ops

Atlas Ops is a private operations and project-management application for
projects, issues, workflow views, collaboration, and operational analytics.

The product is being developed incrementally. The initial milestone establishes
one root React application with TypeScript, Vite, Node.js 20, and npm.

## Requirements

- Node.js 20.19 or newer within the Node.js 20 release line
- npm 10

## Local development

```sh
npm ci
npm run dev
```

## Validation

```sh
npm run lint
npm run test
npm run test:coverage
npm run test:e2e
npm run typecheck
npm run build
```

`npm run test:e2e` starts the Vite development server and requires the Playwright
Chromium browser installed by `npx playwright install chromium`.

## Current product surfaces

- Operational dashboard with live issue metrics and priority mutations
- Project index and deep-linked project context
- Issues workspace with URL-backed search, filters, sorting, and pagination

Application data is served through a typed asynchronous gateway backed by an
in-memory versioned store. This keeps local development deterministic while
preserving cancellation, conflict, tracing, and error boundaries expected from
a production transport.
