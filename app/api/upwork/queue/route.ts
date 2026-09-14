import {
  NextRequest,
  NextResponse
} from "next/server";

import { connectDB } from "@/lib/mongodb";
import QueuedJob from "@/lib/models/QueuedJob";

function getJobUrl(job: any) {
  if (job?.url) {
    return job.url;
  }

  if (!job?.ciphertext) {
    return "";
  }

  const code = String(
    job.ciphertext
  ).startsWith("~")
    ? job.ciphertext
    : `~${job.ciphertext}`;

  return `https://www.upwork.com/jobs/${code}`;
}

function getBudget(job: any) {
  const min =
    job?.hourlyBudgetMin
      ?.displayValue;

  const max =
    job?.hourlyBudgetMax
      ?.displayValue;

  if (min) {
    return max
      ? `${min} - ${max}/hr`
      : `${min}/hr`;
  }

  if (
    job?.amount?.displayValue
  ) {
    return `Fixed ${job.amount.displayValue}`;
  }

  return "Not specified";
}

export async function GET(
  request: NextRequest
) {
  try {
    await connectDB();

    const { searchParams } =
      new URL(request.url);

    const userId =
      searchParams.get("userId") ||
      "global";

    const items =
      await QueuedJob.find({
        userId
      })
        .sort({
          createdAt: -1
        })
        .lean();

    return NextResponse.json({
      success: true,
      queue: items,
      queuedJobIds: items.map(
        item => item.jobId
      ),
      total: items.length
    });

  } catch (error) {
    console.error(
      "GET QUEUE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        queue: [],
        queuedJobIds: [],
        total: 0,
        error:
          "Unable to fetch queue"
      },
      {
        status: 500
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    await connectDB();

    const body =
      await request.json();

    const userId = String(
      body?.userId || "global"
    );

    const job = body?.job;

    if (!job?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Job is required"
        },
        {
          status: 400
        }
      );
    }

    const existing =
      await QueuedJob.findOne({
        userId,
        jobId: String(job.id)
      });

    if (existing) {
      return NextResponse.json({
        success: true,
        queued: true,
        alreadyQueued: true,
        item: existing
      });
    }

    const item =
      await QueuedJob.create({
        userId,

        jobId:
          String(job.id),

        title:
          job.title || "",

        description:
          job.description || "",

        url:
          getJobUrl(job),

        country:
          job.client
            ?.location
            ?.country || "",

        budget:
          getBudget(job),

        publishedDateTime:
          job.publishedDateTime ||
          "",

        applied:
          job.applied === true,

        isFeatured:
          job.isFeatured === true ||
          job.premium === true,

        isPreviousClient:
          job.isPreviousClient === true ||
          Boolean(
            job.freelancerClientRelation
          ),

        rawJob:
          job
      });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        item
      },
      {
        status: 201
      }
    );

  } catch (error: any) {
    console.error(
      "ADD QUEUE ERROR:",
      error
    );

    if (error?.code === 11000) {
      return NextResponse.json({
        success: true,
        queued: true,
        alreadyQueued: true
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to add job to queue"
      },
      {
        status: 500
      }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    await connectDB();

    const { searchParams } =
      new URL(request.url);

    const userId =
      searchParams.get("userId") ||
      "global";

    const jobId =
      searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "jobId is required"
        },
        {
          status: 400
        }
      );
    }

    await QueuedJob.deleteOne({
      userId,
      jobId
    });

    return NextResponse.json({
      success: true,
      queued: false
    });

  } catch (error) {
    console.error(
      "DELETE QUEUE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to remove job from queue"
      },
      {
        status: 500
      }
    );
  }
}