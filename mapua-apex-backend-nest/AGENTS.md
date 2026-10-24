# NestJS Backend Agent Guidelines

These rules apply to `mapua-apex-backend-nest`. Also follow the root `AGENTS.md` (cross-system changes, reuse before rebuilding, `todo.md`, documentation sync, boto3 scripts). When a change also touches the Laravel backend or the frontend, read that sub-project's `AGENTS.md` too.

## Foundational Context

- This is a NestJS 12 application on TypeScript 6, running as **native ESM** (`"type": "module"`, `module`/`moduleResolution: nodenext`). Tests use **Vitest** (not Jest), linting uses **oxlint**, and formatting uses **Prettier**.
- Use the APIs that match the installed major version of each package. Do not assume a version. Check `package.json` (or `npm ls <package>`) before relying on a package's API.
- Activate the `nestjs-best-practices` skill whenever you write, review, or refactor code in this project. Rule IDs below (for example `arch-feature-modules`) refer to files in that skill's `rules/` folder. Read the matching rule file when a step applies.
- Data lives in **DynamoDB** (see `DynamoDB Schema.txt` at the repository root) and callers authenticate with **Cognito JWTs**. The HTTP contract is documented in `API_ROUTES.md` at the repository root.

## Conventions

- Follow all existing code conventions in this project. When you create or edit a file, check sibling files for structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for an existing module, provider, guard, pipe, interceptor, or DTO to reuse before you write a new one.
- Stick to the existing directory structure. Do not create new top-level folders under `src/` or the project root without approval.
- **Do not add, remove, or upgrade dependencies without approval.** Several patterns below (validation, config, throttling, AWS SDK access) need packages that are not installed yet (`class-validator`, `class-transformer`, `@nestjs/config`, `@nestjs/throttler`, `@aws-sdk/*`, and so on). When a step needs one, stop and ask before running `npm install`.
- Only create documentation files when the user explicitly asks for them. This does not cover the required doc updates in "API Documentation & Schema Sync" below.
- Do not create one-off verification scripts when tests cover the behavior. Unit and e2e tests are more important.
- Keep replies concise. Focus on what matters, not on obvious details.

## TypeScript & ESM Rules

- **Relative imports must end in `.js`** (for example `import { UsersService } from './users.service.js';`), even though the source file is `.ts`. Imports without the extension fail at runtime under `nodenext`.
- `strict` is on. Do not use `any`. Do not use `@ts-ignore` or `@ts-nocheck` without a comment that explains why. Give every public method an explicit return type, including `Promise<T>` on async methods.
- Use constructor parameter properties for injection: `constructor(private readonly usersService: UsersService) {}`. Do not leave empty constructors.
- Use `PascalCase` for enum members.
- Prefer TSDoc blocks over inline comments. Add inline comments only for logic that is truly complex.

## Step-by-Step Checklist for a New Feature

Do these steps in order. Do not write code until steps 1–3 are done.

### 1. Understand the contract and the data

- [ ] Read the relevant sections of `API_ROUTES.md` and `DynamoDB Schema.txt`. Write down the exact route, method, request body, response body, status codes, and the DynamoDB keys and access patterns that the feature uses.
- [ ] If the feature changes the HTTP contract and the frontend must change too (or the reverse), **stop and consult the user** before you edit the other system (root `AGENTS.md`, "Cross-System Changes").
- [ ] If an equivalent endpoint already exists in `mapua-apex-backend` (Laravel), read its controller, request validation, and resource. Keep the paths, payload shapes, status codes, and error behavior the same unless the user approves a change.

### 2. Search for existing code (reuse before rebuilding)

- [ ] Search `src/` for existing modules, controllers, services, repositories, DTOs, guards, pipes, interceptors, and filters that already cover the feature, even partly.
- [ ] If you find a partial implementation, tell the user what it does and what it is missing, then extend it. Do not duplicate working code.

### 3. Place the code (Architecture: `arch-*`)

- [ ] **Organize by feature, not by technical layer** (`arch-feature-modules`). A feature lives in `src/<feature>/` with its own `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.repository.ts`, `dto/`, and co-located `*.spec.ts` files. Do not create global `controllers/`, `services/`, or `dtos/` folders.
- [ ] **Generate files with the Nest CLI** where a schematic exists, for example `npx nest g module <feature> --no-interaction` and `npx nest g service <feature> --no-interaction`. Check `npx nest g --help` for options. After you generate a file, fix any relative import that is missing its `.js` extension.
- [ ] **Keep each service focused** (`arch-single-responsibility`). If a service grows past one responsibility, split it instead of building a "god service".
- [ ] **Put data access in a repository** (`arch-use-repository-pattern`). DynamoDB commands (`GetItem`, `Query`, `PutItem`, `TransactWriteItems`, and so on) and key building (`ORGANIZATION#…`, `SIGNATORY#…`) belong in a `<Feature>Repository` provider, not in services or controllers. Services hold business rules only.
- [ ] **Share through module exports** (`arch-module-sharing`). To use another feature's provider, import that feature's module and use what it exports. Never list another module's provider in your own `providers` array. That creates a second instance.
- [ ] **Avoid circular module dependencies** (`arch-avoid-circular-deps`). If two modules need each other, move the shared logic into a third module, or decouple with events (`arch-use-events`). Use `forwardRef` only as a last resort, and say so in your reply.
- [ ] Register the new module in `AppModule` `imports` (or in the parent feature module).

### 4. Wire dependencies (Dependency Injection: `di-*`)

- [ ] **Use constructor injection** (`di-prefer-constructor-injection`). Do not use property injection, and do not pull providers from `ModuleRef` at runtime (`di-avoid-service-locator`).
- [ ] **Inject abstractions by token** (`di-use-interfaces-tokens`). For external clients (DynamoDB document client, Cognito verifier, third-party HTTP APIs), define an injection token or abstract class so tests can swap in a fake. Keep interfaces small (`di-interface-segregation`), and make sure every implementation honors the full contract (`di-liskov-substitution`).
- [ ] **Keep the default singleton scope** (`di-scope-awareness`). Use `Scope.REQUEST` only when it is truly needed, because it spreads to every consumer. Read per-request data such as the caller's JWT claims from the request through a guard or a custom param decorator.

### 5. Define the input and output (API Design and Security: `api-*`, `security-*`)

- [ ] **Validate every input with a DTO** (`security-validate-all-input`, `api-use-pipes`). Body, query, and param DTOs live in `src/<feature>/dto/` and use `class-validator` decorators. A global `ValidationPipe` should run with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`. Use built-in pipes such as `ParseUUIDPipe` and `ParseIntPipe` for path params.
- [ ] **Match the documented error status codes.** `API_ROUTES.md` documents `422` for validation failures. Nest's `ValidationPipe` returns `400` by default, so configure `errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY` (or follow whatever the existing global pipe already does).
- [ ] **Shape responses with response DTOs or serialization** (`api-use-dto-serialization`). Never return raw DynamoDB items. Strip internal attributes (`PK`, `SK`, GSI keys, secrets), and keep the documented envelope (collections and single resources are wrapped in a `data` key) and field casing (`snake_case`, as in `API_ROUTES.md`).
- [ ] **Use versioned routes** (`api-versioning`). All v1 routes sit under `/api/v1`. Follow whatever global prefix or versioning setup already exists in `main.ts` instead of hard-coding the prefix in each controller.
- [ ] **Put cross-cutting behavior in interceptors** (`api-use-interceptors`), such as response wrapping, logging, and timing. Do not repeat it in every handler.
- [ ] **Sanitize output** (`security-sanitize-output`). Escape or strip user-supplied free text before it is returned or rendered elsewhere.

### 6. Protect the route (Security: `security-*`)

- [ ] **Authenticate with a guard** (`security-auth-jwt`, `security-use-guards`). Verify the Cognito JWT (signature through JWKS, issuer, audience or client id, expiry, and token use) in a reusable guard. Do not verify it inline in a handler.
- [ ] **Authorize with guards and decorators** (`security-use-guards`). Gate on `cognito:groups` (case-insensitive) through a roles decorator plus a guard, and match the route-prefix group table in `API_ROUTES.md`. Read `custom:organization_id` and `custom:signatory_id` in the guard or a param decorator.
- [ ] **Keep the documented auth semantics.** A missing or invalid JWT, group, or required claim returns `401`. An unreachable JWKS returns `503`. Cross-organization or off-desk access returns `404`, not `403`. Public and Health routes must explicitly opt out of the global guard (for example with a `@Public()` decorator).
- [ ] **Apply rate limiting** (`security-rate-limiting`). Match the documented limits (about 60 reads per minute and 10 writes per minute per caller, returning `429`).

### 7. Handle errors (Error Handling: `error-*`)

- [ ] **Throw Nest HTTP exceptions** (`error-throw-http-exceptions`), such as `NotFoundException` and `UnprocessableEntityException`, from services. Do not return error objects or `null` for a failure the caller must handle.
- [ ] **Map errors in one place** (`error-use-exception-filters`). Use a global exception filter to keep the error body consistent and to translate AWS SDK errors (for example `ConditionalCheckFailedException` to `409` or `404`, and throttling to `503`). Do not leak stack traces or AWS error details to clients.
- [ ] **Await every promise** (`error-handle-async-errors`). Do not leave floating promises or fire-and-forget calls without a `.catch`. Wrap external calls (Cognito, third-party APIs) and decide clearly whether they fail open or fail closed. Match the documented behavior; for example, the public email and gibberish checks fail open.

### 8. Access data efficiently (Database: `db-*`, Performance: `perf-*`)

- [ ] **Design for the documented access patterns** (`perf-optimize-database`). Use `Query` on a partition key or GSI. Never use `Scan` on a request path unless the schema doc says that pattern is a scan. Use projection expressions so you read only the attributes you need.
- [ ] **Avoid N+1 reads** (`db-avoid-n-plus-one`). Use `BatchGetItem` or one `Query`, not a `GetItem` inside a loop.
- [ ] **Make multi-item writes atomic** (`db-use-transactions`). When several items must change together, use `TransactWriteItems` with condition expressions. Use conditional writes to prevent lost updates.
- [ ] **Treat schema changes as migrations** (`db-use-migrations`). A new table, GSI, or key format is a schema change. Update `DynamoDB Schema.txt`, and if existing items need backfilling, write the backfill as a reviewed script (boto3 scripts go in `mapua-apex-frontend/scripts/`, as the root `AGENTS.md` says). Never mutate data ad hoc.
- [ ] **Cache only when it is clearly worth it** (`perf-use-caching`). Cache expensive or external lookups with explicit TTLs and cache keys that include every input (and a version when thresholds can change).
- [ ] **Do async setup in lifecycle hooks** (`perf-async-hooks`). Warm clients in `onModuleInit` or `onApplicationBootstrap`, not in constructors. Lazy-load rarely used heavy modules (`perf-lazy-loading`) only when startup time matters.

### 9. Configure and observe (DevOps: `devops-*`, Microservices: `micro-*`)

- [ ] **Read configuration through config providers** (`devops-use-config-module`), such as `ConfigService` or typed config namespaces validated at startup. Do not read `process.env` throughout services. Add every new variable to the env example file and name it in your reply.
- [ ] **Log through Nest's `Logger`** (`devops-use-logging`), not `console.log`. Include useful context (route, caller id), and never log JWTs, secrets, or full request bodies that may hold personal data.
- [ ] **Shut down cleanly** (`devops-graceful-shutdown`). Release clients in `onModuleDestroy`, and keep `app.enableShutdownHooks()` enabled once it exists.
- [ ] **Keep the health endpoints working** (`micro-use-health-checks`). If the feature adds a critical dependency, decide whether `/api/v1/ping` or the root health endpoint should report it. Move slow, retryable work (notifications, emails) to a queue or background job (`micro-use-queues`) rather than blocking the request. Use message or event patterns (`micro-use-patterns`) only if the project already uses them.

### 10. Test (Testing: `test-*`)

- [ ] **Unit-test with `Test.createTestingModule`** (`test-use-testing-module`). Put a `*.spec.ts` next to each service, controller, guard, and pipe you add, following `src/app.controller.spec.ts`. Use Vitest globals (`describe`, `it`, `expect`, `vi`). Do not import from Jest.
- [ ] **Mock external dependencies** (`test-mock-external-services`). Override the DynamoDB, Cognito, and HTTP client providers with `.overrideProvider(TOKEN).useValue(fake)` or `vi.fn()`. Unit tests must never call AWS.
- [ ] **Write e2e tests with Supertest** (`test-e2e-supertest`) in `test/*.e2e-spec.ts`, following `test/app.e2e-spec.ts`. Cover the happy path, validation failure (`422`), missing or invalid auth (`401`), the wrong group, and cross-organization access (`404`). Apply the same global pipes, guards, filters, and prefix as `main.ts` so the e2e app matches production.
- [ ] Build test data with small typed fixture or builder helpers. Reuse existing helpers before you add new ones.
- [ ] Run the narrowest set of tests that covers the change, and rerun after each change:
  - Unit: `npx vitest run src/<feature>` (or `npx vitest run -t "<test name>"`)
  - E2E: `npm run test:e2e -- test/<feature>.e2e-spec.ts`

### 11. Format, lint, and build

- [ ] If you changed any TypeScript files, run `npx prettier --write <changed files>` (or `npm run format`) before you finish.
- [ ] Run `npm run lint` and fix every oxlint error you introduced.
- [ ] Run `npm run build` to confirm the project compiles under `nodenext` (missing `.js` import extensions usually show up here).

### 12. Sync the docs and close out

- [ ] Update `API_ROUTES.md` and `DynamoDB Schema.txt` if the contract or data model changed (see "API Documentation & Schema Sync" below).
- [ ] After a major change, check `docs/erd/` against the code and fix anything that is no longer accurate (root `AGENTS.md`).
- [ ] If the work matches an item in `todo.md` at the repository root, update that item (root `AGENTS.md`, "Todo List").

## Running Commands

- Use the Nest CLI to inspect and generate code: `npx nest --help` and `npx nest g --help`. Pass `--no-interaction` where it is supported, so commands never wait for input.
- Start the app with `npm run start:dev`. If the user does not see a change, it may be because the watcher is not running or `dist/` is stale. Ask them before you restart anything they started.

## API Documentation & Schema Sync

- Whenever you change the API (add, remove, or modify a route, controller, request or response shape, status code, or any other part of the API contract), update both **`API_ROUTES.md`** and **`DynamoDB Schema.txt`** (at the repository root) in the same change, so they stay in sync with the code.
- This applies even when the change was driven by frontend work. Treat the docs and schema update as part of finishing the API change, not as a separate task.
