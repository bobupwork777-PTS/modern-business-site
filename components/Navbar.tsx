"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";


export default function Navbar() {

    const { user, loading, setUser } = useAuth();

    const [pages, setPages] = useState<any[]>([]);



    useEffect(() => {

        if (user?._id) {

            console.log("USER DATA:", user);

            getPermissions(user._id);

        }

    }, [user]);





    const getPermissions = async (userId:string) => {

        try {

            const res = await fetch(
                "/api/my-permissions",
                {
                    method:"POST",

                    headers:{
                        "Content-Type":"application/json"
                    },

                    body:JSON.stringify({
                        userId
                    })
                }
            );


            const data = await res.json();


            console.log(
                "NAVBAR PAGES:",
                data.pages
            );


            setPages(
                data.pages || []
            );


        }
        catch(error){

            console.log(
                "Permission Error:",
                error
            );

        }

    };





    const logout = ()=>{


        localStorage.removeItem("user");


        document.cookie =
        "token=; path=/; max-age=0";


        setUser(null);


        window.location.href="/login";

    };





    if(loading)
        return null;






    const groupedPages = pages.reduce(

        (acc:any,page:any)=>{


            if(!page?.group)
                return acc;



            if(!acc[page.group]){

                acc[page.group]=[];

            }



            acc[page.group].push(page);



            return acc;


        },

        {}

    );







    const renderMenu = ()=>{


        return Object.entries(groupedPages)
        .map(([group,items]:any)=>{


            if(!items.length)
                return null;





            return (

                <div
                key={group}
                className="relative group flex items-center"
                >



                    {
                        items.length > 1 ?


                        <button
                        className="
                        flex
                        items-center
                        gap-1
                        text-sm
                        font-semibold
                        "
                        >

                            <span>
                                {group}
                            </span>


                            <span
                            className="
                            text-[10px]
                            leading-none
                            relative
                            top-[1px]
                            "
                            >
                                ▼
                            </span>


                        </button>



                        :



                        <Link
                        href={items[0].path}
                        className="
                        text-sm
                        font-semibold
                        "
                        >

                            {items[0].name}

                        </Link>

                    }






                    {
                        items.length > 1 &&


                        <div
                        className="
                        absolute
                        hidden
                        group-hover:block
                        top-full
                        left-0
                        pt-3
                        "
                        >


                            <div
                            className="
                            bg-[#111B48]
                            rounded-xl
                            w-52
                            py-2
                            shadow-xl
                            overflow-hidden
                            "
                            >


                                {
                                    items.map((page:any)=>(


                                        <Link

                                        key={page._id}

                                        href={page.path}

                                        className="
                                        block
                                        px-4
                                        py-2
                                        text-sm
                                        text-white
                                        hover:bg-blue-600
                                        transition
                                        "

                                        >

                                            {page.name}


                                        </Link>


                                    ))
                                }


                            </div>


                        </div>


                    }


                </div>

            );


        });


    };







    return (

        <header
        className="
        absolute
        top-0
        w-full
        z-50
        "
        >


            <nav
            className="
            max-w-7xl
            mx-auto
            flex
            items-center
            justify-between
            px-5
            py-5
            "
            >




                <Link

                href="/"

                className="
                text-2xl
                font-bold
                text-white
                "

                >

                    Phoenix<span className="text-blue-400">.</span>


                </Link>







                <div

                className="
                hidden
                md:flex
                items-center
                gap-8
                text-white
                "

                >

                    {renderMenu()}


                </div>







                <div

                className="
                hidden
                md:flex
                items-center
                gap-5
                text-white
                "

                >


                    {
                        user ?

                        <>


                            <Link
                            href="/profile"
                            className="text-sm font-semibold"
                            >

                                Hi {user.name}

                            </Link>




                            <button

                            onClick={logout}

                            className="
                            text-sm
                            font-semibold
                            "

                            >

                                Logout


                            </button>


                        </>



                        :



                        <>


                            <Link
                            href="/login"
                            >
                                Login
                            </Link>



                            <Link
                            href="/signup"
                            >

                                Signup

                            </Link>


                        </>

                    }



                </div>




            </nav>


        </header>

    );

}