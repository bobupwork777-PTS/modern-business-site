"use client";

import {useState} from "react";


export default function ForgotPassword(){


const [email,setEmail]=useState("");



const submit=async()=>{


const res=await fetch(
"/api/forgot-password",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
email
})

});


const data=await res.json();


alert(data.message || data.error);


};



return(

<div className="min-h-screen bg-[#0D163F] flex items-center justify-center p-6">

<div className="bg-white rounded-2xl p-8 w-full max-w-md">


<h1 className="text-3xl font-bold mb-6 text-center">
Forgot Password
</h1>


<input

className="border p-3 rounded w-full mb-4"

placeholder="Email"

onChange={(e)=>setEmail(e.target.value)}

/>


<button

onClick={submit}

className="bg-blue-600 text-white w-full py-3 rounded"

>
Send Reset Link
</button>


</div>

</div>

)

}