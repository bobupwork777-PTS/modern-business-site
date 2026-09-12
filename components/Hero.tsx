"use client";

import { ArrowRight } from "lucide-react";

export default function Hero() {
    return (
        <section className="relative min-h-screen overflow-hidden bg-[#050816]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent"/>
            <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 blur-3xl rounded-full animate-pulse"/>
            <div className="relative max-w-7xl mx-auto px-6 pt-40">
                <div className="grid lg:grid-cols-2 gap-12 items-center">

                    {/* LEFT CONTENT */}
                    <div>
                        <p className="text-blue-400 uppercase tracking-widest text-sm mb-6">
                            Digital Transformation Agency
                        </p>
                        <h1 className="text-5xl md:text-7xl font-bold leading-tight text-white ">
                            Build Digital Experiences
                            <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 bg-clip-text text-transparent animate-gradient">
                                That Grow Businesses
                            </span>
                        </h1>
                        <p className="mt-8 text-lg text-gray-300 max-w-xl leading-relaxed">
                            Phoenix Consulting helps businesses create modern websites,
                            scalable applications, and automation solutions that turn
                            ideas into digital success.
                        </p>

                        <div className="mt-10 flex gap-5">
                            <button className="flex items-center gap-2 rounded-full bg-blue-600 px-7 py-4 text-white hover:bg-blue-700 transition">
                                Start Your Project
                                <ArrowRight size={18} />
                            </button>

                            <button className="rounded-full border border-white/30 px-7 py-4 text-white hover:bg-white/10 transition">
                                View Work
                            </button>
                        </div>
                    </div>

                    {/* RIGHT AI VISUAL */}
                    <div className="relative flex justify-center">
                        <div className="absolute -inset-10 bg-blue-500/20 blur-3xl rounded-full animate-pulse "/>
                        <div className="relative h-[450px] w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">

                            {/* Scanner */}
                            <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-blue-400/30 to-transparent animate-[scan_4s_linear_infinite] "/>

                            {/* Orbit Rings */}
                            <div className="absolute left-1/2 top-1/2 w-80 h-80 -translate-x-1/2 -translate-y-1/2 border border-blue-400/30 rounded-full animate-[spin_15s_linear_infinite]"/>

                            <div className="absolute left-1/2 top-1/2 w-60 h-60 -translate-x-1/2 -translate-y-1/2 border border-purple-400/30 rounded-full animate-[spin_10s_linear_infinite_reverse] "/>

                            {/* Floating Nodes */}
                            <div className="absolute top-20 left-20 w-4 h-4 bg-blue-400 rounded-full shadow-lg animate-ping "/>
                            <div className=" absolute top-32 right-24 w-3 h-3 bg-purple-400 rounded-full animate-bounce"/>
                            <div className=" absolute bottom-24 left-24 w-3 h-3 bg-blue-500 rounded-full animate-[particle_5s_linear_infinite] "/>

                            {/* AI Core */}
                            <div className="absolute inset-0 flex items-center justify-center ">
                                <div className="text-center">
                                    <div className="relative mx-auto w-36 h-36 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_80px_rgba(59,130,246,0.8)] animate-[corePulse_3s_ease-in-out_infinite] ">
                                        <svg
                                            className="w-20 h-20 text-white"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M12 2 L14 8 L21 10 L15 13 L12 22 L9 13 L3 10 L10 8 Z "
                                            />
                                        </svg>
                                    </div>
                                    <h3 className="mt-8 text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent ">
                                        Digital Intelligence
                                    </h3>
                                    <p className="mt-3 text-gray-400 ">
                                        AI • Web • Automation
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}