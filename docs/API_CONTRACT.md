# Codefire API contract (frontend ↔ Django)

This is what the Next.js frontend expects from the Django REST Framework + Channels backend.
The source of truth for every response shape is `lib/api/schemas.ts` (zod). The frontend
validates every response against it, so a field with the wrong name or type fails loudly in dev.
The mock implementation in `mocks/handlers.ts` behaves exactly as described here, so you can use
it as an executable reference.

## Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `${NEXT_PUBLIC_API_URL}/api/...`, e.g. `https://api.codefire.uz/api/problems` |
| JSON keys | **camelCase** (use `djangorestframework-camel-case`) |
| Dates | ISO 8601 with offset, Tashkent time: `2026-10-23T19:35:00+05:00` |
| IDs | Problems use string IDs like `"37A"` (round number + letter). Everything else is an integer or a slug |
| Pagination | Page-based: `?page=N` → `{ count, page, pageSize, results }`. Problems and users: 100 per page; submissions: 50 |
| List params | Multi-value params are comma-separated: `?tags=graflar,DP` |
| Errors | Any non-2xx: `{ "code": "validation_error", "message": "Human readable (Uzbek)", "fields": { "email": ["..."] } }`. `fields` only for form errors |
| Empty success | `{ "ok": true }` for actions without a body |
| Language | Send `message` texts in the user's language (read `Accept-Language`: `uz`, `ru`, `en`) |

## Auth

JWT in **httpOnly, Secure, SameSite=Lax cookies**. Never return tokens in the body; the
frontend never touches them.

- The browser sends cookies with `credentials: "include"`. Configure CORS with
  `CORS_ALLOW_CREDENTIALS = True` and an explicit origin list.
- CSRF: set the `csrftoken` cookie (readable by JS). The frontend sends it back as
  `X-CSRFToken` on every non-GET request.
- When the access token expires, return **401**. The frontend calls `POST /api/auth/refresh`
  once (the refresh cookie rotates the access cookie) and retries the original request. If the
  refresh also fails, the user is treated as signed out.
- Server-side rendering forwards the browser's `Cookie` header, so the same cookies must
  authenticate server-to-server requests from the Next.js host.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ login, password }` (login = username or phone `+998901234567`) | `Me`, sets cookies. 400 `invalid_credentials` |
| POST | `/auth/register` | `{ fullName, phone, username, password }`. `phone` is E.164 without spaces: `+998901234567` (the form shows `+998 (90) 123-45-67`). `fullName` is "Ism Familiya" in one field | `Me`, sets cookies. 400 with `fields` (e.g. `username` or `phone` taken) |
| POST | `/auth/password-reset` | `{ login }` (username, email, or phone) | `{ ok: true }` whether or not the account exists; send a one-time reset link/code when it does |
| POST | `/auth/refresh` | — | `{ ok: true }`, rotates cookies. 401 if refresh expired |
| POST | `/auth/logout` | — | `{ ok: true }`, clears cookies |
| GET | `/auth/me` | — | `Me`, or **401** when signed out |

Optional social login (Google, Telegram) should end by setting the same cookies and redirecting
back to the frontend.

## Entities (abridged — see `lib/api/schemas.ts` for every field)

- **UserSummary**: `username, displayName, rating, country (ISO-2), avatarUrl|null`
- **User**: UserSummary + `region, school, contestsCount, solvedCount, contribution, maxRating, bio, joinedAt, streak, clan|null, languages[], tagStats[], difficultyStats[], achievements[]`
- **Me**: User + `phone, email|null, dailyGoal, solvedToday, lastProblem {id, name, language}|null`
- **ProblemSummary**: `id, name, tags[], difficulty (800–3000), solvedCount, acceptance (0–100), status ("solved"|"attempted"|null)`
- **Problem**: ProblemSummary + `legend, inputSpec, outputSpec, notes|null` (Markdown with KaTeX `$…$`), `examples[{input, output}], timeLimitMs, memoryLimitMb, author|null, source|null`
- **Submission**: `id, createdAt, user, problem {id, name}, language, verdict, failedTest|null, timeMs|null, memoryKb|null, contestId|null`
- **Verdict**: `AC | WA | TLE | MLE | RE | CE | PENDING | RUNNING`
- **Contest**: `id, name, kind ("contest"|"training"), status ("upcoming"|"running"|"finished"), startsAt, durationMin, authors[], participants, rated, division|null, format ("ICPC"|"IOI"), registered`
- **Standings**: `contestId, format, frozen, updatedAt, problems[{letter, maxScore}], rows[{rank, user, solved, penalty, score, cells[{letter, result ("accepted"|"rejected"|"pending"|null), attempts, timeMin|null, score|null, firstSolve}]}]`

`status` on problems and `registered` on contests are personal: return them for the signed-in
user, `null` / `false` otherwise. Public lists are cached by the frontend (ISR), so personal
fields are also exposed separately (`/problems/statuses`, see below).

## Endpoints

### Problems
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/problems?search=&tags=&minDifficulty=&maxDifficulty=&status=solved\|attempted\|unsolved&sort=&page=` | `sort`: `id` (default: newest rounds first), `difficulty`, `-difficulty`, `solved`, `-solved`. `search` matches ID prefix or name |
| GET | `/problems/tags` | `string[]` |
| GET | `/problems/statuses` | `{ "37A": "solved", "112B": "attempted" }` for the signed-in user, `{}` otherwise |
| GET | `/problems/{id}` | `Problem`. 404 `not_found` |
| POST | `/problems/{id}/run` | `{ language, code }` → `{ results[{example, verdict, output, expected, timeMs}], compilerOutput|null }`. Runs only the public examples, synchronously |
| GET | `/languages` | `[{ id, name, monaco, template }]`; `monaco` is the Monaco language id (`cpp`, `python`, …) |

### Submissions
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/submissions?user=&problem=&verdict=&contest=&page=` | Newest first, 50 per page |
| GET | `/submissions/{id}` | Submission + `code, compilerOutput|null, tests[{index, verdict, timeMs, memoryKb}]` |
| POST | `/submissions` | `{ problem, language, code, contest? }` → **201** Submission with `verdict: "PENDING"`. 401 when signed out |

### Contests
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/contests?status=&kind=` | Array, not paginated |
| GET | `/contests/{id}` | Contest + `description, problems[{letter, problemId, name, solvedCount, attemptedCount, maxScore}]` (empty before start), `freezeAt|null, announcements[], clarifications[], ratingChanges[]|null` |
| POST | `/contests/{id}/register` | `{ ok: true }`. The frontend updates optimistically |
| DELETE | `/contests/{id}/register` | Unregister |
| GET | `/contests/{id}/standings` | `Standings`. While frozen, hide results after `freezeAt` as `result: "pending"` |

### Users and stats
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/users?sort=rating\|solved\|contribution&country=&region=&school=&search=&page=` | Leaderboard rows (UserSummary + region, school, contestsCount, solvedCount, contribution) |
| GET | `/users/filters` | `{ countries[], regions[], schools[] }` for the filter selects |
| GET | `/users/{username}` | `User` |
| GET | `/users/{username}/rating-history` | `[{contestId, contestName, date, rank, oldRating, newRating}]`, oldest first |
| GET | `/users/{username}/activity` | 365 × `{date: "YYYY-MM-DD", count}` ending today |
| POST / DELETE | `/users/{username}/follow` | Optimistic on the frontend |
| GET | `/stats/platform` | `{ users, problems, submissionsToday, contestsHeld }` |
| GET | `/stats/countries` | `[{code, name, users, solved}]` |
| GET | `/stats/regions` | `[{region, users, newUsers, active}]` for Uzbekistan, most users first. `newUsers` / `active`: last 30 days |
| GET | `/stats/daily` | 30 × `{date: "YYYY-MM-DD", submissions}`, oldest first, ending today |
| GET | `/notifications` | `[{id, at, text, href|null, read}]`, signed-in only |
| GET | `/search?q=` | `{ problems[{id, name, difficulty}] (exact ID match first), users[UserSummary], contests[{id, name, status, startsAt}] }`, max ~6 each. Used by the Ctrl+K palette; must be fast |

### Later (frontend shows "coming soon")
`/clans`, `/clans/{slug}`, `/clans/{slug}/join`, `/courses`, `/courses/{slug}`, `/blogs`,
`/blogs/{slug}`, `/blogs/{slug}/like`, `/blogs/{slug}/comments`. Their shapes are already in
`schemas.ts` and mocked, so they can be built in any order.

## WebSockets (Django Channels)

Base: `${NEXT_PUBLIC_WS_URL}/`. Authenticated by the same cookies. JSON text frames only. The
client reconnects with exponential backoff (0.5s → 10s) on any close other than code 1000.

### `ws/submissions/{id}/`
Live judging of one submission. Send progress as tests run, then exactly one `result`, then close.

```json
{ "type": "progress", "verdict": "PENDING", "test": 0, "totalTests": 24 }
{ "type": "progress", "verdict": "RUNNING", "test": 7, "totalTests": 24 }
{ "type": "result", "verdict": "WA", "failedTest": 7, "timeMs": 140, "memoryKb": 5120, "totalTests": 24 }
```

If the submission is already judged when the socket opens, send the `result` frame immediately.

### `ws/contests/{id}/standings/`
Live scoreboard. On connect, optionally send a full snapshot; then one `cell` event per change.
The client re-sorts and re-ranks itself (`lib/standings.ts`), so the server only sends deltas.

```json
{ "type": "snapshot", "standings": { "...": "Standings" } }
{ "type": "cell", "username": "aziz_uz", "cell": { "letter": "C", "result": "accepted", "attempts": 1, "timeMin": 74, "score": null, "firstSolve": false } }
```

While the board is frozen, accepted/rejected results after `freezeAt` must be sent as
`"result": "pending"`.
