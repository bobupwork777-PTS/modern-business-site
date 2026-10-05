"use client";
import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
function getPlatformColor(platform: string) {
    if (platform === "Upwork") return "#6FDA44";
    if (platform === "Freelancer") return "#29B2FE";
    return "#CBD5E1";
}

export default function PromptPage() {
    const [skills, setSkills] = useState<any[]>([]);
    const [prompts, setPrompts] = useState<any[]>([]);
    const [promptFor, setPromptFor] = useState("");
    const [selectedSkill, setSelectedSkill] = useState("");
    const [prompt, setPrompt] = useState("");
    const [editId, setEditId] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    useEffect(() => {
        loadSkills();
        loadPrompts();
    }, []);
    const loadSkills = async () => {
        try {
            const res = await fetch("/api/upwork/skills", { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Unable to load data");
            setSkills(Array.isArray(data) ? data : data.skills || []);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Request failed");
        }
    };
    const loadPrompts = async () => {
        try {
            const res = await fetch("/api/prompts", { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Unable to load data");
            setPrompts(Array.isArray(data) ? data : data.prompts || []);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Request failed");
        }
    };
    const savePrompt = async () => {
        if (!promptFor || !selectedSkill || !prompt.trim()) return alert("Select skill and enter prompt");
        try {
            setLoading(true);
            setErrorMessage("");
            const res = await fetch("/api/prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promptFor, skillId: selectedSkill, prompt, editId }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Unable to save prompt");
            clearEditor();
            await loadPrompts();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Request failed");
        } finally {
            setLoading(false);
        }
    };
    const editPrompt = (item: any) => {
        setErrorMessage("");
        setPromptFor(item.promptFor);
        setEditId(item._id);
        setSelectedSkill(item.skillId);
        setPrompt(item.prompt);
    };
    const selectPrompt = (platform: string, skillId: string) => {
        setErrorMessage("");
        setPromptFor(platform);
        setSelectedSkill(skillId);
        const existingPrompt = skillId
            ? prompts.find((item) =>
                item.skillId === skillId &&
                (item.promptFor) === platform
            )
            : undefined;
        setPrompt(existingPrompt?.prompt || "");
        setEditId(existingPrompt?._id || "");
    };
    const clearEditor = () => {
        setEditId("");
        setSelectedSkill("");
        setPrompt("");
    };
    const deletePrompt = async (id: string) => {
        if (loading || !confirm("Delete this prompt?")) return;
        try {
            setLoading(true);
            setErrorMessage("");
            const res = await fetch(`/api/prompts?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Unable to delete prompt");
            if (editId === id) clearEditor();
            await loadPrompts();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to delete prompt");
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="min-h-screen flex flex-col bg-[#0D163F]">
            <Navbar />
            <main className="flex-1 pt-24 px-5 pb-10">
                <div className="max-w-[1600px] mx-auto grid xl:grid-cols-[420px_1fr] gap-5">
                    {/* PROMPT EDITOR */}
                    <div
                        className="bg-white rounded-xl border border-t-4 shadow-sm p-6 min-h-[650px] transition-colors"
                        style={{ borderTopColor: getPlatformColor(promptFor) }}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editId ? "View / Edit Prompt" : "Create Prompt"}
                            </h2>
                            {editId && (
                                <button disabled={loading} type="button" onClick={clearEditor} className="text-sm text-gray-500 hover:text-red-500">
                                    Clear
                                </button>
                            )}
                        </div>
                        {errorMessage && (
                            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                                {errorMessage}
                            </p>
                        )}
                        <label htmlFor="promptFor" className="text-sm text-gray-600">Prompt For</label>
                        <select
                            style={{
                                borderColor: getPlatformColor(promptFor),
                                backgroundColor: `${getPlatformColor(promptFor)}18`,
                                color: "#0F172A",
                            }}
                            id="promptFor"
                            disabled={loading}
                            value={promptFor}
                            onChange={(e) => selectPrompt(e.target.value, selectedSkill)}
                            className="w-full mt-2 mb-5 border rounded-lg px-3 py-3 text-sm"
                        >
                            <option value="">Select Platform</option>
                            <option value="Upwork">Upwork</option>
                            <option value="Freelancer">Freelancer</option>
                        </select>
                        <label className="text-sm text-gray-600">Skill</label>
                        <select
                            disabled={loading}
                            value={selectedSkill}
                            onChange={(e) => selectPrompt(promptFor, e.target.value)}
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
                            disabled={loading}
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
                                style={{ backgroundColor: getPlatformColor(promptFor), color: "#0F172A" }}
                                className="px-6 py-2.5 rounded-lg text-sm font-semibold hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        <th className="px-5 py-3 text-left">Prompt For</th>
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
                                            <td colSpan={7} className="text-center py-10 text-gray-400">
                                                No prompts available
                                            </td>
                                        </tr>
                                    )}
                                    {prompts.map((item) => (
                                        <tr
                                            key={item._id}
                                            className="border-t hover:brightness-[0.98] transition"
                                            style={{ backgroundColor: `${getPlatformColor(item.promptFor)}0D` }}
                                        >
                                            <td className="px-5 py-4">
                                                <span
                                                    className="inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-slate-900"
                                                    style={{ backgroundColor: getPlatformColor(item.promptFor) }}
                                                >
                                                    {item.promptFor || "Unspecified"}
                                                </span>
                                            </td>
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
                                                    {item.active === false ? "Inactive" : "Active"}
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
                                                        disabled={loading}
                                                        type="button"
                                                        onClick={() => editPrompt(item)}
                                                        className="text-blue-500 hover:text-blue-700 transition"
                                                        title="View"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        disabled={loading}
                                                        type="button"
                                                        onClick={() => editPrompt(item)}
                                                        className="text-green-500 hover:text-green-700 transition"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        disabled={loading}
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