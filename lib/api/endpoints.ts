import { ApiError, request } from "./client";
import type { ProblemQuery, SubmissionQuery, UserQuery } from "./types";

/** Server-only extras for SSR calls: forwarded cookie and ISR window. */
type Ctx = { cookie?: string; revalidate?: number | false; signal?: AbortSignal };


export const api = {
  auth: {
    /** The signed-in user, or null when signed out (the API answers 401). */
    me: (ctx: Ctx = {}) =>
      request("/auth/me", { schema: (s) => s.meSchema, ...ctx }).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }),
    login: (body: { login: string; password: string }) =>
      request("/auth/login", { method: "POST", body, schema: (s) => s.meSchema }),
    register: (body: { fullName: string; phone: string; username: string; password: string }) =>
      request("/auth/register", { method: "POST", body, schema: (s) => s.meSchema }),
    requestPasswordReset: (login: string) =>
      request("/auth/password-reset", { method: "POST", body: { login }, schema: (s) => s.okSchema }),
    logout: () => request("/auth/logout", { method: "POST", schema: (s) => s.okSchema }),
  },

  problems: {
    list: (q: ProblemQuery = {}, ctx: Ctx = {}) =>
      request("/problems", {
        query: { ...q, tags: q.tags },
        schema: (s) => s.paginated(s.problemSummarySchema),
        ...ctx,
      }),
    get: (id: string, ctx: Ctx = {}) => request(`/problems/${encodeURIComponent(id)}`, { schema: (s) => s.problemSchema, ...ctx }),
    tags: (ctx: Ctx = {}) => request("/problems/tags", { schema: (s) => s.z.array(s.z.string()), ...ctx }),
    statuses: (ctx: Ctx = {}) =>
      request("/problems/statuses", { schema: (s) => s.statusMapSchema, ...ctx }),
    run: (id: string, body: { language: string; code: string }) =>
      request(`/problems/${encodeURIComponent(id)}/run`, { method: "POST", body, schema: (s) => s.runResultSchema }),
  },

  languages: (ctx: Ctx = {}) => request("/languages", { schema: (s) => s.z.array(s.languageSchema), ...ctx }),

  submissions: {
    list: (q: SubmissionQuery = {}, ctx: Ctx = {}) =>
      request("/submissions", { query: { ...q }, schema: (s) => s.paginated(s.submissionSchema), ...ctx }),
    get: (id: number, ctx: Ctx = {}) => request(`/submissions/${id}`, { schema: (s) => s.submissionDetailSchema, ...ctx }),
    create: (body: { problem: string; language: string; code: string; contest?: number }) =>
      request("/submissions", { method: "POST", body, schema: (s) => s.submissionSchema }),
  },

  contests: {
    list: (q: { status?: string; kind?: "contest" | "training" } = {}, ctx: Ctx = {}) =>
      request("/contests", { query: q, schema: (s) => s.z.array(s.contestSchema), ...ctx }),
    get: (id: number, ctx: Ctx = {}) => request(`/contests/${id}`, { schema: (s) => s.contestDetailSchema, ...ctx }),
    register: (id: number) => request(`/contests/${id}/register`, { method: "POST", schema: (s) => s.okSchema }),
    unregister: (id: number) => request(`/contests/${id}/register`, { method: "DELETE", schema: (s) => s.okSchema }),
    standings: (id: number, ctx: Ctx = {}) =>
      request(`/contests/${id}/standings`, { schema: (s) => s.standingsSchema, ...ctx }),
  },

  users: {
    list: (q: UserQuery = {}, ctx: Ctx = {}) =>
      request("/users", { query: { ...q }, schema: (s) => s.paginated(s.userListItemSchema), ...ctx }),
    get: (username: string, ctx: Ctx = {}) => request(`/users/${username}`, { schema: (s) => s.userSchema, ...ctx }),
    ratingHistory: (username: string, ctx: Ctx = {}) =>
      request(`/users/${username}/rating-history`, { schema: (s) => s.z.array(s.ratingPointSchema), ...ctx }),
    activity: (username: string, ctx: Ctx = {}) =>
      request(`/users/${username}/activity`, { schema: (s) => s.z.array(s.activityDaySchema), ...ctx }),
    follow: (username: string, follow: boolean) =>
      request(`/users/${username}/follow`, { method: follow ? "POST" : "DELETE", schema: (s) => s.okSchema }),
    filters: (ctx: Ctx = {}) =>
      request("/users/filters", {
        schema: (s) => s.userFiltersSchema,
        ...ctx,
      }),
  },

  clans: {
    join: (slug: string) => request(`/clans/${slug}/join`, { method: "POST", schema: (s) => s.okSchema }),
    list: (ctx: Ctx = {}) => request("/clans", { schema: (s) => s.z.array(s.clanSchema), ...ctx }),
    get: (slug: string, ctx: Ctx = {}) => request(`/clans/${slug}`, { schema: (s) => s.clanDetailSchema, ...ctx }),
  },

  courses: {
    list: (ctx: Ctx = {}) => request("/courses", { schema: (s) => s.z.array(s.courseSchema), ...ctx }),
    get: (slug: string, ctx: Ctx = {}) => request(`/courses/${slug}`, { schema: (s) => s.courseDetailSchema, ...ctx }),
  },

  blogs: {
    list: (ctx: Ctx = {}) => request("/blogs", { schema: (s) => s.z.array(s.blogPostSchema), ...ctx }),
    get: (slug: string, ctx: Ctx = {}) => request(`/blogs/${slug}`, { schema: (s) => s.blogPostDetailSchema, ...ctx }),
    like: (slug: string, liked: boolean) =>
      request(`/blogs/${slug}/like`, { method: liked ? "POST" : "DELETE", schema: (s) => s.okSchema }),
    comment: (slug: string, text: string) =>
      request(`/blogs/${slug}/comments`, { method: "POST", body: { text }, schema: (s) => s.commentSchema }),
  },

  stats: {
    platform: (ctx: Ctx = {}) => request("/stats/platform", { schema: (s) => s.platformStatsSchema, ...ctx }),
    countries: (ctx: Ctx = {}) => request("/stats/countries", { schema: (s) => s.z.array(s.countryStatSchema), ...ctx }),
    regions: (ctx: Ctx = {}) => request("/stats/regions", { schema: (s) => s.z.array(s.regionStatSchema), ...ctx }),
    daily: (ctx: Ctx = {}) => request("/stats/daily", { schema: (s) => s.z.array(s.dailyStatSchema), ...ctx }),
  },

  notifications: (ctx: Ctx = {}) => request("/notifications", { schema: (s) => s.z.array(s.notificationSchema), ...ctx }),
  search: (q: string, signal?: AbortSignal) => request("/search", { query: { q }, schema: (s) => s.searchResultSchema, signal }),
};
