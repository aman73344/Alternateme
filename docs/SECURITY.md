# Alternate.Me â€” Security Reference

| Field | Value |
| --- | --- |
| **Project** | Alternate.Me â€” AI Digital Twin Platform |
| **Document** | `docs/SECURITY.md` |
| **Version** | 1.1.0 |
| **Last Updated** | 2026-09-30 |
| **Status** | `Current` for implemented controls and their known risks â€” backlog items in Â§8 are `Planned` / `Future` |
| **Source of Truth** | Implementation: `backend/src/auth/**`, `backend/src/middlewares/**`, `backend/src/sources/source-security.ts`, `backend/src/knowledge/file-validator.ts`, `backend/src/knowledge/url-fetcher.ts`, `backend/src/app.ts`, `backend/src/utils/logger.ts`. Requirements: SRS v1.1. |

## Status label vocabulary

| Label | Meaning |
| --- | --- |
| `Current` | Implemented and present in the repository today. |
| `Planned` | Required by SRS v1.1 and assigned to a named, upcoming phase. Not implemented. |
| `Future` | Required by SRS v1.1 with no phase assigned yet. Not implemented. |
| `Engineering Decision` | A choice made during implementation that SRS v1.1 does not specify; recorded for review. |

> **Anti-invention rule:** nothing in this document asserts a requirement that is not present in SRS v1.1 or in the repository. Where behaviour is unspecified, the text says so explicitly.

## 1. Purpose and scope

Controls, risks, and backlog for the Alternate.Me backend: identity (Â§3), sessions (Â§4), tokens and cryptography (Â§5), domain controls per surface (Â§6), known risks (Â§7), hardening backlog (Â§8), and posture summary (Â§9). Data classification and tenant isolation live in `DATABASE.md` Â§8â€“Â§9; prompt-level defences in `PROMPTS.md` Â§4; the Phase 5 verification blocker in `ERROR-HANDLING.md` Â§9 (G-01).

## 2. Defence-in-depth map (`Current`)

| Layer | Controls | Section |
| --- | --- | --- |
| Edge | helmet (minus CSP/COEP â€” see Â§7), CORS allow-list, 10 MB body caps, global + auth + chat rate limits | Â§3, Â§7 |
| Identity | Bearer JWT (HS512), Argon2id passwords, SHA-256-hashed one-time tokens, OAuth account linking | Â§3, Â§5 |
| Authorisation | role / permission / ownership guards; 404-masking of foreign resources | Â§3 |
| Sessions & secrets | refresh rotation with reuse detection; AES-256-GCM BYOK at rest | Â§4, Â§5 |
| Input â€” network | SSRF protocol/host/DNS/IP validation, per-hop redirect re-validation | Â§6.1 |
| Input â€” files | magic-byte, filename, size, and content-type validation | Â§6.2 |
| AI surfaces | secret detection before memory writes, debug-endpoint gating, chat rate limit, generic LLM errors | Â§6.3 |
| Prompt surface | persona ownership + public-projection limits + DATA framing | Â§6.4, `PROMPTS.md` Â§4 |
| At rest | classification table (Argon2, SHA-256, AES-256-GCM, plaintext gaps) | Â§5, `DATABASE.md` Â§9 |
| Observability | Pino redaction, request-id correlation, audit rows | Â§3, `ERROR-HANDLING.md` Â§7 |
| Known risks / backlog | G-06, G-08, CSP posture, OAuth plaintext, retention | Â§7, Â§8 |

## 3. Authentication and authorisation (`Current`, Phase 1)

**Registration** (`src/auth/services/auth.service.ts`): email and username are lower-cased and trimmed; a duplicate **verified** email raises `CONFLICT` (409); passwords are hashed with **Argon2id** (`memoryCost 2^16`, `timeCost 3`, `parallelism 1` â€” `src/auth/utils/password.ts`); the email-verification token is 48 random bytes stored only as its SHA-256 hash with a 24-hour expiry; verification and welcome emails go through the mailer abstraction; a `USER_REGISTERED` audit row is written.

**Login**: password verification creates a device session row (device, browser, OS, IP, country, city, user agent; 30-day expiry) plus an access JWT whose payload carries `sid` (`jti`, `sub`, `email`, `username`, `role`, `tenantId`, `permissions[]`). Route authentication is **Bearer-only** (`authenticate` / `optionalAuthenticate` in `src/auth/middlewares/auth.middleware.ts`); a missing/malformed header or an invalid token yields `AUTHENTICATION_ERROR` (401). `optionalAuthenticate` continues unauthenticated rather than failing.

**Authorisation layers** (`src/auth/middlewares/authorization.middleware.ts`, `src/middlewares/ownership.ts`):

- `authorizeRole([...])` â€” `UserRole` membership (`USER`, `ADMIN`, `SUPER_ADMIN`).
- `authorizePermission([...])` â€” every required permission must be present in the JWT `permissions[]`.
- `authorizeOwnership(...)` â€” explicit owner-id comparison against `req.authUser.id`.
- `requireAlternateOwnership` / `requireSourceOwnership` / `requireOnboardingOwnership` â€” database-backed guards; `requireAlternateOwnership` matches `{ id, userId, deletedAt: null }` and answers **404** "not found or access denied" for foreign or missing rows (`Engineering Decision`: existence is not disclosed).

Identity always comes from the verified JWT (`req.authUser.id`), never from `X-User-Id` / `X-Tenant-Id` headers (`DATABASE.md` Â§9.1; see G-08 in Â§7).

**Rate limits** (`src/middlewares/rateLimiter.ts`): auth endpoints 20 requests / 15 minutes; the global limiter allows `RATE_LIMIT_MAX` (default 100) per `RATE_LIMIT_WINDOW_MS` (default 60 s); chat allows `CHAT_RATE_LIMIT_MAX` (default 30) per 60 s (`chat.routes.ts`). All three answer `RATE_LIMIT_ERROR` (429).

**OAuth (Google, GitHub)**: accounts link by unique `(provider, providerAccountId)`; an existing email is linked rather than duplicated; OAuth users are created with `emailVerified` set; only default profile/email scopes are requested (limitation recorded in `PHASES.md` Â§3.2).

**Audit**: security-relevant mutations write `audit_logs` rows (`DATABASE.md` Â§4.1).

**Known auth gaps.** MFA columns (`isMfaEnabled`, `mfaSecret`) exist but no challenge flow is implemented (`Planned`); account lockout beyond IP rate limiting is not implemented (`Engineering Decision` â€” rate limiting was judged sufficient for the current threat model, `PHASES.md` Â§3.2).

## 4. Sessions and refresh rotation (`Current`, Phase 1)

- **Session record**: device context plus `expiresAt` = now + 30 days; the JWT `sid` claim maps requests to `req.authSessionId`.
- **Refresh tokens**: 64 random bytes, returned in plaintext exactly once and stored **only** as SHA-256 (`tokenHash`, unique index).
- **Rotation**: every call to `refreshAuthToken` verifies the presented token against its hash, consumes it, and issues a new one bound to a device `fingerprint` â€” lineage fields `rotatedFromId` / `replacedByToken` record the chain (`PHASES.md` Â§3.2).
- **Reuse detection**: presenting an already-rotated token revokes **all** of the user's refresh tokens, audits `REFRESH_TOKEN_REUSE_DETECTED`, and fails with 401 (`auth.service.ts`).
- **Logout**: single-session logout revokes the session (cascading to its tokens); logout-all revokes every refresh token. The sessions API lists active sessions and revokes one (404 if foreign, 403 if already revoked) or all (`session.service.ts`).
- **Password reset**: single-use, time-boxed, SHA-256-stored token; a successful reset revokes all refresh tokens and audits `PASSWORD_RESET_COMPLETED`; invalid or reused tokens yield 401.

**Limitation (`Current`).** Access JWTs are stateless for their full `JWT_ACCESS_EXPIRY` (default 15 minutes): `authenticate` verifies signature and claims but does not re-check session liveness, so revoking a session does not invalidate an already-issued access token until it expires. The refresh path is the enforced control.

## 5. Tokens and cryptography (`Current`)

| Primitive | Usage | Evidence |
| --- | --- | --- |
| JWT **HS512** | Access tokens with `issuer` (`alterneme-api`) and `audience` (`alterneme-client`) pinned; default expiry 15 min (`JWT_ACCESS_EXPIRY`); min 32-char secrets enforced by `envSchema` | `src/auth/utils/jwt.ts`, `src/config/index.ts` |
| **Argon2id** | Password hashing (2^16 memory, t = 3, p = 1) | `src/auth/utils/password.ts` |
| **SHA-256** | Every stored token â€” verification (48 B), password reset, refresh (64 B) â€” plus file checksums | `src/auth/utils/crypto.ts` |
| **AES-256-GCM** | BYOK provider keys at rest: `iv:authTag:ciphertext`, key material `sha256(ENCRYPTION_KEY)` | `src/utils/helpers.ts`, `src/ai-providers/provider.service.ts` |

**BYOK handling.** `saveProvider` encrypts the key, connectivity-validates it through the adapter (fail-open to `PENDING` on network failure), upserts on `alternateId`, writes an audit row, and returns only `{ provider, status }`. `getDecryptedApiKey(alternateId, userId)` decrypts strictly server-side for orchestration and is reachable through no route (`PHASES.md` Â§3.3). The ciphertext is the highest-value secret in the database; rotating `ENCRYPTION_KEY` without a re-encryption migration makes every stored key undecryptable (`DATABASE.md` Â§4, Â§9).

**Environment hygiene.** `validateEnv()` fails fast (exit 1) on missing values or JWT secrets shorter than 32 characters; `.env` is git-ignored; CI provisions hermetic test secrets; the container runs as a non-root user (`PHASES.md` Â§3.1). The full at-rest classification table â€” what is Argon2-hashed, SHA-256-hashed, AES-encrypted, or still plaintext â€” is `DATABASE.md` Â§9.

## 6. Domain controls

### 6.1 Web/URL ingestion â€” SSRF (`Current`, Phases 2â€“3)

Three stacked checks (`src/sources/source-security.ts`, `src/knowledge/url-fetcher.ts`):

1. **`validateSourceUrl` (lexical)** â€” protocol allow-list `http:` / `https:` only (explicitly blocking `file:`, `ftp:`, `ftps:`, `gopher:`, `dict:`, `ldap:`, `ldaps:`, `telnet:`, `smb:`, `data:`, `javascript:`); hostname block-list (`localhost`, `localhost.localdomain`, `metadata.google.internal`, `metadata`, `puppet`, `consul`, `docker`, `kubernetes`); private/reserved IPv4 hostname patterns (10/8, 192.168/16, 172.16/12, 127/8, 169.254/8, 0/8, 100.64/10) and IPv6 loopback.
2. **`assertHostnameSafe` (pre-socket DNS)** â€” resolves **all** addresses for the host and rejects any private/reserved answer before a socket opens. `isPrivateAddress` covers CGNAT (100.64/10), link-local (169.254/16), 192.0.0.0/24, loopback, "this network", IPv6 loopback, unique-local `fc00::/7`, `fe80::/10`, and IPv4-mapped loopback; malformed or non-IP input is treated as unsafe. This is what blocks the cloud-metadata endpoint (169.254.169.254) and DNS rebinding aimed at internal networks.
3. **`fetchUrl` (transport)** â€” `redirect: manual` with the full lexical + DNS re-validation repeated on **every hop** (max `MAX_URL_REDIRECTS` = 5); abort timeout `INGESTION_TIMEOUT` = 15 s; body streamed with a hard `MAX_URL_RESPONSE_SIZE` = 5 MB cap â†’ `CONTENT_TOO_LARGE`; the response `Content-Type` must be on a six-type allow-list (`text/html`, `text/plain`, `text/markdown`, `application/xhtml+xml`, `application/pdf`, DOCX) before indexing.

Evidence: 13 network-independent unit tests (`src/utils/__tests__/source-security.test.ts`, `PHASES.md` Â§2/Â§3.3). Phase 6 tools must reuse `assertHostnameSafe` / `fetchUrl` for any URL egress (`PHASES.md` Â§3.7, Â§8).

### 6.2 File upload validation (`Current`, Phases 2â€“3)

`validateUploadedFile` (`src/knowledge/file-validator.ts`) never trusts the filename:

| Check | Failure code |
| --- | --- |
| Empty buffer | `EMPTY_DOCUMENT` |
| Size above `MAX_FILE_SIZE` (25 MB upload; the 15 MB document and 5 MB URL-response caps apply downstream) | `FILE_TOO_LARGE` / `CONTENT_TOO_LARGE` |
| Filename traversal â€” path separators altering the basename, `..`, or a leading `.` | `UNSUPPORTED_FILE_TYPE` |
| Dangerous magic bytes in the first 64 B â€” `MZ` (PE/executable), `ELF`, `#!` (shell script) â€” regardless of extension | `UNSUPPORTED_FILE_TYPE` |
| Magic-byte MIME must resolve to a known profile and must not contradict the claimed MIME for container formats | `UNSUPPORTED_FILE_TYPE` |

A SHA-256 checksum of the body enables idempotent re-upload (`IDEMPOTENT_SKIP` when unchanged). Body-parser JSON is capped at 10 MB, which also caps the Phase 2 base64 `fileContent` path (multipart is `Planned` â€” `PHASES.md` Â§3.3). User-facing text comes from each code's `safeMessage`; internals stay in logs (`ERROR-HANDLING.md` Â§4.3, Â§7).

### 6.3 Memory and AI data protection (`Current`, Phases 4â€“5)

- **Secret detection before persistence** â€” `detectSecrets` (`src/memory/memory.policy.ts`) runs 10 regex families (`SECRET_PATTERNS`): OpenAI and Anthropic keys, AWS access-key IDs and secret keys, generic `api_key = â€¦` assignments, `Bearer â€¦` tokens, JWTs, `password = â€¦` assignments, 13â€“16-digit card numbers, and PEM private keys. Any match marks the content sensitive: `evaluateWritePolicy` refuses the write outright, and logging would show only the `[REDACTED]` replacement (`DATABASE.md` Â§4.5 â€” this section is its cross-reference target).
- **Write policy** â€” additionally rejects `INFERRED` memories below 0.6 confidence, importance below 0.3, and empty or over-length content (1 000-character cap).
- **Visibility defaults** â€” memories insert as `PRIVATE`; chat-context retrieval runs owner-scoped with `includePrivate: true` only after `Alternate.memoryEnabled` (default `false`) is confirmed; owner listing defaults to `ALTERNATE` visibility.
- **Debug endpoints** â€” `/rag/debug` and `/memory/debug` refuse production requests unless `ENABLE_RAG_DEBUG` / `ENABLE_MEMORY_DEBUG` are explicitly `true`; they emit narrow previews (â‰¤ 200â€“800 chars) and never vectors or provider keys.
- **Chat surface** â€” `POST /alternates/:id/chat` sits behind `authenticate` + `requireAlternateOwnership` + a dedicated limiter (30 requests / 60 s); provider keys are decrypted per call and never logged; provider failures surface the generic `LLM_ERROR` (422) without provider internals (`ERROR-HANDLING.md` Â§4.2); SQL for retrieval binds positional parameters (`ED-01`).
- **Extraction/summary inputs** are fenced as untrusted DATA on the worker path (`PROMPTS.md` Â§6â€“Â§7); extraction and retrieval failures are logged and swallowed so chat cannot be failed through memory (`ED-05`).
- **Log hygiene** â€” Pino redacts `authorization`/`cookie` headers and `body.password|token|secret|apiKey|api_key` plus `*.apiKey`, `*.secret`, `*.password` (`ERROR-HANDLING.md` Â§7).

### 6.4 Persona and prompt security (`Current`, Phases 2â€“4)

- Persona free-text (`instructions`, `boundaries`, `refusalBehavior`) is classified high-sensitivity (`DATABASE.md` Â§4.2 â€” this section is its cross-reference target): writable only by the owner through ownership-guarded, audited routes (`PERSONA_UPDATED`), readable in full only in owner-gated contexts.
- The **public projection exposes only** `tone`, `writingStyle`, `personality` â€” never instructions, boundaries, or refusal behaviour (`GET /public/:username`; `DATABASE.md` Â§4.2).
- In the prompt, persona text occupies slot 1 and is followed by the fixed privacy rules and the `## Security` block, so safety clauses are always present after owner-authored instructions (`PROMPTS.md` Â§3â€“Â§4).
- The system prompt itself is protected by behaviour rule 5 â€” never reveal system prompts, API keys, or internal configuration â€” as the defence against prompt-extraction attacks, complementing the redaction layer (Â§7).

### 6.5 Agent tool execution (`Current`, Phase 6)

Phase 6 lets a model request actions. The design assumption is that **everything the model touches is attacker-influenced**, and that only server-side checks grant permission.

**Tool authorization (the single gate, `src/agent/tools/authorization.service.ts`).** Every call passes, in order: authenticated user â†’ alternate exists and is not soft-deleted â†’ ownership â†’ tool exists in the registry â†’ tool enabled for this Alternate â†’ permitted in this execution context â†’ risk policy â†’ approval policy. Any failure raises an `AgentError` before the tool body runs.

- **The execution context is re-derived from the database, never trusted.** `deriveExecutionContext()` compares the authenticated user with `alternate.userId`. A caller can only *lower* their own privilege: claiming `OWNER`, `SYSTEM` or `WORKER` while not owning the Alternate yields `PUBLIC_VISITOR`.
- **Registry â‰  authorization.** `ToolRegistry` only stores and looks up tools. A registered tool is not a permitted tool.
- **No arbitrary code execution.** There is no `eval`, `new Function`, shell, dynamic SQL or filesystem execution anywhere in the agent module, and no sandbox is introduced. Tools are a fixed, server-registered set.
- **Deny-by-default policy.** `evaluateToolPolicy()` returns `allowed: false` for an unknown or renamed risk level, so a future `riskLevel` absent from the mapping fails closed.

**Public/owner execution boundaries (`Current`).**

| Control | Rule |
| --- | --- |
| Private Alternates | A non-owner is rejected with `AGENT_UNAUTHORIZED` before any tool is considered (same rule the existing chat path uses) |
| Owner-only tools | `memory_search` sets `allowPublicVisitor: false` and re-checks inside `execute`, so a misconfigured registry still cannot leak personal context |
| Approval-gated tools | A visitor can never enter an approval flow: no owner is present to approve, so "requires approval" is treated as a denial |
| Persona data | `alternate_context` selects `persona` only when `isOwner`, so persona configuration is never disclosed to a visitor |
| Conversation scoping | `conversation_context` adds `userId` to the WHERE clause for visitors, confining them to their own conversation |
| Per-Alternate revoke | `ToolConfiguration.allowedContexts` can exclude `PUBLIC_VISITOR` per tool |

**Approval gates (`Current`).** Risk â†’ approval is centrally configurable (`config.agent.approval.requireByRiskLevel`) and never hardcoded in a tool. Defaults: `READ_ONLY` no approval, `LOW`/`MEDIUM` off, `HIGH`/`DESTRUCTIVE` required. A per-Alternate `requireApproval` override wins over config and can force approval onto a read-only tool.

- Decisions are **conditional updates** on `status = PENDING AND expiresAt > now()`, so a double-click, a concurrent decision or a post-expiry decision matches zero rows and is refused.
- Rejecting transitions the `ToolExecution` to `CANCELLED` with `TOOL_APPROVAL_REJECTED`, so a rejected action can never fire later.
- `AGENT_APPROVAL_TTL_MS` (24 h) bounds how long a request stays actionable; stale requests are expired before being listed.
- The owner sees `sanitizedActionSummary` â€” a redacted single-line summary â€” never raw arguments and never secrets.

**Injection defence (`Current`).** Prompt-level framing is defence-in-depth only; the enforcement is that authorization re-runs on every call. `INJECTION_MARKERS` uses phrase-shaped patterns (not keyword lists) covering "ignore/disregard previous instructions", role reassignment, fake `SYSTEM:`/tag markers, and **both word orders** of an authorisation claim. `src/tests/agent/prompt-injection.test.ts` exercises seven attack strings across the user-message, RAG, memory and tool-output surfaces and asserts the policy still denies a gated tool afterwards.

**Tool result sanitization (`Current`).** `sanitizeToolResult()` validates, redacts (sensitive key names **and** `SECRET_PATTERNS` content), neutralises, truncates at `AGENT_MAX_TOOL_RESULT_CHARS`, and labels the payload `[UNTRUSTED_TOOL_DATA]`. Persistence mirrors this: `tool_executions.input` is deliberately never written, only `sanitizedInput` (`DATABASE.md` DB-10).

**Idempotency (`Current`).** The key is `sha256(alternateId, toolName, canonical(args))` â€” deterministic, so a retry after a network timeout regenerates the same key with no shared state. A unique constraint on `(alternateId, toolName, idempotencyKey)` makes a duplicate side effect impossible; a matching `SUCCEEDED` row is replayed instead of re-executed. The key is tenant- and tool-scoped, so two Alternates may legitimately perform the same action.

**Retry safety (`Current`).** Only transient classes are retried, with capped exponential backoff. Terminal classes â€” `TOOL_INVALID_INPUT`, `TOOL_NOT_ALLOWED`, `AGENT_UNAUTHORIZED`, `TOOL_NOT_FOUND`, `TOOL_DISABLED`, `TOOL_APPROVAL_REJECTED`, `AGENT_MAX_STEPS` â€” are never retried, because retrying a denial would look like an attempt to work around a decision. The `agent` worker likewise refuses to retry terminal agent errors.

**Cost and abuse control (`Current`).** The agent cannot run unbounded: `maxSteps`, `maxToolCalls`, `maxLlmCalls`, `maxRuntimeMs`, `maxToolRuntimeMs`, `maxContextTokens`, `maxToolResultChars` and `maxToolCallsPerTool` are all configurable and checked before each step and each call. Per-run token, step, tool and LLM-call counters are persisted for future usage metering. HTTP-level limits: `agentRunRateLimiter` 10/min and `agentToolRateLimiter` 30/min, on top of the global limiter.

**Audit (`Current`).** Twelve actions are written through the existing `AuditLog` (`action` is a `String` column, so no second audit system and no enum migration): `AGENT_RUN_STARTED/COMPLETED/FAILED`, `TOOL_EXECUTION_REQUESTED/AUTHORIZED/DENIED/EXECUTED/FAILED`, `APPROVAL_REQUESTED/GRANTED/REJECTED`. Metadata carries `requestId`, `runId`, `alternateId`, `toolName`, `status`, `durationMs`, `errorCode`, plus truncation/redaction/neutralisation flags. Payloads are already redacted; an audit write failure is logged and swallowed so it cannot break a user-facing run.

**Secret handling (`Current`).** No provider API key, password, token or credential is stored on any agent row, logged, or placed in a prompt. Decryption happens per call in the existing `providerService` and never enters the agent context. `AgentStep` stores no reasoning content (`DATABASE.md` DB-11).

**Failure isolation (`Current`).** An agent failure never corrupts conversation state: the user message is already persisted, the run is recorded `FAILED`/`TIMED_OUT` with a safe message, and chat returns a safe reply. No database transaction is held open across an LLM or tool call.

**Residual risks.** `SECRET_PATTERNS` (Phase 5, Â§6.3) does not cover GitHub personal access tokens (`ghp_â€¦`) or generic vendor formats; key-name redaction catches those only when they appear under a known key name. Any future URL-fetching tool must reuse `assertHostnameSafe` / `fetchUrl` and needs its own SSRF review. Enabling a genuinely side-effecting tool requires product sign-off and a per-tool egress review.

## 7. Known risks (`Current`)

| # | Risk | Impact | Status |
| --- | --- | --- | --- |
| G-06 | Rate limiting uses `express-rate-limit`'s **in-process** store; the Redis-backed path (`src/shared/redis.ts`, `cache.ts`, `rateLimiter.ts`) exists but is unwired | Multi-instance deployments do not share counters â€” limits are effectively per-process | Open â€” remediation is Â§8 item 6; this section is the gap's cross-reference target (`ARCHITECTURE.md` G-06) |
| G-08 | `tenantResolver` copies `X-Tenant-Id` / `X-User-Id` headers onto the request **verbatim** (`src/middlewares/tenant.ts`) | Harmless only while no code trusts it for authorisation â€” today identity is always the JWT and data access is scoped by `userId` + `alternateId` (`DATABASE.md` Â§9.1); the header must never become an identity source | Open â€” invariant documented, no code change (`ARCHITECTURE.md` G-08) |
| â€” | Helmet runs with `contentSecurityPolicy: false` and `crossOriginEmbedderPolicy: false` (`src/app.ts`) | Acceptable for a JSON API with an explicit CORS allow-list; becomes a defect if HTML is ever served from this origin. `/docs` (Swagger UI) is publicly reachable unless the proxy restricts it | `Current` posture (`PHASES.md` Â§3.1) â€” re-evaluate if serving HTML |
| â€” | No MFA challenge flow; no account lockout beyond IP rate limits | Brute-force defence rests on Argon2 cost + the 20/15-min auth limiter | `Planned` (MFA) / `Engineering Decision` (lockout) â€” Â§3 |
| â€” | Expired sessions/tokens/audit rows are never swept; no data-export endpoint; storage blobs are not purged with DB rows | Retention and data-subject-request exposure | `Planned` â€” `DATABASE.md` Â§6, and Â§8 items 4â€“5 |
| â€” | OAuth provider tokens and `mfaSecret` sit plaintext in the database | Credential exposure if the database leaks; also banned from error/log output (`ERROR-HANDLING.md` Â§9.2) | `Planned` â€” Â§8 items 1â€“2 |
| â€” | S3 storage adapter is a stub â€” no `@aws-sdk/client-s3`, `download()` throws | Object storage hardening incomplete; local-disk default (`ED-08`) | `Planned` â€” Â§8 item 3 (`ARCHITECTURE.md` G-07) |

## 8. Hardening backlog (`Planned` / `Future`)

This section is the cross-reference target for `DATABASE.md` Â§4/Â§6/Â§9, `PHASES.md` Phase 6 and Future rows, and every "see SECURITY.md Â§8" pointer in the pack.

| # | Item | Cross-reference |
| --- | --- | --- |
| 1 | Encrypt `OAuthAccount.accessToken` / `refreshToken` / `idToken` at rest (AES-256-GCM, same envelope as Â§5) with a re-encryption migration | `DATABASE.md` oauth rows, Â§9; `ERROR-HANDLING.md` Â§9.2 |
| 2 | Encrypt `User.mfaSecret` **before** any MFA flow ships | `DATABASE.md` Â§4.1 |
| 3 | Install `@aws-sdk/client-s3` and support `STORAGE_PROVIDER=s3` for real object storage | `ARCHITECTURE.md` G-07, `ED-08` |
| 4 | Data-export ("download my data") endpoint plus a retention sweep for expired sessions, tokens, and audit rows | `DATABASE.md` Â§6 |
| 5 | Purge storage blobs (local disk or S3) when a User or source is hard-deleted â€” DB cascade does not touch storage today | `DATABASE.md` Â§6 |
| 6 | Migrate rate limiting onto the existing Redis-backed store so multi-instance deployments share counters | G-06 (Â§7) |
| 7 | Implement the MFA challenge flow over the existing `isMfaEnabled` / `mfaSecret` columns (after item 2) | Â§3 |
| 8 | Phase 6 security requirements: deny-by-default tool policy; explicit approvals for side-effecting tools; per-Alternate cost budgets; redacted tool arguments in audit; webhook signature verification; SSRF-safe tool egress reusing `assertHostnameSafe` / `fetchUrl`; no cross-tenant tool reads | `PHASES.md` Â§3.7 |
| 9 | Future areas: moderation pipeline, widget origin allow-list + per-widget rate limits, billing webhook hardening, share-link expiry enforcement | `PHASES.md` Â§4 |

## 9. Security posture summary

Identity is JWT-based with Argon2 at the door, refresh rotation with reuse detection behind it, and every data query scoped by the verified `userId` + `alternateId` rather than by headers (Â§3â€“Â§5, `DATABASE.md` Â§9.1). Network and file inputs pass layered SSRF and magic-byte validation (Â§6.1â€“Â§6.2); AI surfaces get secret detection, visibility defaults, gated debug endpoints, and prompt-level DATA framing (Â§6.3â€“Â§6.4, `PROMPTS.md` Â§4). At rest, passwords are Argon2-hashed, tokens SHA-256-hashed, and BYOK keys AES-256-GCM-encrypted (Â§5).

The structural caveats a reviewer must weigh are **G-06** (per-process rate counters) and **G-08** (trusted-looking identity headers that must stay context-only), both in Â§7; the credential-encryption, retention, and storage items in Â§8 are required before any production or GDPR/DSR commitment; and overall confidence statements must account for the Phase 5 verification blocker recorded in `ERROR-HANDLING.md` Â§9.1 (G-01).

---

*End of SECURITY.md â€” version 1.1.0.*




