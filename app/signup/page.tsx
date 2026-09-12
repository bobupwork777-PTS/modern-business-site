"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Signup() {

    const router = useRouter();

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        dob: "",
        address: "",
        state: "",
        pin: "",
        gender: "",
        role: "",
        password: ""
    });


    const handleChange = (e: any) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        });

    };


    const signup = async () => {

        const res = await fetch("/api/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(form)
        });


        const data = await res.json();


        if (res.ok) {

            alert("Account created");

            router.push("/login");

        }

        else {

            alert(data.error);

        }

    };



    return (
        <div className="min-h-screen bg-[#0D163F] flex items-center justify-center p-6">

            <div className="bg-white rounded-2xl p-8 w-full max-w-2xl">

                <h1 className="text-3xl font-bold text-center mb-6">
                    Create Account
                </h1>


                <div className="grid md:grid-cols-2 gap-4">

                    <input name="name" onChange={handleChange} className="border p-3 rounded" placeholder="Full Name" />
                    <input name="email" onChange={handleChange} className="border p-3 rounded" placeholder="Email" />
                    <input name="phone" onChange={handleChange} className="border p-3 rounded" placeholder="Phone Number" />
                    <input name="dob" onChange={handleChange} className="border p-3 rounded" type="date" />
                    <input name="address" onChange={handleChange} className="border p-3 rounded md:col-span-2" placeholder="Address" />
                    <input name="state" onChange={handleChange} className="border p-3 rounded" placeholder="State" />
                    <input name="pin" onChange={handleChange} className="border p-3 rounded" placeholder="PIN Code" />
                    <input name="password" onChange={handleChange} className="border p-3 rounded" type="password" placeholder="Password" />

                </div>



                <div className="mt-5">

                    <p className="font-medium mb-2">
                        Gender
                    </p>

                    <label className="mr-5">
                        <input
                            type="radio"
                            name="gender"
                            value="Male"
                            onChange={handleChange}
                        /> Male
                    </label>


                    <label>
                        <input
                            type="radio"
                            name="gender"
                            value="Female"
                            onChange={handleChange}
                        /> Female
                    </label>

                </div>




                <div className="mt-5">

                    <p className="font-medium mb-2">
                        Account Type
                    </p>


                    <label className="mr-5">

                        <input
                            type="radio"
                            name="role"
                            value="User"
                            onChange={handleChange}
                        /> User

                    </label>


                    <label>

                        <input
                            type="radio"
                            name="role"
                            value="Admin"
                            onChange={handleChange}
                        /> Admin

                    </label>


                </div>



                <button
                    onClick={signup}
                    className="mt-6 bg-blue-600 hover:bg-blue-700 text-white w-full py-3 rounded-lg"
                >
                    Create Account
                </button>



                <p className="text-center mt-5">

                    Already have account?

                    <Link href="/login" className="text-blue-600 ml-2">
                        Login
                    </Link>

                </p>


            </div>

        </div>
    )

}