"use client";

import {useState} from "react";
import {useParams,useRouter} from "next/navigation";

export default function ResetPassword(){

const {token}=useParams();
const router=useRouter();

const [password,setPassword]=useState("");
const [loading,setLoading]=useState(false);


const reset=async()=>{

if(!password){
alert("Enter new password");
return;
}

setLoading(true);

try{

const res=await fetch("/api/reset-password",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
token,
password
})
});


const data=await res.json();


if(res.ok){

alert("Password updated successfully");

router.push("/login");

}
else{

alert(data.error);

}


}
catch(error){

alert("Something went wrong");

}
finally{

setLoading(false);

}

};



return(

<div className="min-h-screen bg-[#0D163F] flex items-center justify-center p-6">

<div className="bg-white rounded-2xl p-8 w-full max-w-md">

<h1 className="text-3xl font-bold mb-6 text-center">
Reset Password
</h1>


<input
type="password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
className="border p-3 rounded w-full mb-4"
placeholder="Enter New Password"
/>


<button
onClick={reset}
disabled={loading}
className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white w-full py-3 rounded"
>
{loading ? "Updating..." : "Update Password"}
</button>


</div>

</div>

)

}