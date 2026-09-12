"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Job = {
    Title: string;
    Description: string;
    Budget: string;
    Status: string;
    PublishedDate: string;
    Activity: string;
    URL: string;
    score: number;
    matchedSkills: string[];
};

type AIReport = {
    relevant: boolean;
    proposal?: string;
    reason?: string;
    error?: string;
};

const keywords = [
    "react",
    "next.js",
    "nextjs",
    "typescript",
    "javascript",
    "automation",
    "api",
    "saas",
    "full stack",
    "wix",
    "wix studio",
    "webflow",
    "shopify",
    "seo",
    "elementor",
];

function scoreJob(job: {
    Title: string;
    Description: string;
    Budget: string;
}) {
    let score = 50;
    const text = `${job.Title} ${job.Description}`.toLowerCase();

    keywords.forEach((keyword) => {
        if (text.includes(keyword)) score += 5;
    });

    if (job.Budget) score += 5;

    return Math.min(score, 100);
}

function findMatchedSkills(job: {
    Title: string;
    Description: string;
}) {

    const text =
        `${job.Title} ${job.Description}`.toLowerCase();


    return keywords.filter((keyword) =>
        text.includes(keyword.toLowerCase())
    );

}

export default function Page() {
    const input = useRef<HTMLInputElement>(null);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [file, setFile] = useState("");
    const [loading, setLoading] = useState(false);

    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [aiReport, setAiReport] = useState<AIReport | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    async function upload(e: React.ChangeEvent<HTMLInputElement>) {
        const uploaded = e.target.files?.[0];
        if (!uploaded) return;

        setFile(uploaded.name);
        setLoading(true);

        try {
            const buffer = await uploaded.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                defval: "",
            });

            const data: Job[] = rows
                .map((row) => {
                    const job = {
                        Title: String(row.Title || row["Job Title"] || ""),
                        Description: String(
                            row.Description || row["Job Description"] || ""
                        ),
                        Budget: String(row.Budget || ""),
                        Status: String(row.Status || row.status || "Not Applied"),
                        PublishedDate: String(row["Published Date"] || row.PublishedDate || ""),
                        Activity: String(row["Activity on this job"] || row.Activity || ""),
                        URL: String(
                            row.URL || 
                            row.Url || 
                            row["Job URL"] || 
                            row["Job Link"] || 
                            ""
                        ),
                    };

                    return {
                        ...job,
                        score: scoreJob(job),
                        matchedSkills: findMatchedSkills(job),
                    };
                })
                .filter((job) => job.Title || job.Description)
                .sort((a, b) => b.score - a.score);

            setJobs(data);
        } catch (error) {
            console.error("Upload error:", error);
        } finally {
            setLoading(false);
        }
    }

    async function analyzeJob(job: Job) {
        setSelectedJob(job);
        setShowModal(true);
        setAnalyzing(true);
        setAiReport(null);

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ job }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "AI analysis failed");
            }

            console.log("AI REPORT:", data);
            setAiReport(data);
        } catch (error) {
            console.error("Analyze error:", error);

            setAiReport({
                relevant: false,
                error: "Unable to analyze this opportunity. Please try again."
            });
        } finally {
            setAnalyzing(false);
        }
    }
    async function saveJobsToDB() {

        try {

            const response = await fetch("/api/jobs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(jobs)
            });


            const data = await response.json();


            if (data.success) {

                alert("Jobs saved successfully");

            } else {

                alert(data.error);

            }


        } catch (error) {

            console.log(error);
            alert("MongoDB save failed");

        }

    }

    function closeModal() {
        setShowModal(false);
        setSelectedJob(null);
        setAiReport(null);
    }

    return (
        <>
            <Navbar />

            <main className="min-h-screen bg-[#07111f] text-white">
                <section className="mx-auto max-w-7xl px-6 pb-24 pt-40">
                    <p className="text-sm uppercase tracking-widest text-blue-400">
                        AI Opportunity Intelligence
                    </p>

                    <h1 className="mt-5 max-w-5xl text-5xl font-bold leading-tight md:text-7xl">
                        Find The Best
                        <span className="text-blue-500"> Upwork Opportunities </span>
                        Faster
                    </h1>

                    <p className="mt-6 text-lg text-gray-300">
                        Upload jobs and AI ranks the best opportunities for your skills.
                    </p>
                </section>

                <section className="mx-auto max-w-7xl px-6 pb-20">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                        <input
                            ref={input}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={upload}
                            className="hidden"
                        />

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => input.current?.click()}
                                className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-full"
                            >
                                Choose File
                            </button>

                            <button
                                onClick={saveJobsToDB}
                                className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-full"
                            >
                                Save Jobs to MongoDB
                            </button>
                        </div>

                        {file && !loading && (
                            <p className="mt-5 text-green-400">✓ {file}</p>
                        )}

                        {loading && (
                            <p className="mt-5 text-blue-400">Importing opportunities...</p>
                        )}

                        {/* <button
                            onClick={saveJobsToDB}
                            className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-full"
                        >
                            Save Jobs to MongoDB
                        </button> */}
                    </div>
                </section>

                <section className="bg-white py-20 text-gray-900">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="flex items-end justify-between gap-6">
                            <div>
                                <p className="text-sm uppercase tracking-widest text-blue-600">
                                    Imported Jobs
                                </p>

                                <h2 className="mt-3 text-4xl font-bold">
                                    Top Opportunities
                                </h2>
                            </div>

                            {jobs.length > 0 && (
                                <p className="text-gray-500">
                                    {jobs.length} jobs ranked
                                </p>
                            )}
                        </div>

                        <div className="mt-10 overflow-x-auto rounded-2xl border border-gray-200">
                            <table className="w-full min-w-[900px] text-left">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-5">Sl. No.</th>
                                        <th className="p-5">Job</th>
                                        <th className="p-5">Budget</th>
                                        <th className="p-5">Status</th>
                                        <th className="p-5">Published Date</th>
                                        <th className="p-5">Activity</th>
                                        <th className="p-5">Score</th>
                                        <th className="p-5">Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {jobs.map((job, index) => (
                                        <tr
                                            key={`${job.Title}-${index}`}
                                            className="border-t border-gray-200 transition hover:bg-gray-50"
                                        >
                                            <td className="p-5">{index + 1}</td>

                                            <td className="max-w-xl p-5">
                                                <h3 className="font-bold">{job.Title}</h3>

                                                <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                                                    {job.Description}
                                                </p>
                                            </td>

                                            <td className="p-5 text-sm text-gray-500">
                                                <span >
                                                    {job.Budget || "N/A"}
                                                </span>
                                            </td>

                                            <td className="p-5">
                                                <span className="rounded-full bg-blue-100 px-4 py-2 text-sm">
                                                    {job.Status || "N/A"}
                                                </span>
                                            </td>

                                            <td className="p-5 text-sm text-gray-500">
                                                {job.PublishedDate || "N/A"}
                                            </td>

                                            <td className="p-5 max-w-xs text-sm text-gray-500">
                                                {job.Activity || "N/A"}
                                            </td>

                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-2 w-20 rounded-full bg-gray-200">
                                                        <div
                                                            className={`h-2 rounded-full ${job.score >= 85
                                                                ? "bg-green-500"
                                                                : job.score >= 70
                                                                    ? "bg-blue-500"
                                                                    : "bg-yellow-500"
                                                                }`}
                                                            style={{ width: `${job.score}%` }}
                                                        />
                                                    </div>

                                                    <span className="font-bold text-blue-600">
                                                        {job.score}/100
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="p-5">
                                                <button
                                                    onClick={() => analyzeJob(job)}
                                                    className="rounded-full bg-black px-5 py-2 text-sm text-white transition hover:bg-gray-800"
                                                >
                                                    Analyze
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {!jobs.length && (
                                <div className="p-10 text-center text-gray-500">
                                    Upload an Excel or CSV file to see opportunities.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {showModal && selectedJob && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-5 py-10"
                        onClick={closeModal}
                    >
                        <div
                            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-8 text-gray-900 shadow-2xl md:p-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-6">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                                        AI Report
                                    </p>

                                    <h2 className="mt-2 text-3xl font-bold">
                                        AI Opportunity Analysis
                                    </h2>
                                </div>

                                <button
                                    onClick={closeModal}
                                    className="text-2xl text-gray-500 transition hover:text-black"
                                    aria-label="Close"
                                >
                                    ×
                                </button>
                            </div>

                            <h3 className="mt-6 text-lg font-semibold">
                                {selectedJob.Title}
                            </h3>

                            <p className="mt-2 text-sm text-gray-500">
                                {selectedJob.Budget || "Budget not provided"}
                            </p>

                            {analyzing ? (
                                <div className="py-16 text-center">
                                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

                                    <p className="mt-5 font-medium text-blue-600">
                                        AI is analyzing this opportunity...
                                    </p>

                                    <p className="mt-2 text-sm text-gray-500">
                                        Reviewing the scope, skills, pain points and opportunity fit.
                                    </p>
                                </div>
                            ) : aiReport?.error ? (
                                <div className="mt-8 rounded-2xl bg-red-50 p-5 text-red-700">
                                    {aiReport.error}
                                </div>
                            ) : aiReport ? (

                                <div className="mt-8 space-y-6">

                                    {
                                        !aiReport.relevant ? (

                                            <div className="rounded-2xl bg-yellow-50 p-6 text-yellow-700">
                                                <h3 className="font-bold text-lg">
                                                    Not Recommended
                                                </h3>

                                                <p className="mt-2">
                                                    {aiReport.reason}
                                                </p>
                                            </div>

                                        ) : (

                                            <>

                                                <div className="rounded-2xl bg-blue-50 p-6">

                                                    <h3 className="text-xl font-bold text-blue-700">
                                                        Generated Proposal
                                                    </h3>

                                                    <p className="mt-4 whitespace-pre-line leading-7 text-gray-700">
                                                        {aiReport.proposal}
                                                    </p>

                                                </div>


                                                <div className="flex flex-wrap gap-4">

                                                    <button
                                                        onClick={async () => {

                                                            const text = aiReport.proposal || "";

                                                            try {

                                                                if(navigator.clipboard){
                                                                    await navigator.clipboard.writeText(text);
                                                                }

                                                                alert("Proposal copied!");

                                                            }
                                                            catch(error){
                                                                console.error("Copy failed:",error);
                                                            }

                                                        }}
                                                        className="rounded-full bg-black px-6 py-3 text-white transition hover:bg-gray-800"
                                                    >
                                                        Copy Proposal
                                                    </button>


                                                {selectedJob.URL && (

                                                <a
                                                    href={selectedJob.URL}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-full bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700"
                                                >
                                                    Open Job URL
                                                </a>

                                                )}

                                                </div>


                                            </>

                                        )

                                    }

                                </div>

                            ) : null}
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </>
    );
}