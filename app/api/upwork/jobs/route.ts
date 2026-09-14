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
          displayValue
          currency
        }

        hourlyBudgetMin {
          displayValue
          currency
        }

        hourlyBudgetMax {
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isTransformTimeout(error: unknown) {
  return getErrorMessage(error).toLowerCase().includes("transform timeout");
}

async function callUpworkGraphQL(query: string, variables: unknown, forceRefresh = false) {
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

async function fetchBatch(
  searchExpression: string,
  first: number,
  after: string
): Promise<GraphQLResult> {
  const filter: Record<string, unknown> = {
    pagination_eq: { first, after }
  };

  if (searchExpression.trim()) {
    filter.searchExpression_eq = searchExpression.trim();
  }

  const variables = {
    filter,
    type: "USER_JOBS_SEARCH",
    sort: [{ field: "RECENCY" }]
  };

  console.log("UPWORK FETCH:", {
    search: searchExpression,
    first,
    after
  });

  const body = await callUpworkGraphQL(QUERY, variables);
  const result = body?.data?.marketplaceJobPostingsSearch;

  if (!result) {
    throw new Error("marketplaceJobPostingsSearch returned no result.");
  }

  return result;
}

/*
 * UI page size remains 50.
 * Normal request: 50
 * Timeout fallback: 25 + 25
 */
async function fetch50Jobs(
  searchExpression: string,
  after: string
): Promise<GraphQLResult> {
  try {
    return await fetchBatch(searchExpression, PAGE_SIZE, after);
  } catch (error) {
    if (!isTransformTimeout(error)) throw error;

    console.warn("50-job request timed out. Retrying as 25 + 25.");

    const firstBatch = await fetchBatch(searchExpression, 25, after);
    const firstEdges = firstBatch.edges || [];
    const firstCursor = firstBatch.pageInfo?.endCursor;

    if (!firstBatch.pageInfo?.hasNextPage || !firstCursor) {
      return firstBatch;
    }

    const secondBatch = await fetchBatch(searchExpression, 25, firstCursor);
    const secondEdges = secondBatch.edges || [];

    return {
      totalCount: Number(firstBatch.totalCount || secondBatch.totalCount || 0),
      edges: [...firstEdges, ...secondEdges],
      pageInfo: {
        endCursor: secondBatch.pageInfo?.endCursor || firstCursor,
        hasNextPage: secondBatch.pageInfo?.hasNextPage === true
      }
    };
  }
}

function formatJob(edge: any) {
  const job = edge?.node || {};
  const activity = job?.job?.activityStat?.jobActivity || {};
  const relation = job?.freelancerClientRelation || null;

  return {
    id: job.id || "",
    title: job.title || "",
    description: job.description || "",
    ciphertext: job.ciphertext || "",

    // STATUS FIELDS
    applied: job.applied === true,
    premium: job.premium === true,
    isFeatured: job.premium === true,
    isPreviousClient: Boolean(relation),
    freelancerClientRelation: relation,

    publishedDateTime: job.publishedDateTime || null,
    totalApplicants: Number(job.totalApplicants || 0),

    amount: job.amount || null,
    hourlyBudgetMin: job.hourlyBudgetMin || null,
    hourlyBudgetMax: job.hourlyBudgetMax || null,

    client: {
      totalFeedback: Number(job.client?.totalFeedback || 0),
      totalReviews: Number(job.client?.totalReviews || 0),
      totalHires: Number(job.client?.totalHires || 0),
      totalPostedJobs: Number(job.client?.totalPostedJobs || 0),
      verificationStatus: job.client?.verificationStatus || "",
      totalSpent: job.client?.totalSpent || null,
      location: {
        country: job.client?.location?.country || "",
        city: job.client?.location?.city || "",
        timezone: job.client?.location?.timezone || ""
      }
    },

    activity: {
      lastClientActivity: activity.lastClientActivity || null,
      invitesSent: Number(activity.invitesSent || 0),
      totalInvitedToInterview: Number(activity.totalInvitedToInterview || 0),
      totalHired: Number(activity.totalHired || 0),
      totalUnansweredInvites: Number(activity.totalUnansweredInvites || 0)
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const searchExpression = (searchParams.get("q") || "Wix").trim();
    const after = searchParams.get("after") || "0";

    const requestedFirst = Number(searchParams.get("first") || PAGE_SIZE);
    const first = Number.isFinite(requestedFirst)
      ? Math.min(Math.max(Math.trunc(requestedFirst), 1), PAGE_SIZE)
      : PAGE_SIZE;

    const result =
      first === PAGE_SIZE
        ? await fetch50Jobs(searchExpression, after)
        : await fetchBatch(searchExpression, first, after);

    const seen = new Set<string>();

    const edges = (result.edges || []).filter((edge: any) => {
      const id = edge?.node?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const jobs = edges.map(formatJob);

    return NextResponse.json({
      success: true,
      jobs,
      total: Number(result.totalCount || 0),
      pageSize: first,
      pageInfo: {
        endCursor: result.pageInfo?.endCursor || null,
        hasNextPage: result.pageInfo?.hasNextPage === true
      }
    });
  } catch (error) {
    console.error("UPWORK JOB SEARCH ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        jobs: [],
        total: 0,
        error: getErrorMessage(error) || "Unable to search Upwork jobs"
      },
      { status: 500 }
    );
  }
}
