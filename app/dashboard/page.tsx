"use client";

import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    FunnelChart,
    Funnel,
    LabelList,
    ResponsiveContainer,
} from "recharts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A855F7", "#EC4899", "#14B8A6", "#F97316"];

export default function Dashboard() {
    const [dashboard, setDashboard] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/dashboard/analytics")
            .then((res) => res.json())
            .then((data) => {
                setDashboard(data);
                setLoading(false);
            })
            .catch((error) => {
                console.error(error);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0D163F] flex items-center justify-center text-white text-xl">
                Loading Dashboard...
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#0D163F]">
            <Navbar />

            <main className="flex-1 p-10 pt-24">
                <h1 className="text-3xl font-bold text-white mb-10">Skills Dashboard</h1>

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white rounded-2xl p-6 shadow">
                        <p className="text-gray-500">Total Jobs</p>
                        <h2 className="text-4xl font-bold text-blue-600">{dashboard?.totalJobs || 0}</h2>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow">
                        <p className="text-gray-500">Top Skill</p>
                        <h2 className="text-3xl font-bold text-purple-600">{dashboard?.skills?.[0]?.name || "N/A"}</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* BAR CHART */}
                    <div className="bg-white rounded-2xl p-6">
                        <h2 className="text-xl font-bold mb-5">Top Matched Skills</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={dashboard?.skills || []}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#0088FE" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* LINE CHART */}
                    <div className="bg-white rounded-2xl p-6">
                        <h2 className="text-xl font-bold mb-5">Job Growth Trend</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dashboard?.monthlyTrend || []}>
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="jobs" stroke="#00C49F" strokeWidth={3} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* DOUGHNUT */}
                    <div className="bg-white rounded-2xl p-6">
                        <h2 className="text-xl font-bold mb-5">Technology Distribution</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={dashboard?.technologyDistribution || []}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={70}
                                    outerRadius={120}
                                    label
                                >
                                    {dashboard?.technologyDistribution?.map((item: any, index: number) => (
                                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* SCATTER */}
                    <div className="bg-white rounded-2xl p-6">
                        <h2 className="text-xl font-bold mb-5">Budget vs Required Skills</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <ScatterChart>
                                <CartesianGrid />
                                <XAxis dataKey="skills" name="Skills Count" />
                                <YAxis dataKey="budget" name="Budget" />
                                <Tooltip />
                                <Scatter data={dashboard?.scatterData || []} fill="#FF8042" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>

                    {/* HISTOGRAM */}
                    <div className="bg-white rounded-2xl p-6">
                        <h2 className="text-xl font-bold mb-5">Job Budget Distribution</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={dashboard?.histogram || []}>
                                <XAxis dataKey="range" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="jobs" fill="#A855F7" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* FUNNEL */}
                    <div className="bg-white rounded-2xl p-6">
                        <h2 className="text-xl font-bold mb-5">Job Conversion Funnel</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <FunnelChart>
                                <Tooltip />
                                <Funnel data={dashboard?.funnel || []} dataKey="value">
                                    <LabelList position="right" dataKey="stage" />
                                </Funnel>
                            </FunnelChart>
                        </ResponsiveContainer>
                    </div>

                    {/* RADAR */}
                    <div className="bg-white rounded-2xl p-6 lg:col-span-2">
                        <h2 className="text-xl font-bold mb-5">Skill Capability Radar</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <RadarChart data={dashboard?.radar || []}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="skill" />
                                <Radar dataKey="score" stroke="#0088FE" fill="#0088FE" fillOpacity={0.5} />
                                <Tooltip />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}