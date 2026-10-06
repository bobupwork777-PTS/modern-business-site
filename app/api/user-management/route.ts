import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import Page from "@/lib/models/Page";
import Permission from "@/lib/models/Permission";

const validId = (value: unknown): value is string =>
    typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export async function GET() {
    try {
        await connectDB();
        const [users, pages, permissions] = await Promise.all([
            User.find().select("-password -resetToken -resetTokenExpiry"),
            Page.find({ active: true }).sort({ group: 1 }),
            Permission.find(),
        ]);
        return NextResponse.json({ users, pages, permissions });
    } catch (error) {
        console.error("USER MANAGEMENT GET ERROR:", error);
        return NextResponse.json({ message: "Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        let body: Record<string, unknown>;
        try {
            const value = await req.json();
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
            }
            body = value;
        } catch {
            return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
        }

        const { userId, pageId, access } = body;
        if (!validId(userId)) {
            return NextResponse.json({ message: "Invalid or missing userId" }, { status: 400 });
        }

        // Enforce administrator authorization through your existing session system.
        // This supplied route does not include that system.
        await connectDB();

        // Use property presence so active: false is handled correctly.
        if (Object.prototype.hasOwnProperty.call(body, "active")) {
            if (typeof body.active !== "boolean") {
                return NextResponse.json({ message: "active must be true or false" }, { status: 400 });
            }
            if (Object.prototype.hasOwnProperty.call(body, "pageId") ||
                Object.prototype.hasOwnProperty.call(body, "access")) {
                return NextResponse.json({ message: "Send a user status update or a permission update separately" }, { status: 400 });
            }
            if (!User.schema.path("active")) {
                return NextResponse.json({ message: "Add active to the User schema and restart the server" }, { status: 500 });
            }
            const user = await User.findByIdAndUpdate(
                userId,
                { $set: { active: body.active } },
                { new: true, runValidators: true }
            ).select("-password -resetToken -resetTokenExpiry");
            if (!user) {
                return NextResponse.json({ message: "User not found" }, { status: 404 });
            }
            return NextResponse.json({ success: true, user });
        }

        if (!validId(pageId)) {
            return NextResponse.json({ message: "Invalid or missing pageId" }, { status: 400 });
        }
        if (typeof access !== "boolean") {
            return NextResponse.json({ message: "access must be true or false" }, { status: 400 });
        }
        const [userExists, pageExists] = await Promise.all([
            User.exists({ _id: userId }),
            Page.exists({ _id: pageId }),
        ]);
        if (!userExists || !pageExists) {
            return NextResponse.json({ message: !userExists ? "User not found" : "Page not found" }, { status: 404 });
        }
        const permission = await Permission.findOneAndUpdate(
            { userId, pageId },
            { $set: { userId, pageId, access } },
            { upsert: true, new: true, runValidators: true }
        );
        return NextResponse.json({ success: true, permission });
    } catch (error) {
        console.error("USER MANAGEMENT PUT ERROR:", error);
        const err = error as { name?: string };
        if (err?.name === "ValidationError" || err?.name === "CastError") {
            return NextResponse.json({ message: "Invalid update data" }, { status: 400 });
        }
        return NextResponse.json({ message: "Server Error" }, { status: 500 });
    }
}


export async function POST(req: Request) {
    try {
        // Add your existing administrator session check before creating accounts.
        let body: Record<string, unknown>;
        try {
            const value = await req.json();
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
            }
            body = value;
        } catch {
            return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
        }
        const { name, email, password } = body;
        if (typeof name !== "string" || !name.trim() ||
            typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return NextResponse.json({ message: "Enter a valid full name and email" }, { status: 400 });
        }
        if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
            return NextResponse.json({ message: "Password must contain at least 8 characters and be at most 72 bytes" }, { status: 400 });
        }
        const role = body.role ?? "user";
        if (role !== "user" && role !== "admin") {
            return NextResponse.json({ message: "Invalid account type" }, { status: 400 });
        }
        if (body.active !== undefined && typeof body.active !== "boolean") {
            return NextResponse.json({ message: "active must be true or false" }, { status: 400 });
        }
        const details: Record<string, string> = {};
        for (const field of ["phone", "dob", "address", "state", "pin", "gender"]) {
            if (body[field] === undefined) { details[field] = ""; continue; }
            if (typeof body[field] !== "string") {
                return NextResponse.json({ message: `${field} must be text` }, { status: 400 });
            }
            details[field] = (body[field] as string).trim();
        }
        if (details.gender && !["Male", "Female"].includes(details.gender)) {
            return NextResponse.json({ message: "Invalid gender" }, { status: 400 });
        }
        await connectDB();
        if (!User.schema.path("active")) {
            return NextResponse.json({ message: "Add active to the User schema and restart the server" }, { status: 500 });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const existing = await User.exists({ email: { $regex: `^${escapedEmail}$`, $options: "i" } });
        if (existing) {
            return NextResponse.json({ message: "An account with this email already exists" }, { status: 409 });
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const created = await User.create({
            name: name.trim(), email: normalizedEmail, password: hashedPassword,
            ...details, role, active: body.active ?? true,
        });
        // Return only public account details, never the password hash.
        const user = {
            _id: String(created._id), id: String(created._id),
            name: created.name, email: created.email, phone: created.phone,
            dob: created.dob, address: created.address, state: created.state,
            pin: created.pin, gender: created.gender, role: created.role,
            active: created.active, profileImage: created.profileImage || "",
        };
        return NextResponse.json({ success: true, user }, { status: 201 });
    } catch (error) {
        console.error("USER MANAGEMENT POST ERROR:", error);
        const err = error as { code?: number; name?: string };
        if (err?.code === 11000) {
            return NextResponse.json({ message: "An account with these details already exists" }, { status: 409 });
        }
        if (err?.name === "ValidationError" || err?.name === "CastError") {
            return NextResponse.json({ message: "Invalid account details" }, { status: 400 });
        }
        return NextResponse.json({ message: "Unable to create account" }, { status: 500 });
    }
}
