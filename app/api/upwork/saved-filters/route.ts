import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SavedFilter from "@/lib/models/SavedFilter";



export async function POST(
    request:NextRequest
){

    try{

        await connectDB();

        const body = await request.json();
        const filter = await SavedFilter.create(body);
        
        return NextResponse.json({
            success:true,
            filter
        });

    }
    catch(error){

        console.error( "SAVE FILTER ERROR", error );

        return NextResponse.json(
            {
                success:false,
                error:"Unable to save filter"
            },
            {
                status:500
            }
        );
    }

}





export async function GET(
    request:NextRequest
){
    try{
        await connectDB();
        const {searchParams} =
            new URL(
                request.url
            );
        const userId =
            searchParams.get(
                "userId"
            );
        const filters =
            await SavedFilter.find({
                userId
            })
            .sort({
                createdAt:-1
            });
        return NextResponse.json({

            success:true,
            filters

        });
    }
    catch(error){

        return NextResponse.json(
            {
                success:false,
                error:"Unable to load filters"
            },
            {
                status:500
            }
        );

    }

}