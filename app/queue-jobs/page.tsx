"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Job = {
    _id: string;
    jobId: string;
    title: string;
    description: string;
    url: string;
    country: string;
    budget: string;
    publishedDateTime: string;
    createdAt?: string;
    applied: boolean;
    isFeatured: boolean;
    isPreviousClient: boolean;
    rawJob?: any;
};


const formatDate = (date?: string) => {
    if (!date) return "-";
    const d = new Date(date);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
};


export default function QueuePage() {

    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deleteJob, setDeleteJob] = useState<Job | null>(null);
    const [removing, setRemoving] = useState("");

    const [aiJob, setAiJob] = useState<Job | null>(null);
    const [proposal, setProposal] = useState("");
    const [aiLoading, setAiLoading] = useState(false);



    useEffect(() => {
        loadQueue();
    }, []);



    async function loadQueue() {

        try {

            const res = await fetch("/api/upwork/queue", { cache: "no-store" });
            const data = await res.json();

            if (!data.success) throw Error(data.error);

            setJobs(data.queue || []);

        } catch (e: any) {

            setError(e.message);

        } finally {

            setLoading(false);

        }

    }



    async function removeJob(id: string) {

        try {

            setRemoving(id);

            const res = await fetch(
                `/api/upwork/queue?jobId=${id}`,
                {
                    method: "DELETE"
                }
            );

            const data = await res.json();

            if (!data.success)
                throw Error(data.error);


            setJobs(prev => prev.filter(j => j.jobId !== id));


        } catch (e: any) {

            alert(e.message);

        } finally {

            setRemoving("");

        }

    }



    async function generateProposal(job: Job) {

        setAiJob(job);
        setProposal("");
        setAiLoading(true);


        try {

            const res = await fetch("/api/analyze", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    job: {
                        title: job.title,
                        description: job.description,
                        budget: job.budget,
                        country: job.country
                    }

                })

            });


            const data = await res.json();

            setProposal(
                data.proposal ||
                data.error ||
                "No proposal generated"
            );


        } catch (e: any) {

            setProposal(e.message);

        } finally {

            setAiLoading(false);

        }

    }



    return (

        <div className="min-h-screen flex flex-col bg-[#0D163F]">

            <Navbar />


            <main className="flex-1 pt-24 px-5 pb-10">


                <div className="max-w-[1900px] mx-auto bg-white rounded-xl overflow-hidden">


                    <div className="p-5 border-b">

                        <h1 className="text-xl font-bold">
                            Latest Queue Jobs
                        </h1>

                        <p className="text-sm text-gray-500">
                            Showing {jobs.length} queued jobs
                        </p>

                    </div>



                    {loading &&
                        <div className="p-5">
                            Loading...
                        </div>
                    }



                    {error &&
                        <div className="m-5 bg-red-100 text-red-700 p-3 rounded">
                            {error}
                        </div>
                    }



                    <div className="overflow-x-auto">


                        <table className="w-full text-sm">


                            <thead className="bg-gray-100">

                                <tr>

                                    <th className="p-3 text-left">S.NO</th>
                                    <th className="p-3 text-left">STATUS</th>
                                    <th className="p-3 text-left">TITLE</th>
                                    <th className="p-3 text-left">URL</th>
                                    <th className="p-3 text-left">DESCRIPTION</th>
                                    <th className="p-3 text-left">COUNTRY</th>
                                    <th className="p-3 text-left">CLIENT</th>
                                    <th className="p-3 text-left">BUDGET</th>
                                    <th className="p-3 text-left">PUBLISHED TIME</th>
                                    <th className="p-3 text-left">QUEUED DATE</th>
                                    <th className="p-3 text-left">ACTIVITY</th>
                                    <th className="p-3 text-left">ACTION</th>

                                </tr>

                            </thead>



                            <tbody>


                                {jobs.map((job, index) => (


                                    <tr
                                        key={job._id}
                                        className="border-b hover:bg-gray-50 align-top"
                                    >


                                        <td className="p-3 font-semibold">
                                            {index + 1}
                                        </td>



                                        <td className="p-3">


                                            {job.isPreviousClient &&

                                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                                                    Previous Client
                                                </span>

                                            }


                                            {job.applied &&

                                                <span className="block bg-green-100 text-green-700 px-2 py-1 rounded text-xs mt-2">
                                                    Applied
                                                </span>

                                            }


                                        </td>




                                        <td className="p-3 font-semibold max-w-[220px]">
                                            {job.title}
                                        </td>




                                        <td className="p-3">

                                            <a
                                                href={job.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline whitespace-nowrap"
                                            >
                                                View Job
                                            </a>

                                        </td>




                                        <td className="p-3 max-w-[350px] text-gray-600">

                                            {job.description?.slice(0, 180)}...

                                        </td>




                                        <td className="p-3">
                                            {job.country}
                                        </td>




                                        <td className="p-3 text-xs">

                                            <p>
                                                Posted: {job.rawJob?.client?.totalPostedJobs || 0}
                                            </p>

                                            <p>
                                                Spent: {job.rawJob?.client?.totalSpent?.displayValue || "-"}
                                            </p>

                                            <p>
                                                Hires: {job.rawJob?.client?.totalHires || 0}
                                            </p>

                                            <p>
                                                {job.rawJob?.client?.verificationStatus}
                                            </p>

                                        </td>




                                        <td className="p-3">
                                            {job.budget}
                                        </td>




                                        <td className="p-3 text-xs">
                                            {formatDate(job.publishedDateTime)}
                                        </td>




                                        <td className="p-3 text-xs">
                                            {formatDate(job.createdAt)}
                                        </td>




                                        <td className="p-3 text-xs">

                                            <p>
                                                Applicants: {job.rawJob?.totalApplicants || 0}
                                            </p>

                                            <p>
                                                Interview: {job.rawJob?.activity?.totalInvitedToInterview || 0}
                                            </p>

                                            <p>
                                                Invites: {job.rawJob?.activity?.invitesSent || 0}
                                            </p>

                                            <p>
                                                Unanswered: {job.rawJob?.activity?.totalUnansweredInvites || 0}
                                            </p>

                                        </td>




                                        <td className="p-3">


                                            <button
                                                onClick={() => generateProposal(job)}
                                                className="bg-blue-600 text-white px-3 py-2 rounded text-xs mb-2 whitespace-nowrap"
                                            >
                                                AI Proposal
                                            </button>



                                            <button
                                                onClick={() => setDeleteJob(job)}
                                                className="border px-3 py-2 rounded text-xs block whitespace-nowrap"
                                            >
                                                Remove
                                            </button>


                                        </td>


                                    </tr>


                                ))}


                            </tbody>


                        </table>


                    </div>


                </div>


            </main>


            <Footer />




            {deleteJob &&

                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">


                    <div className="bg-white rounded-xl p-6 w-full max-w-md">


                        <h2 className="font-bold text-lg">
                            Remove Job?
                        </h2>


                        <p className="mt-3 text-gray-600">
                            {deleteJob.title}
                        </p>


                        <div className="flex justify-end gap-3 mt-6">


                            <button
                                onClick={() => setDeleteJob(null)}
                                className="border px-4 py-2 rounded"
                            >
                                Cancel
                            </button>


                            <button
                                onClick={() => {
                                    removeJob(deleteJob.jobId);
                                    setDeleteJob(null);
                                }}
                                className="bg-red-600 text-white px-4 py-2 rounded"
                            >

                                {removing === ""

                                    ?
                                    "Yes, Remove"
                                    :
                                    "Removing..."
                                }

                            </button>


                        </div>


                    </div>


                </div>

            }





            {aiJob &&

                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">


                    <div className="bg-white rounded-xl p-6 w-full max-w-3xl">


                        <div className="flex justify-between">

                            <h2 className="font-bold">
                                AI Proposal
                            </h2>


                            <button onClick={() => setAiJob(null)}>
                                ✕
                            </button>


                        </div>



                        {aiLoading

                            ?

                            <p className="mt-5">
                                Generating...
                            </p>

                            :

                            <textarea
                                className="w-full h-80 border rounded mt-5 p-3"
                                value={proposal}
                                readOnly
                            />

                        }


                    </div>


                </div>

            }


        </div>

    );

}