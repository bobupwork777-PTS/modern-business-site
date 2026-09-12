"use client";
import { useState } from "react";
import { Mail, Phone, Send } from "lucide-react";

export default function Contact() {
    const [form, setForm] = useState({ firstName: "", lastName: "", email: "", countryCode: "+1", phone: "", message: "" });
    const [loading, setLoading] = useState(false);
    const input = "h-14 rounded-xl bg-gray-50 border border-gray-200 px-5 text-gray-900 outline-none focus:border-blue-500";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [e.target.name]: e.target.value });

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true);
        try {
            const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            const data = await res.json();
            if (data.success) {
                alert("Message sent successfully");
                setForm({ firstName: "", lastName: "", email: "", countryCode: "+1", phone: "", message: "" });
            } else alert(data.error || "Message failed");
        } catch (err) { console.log(err); alert("Something went wrong") }
        finally { setLoading(false) }
    };

    return (
        <section id="contact" className="relative py-28 overflow-hidden bg-[#F8FAFC]">
            <div className="absolute top-10 left-20 w-96 h-96 bg-blue-400/20 blur-3xl rounded-full animate-pulse" />
            <div className="absolute bottom-0 right-20 w-96 h-96 bg-purple-400/20 blur-3xl rounded-full animate-pulse" />

            <div className="relative max-w-6xl mx-auto px-6">
                <div className="text-center mb-14">
                    <p className="text-blue-600 uppercase tracking-[0.3em] text-sm">Get In Touch</p>

                    <div className="mt-4">
                        <h2 className="text-4xl md:text-6xl font-bold leading-tight text-gray-900">
                            Let's Build Something
                        </h2>

                        <h2 className="
                            text-4xl
                            md:text-6xl
                            font-bold
                            leading-tight
                            mt-2
                            bg-gradient-to-r
                            from-blue-600
                            to-purple-600
                            bg-clip-text
                            text-transparent
                        ">
                            Amazing Together
                        </h2>
                    </div>

                    <p className="mt-5 text-gray-600">Tell us about your project and our team will get back to you.</p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="space-y-5">
                        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-lg hover:-translate-y-2 transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4"><Mail className="text-blue-600" /></div>
                            <h3 className="text-xl font-semibold">Email Us</h3>
                            <p className="mt-2 text-gray-600">bobupwork777@gmail.com</p>
                        </div>

                        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-lg hover:-translate-y-2 transition">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4"><Phone className="text-purple-600" /></div>
                            <h3 className="text-xl font-semibold">Call Us</h3>
                            <p className="mt-2 text-gray-600">Available Worldwide</p>
                        </div>
                    </div>

                    <form onSubmit={submitForm} className="lg:col-span-2 rounded-[32px] bg-white border border-gray-200 p-8 shadow-xl">
                        <div className="grid md:grid-cols-2 gap-5">
                            <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="First Name" className={input} />
                            <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Last Name" className={input} />
                        </div>

                        <div className="grid md:grid-cols-2 gap-5 mt-5">
                            <input name="email" value={form.email} onChange={handleChange} type="email" placeholder="Email Address" className={input} />

                            <div className="flex items-center h-14 rounded-xl bg-gray-50 border border-gray-200 px-4">
                                <select name="countryCode" value={form.countryCode} onChange={handleChange} className="bg-transparent outline-none">
                                    <option>+1</option>
                                    <option>+91</option>
                                    <option>+44</option>
                                </select>
                                <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone Number" className="ml-3 flex-1 bg-transparent outline-none" />
                            </div>
                        </div>

                        <textarea name="message" value={form.message} onChange={handleChange} placeholder="Tell us about your project..." rows={5} className="mt-5 w-full rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 text-gray-900 outline-none focus:border-blue-500" />

                        <button disabled={loading} className="mt-6 w-full h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold flex items-center justify-center gap-3 hover:scale-[1.02] transition">
                            {loading ? "Sending..." : <>Send Message <Send size={18} /></>}
                        </button>
                    </form>
                </div>
            </div>
        </section>
    )
}