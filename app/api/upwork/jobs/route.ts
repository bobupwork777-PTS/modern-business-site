import {
    NextRequest,
    NextResponse
} from "next/server";

import {
    clearUpworkTokenCache,
    getUpworkAccessToken
} from "@/lib/upwork";

const UPWORK_GRAPHQL_URL =
    "https://api.upwork.com/graphql";

/* =========================================
   SETTINGS
========================================= */

const PAGE_SIZE = 50;

/*
    Safety limit.
    Your current search has 625,
    so 2000 is more than enough.
*/
const MAX_JOBS = 2000;

/*
    Fetch up to 4 pages at the same time
    after the first page.
*/
const CONCURRENT_REQUESTS = 4;

/* =========================================
   TYPES
========================================= */

type GraphQLError = {
    message?:string;
    path?:Array<
        string | number
    >;
};

type GraphQLResponse = {
    data?:{
        marketplaceJobPostingsSearch?:{
            totalCount?:number;

            edges?:Array<
                {
                    cursor?:string;
                    node?:any;
                } | null
            >;
        } | null;
    };

    errors?:GraphQLError[];
};

/* =========================================
   GRAPHQL QUERY

   IMPORTANT:

   NO:
   pageInfo

   NO:
   node.amount

   Activity:
   node.job.activityStat.jobActivity

   Fixed Price:
   node.job.contractTerms
       .fixedPriceContractTerms.amount
========================================= */

const SEARCH_JOBS_QUERY = `
query SearchJobs(
    $filter: MarketplaceJobPostingsSearchFilter
){
    marketplaceJobPostingsSearch(
        marketPlaceJobFilter: $filter
        searchType: USER_JOBS_SEARCH
        sortAttributes: [
            {
                field: RECENCY
            }
        ]
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
                createdDateTime
                publishedDateTime
                totalApplicants

                hourlyBudgetMin{
                    displayValue
                    currency
                }

                hourlyBudgetMax{
                    displayValue
                    currency
                }

                client{
                    totalFeedback
                    totalReviews
                    totalHires
                    totalPostedJobs
                    verificationStatus
                    companyRid

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
                            totalOffered
                            totalRecommended
                        }
                    }

                    contractTerms{
                        contractType

                        fixedPriceContractTerms{

                            amount{
                                displayValue
                                currency
                            }

                            maxAmount{
                                displayValue
                                currency
                            }
                        }
                    }
                }
            }
        }
    }
}
`;

/* =========================================
   GRAPHQL REQUEST
========================================= */

async function executeGraphQL(
    variables:any,
    retry=true
):Promise<GraphQLResponse>{

    let accessToken =
        await getUpworkAccessToken();

    let response =
        await fetch(
            UPWORK_GRAPHQL_URL,
            {
                method:"POST",

                headers:{
                    Authorization:
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json",

                    Accept:
                        "application/json"
                },

                body:
                    JSON.stringify({
                        query:
                            SEARCH_JOBS_QUERY,

                        variables
                    }),

                cache:"no-store"
            }
        );

    /* =====================================
       TOKEN EXPIRED
    ===================================== */

    if(
        response.status === 401 &&
        retry
    ){

        clearUpworkTokenCache();

        accessToken =
            await getUpworkAccessToken(
                true
            );

        response =
            await fetch(
                UPWORK_GRAPHQL_URL,
                {
                    method:"POST",

                    headers:{
                        Authorization:
                            `Bearer ${accessToken}`,

                        "Content-Type":
                            "application/json",

                        Accept:
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            query:
                                SEARCH_JOBS_QUERY,

                            variables
                        }),

                    cache:"no-store"
                }
            );
    }

    let result:GraphQLResponse;

    try{

        result =
            await response.json();

    }catch{

        throw new Error(
            `Invalid response from Upwork (${response.status})`
        );
    }

    if(!response.ok){

        console.error(
            "Upwork HTTP Error:",
            response.status,
            result
        );

        throw new Error(
            result.errors?.[0]?.message ||
            `Upwork API returned ${response.status}`
        );
    }

    return result;
}

/* =========================================
   FETCH ONE PAGE
========================================= */

async function fetchPage(
    keyword:string,
    offset:number
){

    const filter:any = {

        pagination_eq:{
            after:
                String(offset),

            first:
                PAGE_SIZE
        }
    };

    if(keyword){

        filter.searchExpression_eq =
            keyword;
    }

    console.log(
        "Upwork page request:",
        {
            keyword,
            after:
                String(offset),

            first:
                PAGE_SIZE
        }
    );

    const result =
        await executeGraphQL({
            filter
        });

    /* =====================================
       GRAPHQL WARNINGS

       If partial data exists,
       don't kill the whole request.
    ===================================== */

    if(
        result.errors?.length
    ){

        console.warn(
            `Upwork GraphQL warnings at offset ${offset}:`,
            result.errors.map(
                error => ({
                    message:
                        error.message,

                    path:
                        error.path
                })
            )
        );
    }

    const searchResult =
        result.data
            ?.marketplaceJobPostingsSearch;

    if(!searchResult){

        throw new Error(
            result.errors?.[0]?.message ||
            `Upwork returned no data at offset ${offset}`
        );
    }

    return{
        totalCount:
            searchResult.totalCount ??
            0,

        edges:
            Array.isArray(
                searchResult.edges
            )
                ? searchResult.edges
                : [],

        warningCount:
            result.errors
                ?.length ||
            0
    };
}

/* =========================================
   NORMALIZE JOB
========================================= */

function normalizeJob(
    node:any
){

    /*
        Correct activity location:

        node
          -> job
          -> activityStat
          -> jobActivity
    */

    const activity =
        node.job
            ?.activityStat
            ?.jobActivity ||
        null;

    /*
        Fixed-price budget.

        We intentionally DON'T query
        MarketplaceJobPostingSearchResult.amount
        because Upwork sometimes returns null
        even though its schema declares Money!.
    */

    const fixedPrice =
        node.job
            ?.contractTerms
            ?.fixedPriceContractTerms ||
        null;

    return{

        id:
            node.id,

        title:
            node.title ||
            "",

        description:
            node.description ||
            "",

        ciphertext:
            node.ciphertext ||
            "",

        applied:
            Boolean(
                node.applied
            ),

        createdDateTime:
            node.createdDateTime ||
            null,

        publishedDateTime:
            node.publishedDateTime ||
            null,

        totalApplicants:
            node.totalApplicants ??
            0,

        /*
            Existing frontend expects:
            job.amount.displayValue
        */

        amount:
            fixedPrice
                ?.amount ||
            null,

        fixedPriceMaxAmount:
            fixedPrice
                ?.maxAmount ||
            null,

        hourlyBudgetMin:
            node.hourlyBudgetMin ||
            null,

        hourlyBudgetMax:
            node.hourlyBudgetMax ||
            null,

        contractType:
            node.job
                ?.contractTerms
                ?.contractType ||
            null,

        /* =================================
           CLIENT
        ================================= */

        client:{

            totalFeedback:
                node.client
                    ?.totalFeedback ??
                0,

            totalReviews:
                node.client
                    ?.totalReviews ??
                0,

            totalHires:
                node.client
                    ?.totalHires ??
                0,

            totalPostedJobs:
                node.client
                    ?.totalPostedJobs ??
                0,

            verificationStatus:
                node.client
                    ?.verificationStatus ||
                "",

            companyRid:
                node.client
                    ?.companyRid ||
                "",

            totalSpent:
                node.client
                    ?.totalSpent ||
                null,

            location:{

                country:
                    node.client
                        ?.location
                        ?.country ||
                    "",

                city:
                    node.client
                        ?.location
                        ?.city ||
                    "",

                timezone:
                    node.client
                        ?.location
                        ?.timezone ||
                    ""
            }
        },

        /* =================================
           ACTIVITY
        ================================= */

        activity:{

            lastClientActivity:
                activity
                    ?.lastClientActivity ||
                null,

            invitesSent:
                activity
                    ?.invitesSent ??
                0,

            totalInvitedToInterview:
                activity
                    ?.totalInvitedToInterview ??
                0,

            totalHired:
                activity
                    ?.totalHired ??
                0,

            totalUnansweredInvites:
                activity
                    ?.totalUnansweredInvites ??
                0,

            totalOffered:
                activity
                    ?.totalOffered ??
                0,

            totalRecommended:
                activity
                    ?.totalRecommended ??
                0
        }
    };
}

/* =========================================
   ADD EDGES
========================================= */

function addEdges(
    edges:Array<any>,
    jobs:any[],
    jobIds:Set<string>
){

    for(
        const edge of edges
    ){

        const node =
            edge?.node;

        if(
            !node?.id
        ){
            continue;
        }

        /*
            Avoid duplicate jobs.
        */

        if(
            jobIds.has(
                node.id
            )
        ){
            continue;
        }

        jobIds.add(
            node.id
        );

        jobs.push(
            normalizeJob(
                node
            )
        );
    }
}

/* =========================================
   GET
========================================= */

export async function GET(
    request:NextRequest
){

    try{

        const {
            searchParams
        } =
            new URL(
                request.url
            );

        const keyword =
            searchParams
                .get("q")
                ?.trim() ||
            "";

        if(!keyword){

            return NextResponse.json(
                {
                    success:false,
                    error:
                        "Search keyword is required"
                },
                {
                    status:400
                }
            );
        }

        /* =====================================
           FIRST PAGE
        ===================================== */

        const firstPage =
            await fetchPage(
                keyword,
                0
            );

        const totalAvailable =
            firstPage.totalCount;

        /*
            If Upwork says 625,
            targetCount becomes 625.

            MAX_JOBS is only a safety guard.
        */

        const targetCount =
            Math.min(
                totalAvailable,
                MAX_JOBS
            );

        const allJobs:any[] =
            [];

        const jobIds =
            new Set<string>();

        let graphqlWarnings =
            firstPage.warningCount;

        addEdges(
            firstPage.edges,
            allJobs,
            jobIds
        );

        /* =====================================
           BUILD REMAINING OFFSETS

           Example for 625:

           50
           100
           150
           ...
           600
        ===================================== */

        const offsets:number[] =
            [];

        for(
            let offset=PAGE_SIZE;
            offset<targetCount;
            offset+=PAGE_SIZE
        ){

            offsets.push(
                offset
            );
        }

        /* =====================================
           LOAD REMAINING PAGES

           Fetch 4 pages per batch so it is
           faster than doing all 13 requests
           strictly one-by-one.
        ===================================== */

        for(
            let i=0;
            i<offsets.length;
            i+=CONCURRENT_REQUESTS
        ){

            const batch =
                offsets.slice(
                    i,
                    i +
                    CONCURRENT_REQUESTS
                );

            console.log(
                "Loading Upwork offsets:",
                batch
            );

            const pages =
                await Promise.all(
                    batch.map(
                        offset =>
                            fetchPage(
                                keyword,
                                offset
                            )
                    )
                );

            pages.forEach(
                page => {

                    graphqlWarnings +=
                        page.warningCount;

                    addEdges(
                        page.edges,
                        allJobs,
                        jobIds
                    );
                }
            );
        }

        /* =====================================
           LIMIT TO TARGET
        ===================================== */

        const finalJobs =
            allJobs.slice(
                0,
                targetCount
            );

        console.log(
            "Upwork search completed:",
            {
                keyword,

                totalAvailable,

                loaded:
                    finalJobs.length,

                requests:
                    1 +
                    offsets.length,

                graphqlWarnings
            }
        );

        return NextResponse.json({

            success:true,

            total:
                totalAvailable,

            loaded:
                finalJobs.length,

            jobs:
                finalJobs,

            graphqlWarnings,

            truncated:
                totalAvailable >
                MAX_JOBS
        });

    }catch(error){

        console.error(
            "Upwork Jobs API Error:",
            error
        );

        return NextResponse.json(
            {
                success:false,

                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to search Upwork jobs"
            },
            {
                status:500
            }
        );
    }
}