"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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

const PAGE_SIZE = 50;
const quickSearches = ["Wix", "Wix Studio", "Wix Velo", "Webflow", "Shopify", "Finsweet", "Relume", "Next.js"];

export default function UpworkJobsPage() {
  const [search, setSearch] = useState("Wix");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [previousClient, setPreviousClient] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInfo, setPageInfo] = useState<PageInfo>({ endCursor: null, hasNextPage: false });
  const [pageCursors, setPageCursors] = useState<Record<number, string>>({ 1: "0" });

  async function searchJobs(page = 1, cursor = "0", keyword?: string) {
    const searchKeyword = (keyword ?? search).trim() || "Wix";
    try {
      setHasSearched(true);
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ q: searchKeyword, first: String(PAGE_SIZE), after: cursor });
      const response = await fetch(`/api/upwork/jobs?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        let message = "Unable to search Upwork jobs";
        if (typeof data.error === "string") message = data.error;
        else if (Array.isArray(data.error)) message = data.error?.[0]?.message || message;
        else if (data.error?.message) message = data.error.message;
        throw new Error(message);
      }

      const nextInfo: PageInfo = {
        endCursor: data.pageInfo?.endCursor || null,
        hasNextPage: data.pageInfo?.hasNextPage === true
      };

      setSearch(searchKeyword);
      setJobs(data.jobs || []);
      setTotal(data.total ?? data.totalCount ?? 0);
      setCurrentPage(page);
      setPageInfo(nextInfo);
      setPageCursors(previous => {
        const updated: Record<number, string> = page === 1 ? { 1: "0" } : { ...previous };
        if (nextInfo.endCursor) updated[page + 1] = nextInfo.endCursor;
        return updated;
      });
    } catch (err) {
      console.error("Upwork Search Error:", err);
      if (page === 1) {
        setJobs([]);
        setTotal(0);
        setCurrentPage(1);
        setPageInfo({ endCursor: null, hasNextPage: false });
        setPageCursors({ 1: "0" });
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
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

  function handleQuickSearch(keyword: string) {
    setSearch(keyword);
  }

  function formatDate(value?: string) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-US", {
      month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true
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
    const min = job.hourlyBudgetMin?.displayValue;
    const max = job.hourlyBudgetMax?.displayValue;
    if (min) return max ? `${min} - ${max}/hr` : `${min}/hr`;
    if (job.amount?.displayValue) return `Fixed ${job.amount.displayValue}`;
    return "Not specified";
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
    return statuses.length ? statuses.join(", ") : "Not Applied";
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(currentPage * PAGE_SIZE, total);

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
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !loading) searchJobs(1, "0"); }}
                    placeholder="Wix, Webflow, Shopify, Next.js..."
                    className="w-full bg-transparent outline-none border-none text-gray-900 text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => searchJobs(1, "0")}
                disabled={loading}
                className="h-[42px] px-5 min-w-[140px] rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold text-xs transition flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Searching...</>
                ) : <>Search Jobs <span>→</span></>}
              </button>
            </div>

            <div className="flex items-center flex-wrap gap-1.5 mt-2">
              <span className="text-[12px] text-gray-500 mr-1">Quick search:</span>
              {quickSearches.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleQuickSearch(item)}
                  className={`px-2.5 py-1 rounded-full border text-[12px] font-medium transition ${
                    search === item
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-500 hover:text-blue-600"
                  }`}
                >
                  {item}
                </button>
              ))}
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
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previousClient}
                    onChange={e => setPreviousClient(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  Previous Client
                </label>
                <span className="text-blue-600 text-xs font-bold">Total: {total}</span>
              </div>
            </div>

            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed border-collapse text-[11px]">
                <colgroup>
                  <col className="w-[6.5%]" />
                  <col className="w-[5%]" />
                  <col className="w-[12%]" />
                  <col className="w-[18%]" />
                  <col className="w-[4%]" />
                  <col className="w-[6%]" />
                  <col className="w-[7%]" />
                  <col className="w-[3%]" />
                  <col className="w-[3%]" />
                  <col className="w-[5%]" />
                  <col className="w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7.5%]" />
                </colgroup>

                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Elapsed</th>
                    <th className={thClass}>Job Title</th>
                    <th className={thClass}>Description</th>
                    <th className={thClass}>URL</th>
                    <th className={thClass}>Country</th>
                    <th className={thClass}>Client</th>
                    <th className={thClass}>Fdbk</th>
                    <th className={thClass}>Appl</th>
                    <th className={thClass}>Verified</th>
                    <th className={thClass}>Budget</th>
                    <th className={thClass}>Published</th>
                    <th className={thClass}>Activity</th>
                    <th className={thClass}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {!hasSearched ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center">
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
                      <td colSpan={14} className="py-12 text-center">
                        <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                        <h3 className="mt-2 text-sm font-semibold text-gray-800">Searching Upwork...</h3>
                        <p className="text-gray-400 text-[12px] mt-1">Fetching latest opportunities.</p>
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center">
                        <h3 className="text-gray-800 text-sm font-semibold">No jobs found</h3>
                        <p className="text-gray-400 text-[12px] mt-1">Try searching another keyword.</p>
                      </td>
                    </tr>
                  ) : (
                    jobs.map(job => {
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

                          <td className="px-1 py-2 align-top text-center text-[11px] leading-[15px]">{job.client?.totalFeedback ?? 0}</td>
                          <td className="px-1 py-2 align-top text-center text-[11px] leading-[15px]">{job.totalApplicants ?? 0}</td>

                          <td className="px-1.5 py-2 align-top">
                            <span className={`text-[11px] leading-[15px] font-medium ${verified ? "text-green-600" : "text-gray-500"}`}>
                              {verified ? "Verified" : "Unverified"}
                            </span>
                          </td>

                          <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] whitespace-normal break-words">{getBudget(job)}</td>
                          <td className="px-1.5 py-2 align-top text-[11px] leading-[15px] whitespace-normal">{formatDate(job.publishedDateTime)}</td>

                          <td className="px-1.5 py-2 align-top">
                            <div className="flex flex-col gap-0 text-[11px] leading-[14px]">
                              <span>Proposals: {getProposalRange(job.totalApplicants)}</span>
                              <span>Interviewing: {job.activity?.totalInvitedToInterview ?? 0}</span>
                              <span>Invites: {job.activity?.invitesSent ?? 0}</span>
                              <span>Unanswered: {job.activity?.totalUnansweredInvites ?? 0}</span>
                            </div>
                          </td>

                          <td className="px-1.5 py-2 align-top">
                            <button
                              type="button"
                              onClick={() => analyzeJob(job)}
                              disabled={analyzing && selectedJob?.id === job.id}
                              className="w-full rounded-md bg-blue-600 px-2 py-1.5 text-[12px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                            >
                              {analyzing && selectedJob?.id === job.id ? "Analyzing..." : "AI Proposal"}
                            </button>
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

const thClass = "px-1.5 py-2 text-left text-[12px] leading-[13px] font-semibold uppercase tracking-[0.2px] text-gray-600 whitespace-nowrap align-middle";
const cellClass = "px-1.5 py-2 align-top text-[11px] leading-[15px] text-gray-800 whitespace-nowrap";
