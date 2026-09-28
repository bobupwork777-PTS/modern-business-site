import { NextRequest, NextResponse } from "next/server";
import mongoose, { Schema } from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Queue = mongoose.models.FreelancerQueuedJob || mongoose.model("FreelancerQueuedJob", new Schema({
  jobId: { type: String, required: true, unique: true },
  job: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
}, { collection: "freelancerQueuedJobs" }));

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing");
  if (mongoose.connection.readyState !== 1) await mongoose.connect(uri);
}

function toRow(record: any) {
  const job = record.job || {};
  const hourlyMin = job.hourlyBudgetMin?.displayValue;
  const hourlyMax = job.hourlyBudgetMax?.displayValue;
  const budget = hourlyMin || hourlyMax
    ? `${hourlyMin || "?"} – ${hourlyMax || "?"}/hr`
    : job.amount?.displayValue || "Not specified";
  return {
    _id: String(record._id), jobId: record.jobId, title: job.title || "Untitled job",
    description: job.description || "", url: job.url || "",
    country: job.client?.location?.country || "", budget,
    publishedDateTime: job.publishedDateTime || "",
    createdAt: record.createdAt, applied: job.applied === true,
    isFeatured: job.isFeatured === true || job.premium === true,
    isPreviousClient: job.isPreviousClient === true,
    rawJob: job
  };
}

export async function GET() {
  try {
    await connect();
    const records = await Queue.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, queue: records.map(toRow), queuedJobIds: records.map((r: any) => r.jobId) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Queue unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { job } = await req.json();
    if (!job || !job.id || !job.title) return NextResponse.json({ success: false, error: "A valid job is required" }, { status: 400 });
    await connect();
    await Queue.updateOne({ jobId: String(job.id) }, { $setOnInsert: { jobId: String(job.id), job, createdAt: new Date() } }, { upsert: true });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Unable to queue job" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ success: false, error: "jobId is required" }, { status: 400 });
  try {
    await connect();
    await Queue.deleteOne({ jobId });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Unable to remove job" }, { status: 500 });
  }
}