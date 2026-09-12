import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Job from "@/lib/models/Job";


export async function GET() {

    try {

        await connectDB();


        const jobs = await Job.find({});



        // Skills

        const skillMap:any = {};

        jobs.forEach((j:any)=>
            j.matchedSkills?.forEach((s:string)=>
                skillMap[s]=(skillMap[s] || 0)+1
            )
        );


        const skills = Object.keys(skillMap)
            .map(s=>({
                name:s,
                value:skillMap[s]
            }))
            .sort((a,b)=>b.value-a.value)
            .slice(0,10);





        // Technology Distribution

        const techMap:any = {};

        jobs.forEach((j:any)=>
            j.matchedSkills?.forEach((s:string)=>
                techMap[s]=(techMap[s] || 0)+1
            )
        );


        const technologyDistribution = Object.keys(techMap)
            .map(s=>({
                name:s,
                value:techMap[s]
            }))
            .sort((a,b)=>b.value-a.value)
            .slice(0,8);







        // Job Growth Trend

        const monthOrder = [
            "Jan","Feb","Mar","Apr",
            "May","Jun","Jul","Aug",
            "Sep","Oct","Nov","Dec"
        ];


        const monthMap:any = {};


        jobs.forEach((j:any)=>{


            const d = j.createdAt
                ? new Date(j.createdAt)
                : j._id.getTimestamp();



            const month = d.toLocaleString("en-US",{
                month:"short",
                year:"numeric"
            });



            monthMap[month]=(monthMap[month] || 0)+1;


        });



        const monthlyTrend = Object.keys(monthMap)
            .map(month=>({
                month,
                jobs:monthMap[month]
            }))
            .sort((a,b)=>{


                const [m1,y1]=a.month.split(" ");
                const [m2,y2]=b.month.split(" ");



                return (
                    Number(y1)-Number(y2) ||
                    monthOrder.indexOf(m1)-monthOrder.indexOf(m2)
                );


            });








        // Budget Extract

        const getBudget=(v:string)=>{

            const n=v?.match(/\d+(\.\d+)?/g);

            return n ? Number(n[n.length-1]) : 0;

        };







        // Budget vs Skills

        const scatterData = jobs
            .map((j:any)=>({

                skills:j.matchedSkills?.length || 0,

                budget:getBudget(j.budget)

            }))
            .filter((x:any)=>x.budget>0);









        // Budget Histogram

        const ranges=[
            "0-10",
            "10-50",
            "50-100",
            "100-200",
            "200-500",
            "500-1000",
            "1000-2000",
            "2000-5000"
        ];



        const budgetRange:any={};


        ranges.forEach(r=>budgetRange[r]=0);



        jobs.forEach((j:any)=>{


            const b=getBudget(j.budget);



            if(b<=10)
                budgetRange["0-10"]++;

            else if(b<=50)
                budgetRange["10-50"]++;

            else if(b<=100)
                budgetRange["50-100"]++;

            else if(b<=200)
                budgetRange["100-200"]++;

            else if(b<=500)
                budgetRange["200-500"]++;

            else if(b<=1000)
                budgetRange["500-1000"]++;

            else if(b<=2000)
                budgetRange["1000-2000"]++;

            else
                budgetRange["2000-5000"]++;


        });



        const histogram = ranges.map(range=>({

            range,

            jobs:budgetRange[range]

        }));









        // Funnel

        const funnel=[
            ["Jobs Found",1],
            ["Analyzed",0.7],
            ["Applied",0.4],
            ["Interview",0.15],
            ["Won",0.05]
        ].map(([stage,value]:any)=>({

            stage,

            value:Math.floor(jobs.length*value)

        }));









        // Radar

        const radar = skills
            .slice(0,6)
            .map(s=>({

                skill:s.name,

                score:s.value

            }));







        return NextResponse.json({

            totalJobs:jobs.length,


            totalMatches:
                skills.reduce(
                    (a,b)=>a+b.value,
                    0
                ),


            skills,

            technologyDistribution,

            monthlyTrend,

            scatterData,

            histogram,

            funnel,

            radar

        });


    }
    catch(error){

        console.log(error);


        return NextResponse.json({

            error:"Dashboard failed"

        },{
            status:500
        });

    }

}