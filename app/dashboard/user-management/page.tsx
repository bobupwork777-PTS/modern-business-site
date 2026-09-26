"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";


export default function UserPage() {

    const [users, setUsers] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);



    useEffect(() => {
        loadData();
    }, []);



    const loadData = async () => {

        try {

            const res = await fetch("/api/user-management", {
                cache: "no-store"
            });


            const data = await res.json();


            setUsers(data.users || []);
            setPages(data.pages || []);
            setPermissions(data.permissions || []);


        } catch (error) {

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


            await fetch("/api/user-management", {

                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },


                body: JSON.stringify({

                    userId,
                    pageId,
                    access

                })

            });



            await loadData();



        } catch(error){

            console.log(error);

        }


    };





    return (

        <div className="min-h-screen bg-[#0D163F]">

            <Navbar />


            <main className="pt-24 px-5 pb-10">


                <div className="bg-white rounded-xl overflow-auto">


                    <h1 className="p-5 text-xl font-bold border-b">
                        User Management
                    </h1>


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
                                pages.map(page => (

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
                        users.map(user => (

                            <tr
                            key={user._id}
                            className="border-b"
                            >


                                <td className="p-3">

                                    <div>

                                        <p className="font-medium">
                                            {user.name}
                                        </p>

                                        <p className="text-sm text-gray-500">
                                            {user.email}
                                        </p>

                                    </div>

                                </td>



                                {
                                pages.map(page => (

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


                                        onChange={(e)=>

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