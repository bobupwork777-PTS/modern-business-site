import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Job from "@/lib/models/Job";

export async function GET() {
  try {

    await connectDB();

    const jobs = await Job.find({});

    const skillCount:any = {};

    jobs.forEach((job:any)=>{

      job.matchedSkills?.forEach((skill:string)=>{

        skillCount[skill] = (skillCount[skill] || 0) + 1;

      });

    });


    const result = Object.keys(skillCount).map(skill=>({
      name: skill,
      value: skillCount[skill]
    }));


    return NextResponse.json(result);


  } catch(error){

    return NextResponse.json(
      {error:"Failed to load skills"},
      {status:500}
    );

  }
}