import { NextRequest, NextResponse } from "next/server";
import { clearUpworkTokenCache, getUpworkAccessToken } from "@/lib/upwork";

const UPWORK_GRAPHQL_URL = "https://api.upwork.com/graphql";
const PAGE_SIZE = 50;

const QUERY = `
query SearchJobs(
  $filter: MarketplaceJobPostingsSearchFilter
  $type: MarketplaceJobPostingSearchType
  $sort: [MarketplaceJobPostingSearchSortAttribute]
) {
  marketplaceJobPostingsSearch(
    marketPlaceJobFilter: $filter
    searchType: $type
    sortAttributes: $sort
  ) {
    totalCount
    edges {
      cursor
      node {
        id
        title
        description
        ciphertext
        applied
        premium
        publishedDateTime
        totalApplicants

        freelancerClientRelation {
          companyRid
          companyName
          lastContractPlatform
          lastContractRid
          lastContractTitle
        }

        amount {
          rawValue
          displayValue
          currency
        }

        hourlyBudgetMin {
          rawValue
          displayValue
          currency
        }

        hourlyBudgetMax {
          rawValue
          displayValue
          currency
        }

        client {
          totalFeedback
          totalReviews
          totalHires
          totalPostedJobs
          verificationStatus

          totalSpent {
            displayValue
            currency
          }

          location {
            country
            city
            timezone
          }
        }

        job {
          activityStat {
            jobActivity {
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

    pageInfo {
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

type RawSearchCacheEntry = {
  expiresAt: number;
  edges: any[];
  upstreamTotal: number;
};

const CACHE_TTL = 60 * 1000;

const globalCache = globalThis as typeof globalThis & {
  __upworkAllJobsCache?: Map<string, RawSearchCacheEntry>;
};

const allJobsCache =
  globalCache.__upworkAllJobsCache ??
  new Map<string, RawSearchCacheEntry>();

globalCache.__upworkAllJobsCache = allJobsCache;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isTransformTimeout(error: unknown) {
  return getErrorMessage(error).toLowerCase().includes("transform timeout");
}

async function callUpworkGraphQL(
  query: string,
  variables: unknown,
  forceRefresh = false
) {
  const accessToken = await getUpworkAccessToken(forceRefresh);

  const response = await fetch(UPWORK_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });

  let body: any;

  try {
    body = await response.json();
  } catch {
    throw new Error(`Upwork returned an invalid response (${response.status}).`);
  }

  if (response.status === 401 && !forceRefresh) {
    clearUpworkTokenCache();
    return callUpworkGraphQL(query, variables, true);
  }

  if (!response.ok) {
    throw new Error(
      body?.error_description ||
      body?.error?.message ||
      body?.error ||
      `Upwork HTTP error ${response.status}`
    );
  }

  if (Array.isArray(body?.errors) && body.errors.length) {
    const message =
      body.errors
        .map((item: any) => item?.message)
        .filter(Boolean)
        .join(" | ") || "Upwork GraphQL error";

    throw new Error(message);
  }

  return body;
}

function isVerifiedStatus(status?: string) {
  if (!status) return false;

  const value = status.toLowerCase();

  if (value.includes("unverified")) return false;

  return value.includes("verified") || value.includes("true");
}

function moneyToNumber(money: any): number | undefined {
  if (!money) return undefined;

  const raw = Number(money.rawValue);

  if (Number.isFinite(raw)) return raw;

  const display = String(money.displayValue ?? "")
    .replace(/,/g, "")
    .match(/-?\d+(?:\.\d+)?/);

  if (!display) return undefined;

  const value = Number(display[0]);

  return Number.isFinite(value) ? value : undefined;
}

function getJobBudgetRange(job: any) {
  const hourlyMin = moneyToNumber(job?.hourlyBudgetMin);
  const hourlyMax = moneyToNumber(job?.hourlyBudgetMax);

  if (hourlyMin !== undefined || hourlyMax !== undefined) {
    return {
      min: hourlyMin ?? hourlyMax,
      max: hourlyMax ?? hourlyMin
    };
  }

  const fixed = moneyToNumber(job?.amount);

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
  budgetMin?: number,
  budgetMax?: number
) {
  if (
    budgetMin === undefined &&
    budgetMax === undefined
  ) {
    return true;
  }

  const range = getJobBudgetRange(job);

  if (
    range.min === undefined ||
    range.max === undefined
  ) {
    return false;
  }

  // Range-overlap behavior.
  // Min 10 excludes Fixed 0 but includes Hourly 7-15.
  if (
    budgetMin !== undefined &&
    range.max < budgetMin
  ) {
    return false;
  }

  if (
    budgetMax !== undefined &&
    range.min > budgetMax
  ) {
    return false;
  }

  return true;
}

function isWithinPostedDays(
  value: string | undefined,
  days?: number
) {
  if (!days) return true;
  if (!value) return false;

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) return false;

  return timestamp >=
    Date.now() - days * 24 * 60 * 60 * 1000;
}

function normalizeCountry(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function matchesAllFilters(
  edge: any,
  options: SearchOptions
) {
  const job = edge?.node;

  if (!job?.id) return false;

  if (options.countries.length) {
    const jobCountry = normalizeCountry(
      job.client?.location?.country
    );

    const selectedCountries =
      options.countries.map(normalizeCountry);

    if (!selectedCountries.includes(jobCountry)) {
      return false;
    }
  }

  if (
    !isWithinBudget(
      job,
      options.budgetMin,
      options.budgetMax
    )
  ) {
    return false;
  }

  const applicants =
    Number(job.totalApplicants || 0);

  if (
    options.applicantMin !== undefined &&
    applicants < options.applicantMin
  ) {
    return false;
  }

  if (
    options.applicantMax !== undefined &&
    applicants > options.applicantMax
  ) {
    return false;
  }

  const verified =
    isVerifiedStatus(
      job.client?.verificationStatus
    );

  if (
    options.paymentVerified === "verified" &&
    !verified
  ) {
    return false;
  }

  if (
    options.paymentVerified === "unverified" &&
    verified
  ) {
    return false;
  }

  if (
    !isWithinPostedDays(
      job.publishedDateTime,
      options.postedDays
    )
  ) {
    return false;
  }

  return true;
}

/*
 * One Upwork API batch.
 * This does NOT apply UI filters.
 *
 * We first collect ALL jobs for the keyword.
 * Then filters are applied to the complete result set.
 */
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
      {
        field: "RECENCY"
      }
    ]
  };

  console.log("UPWORK FETCH:", {
    search: searchExpression,
    first,
    after
  });

  const body =
    await callUpworkGraphQL(
      QUERY,
      variables
    );

  const result =
    body?.data
      ?.marketplaceJobPostingsSearch;

  if (!result) {
    throw new Error(
      "marketplaceJobPostingsSearch returned no result."
    );
  }

  return result;
}

/*
 * Try 50 first.
 * If Upwork's transform times out, fetch 25 + 25.
 */
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
    if (!isTransformTimeout(error)) {
      throw error;
    }

    console.warn(
      "50-job request timed out. Retrying as 25 + 25."
    );

    const firstBatch =
      await fetchBatch(
        searchExpression,
        25,
        after
      );

    const firstEdges =
      firstBatch.edges || [];

    const firstCursor =
      firstBatch.pageInfo?.endCursor;

    if (
      !firstBatch.pageInfo?.hasNextPage ||
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
      totalCount:
        Number(
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
          secondBatch.pageInfo?.endCursor ||
          firstCursor,

        hasNextPage:
          secondBatch.pageInfo?.hasNextPage === true
      }
    };
  }
}

/*
 * Fetch every Upwork page for the keyword.
 *
 * Important:
 * UI filters are NOT applied while fetching pages.
 * This lets Budget / Applicant / Verified / Posted Time /
 * Country / Previous Client filters run against ALL jobs,
 * rather than only the current 50-job page.
 */
async function fetchAllJobs(
  searchExpression: string
) {
  const cacheKey =
    searchExpression.trim().toLowerCase();

  const cached =
    allJobsCache.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    console.log(
      `UPWORK ALL-JOBS CACHE HIT: ${cached.edges.length} jobs`
    );

    return {
      edges: cached.edges,
      upstreamTotal: cached.upstreamTotal
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
      console.warn(
        "Stopping Upwork pagination because cursor repeated:",
        cursor
      );
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

      if (!id || seenJobIds.has(id)) {
        continue;
      }

      seenJobIds.add(id);
      allEdges.push(edge);
    }

    hasNextPage =
      result.pageInfo?.hasNextPage === true;

    const nextCursor =
      result.pageInfo?.endCursor;

    if (
      !hasNextPage ||
      !nextCursor
    ) {
      break;
    }

    cursor = nextCursor;
  }

  allJobsCache.set(cacheKey, {
    expiresAt:
      Date.now() + CACHE_TTL,
    edges: allEdges,
    upstreamTotal
  });

  // Prevent unbounded memory growth in long-lived instances.
  if (allJobsCache.size > 20) {
    const oldestKey =
      allJobsCache.keys().next().value;

    if (oldestKey) {
      allJobsCache.delete(oldestKey);
    }
  }

  console.log(
    `UPWORK ALL-JOBS FETCH COMPLETE: ${allEdges.length}/${upstreamTotal}`
  );

  return {
    edges: allEdges,
    upstreamTotal
  };
}

function formatJob(edge: any) {
  const job =
    edge?.node || {};

  const activity =
    job?.job
      ?.activityStat
      ?.jobActivity || {};

  const relation =
    job?.freelancerClientRelation || null;

  return {
    id:
      job.id || "",

    title:
      job.title || "",

    description:
      job.description || "",

    ciphertext:
      job.ciphertext || "",

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

    totalApplicants:
      Number(
        job.totalApplicants || 0
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
      totalFeedback:
        Number(
          job.client?.totalFeedback ||
          0
        ),

      totalReviews:
        Number(
          job.client?.totalReviews ||
          0
        ),

      totalHires:
        Number(
          job.client?.totalHires ||
          0
        ),

      totalPostedJobs:
        Number(
          job.client?.totalPostedJobs ||
          0
        ),

      verificationStatus:
        job.client?.verificationStatus ||
        "",

      totalSpent:
        job.client?.totalSpent ||
        null,

      location: {
        country:
          job.client?.location?.country ||
          "",

        city:
          job.client?.location?.city ||
          "",

        timezone:
          job.client?.location?.timezone ||
          ""
      }
    },

    activity: {
      lastClientActivity:
        activity.lastClientActivity ||
        null,

      invitesSent:
        Number(
          activity.invitesSent ||
          0
        ),

      totalInvitedToInterview:
        Number(
          activity.totalInvitedToInterview ||
          0
        ),

      totalHired:
        Number(
          activity.totalHired ||
          0
        ),

      totalUnansweredInvites:
        Number(
          activity.totalUnansweredInvites ||
          0
        )
    }
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const searchExpression =
      (
        searchParams.get("q") ||
        "Wix"
      ).trim();

    /*
     * "after" is now the offset in the FULL FILTERED result set.
     * Existing frontend pagination can keep using endCursor.
     */
    const requestedOffset =
      Number(
        searchParams.get("after") ||
        "0"
      );

    const offset =
      Number.isFinite(requestedOffset)
        ? Math.max(
            Math.trunc(requestedOffset),
            0
          )
        : 0;

    const requestedFirst =
      Number(
        searchParams.get("first") ||
        PAGE_SIZE
      );

    const first =
      Number.isFinite(requestedFirst)
        ? Math.min(
            Math.max(
              Math.trunc(requestedFirst),
              1
            ),
            PAGE_SIZE
          )
        : PAGE_SIZE;

    const countries =
      (
        searchParams.get("countries") ||
        ""
      )
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

    const parseOptionalNumber =
      (value: string | null) => {
        if (!value?.trim()) {
          return undefined;
        }

        const number =
          Number(value);

        return Number.isFinite(number)
          ? number
          : undefined;
      };

    const budgetMin =
      parseOptionalNumber(
        searchParams.get("budgetMin")
      );

    const budgetMax =
      parseOptionalNumber(
        searchParams.get("budgetMax")
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
      ) || "all";

    let applicantMin:
      number | undefined;

    let applicantMax:
      number | undefined;

    if (applicants !== "all") {
      const [min, max] =
        applicants
          .split("-")
          .map(Number);

      if (Number.isFinite(min)) {
        applicantMin = min;
      }

      if (Number.isFinite(max)) {
        applicantMax = max;
      }
    }

    const postedDaysRaw =
      parseOptionalNumber(
        searchParams.get("postedDays")
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

    const options:
      SearchOptions = {
        countries,
        budgetMin,
        budgetMax,
        paymentVerified,
        applicantMin,
        applicantMax,
        postedDays,
        previousClient
      };

    /*
     * 1. Get ALL Upwork results for the keyword.
     * 2. Apply filters to the entire result set.
     * 3. Paginate the FILTERED array.
     */
    const {
      edges: allEdges,
      upstreamTotal
    } =
      await fetchAllJobs(
        searchExpression
      );

    let filteredEdges =
      allEdges.filter(edge =>
        matchesAllFilters(
          edge,
          options
        )
      );

    /*
     * "Previous Client" checkbox acts as priority sorting:
     * checked   -> previous-client jobs appear first
     * unchecked -> keep normal Upwork recency order
     *
     * All matching jobs remain in the results.
     */
    if (options.previousClient) {
      filteredEdges = [...filteredEdges].sort((a, b) => {
        const aPrevious = Boolean(a?.node?.freelancerClientRelation);
        const bPrevious = Boolean(b?.node?.freelancerClientRelation);

        return Number(bPrevious) - Number(aPrevious);
      });
    }

    const total =
      filteredEdges.length;

    const paginatedEdges =
      filteredEdges.slice(
        offset,
        offset + first
      );

    const jobs =
      paginatedEdges.map(
        formatJob
      );

    const nextOffset =
      offset + first;

    const hasNextPage =
      nextOffset < total;

    return NextResponse.json({
      success: true,

      jobs,

      // Exact total AFTER filtering ALL Upwork data.
      total,

      // Optional debugging/visibility:
      sourceTotal:
        upstreamTotal,

      loadedSourceJobs:
        allEdges.length,

      pageSize:
        first,

      filters:
        options,

      pageInfo: {
        endCursor:
          hasNextPage
            ? String(nextOffset)
            : null,

        hasNextPage
      }
    });
  } catch (error) {
    console.error(
      "UPWORK JOB SEARCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        jobs: [],
        total: 0,
        error:
          getErrorMessage(error) ||
          "Unable to search Upwork jobs"
      },
      {
        status: 500
      }
    );
  }
}
