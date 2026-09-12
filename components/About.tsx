"use client";

import { useEffect, useState } from "react";


function Counter({
    value,
    suffix = ""
}: {
    value: number;
    suffix?: string;
}) {

    const [count, setCount] = useState(0);


    useEffect(() => {

        let start = 0;


        const timer = setInterval(() => {

            start += Math.ceil(value / 40);


            if (start >= value) {

                start = value;

                clearInterval(timer);

            }


            setCount(start);


        }, 40);



        return () => clearInterval(timer);


    }, [value]);



    return <>{count}{suffix}</>;

}





export default function About() {


    return (

        <section
            id="about"
            className="py-24 bg-white overflow-hidden"
        >


            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">



                {/* LEFT */}

                <div>


                    <p className="
text-blue-600
uppercase
tracking-[0.3em]
text-sm
">

                        About Phoenix

                    </p>



                    <h2
                        className="
mt-5
text-4xl
md:text-6xl
font-extrabold
leading-tight
bg-gradient-to-r
from-blue-600
via-purple-600
to-blue-400
bg-clip-text
text-transparent
animate-gradient
"
                    >

                        We Build Digital Experiences That Matter

                    </h2>



                    <p className="
mt-6
text-lg
text-gray-600
leading-relaxed
">

                        Phoenix Consulting helps businesses transform ideas into powerful
                        digital products. From modern websites to custom applications and
                        automation solutions, we create technology that drives growth.

                    </p>





                    <div className="mt-10 flex gap-5">



                        <div
                            className="
rounded-2xl
bg-blue-50
px-7
py-5
border
border-blue-100
hover:-translate-y-2
transition
duration-500
"
                        >

                            <h3 className="
text-4xl
font-bold
text-blue-600
">

                                <Counter value={50} suffix="+" />

                            </h3>


                            <p className="text-gray-600 mt-1">
                                Projects Delivered
                            </p>


                        </div>





                        <div
                            className="
rounded-2xl
bg-purple-50
px-7
py-5
border
border-purple-100
hover:-translate-y-2
transition
duration-500
"
                        >

                            <h3 className="
text-4xl
font-bold
text-purple-600
">

                                <Counter value={10} suffix="+" />

                            </h3>


                            <p className="text-gray-600 mt-1">
                                Industries Served
                            </p>


                        </div>


                    </div>


                </div>









                {/* RIGHT AI VISUAL */}



                <div className="relative flex justify-center">



                    <div
                        className="
absolute
w-96
h-96
bg-blue-500/20
blur-3xl
rounded-full
animate-pulse
"
                    />





                    <div
                        className="
relative
w-full
h-[430px]
rounded-[40px]
overflow-hidden
border
border-gray-200
bg-gradient-to-br
from-blue-50
via-white
to-purple-50
shadow-2xl
"
                    >





                        {/* Scanner */}

                        <div
                            className="
absolute
top-0
left-0
w-full
h-24
bg-gradient-to-b
from-blue-400/30
to-transparent
animate-[scan_4s_linear_infinite]
"
                        />






                        {/* Particles */}


                        <div
                            className="
absolute
top-24
left-20
w-3
h-3
rounded-full
bg-blue-500
animate-[particle_5s_linear_infinite]
"
                        />


                        <div
                            className="
absolute
top-40
right-24
w-4
h-4
rounded-full
bg-purple-500
animate-[particle_7s_linear_infinite]
"
                        />


                        <div
                            className="
absolute
bottom-24
left-32
w-2
h-2
rounded-full
bg-blue-400
animate-ping
"
                        />






                        {/* AI Core */}


                        <div
                            className="
absolute
inset-0
flex
items-center
justify-center
"
                        >


                            <div
                                className="
relative
w-72
h-72
"
                            >



                                {/* Outer Ring */}

                                <div
                                    className="
absolute
inset-0
rounded-full
border
border-blue-300/60
animate-[spin_20s_linear_infinite]
"
                                />



                                {/* Inner Ring */}

                                <div
                                    className="
absolute
inset-8
rounded-full
border
border-purple-300/60
animate-[spin_12s_linear_infinite_reverse]
"
                                />






                                {/* Core */}

                                <div
                                    className="
absolute
top-1/2
left-1/2
-translate-x-1/2
-translate-y-1/2
w-32
h-32
rounded-full
bg-gradient-to-br
from-blue-600
to-purple-600
flex
items-center
justify-center
shadow-[0_0_80px_rgba(59,130,246,0.7)]
animate-[corePulse_3s_ease-in-out_infinite]
"
                                >



                                    <svg
                                        className="w-16 h-16 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >


                                        <path
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="
M12 2
L14 8
L20 10
L14 12
L12 22
L10 12
L4 10
L10 8
Z
"
                                        />


                                    </svg>



                                </div>







                                {/* Nodes */}


                                <div
                                    className="
absolute
top-0
left-1/2
w-5
h-5
bg-blue-500
rounded-full
animate-pulse
"
                                />



                                <div
                                    className="
absolute
bottom-5
left-10
w-5
h-5
bg-purple-500
rounded-full
animate-bounce
"
                                />



                                <div
                                    className="
absolute
right-0
top-1/2
w-4
h-4
bg-blue-400
rounded-full
animate-ping
"
                                />



                            </div>


                        </div>






                        {/* Bottom Text */}


                        <div
                            className="
absolute
bottom-10
left-0
right-0
text-center
"
                        >


                            <h3
                                className="
text-3xl
font-bold
bg-gradient-to-r
from-blue-600
to-purple-600
bg-clip-text
text-transparent
"
                            >

                                Digital Intelligence

                            </h3>



                            <p className="mt-3 text-gray-500">

                                AI • Automation • Innovation

                            </p>


                        </div>






                    </div>


                </div>



            </div>


        </section>

    )

}