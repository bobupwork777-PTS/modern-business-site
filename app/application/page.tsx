"use client";

import { useState } from "react";
import Input from "@/storybook/Input/Input";
import Button from "@/storybook/Button/Button";

export default function ApplicationPage() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        dob: "",
        position: "",
        experience: "",
        address: "",
        message: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log(formData);
        alert("Application submitted successfully");
    };

    return (
        <div className="min-h-screen bg-gray-50 py-10">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow space-y-6">
                <h1 className="text-3xl font-bold">Application Form</h1>

                <div className="grid md:grid-cols-2 gap-5">
                    <Input label="Full Name" name="name" placeholder="Enter your name" value={formData.name} onChange={handleChange} />
                    <Input label="Email" name="email" type="email" placeholder="Enter email" value={formData.email} onChange={handleChange} />
                    <Input label="Phone Number" name="phone" placeholder="Enter phone number" value={formData.phone} onChange={handleChange} />
                    <Input label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleChange} />
                    <Input label="Position Applying For" name="position" placeholder="Job position" value={formData.position} onChange={handleChange} />
                    <Input label="Experience" name="experience" placeholder="Years of experience" value={formData.experience} onChange={handleChange} />
                </div>

                <div>
                    <label className="text-sm font-medium">Address</label>
                    <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className="w-full mt-2 border rounded-lg px-4 py-3 outline-none focus:ring-4 focus:ring-blue-100"
                        placeholder="Enter your address"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium">Message</label>
                    <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        className="w-full mt-2 border rounded-lg px-4 py-3 outline-none focus:ring-4 focus:ring-blue-100"
                        placeholder="Write something"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium">Upload Resume</label>
                    <input type="file" className="mt-2 block" />
                </div>

                <Button type="submit" fullWidth>
                    Submit Application
                </Button>
            </form>
        </div>
    );
}