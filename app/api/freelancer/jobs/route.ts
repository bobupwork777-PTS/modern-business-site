import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Raw = Record<string, any>;
const BASE = "https://www.freelancer.com/api";
const fail = (error: string, status = 502) => NextResponse.json({ success: false, error }, { status });
const number = (v: unknown) => Number(v) || 0;
const iso = (v: unknown) => v ? new Date(number(v) * 1000).toISOString() : undefined;
const record = (v: unknown): Raw => v && typeof v === "object" && !Array.isArray(v) ? v as Raw : {};
const projectList = (v: unknown): Raw[] => Array.isArray(v) ? v : Object.values(record(v));
const userMap = (v: unknown): Record<string, Raw> => Array.isArray(v)
  ? Object.fromEntries(v.filter(u => u?.id != null).map(u => [String(u.id), u]))
  : record(v);
const ownerId = (p: Raw) => String(p.owner_id ?? p.owner?.id ?? p.user_id ??
  (typeof p.owner === "number" || typeof p.owner === "string" ? p.owner : ""));
const countryText = (v: unknown): string => typeof v === "string" ? v :
  record(v).name || record(v).country_name || record(v).code || "";
const countryOf = (u: Raw) => countryText(u.country) || countryText(u.location?.country);
type PublicClient = { country: string; city: string; memberSinceDateTime?: string };
const publicClientCache = new Map<string, { value: PublicClient | null; expires: number }>();
const decodeHtml = (s: string) => s.replace(/&(#\d+|#x[\da-f]+|amp|nbsp|quot|apos|lt|gt);/gi, (_, entity: string) => {
  const names: Record<string, string> = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">" };
  if (entity[0] === "#") return String.fromCodePoint(parseInt(entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1), entity[1]?.toLowerCase() === "x" ? 16 : 10));
  return names[entity.toLowerCase()] || " ";
});
function parsePublicClient(html: string): PublicClient | null {
  const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  const text = decodeHtml(clean.replace(/<[^>]+>/g, "\n"));
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const start = lines.findIndex(x => /^About the client$/i.test(x));
  if (start < 0) return null;
  const end = lines.findIndex((x, i) => i > start && /^(Client Verification|Other jobs from this client|Similar jobs)$/i.test(x));
  const section = lines.slice(start + 1, end > start ? end : start + 35);
  const location = section.find(x => /^[\p{L} .'-]{2,80},\s*[\p{L} .'-]{2,60}$/u.test(x));
  const parts = location?.split(",").map(x => x.trim()) || [];
  // Some client cards show a flag but omit the city/location text. Only
  // inspect markup after the client heading to avoid bidder flags above it.
  const clientMarkup = clean.match(/About the client([\s\S]*?)(?:Client Verification|Similar jobs|Other jobs from this client)/i)?.[1] || "";
  const flagCountry = decodeHtml(clientMarkup.match(/alt=["']Flag of ([^"']+)["']/i)?.[1] || "");
  const country = parts.at(-1) || flagCountry;
  if (!country) return null;
  const since = section.find(x => /^Member since\s+/i.test(x));
  const parsedDate = since ? new Date(`${since.replace(/^Member since\s+/i, "")} UTC`) : null;
  return { city: location ? parts[0] : "", country, ...(parsedDate && !isNaN(parsedDate.getTime()) ? { memberSinceDateTime: parsedDate.toISOString() } : {}) };
}
async function getPublicClient(project: Raw): Promise<PublicClient | null> {
  const id = String(project.id);
  const cached = publicClientCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.value;
  const slug = String(project.seo_url || "").replace(/^\/+/, "");
  const url = new URL(`/projects/${slug || id}`, "https://www.freelancer.com");
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/html" }, redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return null;
    const value = parsePublicClient(await response.text());
    publicClientCache.set(id, { value, expires: Date.now() + (value ? 15 : 2) * 60_000 });
    return value;
  } catch { return null; }
}

async function freelancerGet(path: string, params: URLSearchParams, token: string) {
  const response = await fetch(`${BASE}${path}?${params}`, {
    headers: { "freelancer-oauth-v1": token, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(20000)
  });
  const body = await response.json();
  if (!response.ok || body.status === "error") {
    throw new Error(body?.message || `Freelancer API returned ${response.status}`);
  }
  return body.result || {};
}

export async function GET(req: NextRequest) {
  const token = process.env.FREELANCER_ACCESS_TOKEN;
  if (!token) return fail("Set FREELANCER_ACCESS_TOKEN in .env.local", 500);
  const input = req.nextUrl.searchParams;
  const limit = Math.min(50, Math.max(1, number(input.get("first")) || 50));
  const offset = Math.max(0, number(input.get("after")));
  const selectedSkills = (input.get("skills") || "").split(",").map(x => x.trim()).filter(Boolean);
  const query = (input.get("q")?.trim() || selectedSkills[0] || "").slice(0, 200);

  const detailFlags = {
    full_description: "true", job_details: "true", upgrades: "true",
    location_details: "true", user_details: "true", user_basic_details: "true",
    user_country_details: "true", user_location_details: "true",
    user_status_details: "true", user_reputation_details: "true",
    user_employer_reputation_details: "true", user_display_info_details: "true"
  };

  try {
    const searchParams = new URLSearchParams({
      limit: String(limit), offset: String(offset), sort_field: "time_updated", ...detailFlags
    });
    if (query) searchParams.set("query", query);
    const search = await freelancerGet("/projects/0.1/projects/active/", searchParams, token);
    const listed = projectList(search.projects);
    let users = userMap(search.users);
    let projects = listed;
    let detailError: string | null = null;

    // The active-project listing is often a short projection. Fetch all IDs in
    // one request to obtain the expanded project and employer projections.
    if (listed.length) {
      const detailParams = new URLSearchParams(detailFlags);
      listed.forEach(p => detailParams.append("projects[]", String(p.id)));
      try {
        const details = await freelancerGet("/projects/0.1/projects/", detailParams, token);
        const byId = new Map(projectList(details.projects).map(p => [String(p.id), p]));
        projects = listed.map(p => ({ ...p, ...(byId.get(String(p.id)) || {}) }));
        users = { ...users, ...userMap(details.users) };
      } catch (error) {
        detailError = error instanceof Error ? error.message : String(error);
      }
    }

    const missingIds = [...new Set(projects.map(ownerId).filter(id => id && !users[id]))];
    if (missingIds.length) {
      const userParams = new URLSearchParams({
        basic_details: "true", country_details: "true", location_details: "true",
        status_details: "true", reputation_details: "true",
        employer_reputation_details: "true", display_info_details: "true"
      });
      missingIds.forEach(id => userParams.append("users[]", id));
      try {
        const details = await freelancerGet("/users/0.1/users/", userParams, token);
        users = { ...users, ...userMap(details.users) };
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.warn("Employer detail lookup:", error);
      }
    }

    const publicClients = new Map<string, PublicClient>();
    const needsPublicClient = projects.filter(p => !countryOf({ ...record(p.owner), ...record(users[ownerId(p)]) }));
    for (let i = 0; i < needsPublicClient.length; i += 8) {
      await Promise.all(needsPublicClient.slice(i, i + 8).map(async p => {
        const client = await getPublicClient(p);
        if (client) publicClients.set(String(p.id), client);
      }));
    }

    const aliases: Record<string, string> = {
      aus: "australia", can: "canada", deu: "germany", fra: "france",
      nz: "new zealand", nzl: "new zealand", sgp: "singapore",
      uae: "united arab emirates", uk: "united kingdom", usa: "united states",
      zaf: "south africa"
    };
    const countries = (input.get("countries") || "").split(",")
      .map(x => x.trim().toLowerCase()).filter(Boolean).map(x => aliases[x] || x);
    const skills = selectedSkills.map(x => x.toLowerCase());
    const min = input.get("budgetMin") ? number(input.get("budgetMin")) : null;
    const max = input.get("budgetMax") ? number(input.get("budgetMax")) : null;
    const [bidMin, bidMax] = (input.get("applicants") || "").split("-").map(Number);
    const days = number(input.get("postedDays"));
    const verification = input.get("paymentVerified");

    const jobs = projects.map(p => {
      const id = ownerId(p);
      const user = { ...record(p.owner), ...record(users[id]) };
      const publicClient = publicClients.get(String(p.id));
      const hasClient = Object.keys(user).length > 0 || Boolean(publicClient);
      const country = countryOf(user) || publicClient?.country || "";
      const projectCountry = countryText(p.location?.country) || countryText(p.country);
      const verified = user.payment_verified ?? user.status?.payment_verified;
      const currency = p.currency?.code || "";
      const minimum = p.budget?.minimum;
      const maximum = p.budget?.maximum;
      const budget = minimum == null && maximum == null ? "" :
        `${currency} ${minimum ?? maximum}${maximum != null && maximum !== minimum ? ` – ${maximum}` : ""}`;
      const hourly = String(p.type || "").toLowerCase().includes("hourly");
      return {
        id: String(p.id), title: p.title || "Untitled project",
        description: p.description || p.preview_description || "",
        url: p.seo_url ? `https://www.freelancer.com/projects/${String(p.seo_url).replace(/^\//, "")}` :
          `https://www.freelancer.com/projects/${p.id}`,
        createdDateTime: iso(p.time_submitted),
        publishedDateTime: iso(p.time_submitted || p.time_updated),
        totalApplicants: number(p.bid_stats?.bid_count),
        isFeatured: Boolean(p.featured), premium: Boolean(p.featured),
        ...(hourly ? {
          hourlyBudgetMin: { displayValue: minimum == null ? "" : `${currency} ${minimum}` },
          hourlyBudgetMax: { displayValue: maximum == null ? "" : `${currency} ${maximum}` }
        } : { amount: { displayValue: budget, currency } }),
        client: hasClient ? {
          ...user,
          companyRid: id,
          name: user.display_name || user.public_name || user.username || "",
          location: { ...record(user.location), city: user.location?.city || publicClient?.city || "", country },
          memberSinceDateTime: user.registration_date ? iso(user.registration_date) : publicClient?.memberSinceDateTime,
          detailSource: Object.keys(user).length ? "api" : "public_project_page",
          verificationStatus: verified == null ? "" : verified ? "verified" : "unverified",
          totalPostedJobs: user.employer_reputation?.project_stats?.all?.count,
          totalFeedback: user.employer_reputation?.overall
        } : null,
        projectLocation: p.location || null,
        projectCountry,
        activity: { lastClientActivity: iso(p.time_updated) },
        freelancerSkills: Array.isArray(p.jobs) ? p.jobs.map((j: Raw) => j.name).filter(Boolean) : [],
        rawProject: p,
        rawClient: hasClient ? user : null
      };
    }).filter((j, index) => {
      const p = projects[index];
      const terms = `${j.title} ${j.description} ${j.freelancerSkills.join(" ")}`.toLowerCase();
      return (!countries.length || countries.includes(j.client?.location.country.toLowerCase() || ""))
        && (!skills.length || skills.some(x => terms.includes(x)))
        && (min === null || number(p.budget?.maximum) >= min)
        && (max === null || number(p.budget?.minimum) <= max)
        && (!input.get("applicants") || j.totalApplicants >= bidMin && j.totalApplicants <= bidMax)
        && (!days || number(p.time_submitted) >= Date.now() / 1000 - days * 86400)
        && (!verification || j.client?.verificationStatus === verification);
    });

    const total = number(search.total_count) || offset + listed.length;
    return NextResponse.json({
      success: true, jobs, total,
      pageInfo: {
        endCursor: String(offset + listed.length),
        hasNextPage: search.total_count != null ? offset + listed.length < total : listed.length === limit
      },
      diagnostics: {
        searched: listed.length,
        returned: jobs.length,
        missingOwner: projects.filter(p => !ownerId(p)).length,
        missingCountry: projects.filter(p => !countryOf(users[ownerId(p)] || record(p.owner))).length,
        missingProjectCountry: projects.filter(p => !countryText(p.location?.country) && !countryText(p.country)).length,
        publicPageCountries: publicClients.size,
        detailError
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("Freelancer search:", error);
    return fail(error instanceof Error ? error.message : "Freelancer search failed");
  }
}
