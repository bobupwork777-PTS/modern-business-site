"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import * as XLSX from "xlsx";

type Job = {
    id: string;
    title?: string;
    description?: string;
    ciphertext?: string;
    url?: string;
    applied?: boolean;
    premium?: boolean;
    isFeatured?: boolean;
    isPreviousClient?: boolean;
    freelancerClientRelation?: {
        companyRid?: string;
        companyName?: string;
        lastContractPlatform?: string;
        lastContractRid?: string;
        lastContractTitle?: string;
    } | null;
    createdDateTime?: string;
    publishedDateTime?: string;
    totalApplicants?: number;
    amount?: { displayValue?: string; currency?: string };
    hourlyBudgetMin?: { displayValue?: string; currency?: string };
    hourlyBudgetMax?: { displayValue?: string; currency?: string };
    client?: {
        totalFeedback?: number;
        totalReviews?: number;
        totalHires?: number;
        totalPostedJobs?: number;
        verificationStatus?: string;
        memberSinceDateTime?: string;
        companyRid?: string;
        edcUserId?: string;
        totalSpent?: { displayValue?: string; currency?: string };
        location?: { country?: string; city?: string; timezone?: string };
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

type AIReport = { relevant: boolean; proposal?: string; reason?: string; error?: string };
type PageInfo = { endCursor: string | null; hasNextPage: boolean };
type PaymentFilter = "all" | "verified" | "unverified";
type AddOptionType = "country" | "skill";
type SortColumn = "status" | "country" | "feedback" | "applicants" | "verified" | "published";
type SortDirection = "desc" | "asc";

const PAGE_SIZE = 50;
const applicantOptions = [
    { value: "all", label: "All applicants" },
    { value: "0-4", label: "< 5" },
    { value: "5-9", label: "5 - 10" },
    { value: "10-14", label: "10 - 15" },
    { value: "15-19", label: "15 - 20" },
    { value: "20-49", label: "20 - 50" },
    { value: "50-999999", label: "50+" }
];
const postedTimeOptions = [
    { value: "all", label: "Any time" },
    { value: "1", label: "Last 24 hours" },
    { value: "3", label: "Last 3 days" },
    { value: "7", label: "Last 7 days" },
    { value: "14", label: "Last 14 days" },
    { value: "30", label: "Last 30 days" }
];

const COUNTRY_GROUPS = [
    ["AUS", "Australia", "New Zealand", "NZ", "Indonesia"],
    ["CAN", "Canada", "US", "USA", "United State", "United States", "Mexico"],
    ["UAE", "United Arab Emirates"],
    ["UK", "United Kingdom", "Ireland", "Norway", "Finland", "Sweden", "Switzerland"],
    ["SGP", "Singapore"],
    ["ZAF", "South Africa"],
    ["Germany", "DEU"],
    ["France", "FRA"]
];



const SKILL_GROUPS = [
    ["wix", "Velo", "wix studio"],
    ["relume", "Finsweet", "webflow"],
    ["GHL", "Go High Level"]
];



function sortByCustomOrder(items: string[], order: string[]) {
    return [...items].sort((a, b) => {
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);

        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;

        return aIndex - bIndex;
    });
}

export default function UpworkJobsPage() {
    const [search, setSearch] = useState("");
    const [searchMode, setSearchMode] = useState<"manual" | "quick" | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [fixedPriceFirst, setFixedPriceFirst] = useState(false);
    const [hourlyPriceFirst, setHourlyPriceFirst] = useState(false);
    const [previousClientFirst, setPreviousClientFirst] = useState(false);
    const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [aiReport, setAiReport] = useState<AIReport | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInfo, setPageInfo] = useState<PageInfo>({ endCursor: null, hasNextPage: false });
    const [pageCursors, setPageCursors] = useState<Record<number, string>>({ 1: "0" });
    const [skillOptions, setSkillOptions] = useState<string[]>([]);
    const [countryOptions, setCountryOptions] = useState<string[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [budgetMin, setBudgetMin] = useState("");
    const [budgetMax, setBudgetMax] = useState("");
    const [paymentVerified, setPaymentVerified] = useState<PaymentFilter>("all");
    const [applicantRange, setApplicantRange] = useState("all");
    const [postedDays, setPostedDays] = useState("all");
    const [showAddOptionModal, setShowAddOptionModal] = useState(false);
    const [addOptionType, setAddOptionType] = useState<AddOptionType | null>(null);
    const [newOptionValue, setNewOptionValue] = useState("");
    const [addOptionError, setAddOptionError] = useState("");
    const [queuedJobIds, setQueuedJobIds] = useState<string[]>([]);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [optionSaving, setOptionSaving] = useState(false);
    const [queueLoadingIds, setQueueLoadingIds] = useState<string[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);

    const exportColumns = [
        { key: "status", label: "Status" },
        { key: "elapsed", label: "Elapsed" },
        { key: "title", label: "Job Title" },
        { key: "description", label: "Description" },
        { key: "url", label: "URL" },
        { key: "country", label: "Country" },
        { key: "client", label: "Client" },
        { key: "memberSince", label: "Member Since" },
        { key: "published", label: "Published" },
        { key: "activity", label: "Activity" },
        { key: "feedback", label: "Feedback" },
        { key: "applicants", label: "Applicants" },
        { key: "verified", label: "Verified" },
        { key: "budget", label: "Budget" }
    ];

    const [selectedExportColumns, setSelectedExportColumns] = useState([
        "title",
        "description",
        "url"
    ]);


    const allCountriesSelected = countryOptions.length > 0 && selectedCountries.length === countryOptions.length;

    useEffect(() => {
        void loadSearchOptions();
        void loadQueue();
    }, []);

    async function loadSearchOptions() {
        setOptionsLoading(true);

        try {
            const [countriesResponse, skillsResponse] = await Promise.all([
                fetch("/api/upwork/countries", { cache: "no-store" }),
                fetch("/api/upwork/skills", { cache: "no-store" })
            ]);

            const [countriesData, skillsData] = await Promise.all([
                countriesResponse.json(),
                skillsResponse.json()
            ]);

            if (!countriesResponse.ok || !countriesData.success) {
                throw new Error(countriesData.error || "Unable to load countries");
            }

            if (!skillsResponse.ok || !skillsData.success) {
                throw new Error(skillsData.error || "Unable to load skills");
            }

            const countries = Array.isArray(countriesData.countries)
                ? countriesData.countries
                    .map((item: any) => typeof item === "string" ? item : item?.name)
                    .filter(Boolean)
                : [];

            const skills = Array.isArray(skillsData.skills)
                ? skillsData.skills
                    .map((item: any) => typeof item === "string" ? item : item?.name)
                    .filter(Boolean)
                : [];

            setCountryOptions(countries);
            setSkillOptions(skills);
            setSelectedCountries(countries);
        } catch (err) {
            console.error("LOAD SEARCH OPTIONS ERROR:", err);
            setError(err instanceof Error ? err.message : "Unable to load countries and skills");
        } finally {
            setOptionsLoading(false);
        }
    }

    async function loadQueue() {
        try {
            const response = await fetch("/api/upwork/queue", {
                cache: "no-store"
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Unable to load queue");
            }

            setQueuedJobIds(
                Array.isArray(data.queuedJobIds)
                    ? data.queuedJobIds.map(String)
                    : []
            );
        } catch (err) {
            console.error("LOAD QUEUE ERROR:", err);
        }
    }

    async function searchJobs(
        page = 1,
        cursor = "0",
        keyword?: string,
        previousClientFirstOverride?: boolean,
        selectedSkillsOverride?: string[]
    ) {

        const searchKeyword =
            (
                keyword ??
                search
            ).trim() ||
            "";

        const activeKeyword =
            searchMode === "quick" || searchMode === "manual"
                ? searchKeyword
                : "";

        const prioritizePreviousClient =
            previousClientFirstOverride ??
            previousClientFirst;

        try {

            setHasSearched(true);
            setLoading(true);
            setError("");

            const params =
                new URLSearchParams({
                    q:
                        activeKeyword,

                    first:
                        String(
                            PAGE_SIZE
                        ),

                    after:
                        cursor
                });

            if (
                selectedCountries.length &&
                !allCountriesSelected
            ) {

                params.set(
                    "countries",
                    selectedCountries.join(",")
                );
            }

            const activeSkills =
                selectedSkillsOverride ??
                selectedSkills;

            if (activeSkills.length) {
                params.set(
                    "skills",
                    activeSkills.join(",")
                );
            }

            if (budgetMin.trim()) {

                params.set(
                    "budgetMin",
                    budgetMin.trim()
                );
            }

            if (budgetMax.trim()) {

                params.set(
                    "budgetMax",
                    budgetMax.trim()
                );
            }

            if (
                paymentVerified !==
                "all"
            ) {

                params.set(
                    "paymentVerified",
                    paymentVerified
                );
            }

            if (
                applicantRange !==
                "all"
            ) {

                params.set(
                    "applicants",
                    applicantRange
                );
            }

            if (
                postedDays !==
                "all"
            ) {

                params.set(
                    "postedDays",
                    postedDays
                );
            }

            if (
                prioritizePreviousClient
            ) {

                params.set(
                    "previousClient",
                    "true"
                );
            }

            console.log("API Params:", Object.fromEntries(params.entries()));



            const response =
                await fetch(`/api/upwork/jobs?${params.toString()}`,
                    {
                        method:"GET",
                        cache:"no-store",
                        headers: {
                            Accept:
                                "application/json"
                        }
                    }
                );

            /*
             * IMPORTANT:
             *
             * Read text first.
             *
             * Never immediately call response.json()
             * because an HTML 404/500/redirect page
             * would cause:
             *
             * Unexpected token '<'
             */
            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";

            const raw = await response.text();

            let data:
                any = {};

            if (
                raw.trim()
                    .startsWith("<")
            ) {

                console.error(
                    "UPWORK JOB API RETURNED HTML:",
                    {
                        status:
                            response.status,

                        contentType,

                        preview:
                            raw.slice(
                                0,
                                500
                            )
                    }
                );

                throw new Error(
                    `Upwork API returned HTML instead of JSON (${response.status}). Check the server console.`
                );
            }

            if (raw) {

                try {

                    data =
                        JSON.parse(
                            raw
                        );
                    console.log("========== GRAPHQL RESPONSE DATA ==========");
                    console.log(data);
                    console.log("============================================");

                } catch {

                    console.error(
                        "INVALID JOB API RESPONSE:",
                        raw.slice(
                            0,
                            500
                        )
                    );

                    throw new Error(
                        `Invalid API response (${response.status})`
                    );
                }
            }

            /*
             * Upwork authorization genuinely
             * needs to be renewed.
             */
            if (
                data?.reauthRequired ===
                true ||

                data?.error ===
                "UPWORK_REAUTH_REQUIRED"
            ) {

                console.warn(
                    "UPWORK AUTHORIZATION REQUIRED:",
                    data
                );

                if (page === 1) {

                    setJobs([]);
                    setTotal(0);
                    setCurrentPage(1);

                    setPageInfo({
                        endCursor:
                            null,

                        hasNextPage:
                            false
                    });

                    setPageCursors({
                        1:
                            "0"
                    });
                }

                setError(
                    data?.reauthReason ||
                    data?.message ||
                    "Upwork authorization is required."
                );

                /*
                 * IMPORTANT:
                 *
                 * Don't fetch /api/upwork/connect.
                 * It is an OAuth browser redirect.
                 *
                 * For now we don't automatically
                 * redirect while simply searching.
                 */
                return;
            }

            if (
                !response.ok ||
                !data?.success
            ) {

                let message =
                    "Unable to search Upwork jobs";

                if (
                    typeof data?.message ===
                    "string" &&
                    data.message
                ) {

                    message =
                        data.message;

                } else if (
                    typeof data?.error ===
                    "string" &&
                    data.error
                ) {

                    message =
                        data.error;

                } else if (
                    Array.isArray(
                        data?.error
                    )
                ) {

                    message =
                        data.error?.[0]
                            ?.message ||
                        message;

                } else if (
                    data?.error?.message
                ) {

                    message =
                        data.error.message;
                }

                throw new Error(
                    message
                );
            }

            const nextInfo:
                PageInfo = {

                endCursor:
                    data?.pageInfo
                        ?.endCursor ||
                    null,

                hasNextPage:
                    data?.pageInfo
                        ?.hasNextPage ===
                    true
            };

            setSearch(
                searchKeyword
            );

            setJobs(
                Array.isArray(
                    data?.jobs
                )
                    ? data.jobs
                    : []
            );

            setTotal(
                Number(
                    data?.total ??
                    data?.totalCount ??
                    0
                )
            );

            setCurrentPage(
                page
            );

            setPageInfo(
                nextInfo
            );

            setPageCursors(
                previous => {

                    const updated:
                        Record<number, string> =

                        page === 1

                            ? {
                                1:
                                    "0"
                            }

                            : {
                                ...previous
                            };

                    if (
                        nextInfo.endCursor
                    ) {

                        updated[
                            page + 1
                        ] =
                            nextInfo.endCursor;
                    }

                    return updated;
                }
            );

        } catch (err) {

            console.error(
                "Upwork Search Error:",
                err
            );

            if (
                page === 1
            ) {

                setJobs([]);
                setTotal(0);
                setCurrentPage(1);

                setPageInfo({
                    endCursor:
                        null,

                    hasNextPage:
                        false
                });

                setPageCursors({
                    1:
                        "0"
                });
            }

            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong"
            );

        } finally {

            setLoading(false);
        }
    }

    async function goToNextPage() {
        if (loading || !pageInfo.hasNextPage || !pageInfo.endCursor) return;
        await searchJobs(currentPage + 1, pageInfo.endCursor);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function goToPreviousPage() {
        if (loading || currentPage <= 1) return;
        const previousPage = currentPage - 1;
        await searchJobs(previousPage, pageCursors[previousPage] ?? "0");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function handleQuickSearch(keyword: string, skills: string[] = []) {

        setSearchMode("quick");

        setSearch(keyword);

        if (skills.length) {
            setSelectedSkills(skills);
        }

        setPageCursors({
            1: "0"
        });

        void searchJobs(
            1,
            "0",
            keyword,
            undefined,
            skills
        );
    }

    function toggleCountry(country: string) {
        if (country === "ALL") {
            setSelectedCountries(allCountriesSelected ? [] : [...countryOptions]);
            return;
        }

        setSelectedCountries(current =>
            current.includes(country)
                ? current.filter(item => item !== country)
                : [...current, country]
        );
    }

    function toggleSkillGroup(index: number) {
        const group = SKILL_GROUPS[index];

        const isSelected = group.every(skill =>
            selectedSkills.includes(skill)
        );

        setSelectedSkills(current =>
            isSelected
                ? current.filter(item => !group.includes(item))
                : [...new Set([...current, ...group])]
        );
    }

    function clearFilters() {
        setSelectedCountries([...countryOptions]);
        setSelectedSkills([]);
        setBudgetMin("");
        setBudgetMax("");
        setPaymentVerified("all");
        setApplicantRange("all");
        setPostedDays("all");
        setFixedPriceFirst(false);
        setHourlyPriceFirst(false);
        setPreviousClientFirst(false);
        setSortColumn(null);
        setSortDirection("desc");
    }

    const activeFilterCount =
        (selectedCountries.length > 0 && !allCountriesSelected ? 1 : 0) +
        (budgetMin ? 1 : 0) +
        (budgetMax ? 1 : 0) +
        (paymentVerified !== "all" ? 1 : 0) +
        (applicantRange !== "all" ? 1 : 0) +
        (postedDays !== "all" ? 1 : 0) +
        (fixedPriceFirst ? 1 : 0) +
        (hourlyPriceFirst ? 1 : 0) +
        (previousClientFirst ? 1 : 0);

    function handleFixedPriceFirstChange(checked: boolean) {
        setFixedPriceFirst(checked);
        setSortColumn(null);
        setSortDirection("desc");

        if (checked) {
            setHourlyPriceFirst(false);
        }
    }

    function handleHourlyPriceFirstChange(checked: boolean) {
        setHourlyPriceFirst(checked);
        setSortColumn(null);
        setSortDirection("desc");

        if (checked) {
            setFixedPriceFirst(false);
        }
    }

    function handleColumnSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection(current => current === "desc" ? "asc" : "desc");
            return;
        }

        setSortColumn(column);
        setSortDirection("desc");
    }

    function getSortIndicator(column: SortColumn) {
        if (sortColumn !== column) return "↕";
        return sortDirection === "desc" ? "↓" : "↑";
    }

    async function handlePreviousClientFirstChange(checked: boolean) {
        setPreviousClientFirst(checked);

        if (hasSearched) {
            setPageCursors({ 1: "0" });
            await searchJobs(1, "0", undefined, checked);
        }
    }

    function openAddOptionModal() {
        setAddOptionType(null);
        setNewOptionValue("");
        setAddOptionError("");
        setShowAddOptionModal(true);
    }

    function closeAddOptionModal() {
        setShowAddOptionModal(false);
        setAddOptionType(null);
        setNewOptionValue("");
        setAddOptionError("");
    }

    async function addCountryOrSkill() {
        const value = newOptionValue.trim();

        if (!addOptionType) {
            setAddOptionError("Please choose Add Country or Add Skill.");
            return;
        }

        if (!value) {
            setAddOptionError(`Please enter a ${addOptionType}.`);
            return;
        }

        try {
            setOptionSaving(true);
            setAddOptionError("");

            const endpoint =
                addOptionType === "country"
                    ? "/api/upwork/countries"
                    : "/api/upwork/skills";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name: value })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                    `Unable to add ${addOptionType}`
                );
            }

            await loadSearchOptions();
            closeAddOptionModal();
        } catch (err) {
            console.error("ADD SEARCH OPTION ERROR:", err);
            setAddOptionError(
                err instanceof Error
                    ? err.message
                    : "Unable to save option"
            );
        } finally {
            setOptionSaving(false);
        }
    }

    function formatDate(value?: string) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString("en-US", {
            month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true
        });
    }

    function formatMemberSince(value?: string) {
        if (!value) return "-";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "-";

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function getElapsedTime(value?: string) {
        if (!value) return "-";
        const published = new Date(value).getTime();
        if (Number.isNaN(published)) return "-";
        const difference = Date.now() - published;
        if (difference < 0) return "Just now";
        const minutes = Math.floor(difference / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes} ${minutes === 1 ? "min" : "mins"} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
        const days = Math.floor(hours / 24);
        return `${days} ${days === 1 ? "day" : "days"} ago`;
    }

    function getBudget(job: Job) {
        const hourlyMin = job.hourlyBudgetMin?.displayValue;
        const hourlyMax = job.hourlyBudgetMax?.displayValue;
        const fixedAmount = job.amount?.displayValue;

        if (hourlyMin || hourlyMax) {
            if (hourlyMin && hourlyMax) {
                return `Hourly Price: ${hourlyMin} - ${hourlyMax}/hr`;
            }

            return `Hourly Price: ${hourlyMin || hourlyMax}/hr`;
        }

        if (fixedAmount) {
            return `Fixed Price: ${fixedAmount}`;
        }

        return "Not specified";
    }

    function isFixedPriceJob(job: Job) {
        return Boolean(
            job.amount?.displayValue &&
            !job.hourlyBudgetMin?.displayValue &&
            !job.hourlyBudgetMax?.displayValue
        );
    }

    function isHourlyPriceJob(job: Job) {
        return Boolean(
            job.hourlyBudgetMin?.displayValue ||
            job.hourlyBudgetMax?.displayValue
        );
    }

    function isVerified(status?: string) {
        if (!status) return false;
        const value = status.toLowerCase();
        if (value.includes("unverified")) return false;
        return value.includes("verified") || value.includes("true");
    }

    function isFeaturedJob(job: Job) {
        return job.isFeatured === true || job.premium === true;
    }

    function isPreviousClientJob(job: Job) {
        return job.isPreviousClient === true || Boolean(job.freelancerClientRelation);
    }

    function getStatusText(job: Job) {
        const statuses: string[] = [];
        if (job.applied) statuses.push("Applied");
        if (isFeaturedJob(job)) statuses.push("Featured");
        if (isPreviousClientJob(job)) statuses.push("Previous Client");
        return statuses.length ? statuses.join(", ") : "N/A";
    }

    function getStatusSortValue(job: Job) {
        let score = 0;
        if (job.applied) score += 100;
        if (isPreviousClientJob(job)) score += 10;
        if (isFeaturedJob(job)) score += 1;
        return score;
    }

    function compareText(a: string, b: string) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    }

    function getProposalRange(totalApplicants?: number) {
        const count = totalApplicants ?? 0;
        if (count < 5) return "< 5";
        if (count < 10) return "5 - 10";
        if (count < 15) return "10 - 15";
        if (count < 20) return "15 - 20";
        if (count < 50) return "20 - 50";
        return "50+";
    }

    function getJobUrl(job: Job) {
        if (job.url) return job.url;
        if (!job.ciphertext) return "";
        const code = job.ciphertext.startsWith("~") ? job.ciphertext : `~${job.ciphertext}`;
        return `https://www.upwork.com/jobs/${code}`;
    }

    async function analyzeJob(job: Job) {
        setSelectedJob(job);
        setShowModal(true);
        setAnalyzing(true);
        setAiReport(null);

        const activity = [
            `Proposals: ${getProposalRange(job.totalApplicants)}`,
            `Interviewing: ${job.activity?.totalInvitedToInterview ?? 0}`,
            `Invites: ${job.activity?.invitesSent ?? 0}`,
            `Unanswered: ${job.activity?.totalUnansweredInvites ?? 0}`
        ].join(", ");

        const analysisJob = {
            Title: job.title || "Untitled Job",
            Description: job.description || "",
            Budget: getBudget(job),
            Status: getStatusText(job),
            PublishedDate: formatDate(job.publishedDateTime),
            Activity: activity,
            URL: getJobUrl(job)
        };

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ job: analysisJob })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "AI analysis failed");
            setAiReport(data);
        } catch (err) {
            console.error("Analyze error:", err);
            setAiReport({ relevant: false, error: "Unable to analyze this opportunity. Please try again." });
        } finally {
            setAnalyzing(false);
        }
    }

    function closeModal() {
        setShowModal(false);
        setSelectedJob(null);
        setAiReport(null);
    }

    async function addToQueue(job: Job) {
        if (queuedJobIds.includes(job.id) || queueLoadingIds.includes(job.id)) {
            return;
        }

        setQueueLoadingIds(current => [...current, job.id]);

        try {
            const response = await fetch("/api/upwork/queue", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ job })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Unable to add job to queue");
            }

            setQueuedJobIds(current =>
                current.includes(job.id)
                    ? current
                    : [...current, job.id]
            );
        } catch (err) {
            console.error("ADD TO QUEUE ERROR:", err);

            alert(
                err instanceof Error
                    ? err.message
                    : "Unable to add job to queue"
            );
        } finally {
            setQueueLoadingIds(current =>
                current.filter(id => id !== job.id)
            );
        }
    }


    function exportToExcel() {

        const data = displayedJobs.map(job => {

            const row: any = {};

            selectedExportColumns.forEach(column => {

                switch (column) {

                    case "status":
                        row.Status = getStatusText(job);
                        break;

                    case "elapsed":
                        row.Elapsed = getElapsedTime(job.publishedDateTime);
                        break;

                    case "title":
                        row["Job Title"] = job.title || "";
                        break;

                    case "description":
                        row.Description = job.description || "";
                        break;

                    case "url":
                        row.URL = getJobUrl(job);
                        break;

                    case "country":
                        row.Country = job.client?.location?.country || "";
                        break;

                    case "client":
                        row.Client =
                            `${job.client?.totalPostedJobs ?? 0} jobs posted | ${job.client?.totalSpent?.displayValue || "$0"} spent`;
                        break;

                    case "memberSince":
                        row["Member Since"] = formatMemberSince(job.client?.memberSinceDateTime);
                        break;

                    case "feedback":
                        row.Feedback = job.client?.totalFeedback ?? 0;
                        break;

                    case "applicants":
                        row.Applicants = job.totalApplicants ?? 0;
                        break;

                    case "verified":
                        row.Verified = isVerified(job.client?.verificationStatus)
                            ? "Verified"
                            : "Unverified";
                        break;

                    case "budget":
                        row.Budget = getBudget(job);
                        break;

                    case "published":
                        row.Published = formatDate(job.publishedDateTime);
                        break;

                    case "activity":
                        row.Activity =
                            `Proposals: ${getProposalRange(job.totalApplicants)}, Interviewing: ${job.activity?.totalInvitedToInterview ?? 0}, Invites: ${job.activity?.invitesSent ?? 0}`;
                        break;
                }

            });

            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Jobs"
        );

        XLSX.writeFile(
            workbook,
            "upwork-jobs-export.xlsx"
        );

        setShowExportModal(false);
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const to = total && jobs.length ? from + jobs.length - 1 : 0;

    const displayedJobs = jobs
        .map((job, index) => ({ job, index }))
        .sort((a, b) => {
            if (sortColumn) {
                let comparison = 0;

                switch (sortColumn) {
                    case "status":
                        comparison = getStatusSortValue(a.job) - getStatusSortValue(b.job);
                        break;

                    case "country":
                        comparison = compareText(
                            a.job.client?.location?.country || "",
                            b.job.client?.location?.country || ""
                        );
                        break;

                    case "feedback":
                        comparison = (a.job.client?.totalFeedback ?? 0) - (b.job.client?.totalFeedback ?? 0);
                        break;

                    case "applicants":
                        comparison = (a.job.totalApplicants ?? 0) - (b.job.totalApplicants ?? 0);
                        break;

                    case "verified":
                        comparison = Number(isVerified(a.job.client?.verificationStatus)) -
                            Number(isVerified(b.job.client?.verificationStatus));
                        break;

                    case "published":
                        comparison = new Date(a.job.publishedDateTime || 0).getTime() -
                            new Date(b.job.publishedDateTime || 0).getTime();
                        break;
                }

                if (comparison !== 0) {
                    return sortDirection === "desc" ? -comparison : comparison;
                }
            }

            if (fixedPriceFirst) {
                const aFixed = isFixedPriceJob(a.job);
                const bFixed = isFixedPriceJob(b.job);

                if (aFixed !== bFixed) {
                    return aFixed ? -1 : 1;
                }
            }

            if (hourlyPriceFirst) {
                const aHourly = isHourlyPriceJob(a.job);
                const bHourly = isHourlyPriceJob(b.job);

                if (aHourly !== bHourly) {
                    return aHourly ? -1 : 1;
                }
            }

            return a.index - b.index;
        })
        .map(item => item.job);



    function getCountryGroup(country: string) {
        return COUNTRY_GROUPS.find(group =>
            group.some(item =>
                item.toLowerCase() === country.toLowerCase()
            )
        ) || [country];
    }

    function getSkillGroup(skill: string) {
        return SKILL_GROUPS.find(group =>
            group.some(item =>
                item.toLowerCase() === skill.toLowerCase()
            )
        ) || [skill];
    }

    function getAvailableGroupItems(group: string[], options: string[]) {
        return options.filter(option =>
            group.some(item =>
                item.toLowerCase() === option.toLowerCase()
            )
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#0D163F]">
            <Navbar />

            <main className="flex-1 bg-[#0D163F] px-2 md:px-3 lg:px-4 pt-20 pb-6">
                <div className="max-w-[1900px] mx-auto">
                    <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
                        <div>
                            <div className="inline-flex items-center gap-1.5 text-blue-400 font-bold uppercase tracking-[1.5px] text-[12px] mb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                Upwork Job Monitoring
                            </div>
                            <h1 className="text-2xl md:text-3xl lg:text-[32px] leading-tight font-semibold text-white">
                                Find the right opportunities,<span className="text-blue-400"> faster.</span>
                            </h1>
                            <p className="mt-1.5 text-gray-300 text-xs">
                                Search, monitor and analyse Upwork opportunities directly from your Phoenix dashboard.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <StatCard label="Total Results" value={total} />
                            <StatCard label="Loaded" value={jobs.length} />
                        </div>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 mb-3">

                        <div className="mt-3 border-t border-gray-200 pt-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-[12px] font-semibold text-gray-800">Job Filters</h3>
                                    {activeFilterCount > 0 && (
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[12px] font-semibold text-blue-700">
                                            {activeFilterCount} active
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    disabled={activeFilterCount === 0}
                                    className="text-[11px] font-medium text-gray-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Clear filters
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                                <div className="xl:col-span-7">
                                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-700">Country</label>
                                    <div className="flex max-h-[92px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                                        <button
                                            type="button"
                                            onClick={() => toggleCountry("ALL")}
                                            disabled={optionsLoading || countryOptions.length === 0}
                                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${allCountriesSelected
                                                ? "border-blue-600 bg-blue-600 text-white"
                                                : "border-gray-300 bg-white text-gray-600 hover:border-blue-500 hover:text-blue-600"
                                                }`}
                                        >
                                            ALL
                                        </button>
                                        {optionsLoading ? (
                                            <span className="text-[11px] text-gray-400">
                                                Loading countries...
                                            </span>
                                        ) : countryOptions.length === 0 ? (
                                            <span className="text-[11px] text-gray-400">
                                                No countries added yet.
                                            </span>
                                        ) : countryOptions.map(country => {

                                            const group = getCountryGroup(country);

                                            const selected = group
                                                .filter(item =>
                                                    countryOptions.some(
                                                        country =>
                                                            country.toLowerCase() === item.toLowerCase()
                                                    )
                                                )
                                                .every(item =>
                                                    selectedCountries.some(
                                                        selected =>
                                                            selected.toLowerCase() === item.toLowerCase()
                                                    )
                                                );

                                            return (
                                                <button
                                                    key={country}
                                                    type="button"
                                                    onClick={() => {

                                                        setSelectedCountries(current => {

                                                            const realGroup = group.filter(item =>
                                                                countryOptions.some(
                                                                    country =>
                                                                        country.toLowerCase() === item.toLowerCase()
                                                                )
                                                            );


                                                            if (selected) {

                                                                return current.filter(
                                                                    item =>
                                                                        !realGroup.some(
                                                                            groupItem =>
                                                                                groupItem.toLowerCase() === item.toLowerCase()
                                                                        )
                                                                );

                                                            }


                                                            return [
                                                                ...new Set([
                                                                    ...current,
                                                                    ...realGroup
                                                                ])
                                                            ];

                                                        });

                                                    }}
                                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${selected
                                                        ? "border-blue-600 bg-blue-600 text-white"
                                                        : "border-gray-300 bg-white text-gray-600 hover:border-blue-500 hover:text-blue-600"
                                                        }`}
                                                >
                                                    {country}
                                                </button>
                                            );

                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-5 xl:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-[12px] font-semibold text-gray-700">Budget</label>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min="0"
                                                value={budgetMin}
                                                onChange={e => setBudgetMin(e.target.value)}
                                                placeholder="Min"
                                                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-[12px] text-gray-900 outline-none focus:border-blue-500"
                                            />
                                            <span className="text-[12px] text-gray-400">to</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={budgetMax}
                                                onChange={e => setBudgetMax(e.target.value)}
                                                placeholder="Max"
                                                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-[11px] text-gray-900 outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-[11px] font-semibold text-gray-700">Payment Verified</label>
                                        <div className="flex h-9 items-center gap-3 rounded-lg border border-gray-300 px-2.5">
                                            {(["all", "verified", "unverified"] as PaymentFilter[]).map(value => (
                                                <label key={value} className="flex cursor-pointer items-center gap-1 text-[12px] text-gray-700">
                                                    <input
                                                        type="radio"
                                                        name="paymentVerified"
                                                        value={value}
                                                        checked={paymentVerified === value}
                                                        onChange={() => setPaymentVerified(value)}
                                                        className="h-3.5 w-3.5"
                                                    />
                                                    {value === "all" ? "All" : value === "verified" ? "Verified" : "Unverified"}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-[11px] font-semibold text-gray-700">Total Applicants</label>
                                        <select
                                            value={applicantRange}
                                            onChange={e => setApplicantRange(e.target.value)}
                                            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-[12px] text-gray-900 outline-none focus:border-blue-500"
                                        >
                                            {applicantOptions.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-[11px] font-semibold text-gray-700">Posted Time</label>
                                        <select
                                            value={postedDays}
                                            onChange={e => setPostedDays(e.target.value)}
                                            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-[12px] text-gray-900 outline-none focus:border-blue-500"
                                        >
                                            {postedTimeOptions.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row lg:items-end gap-2">
                            <div className="flex-1">
                                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Search Jobs</label>
                                <div className="flex items-center gap-2 bg-[#F8FAFC] border border-gray-300 rounded-lg px-3 h-[42px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-100">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0">
                                        <circle cx="11" cy="11" r="7" />
                                        <path d="m20 20-3.5-3.5" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={search}
                                        disabled={searchMode === "quick"}
                                        onChange={e => {
                                            setSearchMode("manual");
                                            setSelectedSkills([]);
                                            setSearch(e.target.value);
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === "Enter" && !loading) {
                                                setSearchMode("manual");
                                                searchJobs(1, "0");
                                            }
                                        }}
                                        placeholder="Wix, Webflow, Shopify, Next.js..."
                                        className="w-full bg-transparent outline-none border-none text-gray-900 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="flex min-w-[160px] flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchMode("manual");
                                        searchJobs(1, "0");
                                    }}
                                    disabled={loading}
                                    className="h-[42px] rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400 flex items-center justify-center gap-1.5"
                                >
                                    {loading ? (
                                        <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Searching...</>
                                    ) : <>Search Jobs <span>→</span></>}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start justify-between gap-3 mt-2">
                            <div className="flex flex-1 flex-wrap items-center gap-1.5">
                                <span className="text-[12px] text-gray-500 mr-1">
                                    Quick search:
                                </span>

                                {optionsLoading ? (
                                    <span className="text-[11px] text-gray-400">Loading skills...</span>
                                ) : skillOptions.length === 0 ? (
                                    <span className="text-[11px] text-gray-400">No skills added yet.</span>
                                ) : skillOptions.map(skill => {

                                    const group = getSkillGroup(skill);

                                    const selected = group.every(item =>
                                        selectedSkills.includes(item)
                                    );

                                    return (
                                        <button
                                            key={skill}
                                            type="button"
                                            onClick={() => {

                                                const updatedSkills = selected
                                                    ? selectedSkills.filter(item => !group.includes(item))
                                                    : [...new Set([...selectedSkills, ...group])];

                                                setSelectedSkills(updatedSkills);

                                                if (updatedSkills.length > 0) {
                                                    setSearchMode("quick");

                                                    // Clear manual search text
                                                    setSearch("");
                                                } else {
                                                    setSearchMode(null);
                                                }

                                            }}
                                            className={`px-2.5 py-1 rounded-full border text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${selected
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "bg-white text-gray-600 border-gray-300 hover:border-blue-500 hover:text-blue-600"
                                                }`}
                                        >
                                            {skill}
                                        </button>
                                    );

                                })}
                            </div>

                            <button
                                type="button"
                                onClick={openAddOptionModal}
                                className="shrink-0 h-9 rounded-lg border border-blue-200 bg-blue-50 px-4 text-[11px] font-semibold text-blue-700 transition hover:border-blue-500 hover:bg-blue-100"
                            >
                                + Add Skills / Country
                            </button>
                        </div>
                    </section>

                    {error && (
                        <section className="flex items-start gap-2 bg-[#FFF1F2] border border-red-300 rounded-lg p-2.5 mb-3">
                            <div className="w-7 h-7 rounded-full bg-red-500 text-white flex justify-center items-center font-bold text-xs">!</div>
                            <div>
                                <h3 className="text-red-800 text-xs font-semibold">Upwork API Error</h3>
                                <p className="text-red-600 text-[12px] mt-0.5">{error}</p>
                            </div>
                        </section>
                    )}

                    <section className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 px-4 py-2.5 border-b border-gray-200">
                            <div>
                                <h2 className="text-base font-semibold text-[#101828]">Latest Opportunities</h2>
                                <p className="text-gray-400 text-[12px] mt-0.5">
                                    {!hasSearched ? "Search jobs to view opportunities" : total > 0 ? `Showing ${from}-${to} of ${total} available jobs` : "No jobs found"}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowExportModal(true)}
                                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                                >
                                    Export Excel
                                </button>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={fixedPriceFirst}
                                        onChange={e => handleFixedPriceFirstChange(e.target.checked)}
                                        disabled={loading}
                                        className="w-3.5 h-3.5 disabled:cursor-not-allowed"
                                    />
                                    Fixed Price
                                </label>

                                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hourlyPriceFirst}
                                        onChange={e => handleHourlyPriceFirstChange(e.target.checked)}
                                        disabled={loading}
                                        className="w-3.5 h-3.5 disabled:cursor-not-allowed"
                                    />
                                    Hourly Price
                                </label>

                                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={previousClientFirst}
                                        onChange={e => void handlePreviousClientFirstChange(e.target.checked)}
                                        disabled={loading}
                                        className="w-3.5 h-3.5 disabled:cursor-not-allowed"
                                    />
                                    Previous Client First
                                </label>

                                <span className="text-blue-600 text-xs font-bold">Total: {total}</span>
                            </div>
                        </div>

                        <div className="w-full overflow-hidden">
                            <table className="w-full table-fixed border-collapse text-[11px]"><style>{`td,th{overflow:hidden;text-overflow:ellipsis;} .break-cell{white-space:normal;word-break:break-word;}`}</style>
                                <colgroup>
                                    <col className="w-[6.5%]" />
                                    <col className="w-[5%]" />
                                    <col className="w-[12%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[4%]" />
                                    <col className="w-[6%]" />
                                    <col className="w-[7%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[3%]" />
                                    <col className="w-[3%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[5%]" />
                                    <col className="w-[7.5%]" />
                                </colgroup>

                                <thead className="bg-[#F8FAFC]">
                                    <tr>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("status")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Status <span className="text-[10px]">{getSortIndicator("status")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>Elapsed</th>
                                        <th className={thClass}>Job Title</th>
                                        <th className={thClass}>Description</th>
                                        <th className={thClass}>URL</th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("country")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Country <span className="text-[10px]">{getSortIndicator("country")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>Client</th>
                                        <th className={thClass}>Member Since</th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("published")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Published <span className="text-[10px]">{getSortIndicator("published")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>Activity</th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("feedback")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Fdbk <span className="text-[10px]">{getSortIndicator("feedback")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("applicants")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Appl <span className="text-[10px]">{getSortIndicator("applicants")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("verified")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Verified <span className="text-[10px]">{getSortIndicator("verified")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>Budget</th>

                                        <th className={thClass}>Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {!hasSearched ? (
                                        <tr>
                                            <td colSpan={15} className="py-12 text-center">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                                                        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-gray-800 text-sm font-semibold mt-2">Search Upwork Jobs</h3>
                                                <p className="text-gray-400 text-[11px] mt-1">Select or enter a keyword and click Search Jobs.</p>
                                            </td>
                                        </tr>
                                    ) : loading ? (
                                        <tr>
                                            <td colSpan={15} className="py-12 text-center">
                                                <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                                                <h3 className="mt-2 text-sm font-semibold text-gray-800">Searching Upwork...</h3>
                                                <p className="text-gray-400 text-[12px] mt-1">Fetching latest opportunities.</p>
                                            </td>
                                        </tr>
                                    ) : jobs.length === 0 ? (
                                        <tr>
                                            <td colSpan={15} className="py-12 text-center">
                                                <h3 className="text-gray-800 text-sm font-semibold">No jobs found</h3>
                                                <p className="text-gray-400 text-[12px] mt-1">Try searching another keyword.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedJobs.map(job => {
                                            const verified = isVerified(job.client?.verificationStatus);
                                            const jobUrl = getJobUrl(job);
                                            return (
                                                <tr key={job.id} className="border-t border-gray-100 hover:bg-blue-50/40 transition">
                                                    <td className="px-1.5 py-2 align-top">
                                                        <div className="flex flex-col items-start gap-1">
                                                            {job.applied && (
                                                                <span className="whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-[12px] font-semibold text-green-700">
                                                                    Applied
                                                                </span>
                                                            )}
                                                            {isFeaturedJob(job) && (
                                                                <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-700">
                                                                    Featured
                                                                </span>
                                                            )}
                                                            {isPreviousClientJob(job) && (
                                                                <span className="whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-[12px] font-semibold text-blue-700">
                                                                    Previous Client
                                                                </span>
                                                            )}
                                                            {!job.applied && !isFeaturedJob(job) && !isPreviousClientJob(job) && (
                                                                <span className="text-[11px] text-gray-400">N/A</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] text-red-500 whitespace-normal">
                                                        {getElapsedTime(job.publishedDateTime)}
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top break-words">
                                                        <h3 className="text-[11px] font-medium text-gray-900 leading-[15px]">{job.title || "Untitled Job"}</h3>
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] text-gray-700 break-words">
                                                        {job.description ? `${job.description.slice(0, 150)}${job.description.length > 150 ? "..." : ""}` : "-"}
                                                    </td>

                                                    <td className={cellClass}>
                                                        {jobUrl ? (
                                                            <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-[11px] whitespace-nowrap">
                                                                View Job
                                                            </a>
                                                        ) : "-"}
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] text-gray-900 break-words">
                                                        {job.client?.location?.country || "-"}
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top">
                                                        <div className="flex flex-col gap-0 text-[11px] leading-[15px]">
                                                            <span className="text-gray-900">
                                                                {job.client?.totalPostedJobs ?? 0} {(job.client?.totalPostedJobs ?? 0) === 1 ? "job" : "jobs"} posted
                                                            </span>
                                                            <span className="text-gray-500">
                                                                {job.client?.totalSpent?.displayValue ? `${job.client.totalSpent.displayValue} spent` : "$0 spent"}
                                                            </span>
                                                            <span className="text-gray-500">
                                                                {job.client?.totalHires ?? 0} {(job.client?.totalHires ?? 0) === 1 ? "hire" : "hires"}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] whitespace-nowrap">
                                                        {formatMemberSince(job.client?.memberSinceDateTime)}
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] whitespace-normal">{formatDate(job.publishedDateTime)}</td>

                                                    <td className="px-1.5 py-2 align-top">
                                                        <div className="flex flex-col gap-0 text-[11px] leading-[14px]">
                                                            <span>Proposals: {getProposalRange(job.totalApplicants)}</span>
                                                            <span>Interviewing: {job.activity?.totalInvitedToInterview ?? 0}</span>
                                                            <span>Invites: {job.activity?.invitesSent ?? 0}</span>
                                                            <span>Unanswered: {job.activity?.totalUnansweredInvites ?? 0}</span>
                                                        </div>
                                                    </td>

                                                    <td className="px-1 py-2 align-top text-center text-[11px] leading-[15px]">{job.client?.totalFeedback ?? 0}</td>

                                                    <td className="px-1 py-2 align-top text-center text-[11px] leading-[15px]">{job.totalApplicants ?? 0}</td>

                                                    <td className="px-1.5 py-2 align-top">
                                                        <span className={`text-[11px] leading-[15px] font-medium ${verified ? "text-green-600" : "text-gray-500"}`}>
                                                            {verified ? "Verified" : "Unverified"}
                                                        </span>
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] whitespace-normal break-words">{getBudget(job)}</td>

                                                    <td className="px-1.5 py-2 align-top">
                                                        <div className="flex flex-col gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => analyzeJob(job)}
                                                                disabled={analyzing && selectedJob?.id === job.id}
                                                                className="w-full rounded-md bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                                                            >
                                                                {analyzing && selectedJob?.id === job.id
                                                                    ? "Analyzing..."
                                                                    : "AI Proposal"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => addToQueue(job)}
                                                                disabled={
                                                                    queuedJobIds.includes(job.id) ||
                                                                    queueLoadingIds.includes(job.id)
                                                                }
                                                                className={`w-full rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${queuedJobIds.includes(job.id)
                                                                    ? "cursor-default border border-green-200 bg-green-50 text-green-700"
                                                                    : queueLoadingIds.includes(job.id)
                                                                        ? "cursor-wait border border-blue-200 bg-blue-50 text-blue-600"
                                                                        : "border border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                                                                    }`}
                                                            >
                                                                {queuedJobIds.includes(job.id)
                                                                    ? "✓ Queued"
                                                                    : queueLoadingIds.includes(job.id)
                                                                        ? "Adding..."
                                                                        : "+ Add To Queue"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {hasSearched && !loading && jobs.length > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 bg-[#F8FAFC] px-3 py-3">
                                <p className="text-[11px] text-gray-500">
                                    Showing <span className="font-semibold text-gray-800">{from}</span>–
                                    <span className="font-semibold text-gray-800">{to}</span> of{" "}
                                    <span className="font-semibold text-gray-800">{total}</span> jobs
                                </p>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={goToPreviousPage}
                                        disabled={loading || currentPage <= 1}
                                        className="h-8 rounded-md border border-gray-300 bg-white px-3 text-[11px] font-semibold text-gray-700 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        ← Previous
                                    </button>

                                    <div className="flex h-8 items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-[11px] font-semibold text-blue-700">
                                        Page {currentPage} of {totalPages}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={goToNextPage}
                                        disabled={loading || !pageInfo.hasNextPage}
                                        className="h-8 rounded-md bg-blue-600 px-3 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </main>


            {showExportModal && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
                    onClick={() => setShowExportModal(false)}
                >
                    <div
                        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">
                                Export Columns
                            </h2>

                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[350px] overflow-y-auto">
                            {exportColumns.map(column => (
                                <label
                                    key={column.key}
                                    className="flex items-center gap-2 text-sm text-gray-700"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedExportColumns.includes(column.key)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedExportColumns([
                                                    ...selectedExportColumns,
                                                    column.key
                                                ]);
                                            } else {
                                                setSelectedExportColumns(
                                                    selectedExportColumns.filter(
                                                        item => item !== column.key
                                                    )
                                                );
                                            }
                                        }}
                                    />
                                    {column.label}
                                </label>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={exportToExcel}
                            disabled={!selectedExportColumns.length}
                            className="mt-5 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:bg-gray-300"
                        >
                            Export Selected Columns
                        </button>
                    </div>
                </div>
            )}

            {showAddOptionModal && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-[2px]"
                    onClick={closeAddOptionModal}
                >
                    <div
                        className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                            <div className="pr-5">
                                <div className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-bold uppercase tracking-[1px] text-blue-700">
                                    Manage Search Options
                                </div>

                                <h2 className="text-xl font-bold tracking-tight text-gray-900">
                                    Add Skills / Country
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={closeAddOptionModal}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-lg text-gray-400 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <div className="px-6 py-5">
                            {/* Option selector */}
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-500">
                                What would you like to add?
                            </p>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {/* Country */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddOptionType("country");
                                        setNewOptionValue("");
                                        setAddOptionError("");
                                    }}
                                    className={`group relative rounded-xl border p-4 text-left transition-all ${addOptionType === "country"
                                        ? "border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600"
                                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${addOptionType === "country"
                                                ? "bg-blue-600 text-white"
                                                : "bg-blue-50 text-blue-600"
                                                }`}
                                        >
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <circle cx="12" cy="12" r="9" />
                                                <path d="M3 12h18" />
                                                <path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9" />
                                                <path d="M12 3c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9" />
                                            </svg>
                                        </div>

                                        <div>
                                            <div className="text-sm font-bold text-gray-900">
                                                Add Country
                                            </div>

                                            <div className="mt-1 text-[11px] leading-4 text-gray-500">
                                                Add another location to your country filters.
                                            </div>
                                        </div>
                                    </div>

                                    {addOptionType === "country" && (
                                        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[12px] font-bold text-white">
                                            ✓
                                        </span>
                                    )}
                                </button>

                                {/* Skill */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddOptionType("skill");
                                        setNewOptionValue("");
                                        setAddOptionError("");
                                    }}
                                    className={`group relative rounded-xl border p-4 text-left transition-all ${addOptionType === "skill"
                                        ? "border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600"
                                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${addOptionType === "skill"
                                                ? "bg-blue-600 text-white"
                                                : "bg-violet-50 text-violet-600"
                                                }`}
                                        >
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <path d="M12 3v18" />
                                                <path d="M3 12h18" />
                                                <path d="m5.5 5.5 13 13" />
                                                <path d="m18.5 5.5-13 13" />
                                            </svg>
                                        </div>

                                        <div>
                                            <div className="text-sm font-bold text-gray-900">
                                                Add Skill
                                            </div>

                                            <div className="mt-1 text-[11px] leading-4 text-gray-500">
                                                Add another skill to your quick-search options.
                                            </div>
                                        </div>
                                    </div>

                                    {addOptionType === "skill" && (
                                        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[12px] font-bold text-white">
                                            ✓
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Empty state */}
                            {!addOptionType && (
                                <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
                                    <p className="text-xs font-medium text-gray-600">
                                        Select an option above to continue
                                    </p>
                                </div>
                            )}

                            {/* Input section */}
                            {addOptionType && (
                                <div className="mt-5 rounded-xl border border-gray-200 bg-slate-50 p-4">
                                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                                        {addOptionType === "country"
                                            ? "Country Name"
                                            : "Skill Name"}
                                    </label>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            autoFocus
                                            value={newOptionValue}
                                            onChange={e => {
                                                setNewOptionValue(e.target.value);
                                                setAddOptionError("");
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") addCountryOrSkill();
                                            }}
                                            placeholder={
                                                addOptionType === "country"
                                                    ? "Example: Brazil"
                                                    : "Example: WordPress"
                                            }
                                            className={`h-11 w-full rounded-lg border bg-white px-3 pr-10 text-sm text-gray-900 outline-none transition ${addOptionError
                                                ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                                : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                }`}
                                        />

                                        {newOptionValue.trim() && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewOptionValue("");
                                                    setAddOptionError("");
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-gray-400 hover:text-gray-700"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>

                                    <p className="mt-1.5 text-[12px] text-gray-400">
                                        {addOptionType === "country"
                                            ? "This country will appear in your country filter list."
                                            : "This skill will appear in your Quick Search options."}
                                    </p>

                                    {addOptionError && (
                                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                                            <span className="mt-[1px] text-xs font-bold text-red-500">
                                                !
                                            </span>

                                            <p className="text-[11px] font-medium text-red-600">
                                                {addOptionError}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/80 px-6 py-4">

                            <div className="ml-auto flex gap-2">
                                <button
                                    type="button"
                                    onClick={closeAddOptionModal}
                                    className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={addCountryOrSkill}
                                    disabled={optionSaving || !addOptionType || !newOptionValue.trim()}
                                    className="h-10 min-w-[120px] rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                    {optionSaving
                                        ? "Saving..."
                                        : addOptionType === "country"
                                            ? "Add Country"
                                            : addOptionType === "skill"
                                                ? "Add Skill"
                                                : "Add"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showModal && selectedJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-8" onClick={closeModal}>
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 text-gray-900 shadow-2xl md:p-8" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-600">AI Report</p>
                                <h2 className="mt-1 text-2xl font-bold">AI Opportunity Analysis</h2>
                            </div>
                            <button type="button" onClick={closeModal} className="text-2xl text-gray-500 transition hover:text-black" aria-label="Close">×</button>
                        </div>

                        <h3 className="mt-5 text-base font-semibold">{selectedJob.title || "Untitled Job"}</h3>
                        <p className="mt-1 text-xs text-gray-500">{getBudget(selectedJob)}</p>

                        {analyzing ? (
                            <div className="py-14 text-center">
                                <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                                <p className="mt-4 font-medium text-blue-600">AI is analyzing this opportunity...</p>
                                <p className="mt-1 text-xs text-gray-500">Reviewing the scope, skills, pain points and opportunity fit.</p>
                            </div>
                        ) : aiReport?.error ? (
                            <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{aiReport.error}</div>
                        ) : aiReport ? (
                            <div className="mt-6">
                                {!aiReport.relevant ? (
                                    <div className="rounded-xl bg-yellow-50 p-5 text-yellow-700">
                                        <h3 className="font-bold">Not Recommended</h3>
                                        <p className="mt-2 text-sm">{aiReport.reason}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-xl bg-blue-50 p-5">
                                            <h3 className="text-lg font-bold text-blue-700">Generated Proposal</h3>
                                            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">{aiReport.proposal}</p>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        if (navigator.clipboard) await navigator.clipboard.writeText(aiReport.proposal || "");
                                                        alert("Proposal copied!");
                                                    } catch (err) {
                                                        console.error("Copy failed:", err);
                                                    }
                                                }}
                                                className="rounded-full bg-black px-5 py-2.5 text-sm text-white transition hover:bg-gray-800"
                                            >
                                                Copy Proposal
                                            </button>

                                            {getJobUrl(selectedJob) && (
                                                <a
                                                    href={getJobUrl(selectedJob)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-full bg-blue-600 px-5 py-2.5 text-sm text-white transition hover:bg-blue-700"
                                                >
                                                    Open Job URL
                                                </a>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="min-w-[100px] bg-[#16214A] border border-white/10 rounded-lg px-3 py-2 shadow-lg">
            <p className="text-gray-400 text-[9px]">{label}</p>
            <h2 className="text-white text-lg leading-5 font-bold mt-0.5">{value}</h2>
        </div>
    );
}

const thClass = "px-1.5 py-2 text-left text-[12px] leading-[13px] font-semibold tracking-[0.2px] text-gray-600 whitespace-nowrap align-middle";
const cellClass = "px-1.5 py-2 align-top text-[11px] leading-[15px] text-gray-800 whitespace-nowrap";