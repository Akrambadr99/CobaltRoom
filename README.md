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
npm run typecheck
npm run build
```

Automated application tests and end-to-end tests will be added in their planned
testing milestones. The application is currently a dependency-free foundation
screen rather than a completed product workflow.
