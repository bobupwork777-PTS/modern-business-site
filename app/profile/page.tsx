"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Profile() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const getProfile = async () => {
            const data = localStorage.getItem("user");
            if (!data) return router.push("/login");

            const localUser = JSON.parse(data);
            if (!localUser?.id) return router.push("/login");

            const res = await fetch(`/api/profile/${localUser.id}`);
            const profile = await res.json();

            setUser(profile);
            localStorage.setItem("user", JSON.stringify(profile));
        };
        getProfile();
    }, [router]);

    const logout = () => {
        localStorage.removeItem("user");
        router.push("/login");
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-[#0D163F] flex items-center justify-center text-white">
                Loading...
            </div>
        );
    }

    const fields = [
        ["Phone", user.phone],
        ["DOB", user.dob],
        ["Address", user.address],
        ["State", user.state],
        ["PIN", user.pin],
        ["Gender", user.gender],
    ];

    return (
        <div className="min-h-screen bg-[#0D163F] flex items-center justify-center p-5">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden">
                <div className="h-24 bg-blue-600" />
                <div className="px-6 pb-6 -mt-10">
                    <div className="w-24 h-24 rounded-full bg-white shadow flex items-center justify-center text-3xl font-bold text-blue-600 mx-auto">
                        {user.name?.[0]}
                    </div>
                    <h1 className="text-2xl font-bold text-center mt-3">{user.name}</h1>
                    <p className="text-center text-gray-500 text-sm">{user.email}</p>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                        {fields.map(([label, value], i) => (
                            <div key={i} className={`${label === "Address" ? "col-span-2" : ""} bg-gray-100 rounded-xl p-3`}>
                                <p className="text-xs text-gray-500">{label}</p>
                                <p className="font-semibold text-sm truncate">{value || "-"}</p>
                            </div>
                        ))}
                        <div className="bg-gray-100 rounded-xl p-3">
                            <p className="text-xs text-gray-500">Role</p>
                            <span className="inline-block mt-1 bg-blue-600 text-white px-3 py-1 rounded-full text-xs">
                                {user.role}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm">
                            Edit Profile
                        </button>
                        <button onClick={logout} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm">
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}