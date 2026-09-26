"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PromptPage() {
    const [skills, setSkills] = useState<any[]>([]);
    const [prompts, setPrompts] = useState<any[]>([]);
    const [selectedSkill, setSelectedSkill] = useState("");
    const [prompt, setPrompt] = useState("");
    const [editId, setEditId] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSkills();
        loadPrompts();
    }, []);

    const loadSkills = async () => {
        try {
            const res = await fetch("/api/upwork/skills", { cache: "no-store" });
            const data = await res.json();
            setSkills(Array.isArray(data) ? data : data.skills || []);
        } catch (error) {
            console.log(error);
        }
    };

    const loadPrompts = async () => {
        try {
            const res = await fetch("/api/prompts", { cache: "no-store" });
            const data = await res.json();
            setPrompts(Array.isArray(data) ? data : data.prompts || []);
        } catch (error) {
            console.log(error);
        }
    };

    const savePrompt = async () => {
        if (!selectedSkill || !prompt.trim()) return alert("Select skill and enter prompt");
        try {
            setLoading(true);
            await fetch("/api/prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skillId: selectedSkill, prompt, editId }),
            });
            clearEditor();
            loadPrompts();
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    const editPrompt = (item: any) => {
        setEditId(item._id);
        setSelectedSkill(item.skillId);
        setPrompt(item.prompt);
    };

    const clearEditor = () => {
        setEditId("");
        setSelectedSkill("");
        setPrompt("");
    };

    const deletePrompt = async (id: string) => {
        if (!confirm("Delete this prompt?")) return;
        await fetch(`/api/prompts?id=${id}`, { method: "DELETE" });
        loadPrompts();
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#0D163F]">
            <Navbar />
            <main className="flex-1 pt-24 px-5 pb-10">
                <div className="max-w-[1600px] mx-auto grid xl:grid-cols-[420px_1fr] gap-5">

                    {/* PROMPT EDITOR */}
                    <div className="bg-white rounded-xl border shadow-sm p-6 min-h-[650px]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editId ? "View / Edit Prompt" : "Create Prompt"}
                            </h2>
                            {editId && (
                                <button type="button" onClick={clearEditor} className="text-sm text-gray-500 hover:text-red-500">
                                    Clear
                                </button>
                            )}
                        </div>

                        <label className="text-sm text-gray-600">Skill</label>
               
                        <select
                            value={selectedSkill}
                            onChange={(e) => {

                                const skillId = e.target.value;

                                setSelectedSkill(skillId);

                                // find existing prompt for selected skill
                                const existingPrompt = prompts.find(
                                    (item) => item.skillId === skillId
                                );

                                if (existingPrompt) {
                                    setPrompt(existingPrompt.prompt);
                                    setEditId(existingPrompt._id);
                                }
                                else {
                                    setPrompt("");
                                    setEditId("");
                                }

                            }}
                            className="w-full mt-2 mb-5 border rounded-lg px-3 py-3 text-sm"
                        >
                            <option value="">Select Skill</option>

                            {skills.map((skill) => (
                                <option
                                    key={skill.name}
                                    value={skill.name}
                                >
                                    {skill.name}
                                </option>
                            ))}

                        </select>

                        <label className="text-sm text-gray-600">Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Enter Gemini prompt..."
                            className="w-full mt-2 h-[380px] border rounded-lg p-4 text-sm resize-none"
                        />

                        <div className="flex justify-between items-center mt-4">
                            <span className="text-xs text-gray-400">{prompt.length} characters</span>
                            <button
                                type="button"
                                onClick={savePrompt}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm"
                            >
                                {loading ? "Saving..." : editId ? "Update Prompt" : "Save Prompt"}
                            </button>
                        </div>
                    </div>

                    {/* EXISTING PROMPTS */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="flex justify-between items-center px-5 py-4 border-b">
                            <h2 className="text-lg font-semibold text-gray-900">Existing Prompts</h2>
                            <span className="text-sm text-gray-400">{prompts.length} prompts</span>
                        </div>

                        <div className="overflow-auto max-h-[650px]">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="px-5 py-3 text-left">Name</th>
                                        <th className="px-5 py-3 text-left">Description</th>
                                        <th className="px-5 py-3 text-left">Status</th>
                                        <th className="px-5 py-3 text-left">Created</th>
                                        <th className="px-5 py-3 text-left">Updated</th>
                                        <th className="px-5 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prompts.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-10 text-gray-400">
                                                No prompts available
                                            </td>
                                        </tr>
                                    )}
                                    {prompts.map((item) => (
                                        <tr key={item._id} className="border-t hover:bg-gray-50 transition">
                                            <td className="px-5 py-4">
                                                <div className="font-medium text-blue-600">{item.skillName}</div>
                                                <div className="text-xs text-gray-400 mt-1">{item.skillId}</div>
                                            </td>
                                            <td className="px-5 py-4 max-w-[400px]">
                                                <div className="
                                                    max-h-[100px]
                                                    overflow-y-auto
                                                    text-gray-600
                                                    text-sm
                                                    pr-2
                                                ">
                                                    {item.prompt}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                                                    Active
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-gray-500">
                                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                                            </td>
                                            <td className="px-5 py-4 text-gray-500">
                                                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "-"}
                                            </td>
                                            
                                            <td className="px-5 py-4">
                                                <div className="flex justify-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => editPrompt(item)}
                                                        className="text-blue-500 hover:text-blue-700 transition"
                                                        title="View"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => editPrompt(item)}
                                                        className="text-green-500 hover:text-green-700 transition"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deletePrompt(item._id)}
                                                        className="text-red-500 hover:text-red-700 transition"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </main>
            <Footer />
        </div>
    );
}