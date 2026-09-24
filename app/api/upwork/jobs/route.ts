import { NextRequest, NextResponse } from "next/server";
import { upworkGraphQL, isUpworkReauthError } from "@/lib/upwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const CACHE_TTL = 60 * 1000;

const QUERY = `
query SearchJobs(
  $filter: MarketplaceJobPostingsSearchFilter
  $type: MarketplaceJobPostingSearchType
  $sort: [MarketplaceJobPostingSearchSortAttribute]
){
  marketplaceJobPostingsSearch(
    marketPlaceJobFilter:$filter
    searchType:$type
    sortAttributes:$sort
  ){
    totalCount
    edges{
      cursor
      node{
        id
        title
        description
        ciphertext
        applied
        premium
        publishedDateTime
        totalApplicants

        freelancerClientRelation{
          companyRid
          companyName
          lastContractPlatform
          lastContractRid
          lastContractTitle
        }

        amount{
          rawValue
          displayValue
          currency
        }

        hourlyBudgetMin{
          rawValue
          displayValue
          currency
        }

        hourlyBudgetMax{
          rawValue
          displayValue
          currency
        }

        client{
          totalFeedback
          totalReviews
          totalHires
          totalPostedJobs
          verificationStatus
          memberSinceDateTime

          totalSpent{
            displayValue
            currency
          }

          location{
            country
            city
            timezone
          }
        }

        job{
          activityStat{
            jobActivity{
              lastClientActivity
              invitesSent
              totalInvitedToInterview
              totalHired
              totalUnansweredInvites
            }
          }
        }
      }
    }

    pageInfo{
      endCursor
      hasNextPage
    }
  }
}
`;

type PageInfo = {
  endCursor?: string | null;
  hasNextPage?: boolean;
};

type GraphQLResult = {
  totalCount?: number;
  edges?: any[];
  pageInfo?: PageInfo;
};

type SearchOptions = {
  countries: string[];
  budgetMin?: number;
  budgetMax?: number;
  paymentVerified: "all" | "verified" | "unverified";
  applicantMin?: number;
  applicantMax?: number;
  postedDays?: number;
  previousClient: boolean;
};

type CacheEntry = {
  expiresAt: number;
  edges: any[];
  upstreamTotal: number;
};

const globalCache = globalThis as typeof globalThis & {
  __upworkAllJobsCache?: Map<string, CacheEntry>;
};

const allJobsCache =
  globalCache.__upworkAllJobsCache ||
  new Map<string, CacheEntry>();

globalCache.__upworkAllJobsCache = allJobsCache;


/* =========================
   HELPERS
========================= */

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isTransformTimeout(error: unknown) {
  return getErrorMessage(error)
    .toLowerCase()
    .includes("transform timeout");
}

async function callUpworkGraphQL(query: string, variables: Record<string, any>) {
  const body: any =
    await upworkGraphQL(
      query,
      variables
    );

  if (Array.isArray(body?.errors) && body.errors.length) {
    const message =
      body.errors
        .map((x: any) => x?.message)
        .filter(Boolean)
        .join(" | ") ||
      "Upwork GraphQL error";

    throw new Error(message);
  }

  return body;
}

function isVerifiedStatus(status?: string) {
  if (!status) return false;

  const value = status.toLowerCase();

  if (value.includes("unverified"))
    return false;

  return (
    value.includes("verified") ||
    value.includes("true")
  );
}

function moneyToNumber(money: any):
  number | undefined {
  if (!money) return undefined;

  const raw = Number(money.rawValue);

  if (Number.isFinite(raw))
    return raw;

  const match =
    String(money.displayValue ?? "")
      .replace(/,/g, "")
      .match(/-?\d+(?:\.\d+)?/);

  if (!match) return undefined;

  const value = Number(match[0]);

  return Number.isFinite(value)
    ? value
    : undefined;
}

function getJobBudgetRange(job: any) {
  const hourlyMin =
    moneyToNumber(job?.hourlyBudgetMin);

  const hourlyMax =
    moneyToNumber(job?.hourlyBudgetMax);

  if (
    hourlyMin !== undefined ||
    hourlyMax !== undefined
  ) {
    return {
      min: hourlyMin ?? hourlyMax,
      max: hourlyMax ?? hourlyMin
    };
  }

  const fixed =
    moneyToNumber(job?.amount);

  if (fixed !== undefined) {
    return {
      min: fixed,
      max: fixed
    };
  }

  return {
    min: undefined,
    max: undefined
  };
}

function isWithinBudget(
  job: any,
  min?: number,
  max?: number
) {
  if (
    min === undefined &&
    max === undefined
  ) return true;

  const range =
    getJobBudgetRange(job);

  if (
    range.min === undefined ||
    range.max === undefined
  ) return false;

  if (
    min !== undefined &&
    range.max < min
  ) return false;

  if (
    max !== undefined &&
    range.min > max
  ) return false;

  return true;
}

function isWithinPostedDays(
  value?: string,
  days?: number
) {
  if (!days) return true;
  if (!value) return false;

  const timestamp =
    new Date(value).getTime();

  if (Number.isNaN(timestamp))
    return false;

  return timestamp >=
    Date.now() -
    days * 86400000;
}

function normalizeCountry(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeJobId(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/^~/, "");
}

const MEMBER_SINCE_DEBUG_JOB_ID =
  "022100716368678466465";

function matchesAllFilters(
  edge: any,
  options: SearchOptions
) {
  const job = edge?.node;

  if (!job?.id) return false;

  if (options.countries.length) {
    const jobCountry =
      normalizeCountry(
        job.client?.location?.country
      );

    const selected =
      options.countries
        .map(normalizeCountry);

    if (!selected.includes(jobCountry))
      return false;
  }

  if (
    !isWithinBudget(
      job,
      options.budgetMin,
      options.budgetMax
    )
  ) return false;

  const applicants =
    Number(job.totalApplicants || 0);

  if (
    options.applicantMin !== undefined &&
    applicants < options.applicantMin
  ) return false;

  if (
    options.applicantMax !== undefined &&
    applicants > options.applicantMax
  ) return false;

  const verified =
    isVerifiedStatus(
      job.client?.verificationStatus
    );

  if (
    options.paymentVerified === "verified" &&
    !verified
  ) return false;

  if (
    options.paymentVerified === "unverified" &&
    verified
  ) return false;

  if (
    !isWithinPostedDays(
      job.publishedDateTime,
      options.postedDays
    )
  ) return false;

  return true;
}


/* =========================
   UPWORK FETCH
========================= */

async function fetchBatch(
  searchExpression: string,
  first: number,
  after: string
): Promise<GraphQLResult> {

  const filter: Record<string, unknown> = {
    pagination_eq: {
      first,
      after
    }
  };

  if (searchExpression.trim()) {
    filter.searchExpression_eq =
      searchExpression.trim();
  }

  const variables = {
    filter,
    type: "USER_JOBS_SEARCH",
    sort: [
      { field: "RECENCY" }
    ]
  };

  console.log(
    "UPWORK FETCH:",
    {
      search: searchExpression,
      first,
      after
    }
  );

  const body = await callUpworkGraphQL(QUERY, variables);

  const result = body?.data?.marketplaceJobPostingsSearch;

  if (!result) {
    throw new Error(
      "marketplaceJobPostingsSearch returned no result."
    );
  }

  return result;
}

async function fetch50Jobs(
  searchExpression: string,
  after: string
): Promise<GraphQLResult> {
  try {
    return await fetchBatch(
      searchExpression,
      PAGE_SIZE,
      after
    );
  } catch (error) {

    if (!isTransformTimeout(error))
      throw error;

    console.warn("50-job request timed out. Retrying 25 + 25.");

    const firstBatch =
      await fetchBatch(
        searchExpression,
        25,
        after
      );

    const firstEdges =
      firstBatch.edges || [];

    const firstCursor =
      firstBatch.pageInfo
        ?.endCursor;

    if (
      !firstBatch.pageInfo
        ?.hasNextPage ||
      !firstCursor
    ) {
      return firstBatch;
    }

    const secondBatch =
      await fetchBatch(
        searchExpression,
        25,
        firstCursor
      );

    return {
      totalCount: Number(
        firstBatch.totalCount ||
        secondBatch.totalCount ||
        0
      ),

      edges: [
        ...firstEdges,
        ...(secondBatch.edges || [])
      ],

      pageInfo: {
        endCursor:
          secondBatch.pageInfo
            ?.endCursor ||
          firstCursor,

        hasNextPage:
          secondBatch.pageInfo
            ?.hasNextPage === true
      }
    };
  }
}


/* =========================
   FETCH ALL RESULTS
========================= */

async function fetchAllJobs(searchExpression: string) {
  const cacheKey =
    searchExpression
      .trim()
      .toLowerCase();

  const cached = allJobsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {

    console.log(`UPWORK CACHE HIT: ${cached.edges.length}`);

    return {
      edges: cached.edges,
      upstreamTotal:
        cached.upstreamTotal
    };
  }

  const allEdges: any[] = [];
  const seenJobIds = new Set<string>();

  const seenCursors = new Set<string>();

  let cursor = "0";
  let upstreamTotal = 0;
  let hasNextPage = true;

  while (hasNextPage) {

    if (seenCursors.has(cursor)) {
      console.warn("Repeated cursor:", cursor);
      break;
    }

    seenCursors.add(cursor);

    const result =
      await fetch50Jobs(
        searchExpression,
        cursor
      );

    upstreamTotal =
      Number(
        result.totalCount ||
        upstreamTotal ||
        0
      );

    for (const edge of result.edges || []) {
      const id = edge?.node?.id;

      if (
        !id ||
        seenJobIds.has(id)
      ) continue;

      seenJobIds.add(id);
      allEdges.push(edge);
    }

    hasNextPage =
      result.pageInfo
        ?.hasNextPage === true;

    const nextCursor =
      result.pageInfo
        ?.endCursor;

    if (
      !hasNextPage ||
      !nextCursor
    ) break;

    cursor = nextCursor;
  }

  allJobsCache.set(
    cacheKey,
    {
      expiresAt:
        Date.now() +
        CACHE_TTL,

      edges: allEdges,
      upstreamTotal
    }
  );

  if (allJobsCache.size > 20) {
    const oldest =
      allJobsCache
        .keys()
        .next()
        .value;

    if (oldest)
      allJobsCache.delete(oldest);
  }

  console.log(`UPWORK FETCH COMPLETE: ${allEdges.length}/${upstreamTotal}`);

  return {
    edges: allEdges,
    upstreamTotal
  };
}


/* =========================
   FORMAT JOB
========================= */

function formatJob(edge: any) {
  const job = edge?.node || {};

  console.log(
    "CLIENT DATA:",
    {
      jobId: job.id,
      ciphertext: job.ciphertext,
      client: job.client,
      relation: job.freelancerClientRelation
    }
  );

  const activity =
    job?.job
      ?.activityStat
      ?.jobActivity || {};

  const relation =
    job?.freelancerClientRelation ||
    null;

  return {
    id: job.id || "",
    title: job.title || "",
    description: job.description || "",
    ciphertext: job.ciphertext || "",

    applied:
      job.applied === true,

    premium:
      job.premium === true,

    isFeatured:
      job.premium === true,

    isPreviousClient:
      Boolean(relation),

    freelancerClientRelation:
      relation,

    publishedDateTime:
      job.publishedDateTime ||
      null,

    // Kept at top level as well so the table can use
    // job.memberSinceDateTime directly.
    memberSinceDateTime:
      job.client
        ?.memberSinceDateTime ||
      null,

    totalApplicants:
      Number(
        job.totalApplicants ||
        0
      ),

    amount:
      job.amount || null,

    hourlyBudgetMin:
      job.hourlyBudgetMin ||
      null,

    hourlyBudgetMax:
      job.hourlyBudgetMax ||
      null,

    client: {
      totalFeedback: Number(
        job.client
          ?.totalFeedback || 0
      ),

      totalReviews: Number(
        job.client
          ?.totalReviews || 0
      ),

      totalHires: Number(
        job.client
          ?.totalHires || 0
      ),

      totalPostedJobs: Number(
        job.client
          ?.totalPostedJobs || 0
      ),

      verificationStatus:
        job.client
          ?.verificationStatus ||
        "",

      // IMPORTANT:
      // The GraphQL query already requests this field.
      // It must also be copied into formatJob(), otherwise
      // it disappears from the JSON returned to the frontend.
      memberSinceDateTime:
        job.client
          ?.memberSinceDateTime ||
        null,

      totalSpent:
        job.client
          ?.totalSpent ||
        null,

      location: {
        country:
          job.client
            ?.location
            ?.country ||
          "",

        city:
          job.client
            ?.location
            ?.city ||
          "",

        timezone:
          job.client
            ?.location
            ?.timezone ||
          ""
      }
    },

    activity: {
      lastClientActivity:
        activity
          .lastClientActivity ||
        null,

      invitesSent:
        Number(
          activity
            .invitesSent ||
          0
        ),

      totalInvitedToInterview:
        Number(
          activity
            .totalInvitedToInterview ||
          0
        ),

      totalHired:
        Number(
          activity
            .totalHired ||
          0
        ),

      totalUnansweredInvites:
        Number(
          activity
            .totalUnansweredInvites ||
          0
        )
    }
  };
}


/* =========================
   API ROUTE
========================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const searchExpression = (
      searchParams.get("q")?.trim() ||
      searchParams.get("skills")?.trim() ||
      ""
    );

    const requestedOffset =
      Number(
        searchParams.get("after") ||
        "0"
      );

    const offset =
      Number.isFinite(
        requestedOffset
      )
        ? Math.max(
          Math.trunc(
            requestedOffset
          ),
          0
        )
        : 0;

    const requestedFirst =
      Number(
        searchParams.get("first") ||
        PAGE_SIZE
      );

    const first =
      Number.isFinite(
        requestedFirst
      )
        ? Math.min(
          Math.max(
            Math.trunc(
              requestedFirst
            ),
            1
          ),
          PAGE_SIZE
        )
        : PAGE_SIZE;

    const countries =
      (
        searchParams.get(
          "countries"
        ) ||
        ""
      )
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);

    const optionalNumber = (value: string | null) => {
      if (!value?.trim())
        return undefined;

      const n = Number(value);

      return Number.isFinite(n)
        ? n
        : undefined;
    };

    const budgetMin =
      optionalNumber(
        searchParams.get(
          "budgetMin"
        )
      );

    const budgetMax =
      optionalNumber(
        searchParams.get(
          "budgetMax"
        )
      );

    const paymentParam =
      searchParams.get(
        "paymentVerified"
      );

    const paymentVerified:
      SearchOptions["paymentVerified"] =
      paymentParam === "verified" ||
        paymentParam === "unverified"
        ? paymentParam
        : "all";

    const applicants =
      searchParams.get(
        "applicants"
      ) ||
      "all";

    let applicantMin:
      number | undefined;

    let applicantMax:
      number | undefined;

    if (applicants !== "all") {
      const [min, max] =
        applicants
          .split("-")
          .map(Number);

      if (Number.isFinite(min))
        applicantMin = min;

      if (Number.isFinite(max))
        applicantMax = max;
    }

    const postedDaysRaw =
      optionalNumber(
        searchParams.get(
          "postedDays"
        )
      );

    const postedDays =
      postedDaysRaw &&
        postedDaysRaw > 0
        ? postedDaysRaw
        : undefined;

    const previousClient =
      searchParams.get(
        "previousClient"
      ) === "true";

    const options: SearchOptions = {
      countries,
      budgetMin,
      budgetMax,
      paymentVerified,
      applicantMin,
      applicantMax,
      postedDays,
      previousClient
    };

    const {
      edges: allEdges,
      upstreamTotal
    } =
      await fetchAllJobs(
        searchExpression
      );

    // Debug the exact Upwork job requested by the user.
    // This confirms whether memberSinceDateTime is actually
    // present in the raw marketplaceJobPostingsSearch response.
    const memberSinceDebugEdge =
      allEdges.find((edge: any) => {
        const node = edge?.node;

        return (
          normalizeJobId(node?.id) ===
            MEMBER_SINCE_DEBUG_JOB_ID ||
          normalizeJobId(node?.ciphertext) ===
            MEMBER_SINCE_DEBUG_JOB_ID
        );
      });

    if (memberSinceDebugEdge) {
      console.log(
        "MEMBER SINCE DEBUG:",
        {
          requestedJobId:
            MEMBER_SINCE_DEBUG_JOB_ID,
          graphQLJobId:
            memberSinceDebugEdge
              ?.node?.id,
          ciphertext:
            memberSinceDebugEdge
              ?.node?.ciphertext,
          memberSinceDateTime:
            memberSinceDebugEdge
              ?.node?.client
              ?.memberSinceDateTime,
          client:
            memberSinceDebugEdge
              ?.node?.client
        }
      );
    }

    let filteredEdges =
      allEdges.filter(
        edge =>
          matchesAllFilters(
            edge,
            options
          )
      );

    if (previousClient) {
      filteredEdges = [
        ...filteredEdges
      ].sort(
        (a, b) =>
          Number(
            Boolean(
              b?.node
                ?.freelancerClientRelation
            )
          ) -
          Number(
            Boolean(
              a?.node
                ?.freelancerClientRelation
            )
          )
      );
    }

    const total =
      filteredEdges.length;

    const jobs =
      filteredEdges
        .slice(
          offset,
          offset + first
        )
        .map(formatJob);

    const nextOffset =
      offset + first;

    const hasNextPage =
      nextOffset < total;

    return NextResponse.json({
      success: true,
      jobs,
      total,
      sourceTotal:
        upstreamTotal,
      loadedSourceJobs:
        allEdges.length,
      pageSize: first,
      filters: options,

      pageInfo: {
        endCursor:
          hasNextPage
            ? String(nextOffset)
            : null,

        hasNextPage
      }
    });

  } catch (error: any) {

    console.error(
      "UPWORK JOB SEARCH ERROR:",
      error
    );

    if (
      isUpworkReauthError(
        error
      )
    ) {

      return NextResponse.json(
        {
          success: false,

          jobs: [],
          total: 0,
          totalCount: 0,

          error:
            "UPWORK_REAUTH_REQUIRED",

          reauthRequired:
            true,

          message:
            "Upwork authorization is required.",

          reauthReason:
            error?.reason ||
            "The Upwork refresh token is no longer valid.",

          reauthUrl:
            "/api/upwork/connect"
        },
        {
          status: 401
        }
      );
    }

    return NextResponse.json(
      {
        success: false,

        jobs: [],
        total: 0,

        error:
          error?.message ||
          "Unable to search Upwork jobs"
      },
      {
        status: 500
      }
    );
  }
}