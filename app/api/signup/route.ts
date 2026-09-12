import {NextResponse} from "next/server";
import {connectDB} from "@/lib/mongodb";
import User from "@/lib/models/User";

export async function POST(req:Request){

try{

await connectDB();

const data=await req.json();

const user=await User.create(data);

return NextResponse.json({
message:"Account created",
user
});

}
catch(error){

return NextResponse.json(
{error:"Signup failed"},
{status:500}
);

}

}