import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Raw = Record<string, any>;
const BASE = "https://www.freelancer.com/api";
const fail = (error: string, status = 502) => NextResponse.json({ success: false, error }, { status });
const number = (v: unknown) => Number(v) || 0;
const iso = (v: unknown): string | undefined => {
  if (v == null || v === "") return undefined;
  const numeric = Number(v);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(String(v));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
const optionalNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if ((typeof value !== "number" && typeof value !== "string") || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};
const enabled = (value: unknown) => value === true || value === 1 ||
  (typeof value === "string" && ["true", "1"].includes(value.trim().toLowerCase()));
const record = (v: unknown): Raw => v && typeof v === "object" && !Array.isArray(v) ? v as Raw : {};
const projectList = (v: unknown): Raw[] => Array.isArray(v) ? v : Object.values(record(v));
const userMap = (v: unknown): Record<string, Raw> => Array.isArray(v) ? Object.fromEntries(v.filter(u => u?.id != null).map(u => [String(u.id), u])) : record(v);
const ownerId = (p: Raw) => String(p.owner_id ?? p.owner_id_new ?? p.owner?.id ?? p.owner_info?.id ?? p.user_id ?? (typeof p.owner === "string" || typeof p.owner === "number" ? p.owner : ""));
const projectOwner = (p: Raw, users: Record<string, Raw>): Raw => ({
  ...record(p.owner_info), ...record(p.owner), ...record(users[ownerId(p)])
});
const employerStats = (u: Raw) => {
  const reputation = record(u.employer_reputation);
  const history = record(reputation.entire_history);
  return {
    rating: optionalNumber(history.overall, reputation.overall),
    reviews: optionalNumber(history.reviews, history.review_count, reputation.reviews, reputation.review_count)
  };
};
const countryText = (v: unknown): string => typeof v === "string" ? v : record(v).name || record(v).country_name || record(v).code || "";
const countryOf = (u: Raw) => countryText(u.country) || countryText(u.location?.country);
type PublicClient = { country: string; city: string; memberSinceDateTime?: string; feedbackRating?: number; reviewCount?: number; paymentVerified?: true };
type LocalClient = Partial<PublicClient> & { invitesSent?: number; completedProjects?: number; contactedFreelancers?: string };
const publicClientCache = new Map<string, { value: PublicClient | null; expires: number }>();
const decodeHtml = (s: string) => s.replace(/&(#\d+|#x[\da-f]+|amp|nbsp|quot|apos|lt|gt);/gi, (_, e: string) => {
  const n: Record<string, string> = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">" };
  if (e[0] === "#") {
    const hex = e[1]?.toLowerCase() === "x";
    const code = parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code) : " ";
  }
  return n[e.toLowerCase()] || " ";
});
function parsePublicClient(html: string): PublicClient | null {
  const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const lines = decodeHtml(clean.replace(/<[^>]+>/g, "\n")).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const start = lines.findIndex(x => /^About the client$/i.test(x));
  if (start < 0) return null;
  const end = lines.findIndex((x, i) => i > start && /^(Client Verification|Other jobs from this client|Similar jobs)$/i.test(x));
  const section = lines.slice(start + 1, end > start ? end : start + 35);
  const location = section.find(x => /^[\p{L} .'-]{2,80},\s*[\p{L} .'-]{2,60}$/u.test(x));
  const parts = location?.split(",").map(x => x.trim()) || [];
  const clientMarkup = clean.match(/About the client([\s\S]*?)(?:Client Verification|Similar jobs|Other jobs from this client)/i)?.[1] || "";
  const country = parts.at(-1) || decodeHtml(clientMarkup.match(/alt=["']Flag of ([^"']+)["']/i)?.[1] || "");
  if (!country) return null;
  const since = section.find(x => /^Member since\s+/i.test(x));
  const parsedDate = since ? new Date(`${since.replace(/^Member since\s+/i, "")} UTC`) : null;
  const locIdx = section.indexOf(location || "");
  const [ratingText, reviewsText] = [locIdx >= 0 ? section[locIdx + 1] : undefined, locIdx >= 0 ? section[locIdx + 2] : undefined];
  const hasRating = ratingText != null && /^(?:[0-4](?:\.\d+)?|5(?:\.0+)?)$/.test(ratingText);
  const hasReviews = hasRating && reviewsText != null && /^\d+$/.test(reviewsText);
  return {
    city: location ? parts[0] : "", country,
    ...(parsedDate && !isNaN(parsedDate.getTime()) ? { memberSinceDateTime: parsedDate.toISOString() } : {}),
    ...(hasRating ? { feedbackRating: Number(ratingText) } : {}),
    ...(hasReviews ? { reviewCount: Number(reviewsText) } : {}),
    ...(section.some(x => /^Payment method verified$/i.test(x)) ? { paymentVerified: true as const } : {})
  };
}
async function getPublicClient(project: Raw, signal: AbortSignal): Promise<PublicClient | null> {
  const id = String(project.id);
  const cached = publicClientCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.value;
  const slug = String(project.seo_url || "").replace(/^\/+/, "");
  try {
    const res = await fetch(new URL(`/projects/${slug || id}`, "https://www.freelancer.com"), {
      headers: { Accept: "text/html" }, redirect: "error", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(4000)])
    });
    if (!res.ok) return null;
    const value = parsePublicClient(await res.text());
    if (publicClientCache.size >= 1000) publicClientCache.delete(publicClientCache.keys().next().value!);
    publicClientCache.set(id, { value, expires: Date.now() + (value ? 15 : 2) * 60_000 });
    return value;
  } catch { return null; }
}
async function freelancerGet(
  path: string,
  params: URLSearchParams,
  token: string,
  signal: AbortSignal
) {
  const res = await fetch(`${BASE}${path}?${params.toString()}`, {
    headers: {
      "freelancer-oauth-v1": token,
      Accept: "application/json"
    },
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)])
  });
  const body = await res.json();
  if (!res.ok || body.status === "error") {
    throw new Error(
      body?.message || `Freelancer API returned ${res.status}`
    );
  }
  return body.result || {};
}
// Scope the connected account cache to the token; never share account IDs
// across credentials. Store only a hash as the cache key.
const accountCache = new Map<string, { id: string; expires: number }>();
async function getAccountId(token: string, signal: AbortSignal): Promise<string | null> {
  const key = createHash("sha256").update(token).digest("hex");
  const cached = accountCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.id;
  const account = await freelancerGet("/users/0.1/self/", new URLSearchParams(), token, signal);
  if (account.id == null) return null;
  const id = String(account.id);
  if (accountCache.size >= 20) accountCache.delete(accountCache.keys().next().value!);
  accountCache.set(key, { id, expires: Date.now() + 10 * 60_000 });
  return id;
}
export async function GET(req: NextRequest) {
  const token = process.env.FREELANCER_ACCESS_TOKEN || "";
  if (!token) return fail("Set FREELANCER_ACCESS_TOKEN in .env.local", 500);
  const input = req.nextUrl.searchParams;
  const enrich = input.get("mode") === "enrich";
  const projectIds = [...new Set((input.get("ids") || "").split(",").filter(id => /^\d+$/.test(id)))].slice(0, 8);
  if (enrich && !projectIds.length) return fail("Project IDs required", 400);
  const requestSignal = AbortSignal.any([req.signal, AbortSignal.timeout(22000)]);
  const limit = Math.min(50, Math.max(1, Math.floor(number(input.get("first")) || 50)));
  const startOffset = Math.max(0, Math.floor(number(input.get("after"))));
  const selectedSkills = (input.get("skills") || "").split(",").map(x => x.trim()).filter(Boolean);
  const query = (input.get("q")?.trim() || selectedSkills[0] || "").slice(0, 200);
  const detailFlags = {
    full_description: "true", job_details: "true", upgrades: "true", location_details: "true",
    user_details: "true", user_basic_details: "true", user_country_details: "true",
    user_location_details: "true", user_status_details: "true", user_reputation_details: "true",
    user_employer_reputation_details: "true", user_display_info_details: "true"
  };
  async function getApplicationStatus(projects: Raw[]): Promise<Map<string, boolean | null>> {
    const statuses = new Map<string, boolean | null>(projects.map(p => [String(p.id), null]));
    if (!enrich || !projects.length) return statuses;
    // Retrieve ONLY the connected account's bids, not every competitor's bids.
    // Unknown stays null on API errors or incomplete pagination.
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(10000)]);
    try {
      const accountId = await getAccountId(token, signal);
      if (!accountId) return statuses;
      const found = new Set<string>();
      const seen = new Set<string>();
      let offset = 0;
      let complete = false;
      for (let page = 0; page < 3; page++) {
        const params = new URLSearchParams({ limit: "50", offset: String(offset) });
        params.append("bidders[]", accountId);
        projects.forEach(p => params.append("projects[]", String(p.id)));
        const result = await freelancerGet("/projects/0.1/bids/", params, token, signal);
        if (result.bids == null || typeof result.bids !== "object") break;
        const bids = projectList(result.bids);
        // If the upstream ignores the bidder filter, never mark unconfirmed jobs false.
        if (bids.some(b => String(b.bidder_id) !== accountId || b.id == null || b.project_id == null)) break;
        let newCount = 0;
        for (const bid of bids) {
          found.add(String(bid.project_id));
          if (!seen.has(String(bid.id))) { seen.add(String(bid.id)); newCount++; }
        }
        found.forEach(id => { if (statuses.has(id)) statuses.set(id, true); });
        if (bids.length < 50) { complete = true; break; }
        if (!newCount) break;
        offset += bids.length;
      }
      if (complete) projects.forEach(p => {
        const restricted = enabled(p.sealed) || enabled(p.upgrades?.sealed) ||
          enabled(p.nonpublic) || enabled(p.upgrades?.nonpublic) || enabled(p.private) || enabled(p.upgrades?.private);
        if (!found.has(String(p.id)) && !restricted) statuses.set(String(p.id), false);
      });
    } catch { /* Keep confirmed positives and unknown values. */ }
    return statuses;
  }
  async function fetchBatch(offset: number) {
    const searchParams = new URLSearchParams({ limit: String(limit), offset: String(offset), sort_field: "time_updated", ...detailFlags });
    if (query) searchParams.set("query", query);
    let search: Raw;
    if (enrich) {
      const detailParams = new URLSearchParams(detailFlags);
      projectIds.forEach(id => detailParams.append("projects[]", id));
      search = await freelancerGet("/projects/0.1/projects/", detailParams, token, requestSignal);
    } else {
      search = await freelancerGet("/projects/0.1/projects/active/", searchParams, token, requestSignal);
    }
    const listed = projectList(search.projects);
    let users = userMap(search.users);
    const projects = listed;
    const applicationStatusPromise = getApplicationStatus(projects);
    const missingIds = [...new Set(projects.map(ownerId).filter(id => id &&
      (!users[id]?.registration_date || employerStats(users[id] || {}).rating == null || employerStats(users[id] || {}).reviews == null)))];
    if (enrich && missingIds.length) {
      const userParams = new URLSearchParams({ basic_details: "true", country_details: "true", location_details: "true", status_details: "true", reputation_details: "true", employer_reputation_details: "true", display_info_details: "true" });
      missingIds.forEach(id => userParams.append("users[]", id));
      try {
        const details = await freelancerGet("/users/0.1/users/", userParams, token, requestSignal);
        Object.entries(userMap(details.users)).forEach(([id, value]) => {
          users[id] = { ...users[id], ...value };
        });
      } catch { /* Keep the details already available. */ }
    }
    const publicClients = new Map<string, PublicClient>();
    const needsPublic = enrich ? projects.filter(p => {
      const user = projectOwner(p, users);
      const stats = employerStats(user);
      return !countryOf(user) || !iso(user.registration_date) || stats.rating == null || stats.reviews == null;
    }) : [];
    for (let i = 0; i < needsPublic.length; i += 8) {
      await Promise.all(needsPublic.slice(i, i + 8).map(async p => {
        const c = await getPublicClient(p, requestSignal);
        if (c) publicClients.set(String(p.id), c);
      }));
    }
    const localClients = new Map<string, LocalClient>();
    if (enrich && process.env.NODE_ENV === "development" && process.env.FREELANCER_LOCAL_ENRICH === "true" && projects.length) {
      const urls = projects.map(p => p.seo_url ? `https://www.freelancer.com/projects/${String(p.seo_url).replace(/^\/+/, "")}` : `https://www.freelancer.com/projects/${p.id}`);
      try {
        const res = await fetch("http://127.0.0.1:43187/enrich", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }), cache: "no-store", signal: AbortSignal.any([requestSignal, AbortSignal.timeout(8000)])
        });
        if (res.ok) (await res.json()).results?.forEach((r: any) => r.client && localClients.set(r.url, r.client));
      } catch { }
    }
    const aliases: Record<string, string> = { aus: "australia", can: "canada", deu: "germany", fra: "france", nz: "new zealand", nzl: "new zealand", sgp: "singapore", uae: "united arab emirates", uk: "united kingdom", usa: "united states", zaf: "south africa" };
    const countries = (input.get("countries") || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean).map(x => aliases[x] || x);
    const skills = selectedSkills.map(x => x.toLowerCase());
    const min = input.get("budgetMin") ? number(input.get("budgetMin")) : null;
    const max = input.get("budgetMax") ? number(input.get("budgetMax")) : null;
    const [bidMin, bidMax] = (input.get("applicants") || "").split("-").map(Number);
    const days = number(input.get("postedDays"));
    const verificationValue = input.get("paymentVerified");
    const verification = verificationValue === "verified" || verificationValue === "unverified" ? verificationValue : null;
    const applicationStatuses = await applicationStatusPromise;
    const jobs = projects.map(p => {
      const id = ownerId(p);
      const user = projectOwner(p, users);
      const publicClient = publicClients.get(String(p.id));
      const projectUrl = p.seo_url ? `https://www.freelancer.com/projects/${String(p.seo_url).replace(/^\/+/, "")}` : `https://www.freelancer.com/projects/${p.id}`;
      const localClient = localClients.get(projectUrl);
      const hasClient = Object.keys(user).length > 0 || Boolean(publicClient) || Boolean(localClient);
      const country = countryOf(user) || localClient?.country || publicClient?.country || "";
      const projectCountry = countryText(p.location?.country) || countryText(p.country);
      const verified = user.payment_verified ?? user.status?.payment_verified;
      const currency = p.currency?.code || "";
      const minimum = p.budget?.minimum, maximum = p.budget?.maximum;
      const budget = minimum == null && maximum == null ? "" : `${currency} ${minimum ?? maximum}${maximum != null && maximum !== minimum ? ` – ${maximum}` : ""}`;
      const hourly = String(p.type || "").toLowerCase().includes("hourly");
      const upgrades = { ...record(p.upgrades) };
      for (const key of ["featured", "assisted", "recruiter", "NDA", "nda", "sealed", "urgent", "nonpublic", "private", "fulltime", "ip_contract", "ip_agreement", "non_compete", "qualified", "pf_only", "enterprise", "highlighted", "premium", "success_bundle", "project_management", "unpaid_recruiter", "listed", "extend"]) {
        if (enabled(p[key])) upgrades[key] = p[key];
      }
      const reputation = record(user.employer_reputation);
      const history = record(reputation.entire_history);
      const rating = optionalNumber(history.overall, reputation.overall, localClient?.feedbackRating, publicClient?.feedbackRating);
      const reviews = optionalNumber(history.reviews, history.review_count, reputation.reviews, reputation.review_count, localClient?.reviewCount, publicClient?.reviewCount);
      const bids = optionalNumber(p.bid_stats?.bid_count);
      const averageBid = optionalNumber(p.bid_stats?.bid_avg);
      const rawStatus = String(p.frontend_project_status || p.status || "").trim();
      const projectStatus = rawStatus.toLowerCase() === "active" ? "Open" :
        rawStatus ? rawStatus.replace(/[_-]+/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "";
      return {
        id: String(p.id), applied: applicationStatuses.get(String(p.id)) ?? null, title: p.title || "Untitled project", description: p.description || p.preview_description || "",
        url: projectUrl, createdDateTime: iso(p.time_submitted), publishedDateTime: iso(p.time_submitted || p.time_updated),
        totalApplicants: bids, bidCount: bids, averageBid,
        averageBidDisplay: averageBid == null ? "" : `${currency} ${averageBid.toLocaleString("en-US", { maximumFractionDigits: 2 })}${hourly ? "/hr" : ""}`.trim(),
        currency, projectStatus, upgrades, isFeatured: enabled(upgrades.featured), premium: enabled(upgrades.premium),
        ...(hourly ? { hourlyBudgetMin: { displayValue: minimum == null ? "" : `${currency} ${minimum}` }, hourlyBudgetMax: { displayValue: maximum == null ? "" : `${currency} ${maximum}` } } : { amount: { displayValue: budget, currency } }),
        client: hasClient ? {
          companyRid: id, name: user.display_name || user.public_name || user.username || "",
          location: { city: user.location?.city || localClient?.city || publicClient?.city || "", country },
          memberSinceDateTime: iso(user.registration_date) || localClient?.memberSinceDateTime || publicClient?.memberSinceDateTime,
          detailSource: Object.keys(user).length ? "api" : localClient ? "local_signed_in_page" : "public_project_page",
          verificationStatus: localClient?.paymentVerified || publicClient?.paymentVerified || verified === true ? "verified" : verified === false ? "unverified" : "",
          totalPostedJobs: user.employer_reputation?.project_stats?.all?.count,
          totalFeedback: rating,
          totalReviews: reviews
        } : null,
        projectLocation: p.location || null, projectCountry,
        activity: { lastClientActivity: iso(p.time_updated), invitesSent: localClient?.invitesSent, completedProjects: localClient?.completedProjects, contactedFreelancers: localClient?.contactedFreelancers },
        freelancerSkills: Array.isArray(p.jobs) ? p.jobs.map((j: Raw) => j.name).filter(Boolean) : [],
      };
    }).filter((j, index) => {
      if (enrich) return true;
      const p = projects[index];
      const terms = `${j.title} ${j.description} ${j.freelancerSkills.join(" ")}`.toLowerCase();
      return (!countries.length || countries.includes(aliases[(j.client?.location?.country || "").toLowerCase()] || (j.client?.location?.country || "").toLowerCase())) &&
        (!skills.length || skills.some(x => terms.includes(x))) &&
        (min === null || number(p.budget?.maximum) >= min) &&
        (max === null || number(p.budget?.minimum) <= max) &&
        (!input.get("applicants") || (j.totalApplicants ?? 0) >= bidMin && (j.totalApplicants ?? 0) <= bidMax) &&
        (!days || number(p.time_submitted) >= Date.now() / 1000 - days * 86400) &&
        (!verification || j.client?.verificationStatus === verification);
    });
    return { jobs, listed, rawTotal: search.total_count == null ? null : number(search.total_count) };
  }
  try {
    // Exactly one upstream page per request. The browser displays it immediately
    // and follows RAW offsets even when local filtering produces an empty page.
    const batch = await fetchBatch(startOffset);
    const nextOffset = startOffset + batch.listed.length;
    const hasNextPage = !enrich && batch.listed.length > 0 &&
      (batch.rawTotal !== null ? nextOffset < batch.rawTotal : batch.listed.length === limit);
    return NextResponse.json({
      success: true, jobs: batch.jobs,
      total: batch.rawTotal,
      rawIds: batch.listed.map(p => String(p.id)),
      pageInfo: { endCursor: hasNextPage ? String(nextOffset) : null, hasNextPage }
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Freelancer search failed");
  }
}
