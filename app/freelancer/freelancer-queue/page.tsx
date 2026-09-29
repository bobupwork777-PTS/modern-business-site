"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type RawJob = {
  id?: string; totalApplicants?: number; title?: string; description?: string; url?: string;
  client?: { totalPostedJobs?: number; totalSpent?: { displayValue?: string }; totalHires?: number; verificationStatus?: string };
  activity?: { totalInvitedToInterview?: number; invitesSent?: number; totalUnansweredInvites?: number };
};
type Job = {
  _id: string; jobId: string; title: string; description: string; url: string;
  country: string; budget: string; publishedDateTime: string; createdAt?: string;
  applied: boolean; isFeatured: boolean; isPreviousClient: boolean; rawJob?: RawJob;
};

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function FreelancerQueuePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteJob, setDeleteJob] = useState<Job | null>(null);
  const [removing, setRemoving] = useState(false);
  const [aiJob, setAiJob] = useState<Job | null>(null);
  const [proposal, setProposal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { void loadQueue(); }, []);

  async function loadQueue() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/freelancer/queue", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Unable to load queue");
      setJobs(Array.isArray(data.queue) ? data.queue : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load queue");
    } finally { setLoading(false); }
  }

  async function removeJob() {
    if (!deleteJob || removing) return;
    setRemoving(true); setError("");
    try {
      const res = await fetch(`/api/freelancer/queue?jobId=${encodeURIComponent(deleteJob.jobId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Unable to remove job");
      setJobs(current => current.filter(job => job.jobId !== deleteJob.jobId));
      setDeleteJob(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove job");
    } finally { setRemoving(false); }
  }

  async function generateProposal(job: Job) {
    setAiJob(job); setProposal(""); setAiLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: {
            Skill: "Freelancer", Title: job.title, Description: job.description,
            Budget: job.budget, Status: job.applied ? "Applied" : "New",
            PublishedDate: formatDate(job.publishedDateTime),
            Activity: `Bids: ${job.rawJob?.totalApplicants ?? "Unknown"}`,
            URL: job.url, Country: job.country
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI analysis failed");
      setProposal(data.proposal || data.reason || "No proposal was returned.");
    } catch (e) {
      setProposal(e instanceof Error ? e.message : "Unable to generate proposal");
    } finally { setAiLoading(false); }
  }

  return <div className="min-h-screen flex flex-col bg-[#0D163F]">
    <Navbar />
    <main className="flex-1 pt-24 px-5 pb-10">
      <div className="max-w-[1900px] mx-auto bg-white rounded-xl overflow-hidden">

        <div className="flex items-center gap-4 border-b p-5">
          <img src="https://cdn.simpleicons.org/freelancer/29B2FE" alt="" width={70} height={70} className="h-14 w-14 shrink-0 md:h-16 md:w-16" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#29B2FE] md:text-xl">Latest Queue Jobs</h1>
            <p className="mt-1 text-sm text-gray-500">Showing {jobs.length} queued jobs</p>
          </div>
        </div>
        {loading && <div className="p-5">Loading...</div>}
        {error && <div role="alert" className="m-5 bg-red-100 text-red-700 p-3 rounded">{error}</div>}
        {!loading && !error && jobs.length === 0 && <div className="p-5 text-gray-500">No Freelancer jobs in the queue.</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100"><tr>
              {["S.NO", "STATUS", "TITLE", "URL", "DESCRIPTION", "COUNTRY", "CLIENT", "BUDGET", "PUBLISHED TIME", "QUEUED DATE", "ACTIVITY", "ACTION"].map(label =>
                <th key={label} className="p-3 text-left">{label}</th>)}
            </tr></thead>
            <tbody>{jobs.map((job, index) => <tr key={job._id || job.jobId} className="border-b hover:bg-gray-50 align-top">
              <td className="p-3 font-semibold">{index + 1}</td>
              <td className="p-3 whitespace-nowrap">
                {job.isPreviousClient && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">Previous Client</span>}
                {job.isFeatured && <span className="block bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs mt-2">Featured</span>}
                {job.applied && <span className="block bg-green-100 text-green-700 px-2 py-1 rounded text-xs mt-2">Applied</span>}
                {!job.isPreviousClient && !job.isFeatured && !job.applied && "—"}
              </td>
              <td className="p-3 font-semibold min-w-[220px]">{job.title}</td>
              <td className="p-3">{job.url ? <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline whitespace-nowrap">View Job</a> : "—"}</td>
              <td className="p-3 min-w-[350px] max-w-[450px] text-gray-600"><p className="line-clamp-4">{job.description || "—"}</p></td>
              <td className="p-3">{job.country || "—"}</td>
              <td className="p-3 text-xs whitespace-nowrap">
                <p>Posted: {job.rawJob?.client?.totalPostedJobs ?? "—"}</p>
                <p>Spent: {job.rawJob?.client?.totalSpent?.displayValue || "—"}</p>
                <p>Hires: {job.rawJob?.client?.totalHires ?? "—"}</p>
                <p>{job.rawJob?.client?.verificationStatus || "Verification unknown"}</p>
              </td>
              <td className="p-3 whitespace-nowrap">{job.budget || "—"}</td>
              <td className="p-3 text-xs whitespace-nowrap">{formatDate(job.publishedDateTime)}</td>
              <td className="p-3 text-xs whitespace-nowrap">{formatDate(job.createdAt)}</td>
              <td className="p-3 text-xs whitespace-nowrap">
                <p>Bids: {job.rawJob?.totalApplicants ?? "—"}</p>
                <p>Interview: {job.rawJob?.activity?.totalInvitedToInterview ?? "—"}</p>
                <p>Invites: {job.rawJob?.activity?.invitesSent ?? "—"}</p>
                <p>Unanswered: {job.rawJob?.activity?.totalUnansweredInvites ?? "—"}</p>
              </td>
              <td className="p-3">
                <button type="button" onClick={() => void generateProposal(job)} className="bg-blue-600 text-white px-3 py-2 rounded text-xs mb-2 whitespace-nowrap">AI Proposal</button>
                <button type="button" onClick={() => setDeleteJob(job)} className="border px-3 py-2 rounded text-xs block whitespace-nowrap">Remove</button>
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </main>
    <Footer />
    {deleteJob && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="font-bold text-lg">Remove Job?</h2>
        <p className="mt-3 text-gray-600">{deleteJob.title}</p>
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" disabled={removing} onClick={() => setDeleteJob(null)} className="border px-4 py-2 rounded">Cancel</button>
          <button type="button" disabled={removing} onClick={() => void removeJob()} className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50">{removing ? "Removing..." : "Yes, Remove"}</button>
        </div>
      </div>
    </div>}
    {aiJob && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl">
        <div className="flex justify-between gap-3"><h2 className="font-bold">AI Proposal: {aiJob.title}</h2><button type="button" onClick={() => setAiJob(null)} aria-label="Close proposal">✕</button></div>
        {aiLoading ? <p className="mt-5">Generating...</p> : <textarea className="w-full h-80 border rounded mt-5 p-3" value={proposal} onChange={e => setProposal(e.target.value)} />}
      </div>
    </div>}
  </div>;
}