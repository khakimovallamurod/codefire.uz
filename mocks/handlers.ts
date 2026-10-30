import { delay, http, HttpResponse } from "msw";
import { API_URL } from "@/lib/api/client";
import type { Submission, Verdict } from "@/lib/api/types";
import {
  activity,
  blogDetail,
  blogPosts,
  clanDetail,
  clans,
  contestDetail,
  contests,
  COUNTRIES,
  courseDetail,
  courses,
  dailySubmissions,
  findProblem,
  findUser,
  iso,
  judgeOutcome,
  LANGUAGES,
  me,
  ME_USERNAME,
  MY_STATUSES,
  PROBLEMS,
  ratingHistory,
  regionStats,
  registeredContests,
  SAMPLE_CODE,
  standings,
  submissions,
  summary,
  TAGS,
  userProfile,
  USERS,
} from "./data";

const base = `${API_URL}/api`;
const PAGE_SIZE = 100;

/** In-memory writes made during this session (per runtime: server and browser each have their own). */
const created: Submission[] = [];
const likedPosts = new Set<string>();

function signedIn(request: Request) {
  return request.headers.get("x-mock-session") === ME_USERNAME;
}

function error(status: number, code: string, message: string, fields?: Record<string, string[]>) {
  return HttpResponse.json({ code, message, ...(fields ? { fields } : {}) }, { status });
}

async function latency() {
  // A little latency in the browser so loading states are exercised; none during SSR.
  if (typeof window !== "undefined") await delay(140);
}

function paginate<T>(items: T[], url: URL, pageSize = PAGE_SIZE) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  return { count: items.length, page, pageSize, results: items.slice((page - 1) * pageSize, page * pageSize) };
}

export const handlers = [
  /* ---------- Auth ---------- */
  http.get(`${base}/auth/me`, async ({ request }) => {
    await latency();
    return signedIn(request) ? HttpResponse.json(me()) : error(401, "not_authenticated", "Tizimga kirilmagan.");
  }),
  http.post(`${base}/auth/login`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { login?: string; password?: string };
    if (!body.login || !body.password) {
      return error(400, "validation_error", "Maydonlarni to'ldiring.", {
        ...(body.login ? {} : { login: ["Foydalanuvchi nomi yoki telefonni kiriting."] }),
        ...(body.password ? {} : { password: ["Parolni kiriting."] }),
      });
    }
    if (body.password.length < 6 || body.password === "xato123") {
      return error(400, "invalid_credentials", "Login yoki parol noto'g'ri.");
    }
    return HttpResponse.json(me());
  }),
  http.post(`${base}/auth/register`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as { username?: string; phone?: string };
    if (body.username && findUser(body.username) && body.username !== ME_USERNAME) {
      return error(400, "validation_error", "Ma'lumotlarni tekshiring.", { username: ["Bu nom band. Boshqasini tanlang."] });
    }
    return HttpResponse.json(me());
  }),
  http.post(`${base}/auth/password-reset`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { login?: string };
    if (!body.login?.trim()) {
      return error(400, "validation_error", "Login yoki telefon raqamingizni kiriting.", {
        login: ["Login yoki telefon raqamingizni kiriting."],
      });
    }
    return HttpResponse.json({ ok: true });
  }),
  http.post(`${base}/auth/refresh`, () => error(401, "token_not_valid", "Sessiya tugagan.")),
  http.post(`${base}/auth/logout`, () => HttpResponse.json({ ok: true })),

  /* ---------- Problems ---------- */
  http.get(`${base}/problems/tags`, () => HttpResponse.json(TAGS)),
  http.get(`${base}/problems/statuses`, ({ request }) =>
    signedIn(request) ? HttpResponse.json(MY_STATUSES) : HttpResponse.json({}),
  ),
  http.get(`${base}/problems`, async ({ request }) => {
    await latency();
    const url = new URL(request.url);
    const q = url.searchParams;
    const search = q.get("search")?.trim().toLowerCase();
    const tags = q.get("tags")?.split(",").filter(Boolean) ?? [];
    const min = Number(q.get("minDifficulty") ?? 0);
    const max = Number(q.get("maxDifficulty") ?? 99999);
    const status = q.get("status");
    const sort = q.get("sort") ?? "id";
    const statuses = signedIn(request) ? MY_STATUSES : {};

    let items = PROBLEMS.filter(
      (p) =>
        (!search || p.id.toLowerCase().includes(search) || p.name.toLowerCase().includes(search)) &&
        tags.every((t) => p.tags.includes(t)) &&
        p.difficulty >= min &&
        p.difficulty <= max &&
        (!status ||
          (status === "solved" && statuses[p.id] === "solved") ||
          (status === "attempted" && statuses[p.id] === "attempted") ||
          (status === "unsolved" && statuses[p.id] !== "solved")),
    );
    const dir = sort.startsWith("-") ? -1 : 1;
    const key = sort.replace("-", "");
    items = [...items].sort((a, b) =>
      key === "difficulty"
        ? dir * (a.difficulty - b.difficulty)
        : key === "solved"
          ? dir * (a.solvedCount - b.solvedCount)
          : // newest rounds first by default, letters in order
            b.round - a.round || a.id.localeCompare(b.id),
    );
    const page = paginate(items, url);
    return HttpResponse.json({
      ...page,
      results: page.results.map(({ id, name, tags, difficulty, solvedCount, acceptance }) => ({
        id,
        name,
        tags,
        difficulty,
        solvedCount,
        acceptance,
        status: statuses[id] ?? null,
      })),
    });
  }),
  http.get(`${base}/problems/:id`, async ({ params, request }) => {
    await latency();
    const p = findProblem(String(params.id));
    if (!p) return error(404, "not_found", "Masala topilmadi.");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { round, ...problem } = p;
    return HttpResponse.json({ ...problem, status: signedIn(request) ? (MY_STATUSES[p.id] ?? null) : null });
  }),
  http.post(`${base}/problems/:id/run`, async ({ params, request }) => {
    await delay(700);
    const p = findProblem(String(params.id));
    if (!p) return error(404, "not_found", "Masala topilmadi.");
    const { code } = (await request.json()) as { code: string };
    if (code.trim().length < 20) {
      return HttpResponse.json({
        results: [],
        compilerOutput: "main.cpp:3:1: error: expected unqualified-id before end of input",
      });
    }
    const broken = /TODO|WA/.test(code);
    return HttpResponse.json({
      compilerOutput: null,
      results: p.examples.map((ex, i) => ({
        example: i + 1,
        verdict: broken && i === p.examples.length - 1 ? "WA" : "AC",
        output: broken && i === p.examples.length - 1 ? "0" : ex.output,
        expected: ex.output,
        timeMs: 4 + i * 3,
      })),
    });
  }),
  http.get(`${base}/languages`, () => HttpResponse.json(LANGUAGES)),

  /* ---------- Submissions ---------- */
  http.get(`${base}/submissions`, async ({ request }) => {
    await latency();
    const url = new URL(request.url);
    const user = url.searchParams.get("user");
    const problem = url.searchParams.get("problem")?.toUpperCase();
    const verdict = url.searchParams.get("verdict") as Verdict | null;
    const contest = url.searchParams.get("contest");
    const items = [...created, ...submissions()].filter(
      (s) =>
        (!user || s.user.username === user) &&
        (!problem || s.problem.id === problem) &&
        (!verdict || s.verdict === verdict) &&
        // Mock rule: a contest's problems are the ones from its round (148A, 148B…).
        (!contest || s.contestId === Number(contest) || s.problem.id.startsWith(contest)),
    );
    return HttpResponse.json(paginate(items, url, 50));
  }),
  http.get(`${base}/submissions/:id`, async ({ params }) => {
    await latency();
    const id = Number(params.id);
    let s = [...created, ...submissions()].find((x) => x.id === id);
    // Made in another runtime (the browser) during this session: rebuild it from its id.
    if (!s && id > 902_400 && id < 903_000) {
      const o = judgeOutcome(id);
      s = {
        id,
        createdAt: iso(Date.now()),
        user: summary(findUser(ME_USERNAME)!),
        problem: { id: "37A", name: findProblem("37A")!.name },
        language: "GNU C++17",
        verdict: o.verdict,
        failedTest: o.failedTest,
        timeMs: o.verdict === "TLE" ? 2000 : 31 + (id % 180),
        memoryKb: 3200 + (id % 9000),
        contestId: null,
      };
    }
    if (!s) return error(404, "not_found", "Urinish topilmadi.");
    const total = 24;
    const lastTest = s.failedTest ?? (s.verdict === "AC" ? total : 0);
    return HttpResponse.json({
      ...s,
      code: SAMPLE_CODE,
      compilerOutput: s.verdict === "CE" ? "main.cpp: In function 'int main()':\nmain.cpp:9:5: error: 'cot' was not declared in this scope; did you mean 'cout'?" : null,
      tests:
        s.verdict === "CE" || s.verdict === "PENDING"
          ? []
          : Array.from({ length: Math.min(lastTest, total) }, (_, i) => ({
              index: i + 1,
              verdict: i + 1 === s.failedTest ? s.verdict : "AC",
              timeMs: Math.round(((s.timeMs ?? 30) * (0.3 + ((i * 37) % 70) / 100))),
              memoryKb: Math.round((s.memoryKb ?? 1000) * (0.6 + ((i * 13) % 40) / 100)),
            })),
    });
  }),
  http.post(`${base}/submissions`, async ({ request }) => {
    await delay(250);
    if (!signedIn(request)) return error(401, "not_authenticated", "Yechim yuborish uchun tizimga kiring.");
    const body = (await request.json()) as { problem: string; language: string; code: string; contest?: number };
    const p = findProblem(body.problem);
    if (!p) return error(404, "not_found", "Masala topilmadi.");
    if (!body.code.trim()) return error(400, "validation_error", "Kod bo'sh.", { code: ["Yechim kodini yozing."] });
    const lang = LANGUAGES.find((l) => l.id === body.language);
    const sub: Submission = {
      id: 902_401 + created.length,
      createdAt: iso(Date.now()),
      user: summary(findUser(ME_USERNAME)!),
      problem: { id: p.id, name: p.name },
      language: lang?.name ?? body.language,
      verdict: "PENDING",
      failedTest: null,
      timeMs: null,
      memoryKb: null,
      contestId: body.contest ?? null,
    };
    created.unshift(sub);
    return HttpResponse.json(sub, { status: 201 });
  }),

  /* ---------- Contests ---------- */
  http.get(`${base}/contests`, async ({ request }) => {
    await latency();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const kind = url.searchParams.get("kind");
    const list = contests(signedIn(request)).filter((c) => (!status || c.status === status) && (!kind || c.kind === kind));
    return HttpResponse.json(list);
  }),
  http.get(`${base}/contests/:id/standings`, async ({ params }) => {
    await latency();
    const st = standings(Number(params.id));
    return st ? HttpResponse.json(st) : error(404, "not_found", "Natijalar hali yo'q.");
  }),
  http.get(`${base}/contests/:id`, async ({ params, request }) => {
    await latency();
    const c = contestDetail(Number(params.id), signedIn(request));
    return c ? HttpResponse.json(c) : error(404, "not_found", "Musobaqa topilmadi.");
  }),
  http.post(`${base}/contests/:id/register`, async ({ params, request }) => {
    await delay(350);
    if (!signedIn(request)) return error(401, "not_authenticated", "Ro'yxatdan o'tish uchun tizimga kiring.");
    registeredContests.add(Number(params.id));
    return HttpResponse.json({ ok: true });
  }),
  http.delete(`${base}/contests/:id/register`, async ({ params }) => {
    await delay(350);
    registeredContests.delete(Number(params.id));
    return HttpResponse.json({ ok: true });
  }),

  /* ---------- Users ---------- */
  http.get(`${base}/users/filters`, () =>
    HttpResponse.json({
      countries: Object.keys(COUNTRIES),
      regions: [...new Set(USERS.map((u) => u.region).filter(Boolean))].sort(),
      schools: [...new Set(USERS.map((u) => u.school).filter(Boolean))].sort(),
    }),
  ),
  http.get(`${base}/users`, async ({ request }) => {
    await latency();
    const url = new URL(request.url);
    const q = url.searchParams;
    const sort = q.get("sort") ?? "rating";
    const country = q.get("country");
    const region = q.get("region");
    const school = q.get("school");
    const search = q.get("search")?.toLowerCase();
    const items = USERS.filter(
      (u) =>
        (!country || u.country === country) &&
        (!region || u.region === region) &&
        (!school || u.school === school) &&
        (!search || u.username.includes(search) || u.displayName.toLowerCase().includes(search)),
    )
      .sort((a, b) =>
        sort === "solved" ? b.solvedCount - a.solvedCount : sort === "contribution" ? b.contribution - a.contribution : b.rating - a.rating,
      )
      .map((u) => ({
        ...summary(u),
        region: u.region,
        school: u.school,
        contestsCount: u.contestsCount,
        solvedCount: u.solvedCount,
        contribution: u.contribution,
      }));
    return HttpResponse.json(paginate(items, url));
  }),
  http.post(`${base}/users/:username/follow`, async ({ request }) => {
    await delay(300);
    return signedIn(request) ? HttpResponse.json({ ok: true }) : error(401, "not_authenticated", "Kuzatish uchun tizimga kiring.");
  }),
  http.delete(`${base}/users/:username/follow`, async () => {
    await delay(300);
    return HttpResponse.json({ ok: true });
  }),
  http.post(`${base}/clans/:slug/join`, async ({ request }) => {
    await delay(400);
    return signedIn(request) ? HttpResponse.json({ ok: true }) : error(401, "not_authenticated", "Klanga qo'shilish uchun tizimga kiring.");
  }),
  http.get(`${base}/users/:username/rating-history`, ({ params }) => HttpResponse.json(ratingHistory(String(params.username)))),
  http.get(`${base}/users/:username/activity`, ({ params }) => HttpResponse.json(activity(String(params.username)))),
  http.get(`${base}/users/:username`, async ({ params }) => {
    await latency();
    const u = userProfile(String(params.username));
    return u ? HttpResponse.json(u) : error(404, "not_found", "Foydalanuvchi topilmadi.");
  }),

  /* ---------- Community ---------- */
  http.get(`${base}/clans`, () => HttpResponse.json(clans())),
  http.get(`${base}/clans/:slug`, ({ params }) => {
    const c = clanDetail(String(params.slug));
    return c ? HttpResponse.json(c) : error(404, "not_found", "Klan topilmadi.");
  }),
  http.get(`${base}/courses`, ({ request }) => HttpResponse.json(courses(signedIn(request)))),
  http.get(`${base}/courses/:slug`, ({ params, request }) => {
    const c = courseDetail(String(params.slug), signedIn(request));
    return c ? HttpResponse.json(c) : error(404, "not_found", "Kurs topilmadi.");
  }),
  http.get(`${base}/blogs`, () => HttpResponse.json(blogPosts(likedPosts))),
  http.get(`${base}/blogs/:slug`, ({ params }) => {
    const p = blogDetail(String(params.slug), likedPosts);
    return p ? HttpResponse.json(p) : error(404, "not_found", "Maqola topilmadi.");
  }),
  http.post(`${base}/blogs/:slug/like`, async ({ params }) => {
    await delay(250);
    likedPosts.add(String(params.slug));
    return HttpResponse.json({ ok: true });
  }),
  http.delete(`${base}/blogs/:slug/like`, async ({ params }) => {
    await delay(250);
    likedPosts.delete(String(params.slug));
    return HttpResponse.json({ ok: true });
  }),
  http.post(`${base}/blogs/:slug/comments`, async ({ request }) => {
    await delay(300);
    if (!signedIn(request)) return error(401, "not_authenticated", "Izoh yozish uchun tizimga kiring.");
    const { text } = (await request.json()) as { text: string };
    if (!text?.trim()) return error(400, "validation_error", "Izoh bo'sh.", { text: ["Izoh matnini yozing."] });
    return HttpResponse.json(
      { id: Date.now(), author: summary(findUser(ME_USERNAME)!), at: iso(Date.now()), text: text.trim(), likes: 0 },
      { status: 201 },
    );
  }),

  /* ---------- Stats, notifications, search ---------- */
  http.get(`${base}/stats/platform`, () =>
    HttpResponse.json({ users: 48_215, problems: PROBLEMS.length, submissionsToday: 12_934, contestsHeld: 312 }),
  ),
  http.get(`${base}/stats/regions`, () => HttpResponse.json(regionStats())),
  http.get(`${base}/stats/daily`, () => HttpResponse.json(dailySubmissions())),
  http.get(`${base}/stats/countries`, () =>
    HttpResponse.json(
      Object.entries(COUNTRIES)
        .map(([code, name]) => {
          const users = USERS.filter((u) => u.country === code);
          const scale = 48_215 / USERS.length;
          return { code, name, users: Math.round(users.length * scale), solved: Math.round(users.reduce((s, u) => s + u.solvedCount, 0) * scale) };
        })
        .sort((a, b) => b.users - a.users),
    ),
  ),
  http.get(`${base}/notifications`, ({ request }) => {
    if (!signedIn(request)) return error(401, "not_authenticated", "Tizimga kirilmagan.");
    const now = Date.now();
    return HttpResponse.json([
      { id: 4, at: iso(now - 12 * 60_000), text: "Codefire Round #148 davom etmoqda. Natijalar jadvali muzlatildi.", href: "/contests/148", read: false },
      { id: 3, at: iso(now - 3 * 3_600_000), text: "112B masalasiga yuborgan yechimingiz: Noto'g'ri javob, 7-test.", href: "/submissions", read: false },
      { id: 2, at: iso(now - 26 * 3_600_000), text: "nodira_a sizni «TATU Algo» klaniga taklif qildi.", href: "/clans/tatu-algo", read: true },
      { id: 1, at: iso(now - 4 * 86_400_000), text: "Reytingingiz +38 ga oshdi: 1642. Flame darajasi!", href: "/users/sardorbek", read: true },
    ]);
  }),
  http.get(`${base}/search`, async ({ request }) => {
    const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    if (!q) return HttpResponse.json({ problems: [], users: [], contests: [] });
    const exact = PROBLEMS.find((p) => p.id.toLowerCase() === q);
    const problems = [
      ...(exact ? [exact] : []),
      ...PROBLEMS.filter((p) => p !== exact && (p.id.toLowerCase().startsWith(q) || p.name.toLowerCase().includes(q))),
    ]
      .slice(0, 6)
      .map((p) => ({ id: p.id, name: p.name, difficulty: p.difficulty }));
    const users = USERS.filter((u) => u.username.includes(q) || u.displayName.toLowerCase().includes(q))
      .slice(0, 5)
      .map(summary);
    const cs = contests(false)
      .filter((c) => c.name.toLowerCase().includes(q) || String(c.id) === q)
      .slice(0, 4)
      .map(({ id, name, status, startsAt }) => ({ id, name, status, startsAt }));
    return HttpResponse.json({ problems, users, contests: cs });
  }),
];
