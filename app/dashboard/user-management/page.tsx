"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useRouter } from "next/navigation";


export default function UserPage() {

    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);



    useEffect(() => {
        loadData();
    }, []);



    const loadData = async () => {

        try {

            const res = await fetch(
                "/api/user-management",
                {
                    cache: "no-store"
                }
            );

            const data = await res.json();

            setUsers(data.users || []);
            setPages(data.pages || []);
            setPermissions(data.permissions || []);

        }
        catch (error) {

            console.log(error);

        }
        finally {

            setLoading(false);

        }

    };




    const checkPermission = (
        userId: string,
        pageId: string
    ) => {

        return permissions.some(
            (item) =>
                String(item.userId) === String(userId) &&
                String(item.pageId) === String(pageId) &&
                item.access === true
        );

    };




    const updatePermission = async (
        userId: string,
        pageId: string,
        access: boolean
    ) => {

        try {

            await fetch(
                "/api/user-management",
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        userId,
                        pageId,
                        access
                    })
                }
            );


            loadData();

        }
        catch (error) {

            console.log(error);

        }

    };




    return (

        <div className="min-h-screen bg-[#0D163F]">

            <Navbar />


            <main className="pt-24 px-5 pb-10">

                <div className="bg-white rounded-xl overflow-auto">


                    <div className="flex justify-between items-center p-5 border-b ">

                        <h1 className="text-xl font-bold">
                            User Management
                        </h1>

                        <button
                            onClick={() => router.push("/signup?admin=true")}
                            className="
                            bg-blue-600
                            text-white
                            px-4
                            py-2
                            rounded-lg
                            text-sm
                            font-semibold
                            hover:bg-blue-700
                            "
                        >
                            Create New User
                        </button>


                    </div>




                    {
                        loading ?

                            <div className="p-5">
                                Loading...
                            </div>


                            :


                            <table className="w-full">


                                <thead className="bg-gray-100">

                                    <tr>

                                        <th className="p-3 text-left">
                                            User
                                        </th>


                                        {
                                            pages.map((page) => (

                                                <th
                                                    key={page._id}
                                                    className="p-3"
                                                >
                                                    {page.name}
                                                </th>

                                            ))
                                        }

                                    </tr>

                                </thead>



                                <tbody>


                                    {
                                        users.map((user) => (

                                            <tr
                                                key={user._id}
                                                className="border-b"
                                            >


                                                <td className="p-3">

                                                    <p className="font-medium">
                                                        {user.name}
                                                    </p>

                                                    <p className="text-sm text-gray-500">
                                                        {user.email}
                                                    </p>

                                                </td>



                                                {
                                                    pages.map((page) => (

                                                        <td
                                                            key={page._id}
                                                            className="text-center"
                                                        >

                                                            <input
                                                                type="checkbox"

                                                                checked={
                                                                    checkPermission(
                                                                        user._id,
                                                                        page._id
                                                                    )
                                                                }

                                                                onChange={(e) =>
                                                                    updatePermission(
                                                                        user._id,
                                                                        page._id,
                                                                        e.target.checked
                                                                    )
                                                                }

                                                            />

                                                        </td>

                                                    ))
                                                }


                                            </tr>

                                        ))
                                    }


                                </tbody>


                            </table>

                    }


                </div>

            </main>


            <Footer />

        </div>

    );

}