"use client";

import { useState } from "react";
import Link from "next/link";

export default function Login() {
    const [form, setForm] = useState({
        email: "",
        password: ""
    });
    const [loading, setLoading] = useState(false);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const login = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(form)
            });

            const data = await res.json();
            if(!res.ok){
                alert(data.error || "Email failed");
                return;

            }

            console.log("LOGIN RESPONSE:", data);

            if (res.ok) {
                if(!data.user){
                    alert("User data not found");
                    return;
                }

                // Save user data
                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );

                // Save authentication
                document.cookie =
                "token=true; path=/; max-age=86400";

                document.cookie =
                `role=${data.user.role}; path=/; max-age=86400`;

                alert("Login successful");

                // Role based redirect
                if(data.user.role === "admin"){
                    window.location.href="/";
                }
                else{
                    window.location.href="/";
                }
            }
            else {
                alert(data.error);
            }
        }
        catch(error){
            console.log(error);
            alert("Something went wrong");
        }
        finally{
            setLoading(false);
        }
    };
    return (
        <div className="min-h-screen bg-[#0D163F] flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md">
                <h1 className="text-3xl font-bold text-center mb-6">
                    Login
                </h1>
                <input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="border p-3 rounded w-full mb-4"
                    placeholder="Email"
                    type="email"
                />
                <input
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    type="password"
                    className="border p-3 rounded w-full mb-4"
                    placeholder="Password"
                />
                <button
                    onClick={login}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white w-full py-3 rounded-lg"
                >
                    {
                        loading
                        ? "Logging in..."
                        : "Login"
                    }
                </button>

                <div className="flex justify-between mt-5 text-sm">
                    <Link
                        href="/forgot-password"
                        className="text-blue-600"
                    >
                        Forgot Password?
                    </Link>
                    <Link
                        href="/signup"
                        className="text-blue-600"
                    >
                        Create Account?
                    </Link>
                </div>
            </div>
        </div>
    );
}