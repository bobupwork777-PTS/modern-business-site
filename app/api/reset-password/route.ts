import {NextResponse} from "next/server";
import {connectDB} from "@/lib/mongodb";
import User from "@/lib/models/User";


export async function POST(req:Request){


await connectDB();


const {
token,
password
}=await req.json();



const user=await User.findOne({

resetToken:token,

resetTokenExpiry:{
$gt:Date.now()
}

});



if(!user){

return NextResponse.json(
{
error:"Invalid or expired link"
},
{
status:400
}
);

}



user.password=password;

user.resetToken=null;

user.resetTokenExpiry=null;


await user.save();



return NextResponse.json({

message:"Password updated"

});


}