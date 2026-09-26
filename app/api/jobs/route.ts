import { connectDB } from "@/lib/mongodb";
import Job from "@/lib/models/Job";

export async function POST(req: Request) {
    try {
        await connectDB();
        const jobs = await req.json();

        const formattedJobs = jobs.map((job: any) => ({
            title: job.Title,
            description: job.Description,
            budget: job.Budget,
            score: job.score,
            matchedSkills: job.matchedSkills || []
        }));

        const result = await Job.insertMany(formattedJobs);

        return Response.json({ success: true, count: result.length });
    } catch (error) {
        console.error(error);
        return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
}