"use client";

import {
    useMemo,
    useState
} from "react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Job = {
    id: string;
    title?: string;
    description?: string;
    ciphertext?: string;
    url?: string;
    applied?: boolean;
    createdDateTime?: string;
    publishedDateTime?: string;
    totalApplicants?: number;

    amount?: {
        displayValue?: string;
        currency?: string;
    };

    hourlyBudgetMin?: {
        displayValue?: string;
        currency?: string;
    };

    hourlyBudgetMax?: {
        displayValue?: string;
        currency?: string;
    };

    client?: {
        totalFeedback?: number;
        totalReviews?: number;
        totalHires?: number;
        totalPostedJobs?: number;
        verificationStatus?: string;
        companyRid?: string;
        edcUserId?: string;

        totalSpent?: {
            displayValue?: string;
            currency?: string;
        };

        location?: {
            country?: string;
            city?: string;
            timezone?: string;
        };
    };

    activity?: {
        lastClientActivity?: string;
        invitesSent?: number;
        totalInvitedToInterview?: number;
        totalHired?: number;
        totalUnansweredInvites?: number;
        totalOffered?: number;
        totalRecommended?: number;
    };
};

type Selection = {
    email: boolean;
    telegram: boolean;
    queue: boolean;
};

export default function UpworkJobsPage() {

    const [search, setSearch] = useState("Wix");
    const [jobs, setJobs] = useState<Job[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [previousClient, setPreviousClient] = useState(false);

    const [selections, setSelections] = useState<
        Record<string, Selection>
    >({});

    const quickSearches = [
        "Wix",
        "Wix Studio",
        "Wix Velo",
        "Webflow",
        "Shopify",
        "Finsweet",
        "Relume",
        "Next.js"
    ];

    /* =========================================
       SEARCH JOBS
    ========================================= */

    async function searchJobs() {

        const searchKeyword =
            search.trim() || "Wix";

        try {

            setHasSearched(true);
            setLoading(true);
            setError("");

            const response = await fetch(
                `/api/upwork/jobs?q=${encodeURIComponent(
                    searchKeyword
                )}`,
                {
                    cache: "no-store"
                }
            );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {

                let message =
                    "Unable to search Upwork jobs";

                if (
                    typeof data.error === "string"
                ) {
                    message =
                        data.error;
                }

                else if (
                    Array.isArray(
                        data.error
                    )
                ) {
                    message =
                        data.error?.[0]
                            ?.message ||
                        message;
                }

                else if (
                    data.error?.message
                ) {
                    message =
                        data.error.message;
                }

                throw new Error(
                    message
                );
            }

            setJobs(
                data.jobs || []
            );

            setTotal(
                data.total ??
                data.totalCount ??
                0
            );

        }

        catch (err) {

            console.error(
                "Upwork Search Error:",
                err
            );

            setJobs([]);
            setTotal(0);

            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong"
            );
        }

        finally {
            setLoading(false);
        }
    }

    /* =========================================
       QUICK SEARCH
       ONLY CHANGES SEARCH VALUE
    ========================================= */

    function handleQuickSearch(
        keyword: string
    ) {
        setSearch(keyword);
    }

    /* =========================================
       FORMAT DATE
    ========================================= */

    function formatDate(
        value?: string
    ) {

        if (!value) {
            return "-";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "-";
        }

        return date.toLocaleString(
            "en-US",
            {
                month: "numeric",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            }
        );
    }

    /* =========================================
       ELAPSED TIME
    ========================================= */

    function getElapsedTime(
        value?: string
    ) {

        if (!value) {
            return "-";
        }

        const published =
            new Date(
                value
            ).getTime();

        if (
            Number.isNaN(
                published
            )
        ) {
            return "-";
        }

        const difference =
            Date.now() -
            published;

        if (difference < 0) {
            return "Just now";
        }

        const minutes =
            Math.floor(
                difference / 60000
            );

        if (minutes < 1) {
            return "Just now";
        }

        if (minutes < 60) {

            return `${minutes} ${minutes === 1
                    ? "min"
                    : "mins"
                } ago`;
        }

        const hours =
            Math.floor(
                minutes / 60
            );

        if (hours < 24) {

            return `${hours} ${hours === 1
                    ? "hour"
                    : "hours"
                } ago`;
        }

        const days =
            Math.floor(
                hours / 24
            );

        return `${days} ${days === 1
                ? "day"
                : "days"
            } ago`;
    }

    /* =========================================
       BUDGET
    ========================================= */

    function getBudget(
        job: Job
    ) {

        const min =
            job.hourlyBudgetMin
                ?.displayValue;

        const max =
            job.hourlyBudgetMax
                ?.displayValue;

        if (min) {

            if (max) {

                return `${min} - ${max}/hr`;
            }

            return `${min}/hr`;
        }

        if (
            job.amount
                ?.displayValue
        ) {

            return `Fixed ${job.amount.displayValue}`;
        }

        return "Not specified";
    }

    /* =========================================
       VERIFIED
    ========================================= */

    function isVerified(
        status?: string
    ) {

        if (!status) {
            return false;
        }

        const value =
            status.toLowerCase();

        if (
            value.includes(
                "unverified"
            )
        ) {
            return false;
        }

        return (
            value.includes(
                "verified"
            ) ||
            value.includes(
                "true"
            )
        );
    }

    /* =========================================
       PROPOSAL RANGE
    ========================================= */

    function getProposalRange(
        totalApplicants?: number
    ) {

        const count =
            totalApplicants ??
            0;

        if (count < 5) {
            return "< 5";
        }

        if (count < 10) {
            return "5 - 10";
        }

        if (count < 15) {
            return "10 - 15";
        }

        if (count < 20) {
            return "15 - 20";
        }

        if (count < 50) {
            return "20 - 50";
        }

        return "50+";
    }

    /* =========================================
       JOB URL
    ========================================= */

    function getJobUrl(
        job: Job
    ) {

        if (job.url) {
            return job.url;
        }

        if (
            !job.ciphertext
        ) {
            return "";
        }

        const code =
            job.ciphertext
                .startsWith("~")
                ? job.ciphertext
                : `~${job.ciphertext}`;

        return (
            `https://www.upwork.com/jobs/${code}`
        );
    }

    /* =========================================
       TOGGLE
    ========================================= */

    function toggleSelection(
        jobId: string,
        field: keyof Selection
    ) {

        setSelections(
            previous => {

                const current =
                    previous[jobId] || {
                        email: false,
                        telegram: false,
                        queue: false
                    };

                return {
                    ...previous,

                    [jobId]: {
                        ...current,
                        [field]:
                            !current[field]
                    }
                };
            }
        );
    }

    /* =========================================
       SELECT ALL
    ========================================= */

    function setAll(
        field: "email" | "telegram",
        checked: boolean
    ) {

        setSelections(
            previous => {

                const updated = {
                    ...previous
                };

                jobs.forEach(
                    job => {

                        const current =
                            updated[job.id] || {
                                email: false,
                                telegram: false,
                                queue: false
                            };

                        updated[job.id] = {
                            ...current,
                            [field]: checked
                        };
                    }
                );

                return updated;
            }
        );
    }

    /* =========================================
       ADD TO QUEUE
    ========================================= */

    function addSelectedToQueue() {

        setSelections(
            previous => {

                const updated = {
                    ...previous
                };

                let selectedFound =
                    false;

                jobs.forEach(
                    job => {

                        const current =
                            updated[job.id] || {
                                email: false,
                                telegram: false,
                                queue: false
                            };

                        if (
                            current.email ||
                            current.telegram ||
                            current.queue
                        ) {

                            selectedFound =
                                true;

                            updated[job.id] = {
                                ...current,
                                queue: true
                            };
                        }
                    }
                );

                return selectedFound
                    ? updated
                    : previous;
            }
        );
    }

    /* =========================================
       QUEUE COUNT
    ========================================= */

    const queuedCount =
        useMemo(
            () =>
                Object.values(
                    selections
                ).filter(
                    item =>
                        item.queue
                ).length,
            [
                selections
            ]
        );

    return (

        <div
            className="
                min-h-screen
                flex
                flex-col
                bg-[#0D163F]
            "
        >

            <Navbar />

            <main
                className="
                    flex-1
                    bg-[#0D163F]
                    px-2
                    md:px-3
                    lg:px-4
                    pt-20
                    pb-6
                "
            >

                <div
                    className="
                        max-w-[1900px]
                        mx-auto
                    "
                >

                    {/* =================================
                        HERO
                    ================================= */}

                    <section
                        className="
                            flex
                            flex-col
                            lg:flex-row
                            lg:items-end
                            lg:justify-between
                            gap-3
                            mb-3
                        "
                    >

                        <div>

                            <div
                                className="
                                    inline-flex
                                    items-center
                                    gap-1.5
                                    text-blue-400
                                    font-bold
                                    uppercase
                                    tracking-[1.5px]
                                    text-[10px]
                                    mb-1.5
                                "
                            >

                                <span
                                    className="
                                        w-1.5
                                        h-1.5
                                        rounded-full
                                        bg-blue-400
                                    "
                                />

                                Upwork Job Monitoring

                            </div>

                            <h1
                                className="
                                    text-2xl
                                    md:text-3xl
                                    lg:text-[32px]
                                    leading-tight
                                    font-semibold
                                    text-white
                                "
                            >

                                Find the right opportunities,

                                <span
                                    className="
                                        text-blue-400
                                    "
                                >
                                    {" "}faster.
                                </span>

                            </h1>

                            <p
                                className="
                                    mt-1.5
                                    text-gray-300
                                    text-xs
                                "
                            >
                                Search, monitor and analyse Upwork opportunities directly from your Phoenix dashboard.
                            </p>

                        </div>

                        <div
                            className="
                                flex
                                flex-wrap
                                gap-1.5
                            "
                        >

                            <StatCard
                                label="Total Results"
                                value={total}
                            />

                            <StatCard
                                label="Loaded"
                                value={
                                    jobs.length
                                }
                            />

                            <StatCard
                                label="In Queue"
                                value={
                                    queuedCount
                                }
                            />

                        </div>

                    </section>

                    {/* =================================
                        SEARCH
                    ================================= */}

                    <section
                        className="
                            bg-white
                            border
                            border-gray-200
                            rounded-xl
                            shadow-lg
                            p-3
                            mb-3
                        "
                    >

                        <div
                            className="
                                flex
                                flex-col
                                lg:flex-row
                                lg:items-end
                                gap-2
                            "
                        >

                            <div
                                className="
                                    flex-1
                                "
                            >

                                <label
                                    className="
                                        block
                                        text-[11px]
                                        font-semibold
                                        text-gray-700
                                        mb-1
                                    "
                                >
                                    Search Jobs
                                </label>

                                <div
                                    className="
                                        flex
                                        items-center
                                        gap-2
                                        bg-[#F8FAFC]
                                        border
                                        border-gray-300
                                        rounded-lg
                                        px-3
                                        h-[42px]
                                        focus-within:border-blue-500
                                        focus-within:ring-1
                                        focus-within:ring-blue-100
                                    "
                                >

                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="
                                            text-gray-400
                                            shrink-0
                                        "
                                    >

                                        <circle
                                            cx="11"
                                            cy="11"
                                            r="7"
                                        />

                                        <path
                                            d="m20 20-3.5-3.5"
                                        />

                                    </svg>

                                    <input
                                        type="text"
                                        value={
                                            search
                                        }
                                        onChange={
                                            e =>
                                                setSearch(
                                                    e.target.value
                                                )
                                        }
                                        placeholder="Wix, Webflow, Shopify, Next.js..."
                                        className="
                                            w-full
                                            bg-transparent
                                            outline-none
                                            border-none
                                            text-gray-900
                                            text-xs
                                        "
                                    />

                                </div>

                            </div>

                            {/* SEARCH BUTTON */}

                            <button
                                type="button"
                                onClick={
                                    searchJobs
                                }
                                disabled={
                                    loading
                                }
                                className="
                                    h-[42px]
                                    px-5
                                    min-w-[140px]
                                    rounded-lg
                                    bg-blue-600
                                    hover:bg-blue-700
                                    disabled:bg-blue-400
                                    disabled:cursor-not-allowed
                                    text-white
                                    font-semibold
                                    text-xs
                                    transition
                                    flex
                                    items-center
                                    justify-center
                                    gap-1.5
                                "
                            >

                                {loading ? (

                                    <>

                                        <span
                                            className="
                                                w-3.5
                                                h-3.5
                                                border-2
                                                border-white/30
                                                border-t-white
                                                rounded-full
                                                animate-spin
                                            "
                                        />

                                        Searching...

                                    </>

                                ) : (

                                    <>

                                        Search Jobs

                                        <span>
                                            →
                                        </span>

                                    </>

                                )}

                            </button>

                        </div>

                        {/* QUICK SEARCH */}

                        <div
                            className="
                                flex
                                items-center
                                flex-wrap
                                gap-1.5
                                mt-2
                            "
                        >

                            <span
                                className="
                                    text-[10px]
                                    text-gray-500
                                    mr-1
                                "
                            >
                                Quick search:
                            </span>

                            {quickSearches.map(
                                item => (

                                    <button
                                        key={
                                            item
                                        }
                                        type="button"
                                        onClick={() =>
                                            handleQuickSearch(
                                                item
                                            )
                                        }
                                        className={`
                                            px-2.5
                                            py-1
                                            rounded-full
                                            border
                                            text-[10px]
                                            font-medium
                                            transition
                                            ${search === item

                                                ? `
                                                        bg-blue-600
                                                        text-white
                                                        border-blue-600
                                                    `

                                                : `
                                                        bg-white
                                                        text-gray-600
                                                        border-gray-300
                                                        hover:border-blue-500
                                                        hover:text-blue-600
                                                    `
                                            }
                                        `}
                                    >

                                        {item}

                                    </button>

                                )
                            )}

                        </div>

                    </section>

                    {/* ERROR */}

                    {error && (

                        <section
                            className="
                                flex
                                items-start
                                gap-2
                                bg-[#FFF1F2]
                                border
                                border-red-300
                                rounded-lg
                                p-2.5
                                mb-3
                            "
                        >

                            <div
                                className="
                                    w-7
                                    h-7
                                    rounded-full
                                    bg-red-500
                                    text-white
                                    flex
                                    justify-center
                                    items-center
                                    font-bold
                                    text-xs
                                "
                            >
                                !
                            </div>

                            <div>

                                <h3
                                    className="
                                        text-red-800
                                        text-xs
                                        font-semibold
                                    "
                                >
                                    Upwork API Error
                                </h3>

                                <p
                                    className="
                                        text-red-600
                                        text-[10px]
                                        mt-0.5
                                    "
                                >
                                    {error}
                                </p>

                            </div>

                        </section>

                    )}

                    {/* =================================
                        TABLE
                    ================================= */}

                    <section
                        className="
                            bg-white
                            border
                            border-gray-200
                            rounded-xl
                            shadow-lg
                            overflow-hidden
                        "
                    >

                        {/* TABLE HEADER */}

                        <div
                            className="
                                flex
                                flex-col
                                xl:flex-row
                                xl:items-center
                                xl:justify-between
                                gap-2
                                px-4
                                py-2.5
                                border-b
                                border-gray-200
                            "
                        >

                            <div>

                                <h2
                                    className="
                                        text-base
                                        font-semibold
                                        text-[#101828]
                                    "
                                >
                                    Latest Opportunities
                                </h2>

                                <p
                                    className="
                                        text-gray-400
                                        text-[10px]
                                        mt-0.5
                                    "
                                >

                                    {!hasSearched
                                        ? "Search jobs to view opportunities"
                                        : `Showing ${jobs.length} of ${total} available jobs`
                                    }

                                </p>

                            </div>

                            <div
                                className="
                                    flex
                                    flex-wrap
                                    items-center
                                    gap-3
                                "
                            >

                                <label
                                    className="
                                        flex
                                        items-center
                                        gap-1.5
                                        text-xs
                                        font-semibold
                                        text-gray-800
                                        cursor-pointer
                                    "
                                >

                                    <input
                                        type="checkbox"
                                        checked={
                                            previousClient
                                        }
                                        onChange={
                                            e =>
                                                setPreviousClient(
                                                    e.target.checked
                                                )
                                        }
                                        className="
                                            w-3.5
                                            h-3.5
                                        "
                                    />

                                    Previous Client

                                </label>

                                <button
                                    type="button"
                                    onClick={
                                        addSelectedToQueue
                                    }
                                    disabled={
                                        jobs.length === 0
                                    }
                                    className="
                                        px-4
                                        py-1.5
                                        rounded-full
                                        border
                                        border-blue-700
                                        bg-blue-600
                                        hover:bg-blue-700
                                        disabled:bg-gray-300
                                        disabled:border-gray-300
                                        disabled:cursor-not-allowed
                                        text-white
                                        text-[11px]
                                        font-medium
                                    "
                                >
                                    Add To Queue
                                </button>

                                <span
                                    className="
                                        text-blue-600
                                        text-xs
                                        font-bold
                                    "
                                >
                                    Total: {total}
                                </span>

                            </div>

                        </div>

                        <div
                            className="
                                overflow-x-auto
                            "
                        >

                            <table
                                className="
                                    w-full
                                    min-w-[2050px]
                                    border-collapse
                                    text-[12px]
                                "
                            >

                                <thead
                                    className="
                                        bg-[#F8FAFC]
                                    "
                                >

                                    <tr>

                                        <th className={thClass}>
                                            Status
                                        </th>

                                        <th className={thClass}>
                                            Elapsed
                                        </th>

                                        <th className={thClass}>
                                            Job Title
                                        </th>

                                        <th className={thClass}>
                                            Description
                                        </th>

                                        <th className={thClass}>
                                            URL
                                        </th>

                                        <th className={thClass}>
                                            Country
                                        </th>

                                        <th className={thClass}>
                                            Client
                                        </th>

                                        <th className={thClass}>
                                            Fdbk
                                        </th>

                                        <th className={thClass}>
                                            Appl
                                        </th>

                                        <th className={thClass}>
                                            Verified
                                        </th>

                                        <th className={thClass}>
                                            Budget
                                        </th>

                                        <th className={thClass}>
                                            Published
                                        </th>

                                        <th className={thClass}>
                                            Activity
                                        </th>

                                        <th className={thClass}>

                                            <div
                                                className="
                                                    flex
                                                    flex-col
                                                    gap-0.5
                                                    normal-case
                                                    tracking-normal
                                                "
                                            >

                                                <label
                                                    className="
                                                        flex
                                                        items-center
                                                        gap-1
                                                    "
                                                >

                                                    <input
                                                        type="checkbox"
                                                        disabled={
                                                            jobs.length === 0
                                                        }
                                                        onChange={
                                                            e =>
                                                                setAll(
                                                                    "email",
                                                                    e.target.checked
                                                                )
                                                        }
                                                    />

                                                    All Email

                                                </label>

                                                <label
                                                    className="
                                                        flex
                                                        items-center
                                                        gap-1
                                                    "
                                                >

                                                    <input
                                                        type="checkbox"
                                                        disabled={
                                                            jobs.length === 0
                                                        }
                                                        onChange={
                                                            e =>
                                                                setAll(
                                                                    "telegram",
                                                                    e.target.checked
                                                                )
                                                        }
                                                    />

                                                    Telegram

                                                </label>

                                            </div>

                                        </th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {/* BEFORE SEARCH */}

                                    {!hasSearched ? (

                                        <tr>

                                            <td
                                                colSpan={
                                                    14
                                                }
                                                className="
                                                    py-12
                                                    text-center
                                                "
                                            >

                                                <div
                                                    className="
                                                        w-10
                                                        h-10
                                                        rounded-full
                                                        bg-blue-50
                                                        flex
                                                        items-center
                                                        justify-center
                                                        mx-auto
                                                    "
                                                >

                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        className="
                                                            text-blue-600
                                                        "
                                                    >

                                                        <circle
                                                            cx="11"
                                                            cy="11"
                                                            r="7"
                                                        />

                                                        <path
                                                            d="m20 20-3.5-3.5"
                                                        />

                                                    </svg>

                                                </div>

                                                <h3
                                                    className="
                                                        text-gray-800
                                                        text-sm
                                                        font-semibold
                                                        mt-2
                                                    "
                                                >
                                                    Search Upwork Jobs
                                                </h3>

                                                <p
                                                    className="
                                                        text-gray-400
                                                        text-[11px]
                                                        mt-1
                                                    "
                                                >
                                                    Select or enter a keyword and click Search Jobs.
                                                </p>

                                            </td>

                                        </tr>

                                    ) : loading ? (

                                        /* LOADING */

                                        <tr>

                                            <td
                                                colSpan={
                                                    14
                                                }
                                                className="
                                                    py-12
                                                    text-center
                                                "
                                            >

                                                <div
                                                    className="
                                                        w-8
                                                        h-8
                                                        border-[3px]
                                                        border-gray-200
                                                        border-t-blue-600
                                                        rounded-full
                                                        animate-spin
                                                        mx-auto
                                                    "
                                                />

                                                <h3
                                                    className="
                                                        mt-2
                                                        text-sm
                                                        font-semibold
                                                        text-gray-800
                                                    "
                                                >
                                                    Searching Upwork...
                                                </h3>

                                                <p
                                                    className="
                                                        text-gray-400
                                                        text-[10px]
                                                        mt-1
                                                    "
                                                >
                                                    Fetching latest opportunities.
                                                </p>

                                            </td>

                                        </tr>

                                    ) : jobs.length === 0 ? (

                                        /* NO RESULTS */

                                        <tr>

                                            <td
                                                colSpan={
                                                    14
                                                }
                                                className="
                                                    py-12
                                                    text-center
                                                "
                                            >

                                                <h3
                                                    className="
                                                        text-gray-800
                                                        text-sm
                                                        font-semibold
                                                    "
                                                >
                                                    No jobs found
                                                </h3>

                                                <p
                                                    className="
                                                        text-gray-400
                                                        text-[10px]
                                                        mt-1
                                                    "
                                                >
                                                    Try searching another keyword.
                                                </p>

                                            </td>

                                        </tr>

                                    ) : (

                                        jobs.map(
                                            job => {

                                                const verified =
                                                    isVerified(
                                                        job.client
                                                            ?.verificationStatus
                                                    );

                                                const jobUrl =
                                                    getJobUrl(
                                                        job
                                                    );

                                                const selection =
                                                    selections[
                                                    job.id
                                                    ] || {
                                                        email: false,
                                                        telegram: false,
                                                        queue: false
                                                    };

                                                return (

                                                    <tr
                                                        key={
                                                            job.id
                                                        }
                                                        className="
                                                            border-t
                                                            border-gray-100
                                                            hover:bg-blue-50/40
                                                            transition
                                                        "
                                                    >

                                                        {/* STATUS */}

                                                        <td
                                                            className={
                                                                cellClass
                                                            }
                                                        >

                                                            {job.applied ? (

                                                                <span
                                                                    className="
                                                                        font-medium
                                                                        text-green-600
                                                                    "
                                                                >
                                                                    Applied
                                                                </span>

                                                            ) : (

                                                                <span
                                                                    className="
                                                                        text-gray-400
                                                                    "
                                                                >
                                                                    N/A
                                                                </span>

                                                            )}

                                                        </td>

                                                        {/* ELAPSED */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[100px]
                                                                text-[12px]
                                                                leading-[16px]
                                                                text-red-500
                                                                whitespace-nowrap
                                                            "
                                                        >

                                                            {getElapsedTime(
                                                                job.publishedDateTime
                                                            )}

                                                        </td>

                                                        {/* TITLE */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[190px]
                                                                max-w-[230px]
                                                            "
                                                        >

                                                            <h3
                                                                className="
                                                                    text-[12px]
                                                                    font-medium
                                                                    text-gray-900
                                                                    leading-[16px]
                                                                "
                                                            >

                                                                {job.title ||
                                                                    "Untitled Job"}

                                                            </h3>

                                                        </td>

                                                        {/* DESCRIPTION */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[310px]
                                                                max-w-[360px]
                                                                text-[12px]
                                                                leading-[16px]
                                                                text-gray-700
                                                            "
                                                        >

                                                            {job.description
                                                                ? `${job.description.slice(
                                                                    0,
                                                                    150
                                                                )}${job.description.length >
                                                                    150
                                                                    ? "..."
                                                                    : ""
                                                                }`
                                                                : "-"
                                                            }

                                                        </td>

                                                        {/* URL */}

                                                        <td
                                                            className={
                                                                cellClass
                                                            }
                                                        >

                                                            {jobUrl ? (

                                                                <a
                                                                    href={
                                                                        jobUrl
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="
                                                                        text-blue-600
                                                                        hover:text-blue-800
                                                                        hover:underline
                                                                        font-medium
                                                                        text-[12px]
                                                                        whitespace-nowrap
                                                                    "
                                                                >
                                                                    View Job
                                                                </a>

                                                            ) : (
                                                                "-"
                                                            )}

                                                        </td>

                                                        {/* COUNTRY */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[95px]
                                                                text-[12px]
                                                                leading-[16px]
                                                                text-gray-900
                                                            "
                                                        >

                                                            {job.client
                                                                ?.location
                                                                ?.country ||
                                                                "-"
                                                            }

                                                        </td>

                                                        {/* CLIENT */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[135px]
                                                            "
                                                        >

                                                            <div
                                                                className="
                                                                    flex
                                                                    flex-col
                                                                    gap-0
                                                                    text-[12px]
                                                                    leading-[16px]
                                                                "
                                                            >

                                                                <span
                                                                    className="
                                                                        text-gray-900
                                                                    "
                                                                >

                                                                    {job.client
                                                                        ?.totalPostedJobs ??
                                                                        0}{" "}

                                                                    {(job.client
                                                                        ?.totalPostedJobs ??
                                                                        0) === 1
                                                                        ? "job"
                                                                        : "jobs"
                                                                    }{" "}posted

                                                                </span>

                                                                <span
                                                                    className="
                                                                        text-gray-500
                                                                    "
                                                                >

                                                                    {job.client
                                                                        ?.totalSpent
                                                                        ?.displayValue

                                                                        ? `${job.client.totalSpent.displayValue} spent`

                                                                        : "$0 spent"
                                                                    }

                                                                </span>

                                                                <span
                                                                    className="
                                                                        text-gray-500
                                                                    "
                                                                >

                                                                    {job.client
                                                                        ?.totalHires ??
                                                                        0}{" "}

                                                                    {(job.client
                                                                        ?.totalHires ??
                                                                        0) === 1
                                                                        ? "hire"
                                                                        : "hires"
                                                                    }

                                                                </span>

                                                            </div>

                                                        </td>

                                                        {/* FEEDBACK */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                text-center
                                                                text-[12px]
                                                                leading-[16px]
                                                            "
                                                        >

                                                            {job.client
                                                                ?.totalFeedback ??
                                                                0}

                                                        </td>

                                                        {/* APPLICANTS */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                text-center
                                                                text-[12px]
                                                                leading-[16px]
                                                            "
                                                        >

                                                            {job.totalApplicants ??
                                                                0}

                                                        </td>

                                                        {/* VERIFIED */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[85px]
                                                            "
                                                        >

                                                            <span
                                                                className={`
                                                                    text-[12px]
                                                                    leading-[16px]
                                                                    font-medium
                                                                    ${verified
                                                                        ? "text-green-600"
                                                                        : "text-gray-500"
                                                                    }
                                                                `}
                                                            >

                                                                {verified
                                                                    ? "Verified"
                                                                    : "Unverified"
                                                                }

                                                            </span>

                                                        </td>

                                                        {/* BUDGET */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[125px]
                                                                max-w-[155px]
                                                                text-[12px]
                                                                leading-[16px]
                                                                whitespace-nowrap
                                                            "
                                                        >

                                                            {getBudget(
                                                                job
                                                            )}

                                                        </td>

                                                        {/* PUBLISHED */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[150px]
                                                                text-[12px]
                                                                leading-[16px]
                                                                whitespace-nowrap
                                                            "
                                                        >

                                                            {formatDate(
                                                                job.publishedDateTime
                                                            )}

                                                        </td>

                                                        {/* ACTIVITY */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[155px]
                                                            "
                                                        >

                                                            <div
                                                                className="
                                                                    flex
                                                                    flex-col
                                                                    gap-0
                                                                    text-[12px]
                                                                    leading-[15px]
                                                                "
                                                            >

                                                                <span>
                                                                    Proposals:{" "}
                                                                    {getProposalRange(
                                                                        job.totalApplicants
                                                                    )}
                                                                </span>

                                                                <span>
                                                                    Interviewing:{" "}
                                                                    {job.activity
                                                                        ?.totalInvitedToInterview ??
                                                                        0}
                                                                </span>

                                                                <span>
                                                                    Invites:{" "}
                                                                    {job.activity
                                                                        ?.invitesSent ??
                                                                        0}
                                                                </span>

                                                                <span>
                                                                    Unanswered:{" "}
                                                                    {job.activity
                                                                        ?.totalUnansweredInvites ??
                                                                        0}
                                                                </span>

                                                            </div>

                                                        </td>

                                                        {/* ACTIONS */}

                                                        <td
                                                            className="
                                                                px-2
                                                                py-2
                                                                align-top
                                                                min-w-[100px]
                                                            "
                                                        >

                                                            <div
                                                                className="
                                                                    flex
                                                                    flex-col
                                                                    gap-0.5
                                                                    text-[12px]
                                                                    leading-[16px]
                                                                "
                                                            >

                                                                <label
                                                                    className="
                                                                        flex
                                                                        items-center
                                                                        gap-1.5
                                                                        cursor-pointer
                                                                    "
                                                                >

                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            selection.email
                                                                        }
                                                                        onChange={() =>
                                                                            toggleSelection(
                                                                                job.id,
                                                                                "email"
                                                                            )
                                                                        }
                                                                    />

                                                                    Email

                                                                </label>

                                                                <label
                                                                    className="
                                                                        flex
                                                                        items-center
                                                                        gap-1.5
                                                                        cursor-pointer
                                                                    "
                                                                >

                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            selection.telegram
                                                                        }
                                                                        onChange={() =>
                                                                            toggleSelection(
                                                                                job.id,
                                                                                "telegram"
                                                                            )
                                                                        }
                                                                    />

                                                                    Telegram

                                                                </label>

                                                                <label
                                                                    className="
                                                                        flex
                                                                        items-center
                                                                        gap-1.5
                                                                        cursor-pointer
                                                                    "
                                                                >

                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            selection.queue
                                                                        }
                                                                        onChange={() =>
                                                                            toggleSelection(
                                                                                job.id,
                                                                                "queue"
                                                                            )
                                                                        }
                                                                    />

                                                                    Queue

                                                                </label>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                );
                                            }
                                        )

                                    )}

                                </tbody>

                            </table>

                        </div>

                    </section>

                </div>

            </main>

            <Footer />

        </div>
    );
}

/* =========================================
   STAT CARD
========================================= */

function StatCard({
    label,
    value
}: {
    label: string;
    value: number;
}) {

    return (

        <div
            className="
                min-w-[100px]
                bg-[#16214A]
                border
                border-white/10
                rounded-lg
                px-3
                py-2
                shadow-lg
            "
        >

            <p
                className="
                    text-gray-400
                    text-[9px]
                "
            >
                {label}
            </p>

            <h2
                className="
                    text-white
                    text-lg
                    leading-5
                    font-bold
                    mt-0.5
                "
            >
                {value}
            </h2>

        </div>
    );
}

/* =========================================
   TABLE CLASSES
========================================= */

const thClass = `
    px-2
    py-2
    text-left
    text-[11px]
    leading-[14px]
    font-semibold
    uppercase
    tracking-[0.2px]
    text-gray-600
    whitespace-nowrap
    align-middle
`;

const cellClass = `
    px-2
    py-2
    align-top
    text-[12px]
    leading-[16px]
    text-gray-800
    whitespace-nowrap
`;