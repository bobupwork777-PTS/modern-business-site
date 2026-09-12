import {NextResponse} from "next/server";
import {connectDB} from "@/lib/mongodb";
import User from "@/lib/models/User";


export async function GET(
req:Request,
context:any
){

try{

await connectDB();


const {id}=await context.params;


const user=await User.findById(id)
.select("-password -resetToken -resetTokenExpiry");


if(!user){

return NextResponse.json(
{
error:"User not found"
},
{
status:404
}
);

}


return NextResponse.json({

id:user._id,
name:user.name,
email:user.email,
phone:user.phone,
dob:user.dob,
address:user.address,
state:user.state,
pin:user.pin,
gender:user.gender,
role:user.role

});


}
catch(error){

console.log(error);

return NextResponse.json(
{
error:"Profile API failed"
},
{
status:500
}
);

}

}