"use client";

import { useEffect, useState, useRef } from "react";
import SearchOptionsModal, { type SearchOptionChange, } from "../../../components/SearchOptionsModal";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import * as XLSX from "xlsx";

type ProjectBadgeFlag = boolean | number | string | null | undefined;

type ProjectUpgradeFlags = Record<string, ProjectBadgeFlag>;

type Job = {
    id: string;
    projectCountry?: string;
    title?: string;
    description?: string;
    ciphertext?: string;
    url?: string;
    applied?: boolean | null;
    premium?: boolean;
    isFeatured?: boolean;
    isRecruiter?: ProjectBadgeFlag;
    isNDA?: ProjectBadgeFlag;
    isSealed?: ProjectBadgeFlag;
    isUrgent?: ProjectBadgeFlag;
    isPrivate?: ProjectBadgeFlag;
    isFullTime?: ProjectBadgeFlag;
    isIPAgreement?: ProjectBadgeFlag;
    recruiter?: ProjectBadgeFlag;
    featured?: ProjectBadgeFlag;
    NDA?: ProjectBadgeFlag;
    nda?: ProjectBadgeFlag;
    sealed?: ProjectBadgeFlag;
    urgent?: ProjectBadgeFlag;
    nonpublic?: ProjectBadgeFlag;
    fulltime?: ProjectBadgeFlag;
    assisted?: ProjectBadgeFlag;
    ip_contract?: ProjectBadgeFlag;
    ip_agreement?: ProjectBadgeFlag;
    upgrades?: ProjectUpgradeFlags;
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
    bidCount?: number;
    averageBid?: number;
    averageBidDisplay?: string;
    projectStatus?: string;
    currency?: string;
    rawProject?: Record<string, unknown>;
    rawClient?: Record<string, unknown> | null;
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
    preferredQualifications?: {
        contractorType?: string | null;
        englishProficiency?: string | null;
        hasPortfolio?: boolean;
        hoursWorked?: number;
        jobSuccessScore?: number | null;
        minEarning?: string | null;
        risingTalent?: boolean;
        location?: { country?: string | null; city?: string | null; } | string | null;
    };
};

type AIReport = { relevant: boolean; proposal?: string; reason?: string; error?: string };
type PaymentFilter = "all" | "verified" | "unverified";
type SortColumn = "status" | "preferredAttributes" | "elapsed" | "country" | "feedback" | "applicants" | "proposals" | "verified" | "budget" | "published" | "averageBid" | "memberSince";
type SortDirection = "desc" | "asc";
type SavedFilter = {
    _id?: string;
    id: number;
    name: string;
    countries: string[];
    skills: string[];
    paymentVerified: PaymentFilter;
    applicantRange: string;
    postedDays: string;
    search: string;
};

const PAGE_SIZE = 50;
const applicantOptions = [
    { value: "all", label: "Any applicants" },
    { value: "0-19", label: "0 - 20" },
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
]


export default function FreelancerJobsPage() {

    const [filterCollapsed, setFilterCollapsed] = useState(false);
    const [search, setSearch] = useState("");
    const [searchMode, setSearchMode] = useState<"manual" | "quick" | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [searchProgress, setSearchProgress] = useState(0);
    const searchAbortRef = useRef<AbortController | null>(null);
    const [copiedDescriptionId, setCopiedDescriptionId] = useState<string | null>(null);
    const descriptionCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const analysisAbortRef = useRef<AbortController | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        return () => {
            const controller = searchAbortRef.current;
            searchAbortRef.current = null;
            controller?.abort();
            analysisAbortRef.current?.abort();
            if (copyTimer.current) clearTimeout(copyTimer.current);
            if (descriptionCopyTimer.current) clearTimeout(descriptionCopyTimer.current);
        };
    }, []);

    function stopSearch() {
        const controller = searchAbortRef.current;
        searchAbortRef.current = null;
        controller?.abort();
        setLoading(false);
        setEnriching(false);
    }
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
    const [skillOptions, setSkillOptions] = useState<string[]>([]);
    const [countryOptions, setCountryOptions] = useState<string[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [paymentVerified, setPaymentVerified] = useState<PaymentFilter>("all");
    const [applicantRange, setApplicantRange] = useState("all");
    const [postedDays, setPostedDays] = useState("3");
    const [showAddOptionModal, setShowAddOptionModal] = useState(false);
    const [queuedJobIds, setQueuedJobIds] = useState<string[]>([]);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [queueLoadingIds, setQueueLoadingIds] = useState<string[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);
    const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
    const [selectedSavedFilter, setSelectedSavedFilter] = useState("");
    const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
    const [newFilterName, setNewFilterName] = useState("");

    const exportColumns = [
        { key: "status", label: "Status" },
        { key: "preferredQualifications", label: "Preferred Qualifications" },
        { key: "elapsed", label: "Elapsed" },
        { key: "title", label: "Job Title" },
        { key: "description", label: "Description" },
        { key: "url", label: "URL" },
        { key: "country", label: "Country" },
        { key: "client", label: "Client" },
        { key: "published", label: "Published" },
        { key: "activity", label: "Activity" },
        { key: "feedback", label: "Feedback" },
        { key: "applicants", label: "Bids" },
        { key: "averageBid", label: "Average Bid" },
        { key: "memberSince", label: "Member Since" },
        { key: "verified", label: "Verified" },
        { key: "budget", label: "Budget" }
    ];

    const [selectedExportColumns, setSelectedExportColumns] = useState([
        "title",
        "description",
        "url"
    ]);


    const allCountriesSelected = countryOptions.length > 0 && selectedCountries.length === countryOptions.length;

    function loadSavedFilters() {
        try {
            const stored = JSON.parse(localStorage.getItem("phoenix:freelancer:saved-filters:v1") || "[]");
            if (!Array.isArray(stored)) return;
            setSavedFilters(stored.filter((filter: SavedFilter) =>
                filter && typeof filter.id === "number" && typeof filter.name === "string" &&
                Array.isArray(filter.countries) && filter.countries.every(item => typeof item === "string") &&
                Array.isArray(filter.skills) && filter.skills.every(item => typeof item === "string") &&
                ["all", "verified", "unverified"].includes(filter.paymentVerified) &&
                typeof filter.applicantRange === "string" && typeof filter.postedDays === "string" &&
                typeof filter.search === "string"
            ));
        } catch (error) {
            console.error("LOAD SAVED FILTER ERROR", error);
        }
    }

    useEffect(() => {
        void loadSearchOptions();
        void loadQueue();
        void loadSavedFilters();
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
            const response = await fetch("/api/freelancer/queue", {
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

    // Publish every page as it arrives; enrich details without blocking results.
    async function searchJobs(
        _page = 1,
        _cursor = "0",
        keyword?: string,
        _previousClientFirstOverride?: boolean,
        selectedSkillsOverride?: string[],
        filterOverride?: SavedFilter
    ) {
        const searchKeyword = (keyword ?? filterOverride?.search ?? search).trim();
        const activeSkills = selectedSkillsOverride ?? filterOverride?.skills ?? selectedSkills;
        // With text, search the text and match ANY selected skill. Without text,
        // search each selected skill, then merge results by project ID.
        const queries = [...new Set((searchKeyword ? [searchKeyword] :
            activeSkills.length ? activeSkills : [""]).map(q => q.trim()))];
        searchAbortRef.current?.abort();
        const controller = new AbortController();
        searchAbortRef.current = controller;
        const isCurrentSearch = () =>
            !controller.signal.aborted && searchAbortRef.current === controller;
        setHasSearched(true);
        setLoading(true);
        setEnriching(false);
        setSearchProgress(0);
        setError("");
        setCurrentPage(1);
        setJobs([]);
        const allJobs = new Map<string, Job>();
        const enrichmentScheduled = new Set<string>();
        const enrichmentLanes: Promise<void>[] = [Promise.resolve(), Promise.resolve()];
        let lane = 0;
        let loadedPages = 0;
        const warnings = new Set<string>();
        const publish = () => {
            if (isCurrentSearch()) setJobs(Array.from(allJobs.values()));
        };
        async function readResponse(response: Response) {
            const raw = await response.text();
            let data: any;
            try { data = JSON.parse(raw); }
            catch { throw new Error(`Freelancer API returned an invalid response (${response.status}).`); }
            if (data?.reauthRequired === true || data?.error === "FREELANCER_REAUTH_REQUIRED") {
                throw new Error(data?.reauthReason || "Please reconnect your Freelancer account.");
            }
            if (!response.ok || !data?.success) {
                throw new Error(typeof data?.message === "string" ? data.message :
                    typeof data?.error === "string" ? data.error : "Unable to search Freelancer jobs.");
            }
            if (!Array.isArray(data.jobs)) throw new Error("The API returned an invalid jobs list.");
            return data;
        }
        function scheduleEnrichment(ids: string[]) {
            for (let start = 0; start < ids.length; start += 8) {
                const chunk = ids.slice(start, start + 8);
                const target = lane++ % enrichmentLanes.length;
                enrichmentLanes[target] = enrichmentLanes[target].then(async () => {
                    if (!isCurrentSearch()) return;
                    setEnriching(true);
                    try {
                        const params = new URLSearchParams({ mode: "enrich", ids: chunk.join(",") });
                        const response = await fetch(`/api/freelancer/jobs?${params}`, {
                            cache: "no-store", signal: controller.signal
                        });
                        const data = await readResponse(response);
                        if (!isCurrentSearch()) return;
                        for (const details of data.jobs as Job[]) {
                            const id = String(details.id);
                            const existing = allJobs.get(id);
                            if (!existing) continue;
                            // Do not replace known data with missing enrichment fields.
                            const mergeDefined = (base: any, update: any): any => {
                                const result = { ...(base || {}) };
                                for (const [key, value] of Object.entries(update || {})) {
                                    if (value == null || value === "") continue;
                                    result[key] = typeof value === "object" && !Array.isArray(value)
                                        ? mergeDefined(result[key], value) : value;
                                }
                                return result;
                            };
                            allJobs.set(id, mergeDefined(existing, details));
                        }
                        publish();
                    } catch (err) {
                        if (isCurrentSearch()) warnings.add("Some client details or application statuses could not be loaded.");
                    }
                });
            }
        }
        async function searchQuery(query: string) {
            const params = new URLSearchParams({ q: query, first: String(PAGE_SIZE), after: "0" });
            if (activeSkills.length) params.set("skills", activeSkills.join(","));
            // Keep editable date filters local so changing them can reveal loaded jobs.
            const visitedCursors = new Set<string>();
            const seenRawIds = new Set<string>();
            let cursor = "0";
            while (isCurrentSearch()) {
                if (visitedCursors.has(cursor)) throw new Error("The API repeated a page cursor. Loaded results have been kept.");
                visitedCursors.add(cursor);
                params.set("after", cursor);
                const response = await fetch(`/api/freelancer/jobs?${params}`, {
                    cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" }
                });
                const data = await readResponse(response);
                if (!isCurrentSearch()) return;
                const rawIds: string[] = Array.isArray(data.rawIds) ? data.rawIds.map(String) : data.jobs.map((j: Job) => String(j.id));
                if (rawIds.length && rawIds.every(id => seenRawIds.has(id))) {
                    throw new Error("Freelancer repeated a results page. Loaded results have been kept.");
                }
                rawIds.forEach(id => seenRawIds.add(id));
                const newIds: string[] = [];
                for (const job of data.jobs as Job[]) {
                    const id = String(job.id);
                    // Another query may already have enriched this project.
                    if (!allJobs.has(id)) allJobs.set(id, { ...job, id });
                    if (!enrichmentScheduled.has(id)) {
                        enrichmentScheduled.add(id);
                        newIds.push(id);
                    }
                }
                loadedPages++;
                setSearchProgress(loadedPages);
                publish();
                scheduleEnrichment(newIds);
                if (data.pageInfo?.hasNextPage !== true) return;
                const next = data.pageInfo?.endCursor;
                if (next == null || !Number.isFinite(Number(next)) || Number(next) <= Number(cursor)) {
                    throw new Error("The API returned an invalid next-page cursor. Loaded results have been kept.");
                }
                cursor = String(next);
            }
        }
        try {
            let queryIndex = 0;
            // Limit concurrent searches to avoid flooding the upstream API.
            const workers = Array.from({ length: Math.min(2, queries.length) }, async () => {
                while (queryIndex < queries.length && isCurrentSearch()) {
                    const query = queries[queryIndex++];
                    try { await searchQuery(query); }
                    catch (err) {
                        if (isCurrentSearch()) warnings.add(err instanceof Error ? err.message : "Unable to load all jobs.");
                    }
                }
            });
            await Promise.all(workers);
            if (!isCurrentSearch()) return;
            setSearch(searchKeyword);
            setLoading(false);
            if (warnings.size) setError(Array.from(warnings).join(" "));
            // Continue client/application lookups after search finishes.
            await Promise.all(enrichmentLanes);
            if (isCurrentSearch() && warnings.size) setError(Array.from(warnings).join(" "));
        } finally {
            if (searchAbortRef.current === controller) {
                searchAbortRef.current = null;
                setLoading(false);
                setEnriching(false);
            }
        }
    }

    function goToNextPage() {
        if (currentPage >= totalPages) return;
        setCurrentPage(page => Math.min(page + 1, totalPages));
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function goToPreviousPage() {
        if (currentPage <= 1) return;
        setCurrentPage(page => Math.max(1, page - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function handleQuickSearch(keyword: string, skills: string[] = []) {

        setSearchMode("quick");

        setSearch(keyword);

        setSelectedSkills(skills);


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

    function saveCurrentFilter() {
        const name = newFilterName.trim();
        if (!name) { alert("Enter filter name"); return; }
        try {
            const filter: SavedFilter = {
                id: Date.now(), name,
                countries: [...selectedCountries], skills: [...selectedSkills],
                paymentVerified, applicantRange, postedDays, search
            };
            const updated = [filter, ...savedFilters];
            localStorage.setItem("phoenix:freelancer:saved-filters:v1", JSON.stringify(updated));
            setSavedFilters(updated);
            setSelectedSavedFilter(String(filter.id));
            setNewFilterName("");
            setShowSaveFilterModal(false);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Unable to save filter");
        }
    }

    function applySavedFilter(id: string) {
        const filter = savedFilters.find(item => item._id === id || String(item.id) === id);
        if (!filter) return;
        setSelectedCountries([...filter.countries]);
        setSelectedSkills([...filter.skills]);
        setPaymentVerified(filter.paymentVerified);
        setApplicantRange(filter.applicantRange);
        setPostedDays(filter.postedDays);
        setSearch(filter.search);
        setSearchMode(filter.skills.length ? "quick" : "manual");
        void searchJobs(1, "0", filter.search, undefined, filter.skills, filter);
    }

    function clearFilters() {
        setSelectedSavedFilter("");
        setSearch("");
        setSearchMode(null);
        setSelectedCountries([...countryOptions]);
        setSelectedSkills([]);
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

    function handlePreviousClientFirstChange(checked: boolean) {
        setPreviousClientFirst(checked);
    }

    function openAddOptionModal() {
        setShowAddOptionModal(true);
    }

    function closeAddOptionModal() {
        setShowAddOptionModal(false);
    }

    async function handleSearchOptionChange(change: SearchOptionChange) {
        const updateSelected = (current: string[]) => {
            if (change.action === "delete") {
                return current.filter(name => name !== change.name);
            }
            if (change.action === "update") {
                return [...new Set(current.map(name =>
                    name === change.oldName ? change.name : name
                ))];
            }
            return current;
        };
        const updateOptions = (current: string[]) => {
            const values = change.action === "add"
                ? [...new Set([...current, change.name])]
                : updateSelected(current);
            return [...values].sort((a, b) => a.localeCompare(b));
        };
        if (change.type === "country") {
            setCountryOptions(updateOptions);
            setSelectedCountries(updateSelected);
        } else {
            setSkillOptions(updateOptions);
            setSelectedSkills(updateSelected);
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

    function isEnabledBadgeFlag(value: ProjectBadgeFlag) {
        return value === true || value === 1 ||
            (typeof value === "string" && ["true", "1"].includes(value.trim().toLowerCase()));
    }

    function getProjectBadgeLabels(job: Job): string[] {
        const labels = new Set<string>();

        const aliases: Record<string, string> = {
            recruiter: "Recruiter",
            assisted: "Recruiter",
            unpaidrecruiter: "Recruiter",
            isrecruiter: "Recruiter",
            ipcontract: "IP Agreement",
            ipagreement: "IP Agreement",
            isipagreement: "IP Agreement",
            nda: "NDA",
            isnda: "NDA",
            sealed: "Sealed",
            issealed: "Sealed",
            urgent: "Urgent",
            isurgent: "Urgent",
            featured: "Featured",
            isfeatured: "Featured",
            nonpublic: "Private",
            private: "Private",
            isprivate: "Private",
            fulltime: "Full Time",
            isfulltime: "Full Time",
            noncompete: "Non Compete",
            pfonly: "Preferred Freelancer Only",
            premium: "Premium",
            enterprise: "Enterprise",
            qualified: "Qualified",
            projectmanagement: "Project Management",
            successbundle: "Success Bundle"
        };

        const asRecord = (value: unknown): Record<string, unknown> =>
            value && typeof value === "object" && !Array.isArray(value)
                ? value as Record<string, unknown>
                : {};

        const isEnabled = (value: unknown) =>
            value === true ||
            value === 1 ||
            (typeof value === "string" &&
                ["true", "1"].includes(value.trim().toLowerCase()));

        const addFlags = (
            source: Record<string, unknown>,
            allowUnknown: boolean
        ) => {
            Object.entries(source).forEach(([key, value]) => {
                if (!isEnabled(value)) return;

                const normalized = key.replace(/[_\s-]/g, "").toLowerCase();
                const knownLabel = aliases[normalized];

                if (knownLabel) {
                    labels.add(knownLabel);
                } else if (allowUnknown) {
                    labels.add(
                        key
                            .replace(/([a-z])([A-Z])/g, "$1 $2")
                            .replace(/[_-]+/g, " ")
                            .replace(/\b\w/g, letter => letter.toUpperCase())
                    );
                }
            });
        };

        const raw = asRecord(job.rawProject);

        addFlags(asRecord(job), false);
        addFlags(asRecord(job.upgrades), true);
        addFlags(raw, false);
        addFlags(asRecord(raw.upgrades), true);

        return [...labels];
    }

    function getApplicationLabel(job: Job) {
        if (job.applied === true) return "Applied";
        return "Not applied";
    }

    function getStatusLabels(job: Job) {
        return [
            ...(job.projectStatus ? [job.projectStatus] : []),
            getApplicationLabel(job),
            ...getProjectBadgeLabels(job),
            ...(isPreviousClientJob(job) ? ["Previous Client"] : [])
        ];
    }

    function getStatusBadgeClass(label: string) {
        switch (label) {
            case "Applied": return "bg-green-100 text-green-700";
            case "Not applied": return "bg-gray-100 text-gray-600";
            case "Recruiter": return "bg-purple-600 text-white";
            case "Featured": return "bg-amber-50 text-amber-700";
            case "NDA": return "bg-blue-600 text-white";
            case "Sealed": return "bg-sky-500 text-white";
            case "Urgent": return "bg-red-50 text-red-700";
            case "Private": return "bg-amber-400 text-gray-900";
            case "IP Agreement": return "bg-pink-800 text-white";
            case "Previous Client": return "bg-blue-50 text-blue-700";
            default: return "bg-slate-100 text-slate-700";
        }
    }

    function isFeaturedJob(job: Job) {
        return getProjectBadgeLabels(job).includes("Featured");
    }

    function isPreviousClientJob(job: Job) {
        return job.isPreviousClient === true || Boolean(job.freelancerClientRelation);
    }

    function getStatusText(job: Job) {
        const statuses = getStatusLabels(job);
        return statuses.length ? statuses.join(", ") : "N/A";
    }

    function getStatusSortValue(job: Job) {
        const applicationRank = job.applied === true ? 2 : job.applied === false ? 1 : 0;
        return applicationRank;
    }

    function compareText(a: string, b: string) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    }

    function getJobCountry(job: Job) {
        return job.projectCountry || job.client?.location?.country || "";
    }

    function getProposalRange(totalApplicants?: number) {
        return totalApplicants == null ? "-" : String(totalApplicants);
    }

    function getJobUrl(job: Job) {
        if (job.url) return job.url;
        if (!job.ciphertext) return "";
        const code = job.ciphertext.startsWith("~") ? job.ciphertext : `~${job.ciphertext}`;
        return `https://www.freelancer.com/projects/${code}`;
    }

    async function analyzeJob(job: Job) {
        analysisAbortRef.current?.abort();
        const controller = new AbortController();
        analysisAbortRef.current = controller;
        setSelectedJob(job);
        setShowModal(true);
        setAnalyzing(true);
        setAiReport(null);

        try {
            // Select the platform and skill BEFORE requesting a proposal.
            const promptResponse = await fetch("/api/prompts", {
                cache: "no-store",
                signal: controller.signal
            });
            const promptData = await promptResponse.json();
            if (!promptResponse.ok) {
                throw new Error(promptData?.error || "Unable to load proposal prompts.");
            }
            if (controller.signal.aborted || analysisAbortRef.current !== controller) return;

            type ProposalPrompt = {
                _id: string;
                skillId?: string;
                skillName?: string;
                promptFor?: string;
                prompt?: string;
                active?: boolean;
            };
            const prompts: ProposalPrompt[] = Array.isArray(promptData)
                ? promptData
                : Array.isArray(promptData?.prompts) ? promptData.prompts : [];
            const normalize = (value: string) => value.trim().toLowerCase();
            const availablePrompts = prompts.filter(item =>
                item.promptFor === "Freelancer" &&
                item.active === true &&
                typeof item.prompt === "string" && item.prompt.trim().length > 0
            );
            // Match selected search skills in their existing order. If none are
            // selected, an exact skill entered in the search box can be used.
            const searchSkills = selectedSkills.length
                ? selectedSkills
                : search.trim() ? [search.trim()] : [];
            if (!searchSkills.length) {
                throw new Error("Select a search skill before generating an AI proposal.");
            }
            let matchedPrompt: ProposalPrompt | undefined;
            for (const searchSkill of searchSkills) {
                matchedPrompt = availablePrompts.find(item =>
                    normalize(item.skillId || item.skillName || "") === normalize(searchSkill)
                );
                if (matchedPrompt) break;
            }
            if (!matchedPrompt) {
                throw new Error(`No active Freelancer prompt matches these search skills: ${searchSkills.join(", ")}.`);
            }

            const skill = matchedPrompt.skillId || matchedPrompt.skillName || "";
            const activity = [
                `Proposals: ${getProposalRange(job.bidCount ?? job.totalApplicants)}`,
                `Interviewing: ${job.activity?.totalInvitedToInterview ?? 0}`,
                `Invites: ${job.activity?.invitesSent ?? 0}`,
                `Unanswered: ${job.activity?.totalUnansweredInvites ?? 0}`,
                `Hired: ${job.activity?.totalHired ?? 0}`
            ].join(", ");
            const analysisJob = {
                Skill: skill,
                Title: job.title || "Untitled Job",
                Description: job.description || "",
                Budget: getBudget(job),
                Status: getStatusText(job),
                PublishedDate: formatDate(job.publishedDateTime),
                Activity: activity,
                URL: getJobUrl(job)
            };

            const response = await fetch("/api/analyze-groq", {
                signal: controller.signal,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    job: analysisJob,
                    promptFor: "Freelancer",
                    skill,
                    selectedSkills: searchSkills,
                    promptId: matchedPrompt._id,
                    prompt: matchedPrompt.prompt
                })
            });
            const data = await response.json();
            if (!response.ok || data?.error) {
                throw new Error(data?.error || "AI analysis failed.");
            }
            if (analysisAbortRef.current === controller && !controller.signal.aborted) {
                setAiReport(data);
            }
        } catch (err) {
            if (controller.signal.aborted || analysisAbortRef.current !== controller) return;
            setAiReport({
                relevant: false,
                error: err instanceof Error ? err.message : "Unable to generate this proposal."
            });
        } finally {
            if (analysisAbortRef.current === controller) {
                analysisAbortRef.current = null;
                setAnalyzing(false);
            }
        }
    }

    function getFeedbackText(job: Job): string {
        const rating = job.client?.totalFeedback;
        const reviews = job.client?.totalReviews;
        if (rating == null && reviews == null) return "N/A";
        return `${rating == null ? "N/A" : rating.toFixed(1)} out of ${reviews == null ? "N/A" : reviews}`;
    }

    function getPreferredQualificationText(job: Job): string {
        const items = getProjectBadgeLabels(job);
        const pq = job.preferredQualifications;
        if (!pq) return items.length ? items.join("\n") : "-";
        if (pq.location) {
            const location = typeof pq.location === "string" ? pq.location :
                [pq.location.city, pq.location.country].filter(Boolean).join(", ");
            if (location) items.push(`Location: ${location}`);
        }
        if (pq.contractorType) items.push(`Type: ${pq.contractorType}`);
        if (pq.englishProficiency && pq.englishProficiency.trim().toLowerCase() !== "any")
            items.push(`English: ${pq.englishProficiency}`);
        if (pq.jobSuccessScore != null) items.push(`JSS: ${pq.jobSuccessScore}%`);
        if (pq.minEarning && pq.minEarning.trim().toLowerCase() !== "any") items.push(`Earnings: ${pq.minEarning}`);
        if (pq.hoursWorked != null) items.push(`Hours: ${pq.hoursWorked}+`);
        if (pq.hasPortfolio) items.push("Portfolio Required");
        if (pq.risingTalent) items.push("Rising Talent");
        return items.length ? items.join("\n") : "-";
    }

    function closeModal() {
        analysisAbortRef.current?.abort();
        analysisAbortRef.current = null;
        setAnalyzing(false);
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
            const response = await fetch("/api/freelancer/queue", {
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


    async function exportToExcel() {
        if (exporting || !selectedExportColumns.length) return;

        setExporting(true);

        try {
            const allJobs = sortedJobs;

            if (!allJobs.length) {
                throw new Error("No jobs available to export.");
            }

            const data = allJobs.map(job => {
                const row: Record<string, string | number> = {};

                selectedExportColumns.forEach(column => {
                    switch (column) {
                        case "status":
                            row.Status = getStatusText(job);
                            break;

                        case "preferredQualifications":
                            row["Preferred Qualifications"] =
                                getPreferredQualificationText(job);
                            break;

                        case "preferredAttributes":
                            row["Preferred Attributes"] =
                                getProjectBadgeLabels(job).join(", ") || "N/A";
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
                            row.Country = getJobCountry(job) || "";
                            break;

                        case "client":
                            row.Client =
                                `${job.client?.totalPostedJobs ?? 0} jobs posted | ${job.client?.totalSpent?.displayValue || "$0"} spent`;
                            break;

                        case "memberSince":
                            row["Member Since"] =
                                formatMemberSince(job.client?.memberSinceDateTime);
                            break;

                        case "averageBid":
                            row["Average Bid"] = job.averageBidDisplay || "N/A";
                            break;

                        case "feedback":
                            row.Feedback = getFeedbackText(job);
                            break;

                        case "applicants":
                            row.Bids =
                                job.bidCount ?? job.totalApplicants ?? "N/A";
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

            XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs");

            const now = new Date();
            const day = String(now.getDate()).padStart(2, "0");
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, "0");
            const minutes = String(now.getMinutes()).padStart(2, "0");

            const skillsName = (
                selectedSkills.length
                    ? selectedSkills.join("-").toLowerCase()
                    : "all-skills"
            ).replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");

            const fileName =
                `${day}-${month}-${year}-${skillsName}-${hours}-${minutes}.xlsx`;

            XLSX.writeFile(workbook, fileName);
            setShowExportModal(false);
        } catch (error) {
            console.error("EXCEL EXPORT ERROR:", error);

            alert(
                error instanceof Error
                    ? error.message
                    : "Unable to export jobs."
            );
        } finally {
            setExporting(false);
        }
    }

    function normalizeCountry(value: string) {
        const country = value.trim().toLowerCase();
        const aliases: Record<string, string> = {
            aus: "australia", au: "australia",
            nz: "new zealand", nzl: "new zealand",
            can: "canada", ca: "canada",
            us: "united states", usa: "united states", "united state": "united states",
            uae: "united arab emirates", ae: "united arab emirates", are: "united arab emirates",
            uk: "united kingdom", gb: "united kingdom", gbr: "united kingdom",
            sgp: "singapore", sg: "singapore",
            zaf: "south africa", za: "south africa",
            deu: "germany", de: "germany", fra: "france", fr: "france"
        };
        return aliases[country] ?? country;
    }

    const selectedCountryNames = new Set(selectedCountries.map(normalizeCountry));
    const postedCutoff = postedDays === "all"
        ? null
        : Date.now() - Number(postedDays) * 24 * 60 * 60 * 1000;

    const filteredJobs = jobs.filter(job => {
        if (selectedCountryNames.size &&
            !selectedCountryNames.has(normalizeCountry(getJobCountry(job)))) return false;

        const verified = isVerified(job.client?.verificationStatus);
        if (paymentVerified === "verified" && !verified) return false;
        if (paymentVerified === "unverified" && verified) return false;

        if (applicantRange !== "all") {
            const [min, max] = applicantRange.split("-").map(Number);
            const bids = job.bidCount ?? job.totalApplicants;
            if (bids == null || bids < min || bids > max) return false;
        }
        if (postedCutoff !== null) {
            const published = new Date(job.publishedDateTime || job.createdDateTime || "").getTime();
            if (!Number.isFinite(published) || published < postedCutoff) return false;
        }
        return true;
    });

    const sortedJobs = filteredJobs
        .map((job, index) => ({ job, index }))
        .sort((a, b) => {
            if (sortColumn) {
                let comparison = 0;

                switch (sortColumn) {
                    case "status":
                        comparison = getStatusSortValue(a.job) - getStatusSortValue(b.job) ||
                            compareText(a.job.projectStatus || "", b.job.projectStatus || "");
                        break;

                    case "preferredAttributes":
                        comparison =
                            getProjectBadgeLabels(a.job).length -
                            getProjectBadgeLabels(b.job).length;
                        break;

                    case "elapsed":
                        comparison =
                            new Date(a.job.publishedDateTime || 0).getTime() -
                            new Date(b.job.publishedDateTime || 0).getTime();
                        break;

                    case "country":
                        comparison = compareText(
                            getJobCountry(a.job) || "",
                            getJobCountry(b.job) || ""
                        );
                        break;

                    case "averageBid":
                        if (a.job.averageBid == null && b.job.averageBid != null) return 1;
                        if (a.job.averageBid != null && b.job.averageBid == null) return -1;
                        comparison = (a.job.averageBid ?? 0) - (b.job.averageBid ?? 0);
                        break;
                    case "memberSince":
                        comparison = new Date(a.job.client?.memberSinceDateTime || 0).getTime() - new Date(b.job.client?.memberSinceDateTime || 0).getTime();
                        break;
                    case "feedback":
                        comparison = (a.job.client?.totalFeedback ?? 0) - (b.job.client?.totalFeedback ?? 0);
                        break;

                    case "applicants":
                        comparison = (a.job.totalApplicants ?? 0) - (b.job.totalApplicants ?? 0);
                        break;

                    case "proposals":
                        comparison =
                            (a.job.totalApplicants ?? 0) -
                            (b.job.totalApplicants ?? 0);
                        break;

                    case "verified":
                        comparison = Number(isVerified(a.job.client?.verificationStatus)) -
                            Number(isVerified(b.job.client?.verificationStatus));
                        break;

                    case "budget": {
                        const aBudget = getBudgetValue(a.job);
                        const bBudget = getBudgetValue(b.job);

                        // Keep missing budgets last in both directions.
                        if (aBudget === null && bBudget !== null) return 1;
                        if (aBudget !== null && bBudget === null) return -1;
                        comparison = (aBudget ?? 0) - (bBudget ?? 0);
                        break;
                    }

                    case "published":
                        comparison = new Date(a.job.publishedDateTime || 0).getTime() -
                            new Date(b.job.publishedDateTime || 0).getTime();
                        break;
                }

                if (comparison !== 0) {
                    return sortDirection === "desc" ? -comparison : comparison;
                }
            }

            if (previousClientFirst) {
                const previous = Number(isPreviousClientJob(b.job)) - Number(isPreviousClientJob(a.job));
                if (previous) return previous;
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

    const total = sortedJobs.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const visiblePage = Math.min(currentPage, totalPages);
    const displayedJobs = sortedJobs.slice(
        (visiblePage - 1) * PAGE_SIZE,
        visiblePage * PAGE_SIZE
    );
    const from = total ? (visiblePage - 1) * PAGE_SIZE + 1 : 0;
    const to = total ? from + displayedJobs.length - 1 : 0;

    // Any filter or sort change starts at the first matching page.
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCountries, paymentVerified, applicantRange, postedDays,
        sortColumn, sortDirection, fixedPriceFirst, hourlyPriceFirst, previousClientFirst]);

    useEffect(() => {
        setCurrentPage(page => Math.min(page, totalPages));
    }, [totalPages]);




    function parseBudgetAmount(value: string | number | null | undefined): number | null {
        if (value == null || String(value).trim() === "") return null;
        const cleaned = String(value).replace(/,/g, "").replace(/[^0-9.-]/g, "");
        if (!cleaned) return null;
        const amount = Number(cleaned);
        return Number.isFinite(amount) && amount >= 0 ? amount : null;
    }

    function getBudgetValue(job: Job): number | null {
        // Match getBudget(): hourly fields take precedence over fixed amounts.
        if (isHourlyPriceJob(job)) {
            const hourlyMin = parseBudgetAmount(job.hourlyBudgetMin?.displayValue);
            const hourlyMax = parseBudgetAmount(job.hourlyBudgetMax?.displayValue);
            if (hourlyMin === null) return hourlyMax;
            if (hourlyMax === null) return hourlyMin;
            return Math.max(hourlyMin, hourlyMax);
        }
        return parseBudgetAmount(job.amount?.displayValue);
    }

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
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleCopyUrl = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedUrl(url);
            if (copyTimer.current) clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopiedUrl(null), 2000);
        } catch (error) {
            console.error("Could not copy job URL:", error);
        }
    };


    function getFilterSummary() {

        const items: string[] = [];
        if (selectedCountries.length) {
            items.push(
                `Country: ${selectedCountries.join(", ")}`
            );
        }
        if (selectedSkills.length) {
            items.push(
                `Skills: ${selectedSkills.join(", ")}`
            );
        }
        if (paymentVerified !== "all") {

            items.push(
                `Payment: ${paymentVerified}`
            );

        }
        if (applicantRange !== "all") {

            items.push(
                `Applicants: ${applicantRange}`
            );

        }
        if (postedDays !== "all") {

            items.push(
                `Posted: ${postedDays} days`
            );

        }
        return items.length
            ?
            items.join(" | ")
            :
            "No filters applied";
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#0D163F]">
            <Navbar />

            <main className="flex-1 bg-[#0D163F] px-2 md:px-3 lg:px-4 pt-20 pb-6">
                <div className="max-w-[1900px] mx-auto">
                    <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">

                        <div>
                            <div className="mb-3 flex items-center gap-3 md:gap-4">
                                <img src="https://cdn.simpleicons.org/freelancer/29B2FE" alt="" width={80} height={80} className="h-14 w-14 shrink-0 md:h-20 md:w-20" />
                                <span className="text-lg md:text-[30px] font-bold uppercase leading-tight tracking-[1px] md:tracking-[2px] text-[#29B2FE]">
                                    Freelancer Job Monitoring
                                </span>
                            </div>
                            <h1 className="text-xl md:text-2xl font-semibold leading-tight text-white">
                                Find the right opportunities,<span className="text-[#29B2FE]"> faster.</span>
                            </h1>
                            <p className="mt-1.5 text-xs text-gray-300">
                                Search, monitor and analyse Freelancer opportunities directly from your Phoenix dashboard.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <StatCard label="Total Results" value={total} />
                            <StatCard label="Loaded" value={jobs.length} />
                        </div>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 mb-3">
                        <div className="flex items-center justify-between cursor-pointer">

                            <div className="flex-1">

                                {
                                    filterCollapsed
                                        ?
                                        <span className="text-[12px] text-gray-600">
                                            {getFilterSummary()}
                                        </span>
                                        :
                                        <span className="text-[12px] font-semibold text-gray-800">
                                            Job Filters
                                        </span>
                                }
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setFilterCollapsed(
                                        previous => !previous
                                    )
                                }
                                className="text-gray-600 text-lg transition-transform">
                                <span
                                    className={`inline-block transition-transform 
                                        ${filterCollapsed ? "rotate-180" : ""}
                                    `}
                                >
                                    ⌄
                                </span>

                            </button>

                        </div>

                        {
                            !filterCollapsed && (
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
                                            className="text-[11px] font-bold text-[#29B2FE] disabled:cursor-not-allowed disabled:opacity-80"
                                        // style={{ WebkitTextStroke: "0.5px black" }}
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
                                                    onClick={() => {
                                                        setSelectedCountries([]);
                                                        setCurrentPage(1);
                                                    }}
                                                    disabled={optionsLoading || selectedCountries.length === 0}
                                                    className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    Deselect all countries
                                                </button>
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
                            )}

                        {
                            !filterCollapsed && (
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
                                                onChange={e => {
                                                    setSearchMode("manual");
                                                    setSearch(e.target.value);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter" && !loading) {
                                                        setSearchMode("manual");
                                                        void searchJobs(1, "0", search, undefined, selectedSkills);
                                                    }
                                                }}
                                                placeholder="Wix, Webflow, Shopify, Next.js..."
                                                className="w-full bg-transparent outline-none border-none text-gray-900 text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex min-w-[160px] flex-row items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchMode("manual");
                                                void searchJobs(1, "0", search, undefined, selectedSkills);
                                            }}
                                            disabled={loading}
                                            className="flex h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                                    Searching...
                                                </>
                                            ) : (
                                                <>
                                                    Search Jobs <span>→</span>
                                                </>
                                            )}
                                        </button>

                                        {(loading || enriching) && (
                                            <button
                                                type="button"
                                                onClick={stopSearch}
                                                className="h-[42px] whitespace-nowrap rounded-lg bg-red-600 px-5 text-xs font-semibold text-white transition hover:bg-red-700"
                                            >
                                                Stop Search
                                            </button>
                                        )}
                                    </div>


                                </div>
                            )}
                        {
                            !filterCollapsed && (
                                <div className="flex items-start justify-between gap-3 mt-2">
                                    <div className="flex flex-1 flex-wrap items-center gap-1.5">
                                        <span className="text-[12px] text-gray-500 mr-1">
                                            Quick search:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedSkills([]);
                                                setSearchMode(null);
                                                setCurrentPage(1);
                                            }}
                                            disabled={optionsLoading || selectedSkills.length === 0}
                                            className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Deselect all skills
                                        </button>
                                        {skillOptions.map(skill => {
                                            const group = getSkillGroup(skill);
                                            const selected =
                                                group.every(item =>
                                                    selectedSkills.includes(item)
                                                );
                                            return (
                                                <button
                                                    key={skill}
                                                    type="button"
                                                    onClick={() => {

                                                        const updated =
                                                            selected
                                                                ?
                                                                selectedSkills.filter(
                                                                    item => !group.includes(item)
                                                                )
                                                                :
                                                                [
                                                                    ...new Set([
                                                                        ...selectedSkills,
                                                                        ...group
                                                                    ])
                                                                ];
                                                        setSelectedSkills(
                                                            updated
                                                        );
                                                        setSearchMode(
                                                            updated.length
                                                                ?
                                                                "quick"
                                                                :
                                                                null
                                                        );
                                                    }}

                                                    className={`
px-2.5 py-1 rounded-full border text-[12px]
font-medium
${selected
                                                            ?
                                                            "bg-blue-600 text-white border-blue-600"
                                                            :
                                                            "bg-white text-gray-600 border-gray-300"
                                                        }
`}
                                                >

                                                    {skill}
                                                </button>
                                            )
                                        })}
                                    </div>



                                    <div className="flex gap-2">
                                        <select
                                            value={selectedSavedFilter}
                                            onChange={(e) => {

                                                setSelectedSavedFilter(
                                                    e.target.value
                                                );

                                                applySavedFilter(
                                                    e.target.value
                                                );

                                            }}
                                            className="
    h-9 rounded-lg border
    border-gray-300 px-3
    text-[12px]
    "
                                        >

                                            <option value="">
                                                Saved Filters
                                            </option>


                                            {
                                                savedFilters.map(filter => (

                                                    <option
                                                        key={filter._id || String(filter.id)}
                                                        value={filter._id || String(filter.id)}
                                                    >
                                                        {filter.name}
                                                    </option>

                                                ))
                                            }

                                        </select>



                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowSaveFilterModal(true)
                                            }
                                            className=" h-9 rounded-lg border border-green-200 bg-green-50 px-4 text-[11px] font-semibold text-green-700 "
                                        >
                                            + Save Filter
                                        </button>

                                        <button

                                            type="button"
                                            onClick={openAddOptionModal}

                                            className="
h-9 rounded-lg
border border-blue-200
bg-blue-50
px-4 text-[11px]
font-semibold text-blue-700
"

                                        >

                                            + Add Skills / Country

                                        </button>


                                    </div>


                                </div>
                            )}
                    </section>

                    {error && (
                        <section className="flex items-start gap-2 bg-[#FFF1F2] border border-red-300 rounded-lg p-2.5 mb-3">
                            <div className="w-7 h-7 rounded-full bg-red-500 text-white flex justify-center items-center font-bold text-xs">!</div>
                            <div>
                                <h3 className="text-red-800 text-xs font-semibold">Freelancer API Error</h3>
                                <p className="text-red-600 text-[12px] mt-0.5">{error}</p>
                            </div>
                        </section>
                    )}

                    <section className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 px-4 py-2.5 border-b border-gray-200">
                            <div>
                                <h2 className="text-base font-semibold text-[#101828]">Latest Opportunities</h2>
                                <p className="text-gray-400 text-[12px] mt-0.5">
                                    {!hasSearched ? "Search jobs to view opportunities" : total > 0 ? `Showing ${from}-${to} of ${total} available jobs` : loading || enriching ? "Loading results and client details..." : "No jobs found"}
                                    {(loading || enriching) && (
                                        <span className="ml-2 text-[11px] text-blue-600" role="status">
                                            {loading ? `Loading more results (${searchProgress} pages loaded)...` : "Loading client details and application status..."}
                                        </span>
                                    )}
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

                        <div className="w-full min-w-0">
                            <table className="freelancer-jobs-table w-full table-fixed border-collapse text-[11px]">
                                <style>{`
                                    .freelancer-jobs-table th,
                                    .freelancer-jobs-table td {
                                        overflow: hidden;
                                        text-overflow: ellipsis;
                                        white-space: normal;
                                        overflow-wrap: anywhere;
                                    }
                                    .freelancer-jobs-table button,
                                    .freelancer-jobs-table a,
                                    .freelancer-jobs-table td div {
                                        min-width: 0;
                                        max-width: 100%;
                                        white-space: normal;
                                        overflow-wrap: anywhere;
                                    }
                                `}</style>
                                <colgroup>
                                    <col style={{ width: "4%" }} />
                                    <col style={{ width: "7%" }} />
                                    <col style={{ width: "4%" }} />
                                    <col style={{ width: "11%" }} />
                                    <col style={{ width: "17%" }} />
                                    <col style={{ width: "4%" }} />
                                    <col style={{ width: "5%" }} />
                                    <col style={{ width: "5%" }} />
                                    <col style={{ width: "6%" }} />
                                    <col style={{ width: "6%" }} />
                                    <col style={{ width: "5%" }} />
                                    <col style={{ width: "3%" }} />
                                    <col style={{ width: "3%" }} />
                                    <col style={{ width: "6%" }} />
                                    <col style={{ width: "7%" }} />
                                    <col style={{ width: "7%" }} />
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
                                        <th
                                            className={thClass}
                                            aria-sort={
                                                sortColumn === "preferredAttributes"
                                                    ? sortDirection === "desc"
                                                        ? "descending"
                                                        : "ascending"
                                                    : "none"
                                            }
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("preferredAttributes")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Preferred Attributes
                                                <span className="text-[10px]">
                                                    {getSortIndicator("preferredAttributes")}
                                                </span>
                                            </button>
                                        </th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("elapsed")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Elapsed <span className="text-[10px]">{getSortIndicator("elapsed")}</span>
                                            </button>
                                        </th>
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
                                                onClick={() => handleColumnSort("proposals")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Proposals
                                                <span className="text-[10px]">
                                                    {getSortIndicator("proposals")}
                                                </span>
                                            </button>
                                        </th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("feedback")}
                                                className="inline-flex w-full items-center justify-center gap-1 text-center hover:text-blue-600"
                                            >
                                                Fdbk <span className="text-[10px]">{getSortIndicator("feedback")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("applicants")}
                                                className="inline-flex w-full items-center justify-center gap-1 text-center hover:text-blue-600"
                                            >
                                                Bids <span className="text-[10px]">{getSortIndicator("applicants")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>
                                            <button type="button" onClick={() => handleColumnSort("averageBid")} className="inline-flex items-center gap-1 hover:text-blue-600">
                                                Average Bid <span className="text-[10px]">{getSortIndicator("averageBid")}</span>
                                            </button>
                                        </th>
                                        <th className={thClass}>
                                            <button
                                                type="button"
                                                onClick={() => handleColumnSort("budget")}
                                                className="inline-flex items-center gap-1 hover:text-blue-600"
                                            >
                                                Budget <span className="text-[10px]">{getSortIndicator("budget")}</span>
                                            </button>
                                        </th>

                                        <th className={thClass}>Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {!hasSearched ? (
                                        <tr>
                                            <td colSpan={16} className="py-12 text-center">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                                                        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-gray-800 text-sm font-semibold mt-2">Search Freelancer Jobs</h3>
                                                <p className="text-gray-400 text-[11px] mt-1">Enter a keyword, select skills, or use both, then click Search Jobs.</p>
                                            </td>
                                        </tr>
                                    ) : (loading || enriching) && displayedJobs.length === 0 ? (
                                        <tr>
                                            <td colSpan={16} className="py-12 text-center">
                                                <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                                                <h3 className="mt-2 text-sm font-semibold text-gray-800">Searching Freelancer...</h3>
                                                <p className="text-gray-400 text-[12px] mt-1">Fetching latest opportunities.</p>
                                            </td>
                                        </tr>
                                    ) : displayedJobs.length === 0 ? (
                                        <tr>
                                            <td colSpan={16} className="py-12 text-center">
                                                <h3 className="text-gray-800 text-sm font-semibold">No jobs found</h3>
                                                <p className="text-gray-400 text-[12px] mt-1">Try searching another keyword.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedJobs.map(job => {
                                            const verified = isVerified(job.client?.verificationStatus);
                                            const jobUrl = getJobUrl(job);
                                            const hasHired = (job.activity?.totalHired ?? 0) > 0;
                                            const hasManyProposals = (job.totalApplicants ?? 0) >= 50;
                                            return (
                                                <tr
                                                    key={job.id}
                                                    className={`border-t border-gray-100 transition ${hasHired
                                                        ? "bg-red-100 hover:bg-red-200"
                                                        : hasManyProposals
                                                            ? "bg-yellow-100 hover:bg-yellow-200"
                                                            : "hover:bg-blue-50/40"
                                                        }`}
                                                >
                                                    <td className="px-1.5 py-2 align-top">
                                                        <span
                                                            className={`inline-block rounded-full px-2 py-1 text-[12px] font-semibold ${getStatusBadgeClass(job.projectStatus || "N/A")
                                                                }`}
                                                        >
                                                            {job.projectStatus || "N/A"}
                                                        </span>
                                                        <span
                                                            title={job.applied == null
                                                                ? "Application status could not be verified for the connected Freelancer account."
                                                                : "Application status for the connected Freelancer account."}
                                                            className={`mt-1 block rounded-md px-1 py-1 text-center text-[10px] font-semibold ${getStatusBadgeClass(getApplicationLabel(job))}`}
                                                        >
                                                            {getApplicationLabel(job)}
                                                        </span>
                                                    </td>
                                                    <td className="px-1.5 py-2 align-top">
                                                        <div className="flex flex-col items-start gap-1">
                                                            {getProjectBadgeLabels(job).map(label => (
                                                                <span
                                                                    key={label}
                                                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusBadgeClass(label)}`}
                                                                >
                                                                    {label}
                                                                </span>
                                                            ))}

                                                            {getProjectBadgeLabels(job).length === 0 && (
                                                                <span className="text-[11px] text-gray-400">N/A</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-1.5 py-2 align-top text-center text-[11px] leading-[15px] text-red-500 whitespace-normal">
                                                        {getElapsedTime(job.publishedDateTime)}
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top break-words">
                                                        <h3 className="text-[11px] font-medium text-gray-900 leading-[15px]">{job.title || "Untitled Job"}</h3>
                                                    </td>
                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] text-gray-700 break-words">
                                                        {job.description ? (
                                                            <>
                                                                <p>
                                                                    {job.description.slice(0, 300)}
                                                                    {job.description.length > 300 ? "..." : ""}
                                                                </p>

                                                                <button
                                                                    type="button"
                                                                    onClick={async (event) => {
                                                                        event.stopPropagation();

                                                                        try {
                                                                            await navigator.clipboard.writeText(
                                                                                job.description ?? ""
                                                                            );

                                                                            const jobId = String(job.id);
                                                                            setCopiedDescriptionId(jobId);

                                                                            if (descriptionCopyTimer.current) clearTimeout(descriptionCopyTimer.current);
                                                                            descriptionCopyTimer.current = setTimeout(() => {
                                                                                setCopiedDescriptionId(current =>
                                                                                    current === jobId ? null : current
                                                                                );
                                                                            }, 2000);
                                                                        } catch (error) {
                                                                            console.error("Copy failed:", error);
                                                                            alert("Unable to copy the description.");
                                                                        }
                                                                    }}
                                                                    className="mt-1 text-[11px] font-medium text-blue-600 hover:underline"
                                                                >
                                                                    {copiedDescriptionId === String(job.id)
                                                                        ? "✓ Copied"
                                                                        : "Copy Description"}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            "-"
                                                        )}
                                                    </td>

                                                    <td className={cellClass}>
                                                        {jobUrl ? (
                                                            <div className="flex flex-col items-start gap-1 whitespace-nowrap text-[11px] font-medium">
                                                                <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-[11px] whitespace-nowrap">
                                                                    View Job
                                                                </a>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopyUrl(jobUrl)}
                                                                    className={copiedUrl === jobUrl ? "text-green-700" : "text-gray-600 hover:text-blue-600"}
                                                                    title="Copy job URL"
                                                                >
                                                                    {copiedUrl === jobUrl ? "✓ Copied" : "Copy URL"}
                                                                </button>
                                                            </div>
                                                        ) : "-"}
                                                    </td>

                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] text-gray-900 break-words">
                                                        {getJobCountry(job) || "-"}
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
                                                            <span
                                                                className={
                                                                    hasHired
                                                                        ? "font-semibold text-red-700"
                                                                        : "text-gray-700"
                                                                }
                                                            >
                                                                Hired: {job.activity?.totalHired ?? 0}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-1 py-2 align-top text-center text-[11px] leading-[15px]">{getProposalRange(job.totalApplicants)}</td>

                                                    <td className="px-1 py-2 align-top text-center text-[11px] leading-[15px]">{getFeedbackText(job)}</td>
                                                    <td className="px-1 py-2 align-top text-center text-[11px] leading-[15px]">{job.bidCount ?? job.totalApplicants ?? "N/A"}</td>
                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px]">{job.averageBidDisplay || "N/A"}</td>

                                                    <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] whitespace-normal break-words">
                                                        {getBudget(job)}
                                                    </td>

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

                        {hasSearched && total > 0 && (
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
                                        disabled={visiblePage <= 1}
                                        className="h-8 rounded-md border border-gray-300 bg-white px-3 text-[11px] font-semibold text-gray-700 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        ← Previous
                                    </button>

                                    <div className="flex h-8 items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-[11px] font-semibold text-blue-700">
                                        Page {visiblePage} of {totalPages}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={goToNextPage}
                                        disabled={visiblePage >= totalPages}
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


            {showSaveFilterModal && (

                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4"
                    onClick={() => setShowSaveFilterModal(false)}
                >

                    <div
                        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >

                        <div className="flex items-center justify-between mb-4">

                            <h2 className="text-base font-semibold text-gray-900">
                                Save Current Filter
                            </h2>


                            <button
                                type="button"
                                onClick={() => setShowSaveFilterModal(false)}
                                className="text-gray-400 hover:text-gray-700"
                            >
                                ✕
                            </button>

                        </div>


                        <input
                            type="text"
                            value={newFilterName}
                            onChange={(e) => setNewFilterName(e.target.value)}
                            placeholder="Example: Wix Canada Jobs"
                            className="
            w-full h-10 rounded-lg
            border border-gray-300
            px-3 text-sm
            outline-none
            focus:border-blue-500
            "
                        />


                        <div className="flex justify-end gap-2 mt-5">


                            <button
                                type="button"
                                onClick={() => setShowSaveFilterModal(false)}
                                className="
                px-4 py-2 rounded-lg
                border border-gray-300
                text-sm
                "
                            >
                                Cancel
                            </button>


                            <button
                                type="button"
                                onClick={saveCurrentFilter}
                                className="
                px-4 py-2 rounded-lg
                bg-blue-600
                text-white
                text-sm
                font-semibold
                "
                            >
                                Save
                            </button>


                        </div>


                    </div>

                </div>

            )}
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
                            disabled={exporting || !selectedExportColumns.length}
                            aria-busy={exporting}
                            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {exporting ? (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                                    />
                                    Exporting all jobs...
                                </>
                            ) : (
                                "Export Selected Columns"
                            )}
                        </button>
                    </div>
                </div>
            )}

            {showAddOptionModal && (
                <SearchOptionsModal
                    countryOptions={countryOptions}
                    skillOptions={skillOptions}
                    onClose={closeAddOptionModal}
                    onChanged={handleSearchOptionChange}
                />
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
                                                        await navigator.clipboard.writeText(aiReport.proposal || "");
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