import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import Page from "@/lib/models/Page";
import Permission from "@/lib/models/Permission";

export const runtime = "nodejs";

const validId = (value: unknown): value is string =>
    typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const profileFields = [
    "name", "email", "phone", "dob", "address", "state", "pin", "gender", "role",
] as const;
const has = (body: Record<string, unknown>, key: string) =>
    Object.prototype.hasOwnProperty.call(body, key);
const fail = (message: string, status = 400) =>
    NextResponse.json({ success: false, message }, { status });
const safeSelection = "-password -resetToken -resetTokenExpiry";

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
    try {
        const body = await req.json();
        return body && typeof body === "object" && !Array.isArray(body) ? body : null;
    } catch {
        return null;
    }
}

function validateProfile(body: Record<string, unknown>, creating = false) {
    const updates: Record<string, string> = {};
    for (const field of profileFields) {
        if (!has(body, field)) continue;
        const value = body[field];
        if (typeof value !== "string") return { error: `${field} must be text` };
        updates[field] = value.trim();
    }
    if ((creating || has(body, "name")) && !updates.name) {
        return { error: "Full name is required" };
    }
    if (creating || has(body, "email")) {
        if (!updates.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
            return { error: "Enter a valid email address" };
        }
        updates.email = updates.email.toLowerCase();
    }
    if (has(body, "role") && !["user", "admin"].includes(updates.role)) {
        return { error: "Invalid account type" };
    }
    if (updates.gender && !["Male", "Female"].includes(updates.gender)) {
        return { error: "Invalid gender" };
    }
    if (updates.dob) {
        const date = new Date(`${updates.dob}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(updates.dob) ||
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== updates.dob) {
            return { error: "Enter a valid date of birth" };
        }
    }
    return { updates };
}

function validatePassword(value: unknown, required: boolean): string | null {
    if (!required && (value === undefined || value === "")) return null;
    if (typeof value !== "string" || value.length < 8 ||
        Buffer.byteLength(value, "utf8") > 72) {
        return "Password must contain at least 8 characters and be at most 72 bytes";
    }
    return null;
}

function emailQuery(email: string) {
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { $regex: `^${escaped}$`, $options: "i" };
}

function handleError(error: unknown) {
    const err = error as { code?: number; name?: string };
    // Avoid logging request values or password hashes.
    console.error("USER MANAGEMENT ERROR:", err?.name || "UnknownError", err?.code);
    if (err?.code === 11000) return fail("An account with these details already exists", 409);
    if (err?.name === "ValidationError" || err?.name === "CastError") {
        return fail("Invalid account or update details");
    }
    return fail("Server Error", 500);
}

// IMPORTANT: Apply your application's existing administrator session check
// to GET, PUT and POST. The supplied code does not include an auth system.
export async function GET() {
    try {
        await connectDB();
        const [users, pages, permissions] = await Promise.all([
            User.find().select(safeSelection),
            Page.find({ active: true }).sort({ group: 1 }),
            Permission.find(),
        ]);
        return NextResponse.json({ users, pages, permissions });
    } catch (error) {
        return handleError(error);
    }
}

export async function PUT(req: Request) {
    try {
        const body = await readBody(req);
        if (!body) return fail("Invalid JSON or request body");
        const { userId, pageId, access } = body;
        if (!validId(userId)) return fail("Invalid or missing userId");

        const statusUpdate = has(body, "active");
        const permissionUpdate = has(body, "pageId") || has(body, "access");
        const profileUpdate = profileFields.some(field => has(body, field)) || has(body, "password");
        if (Number(statusUpdate) + Number(permissionUpdate) + Number(profileUpdate) !== 1) {
            return fail("Send one profile, status, or permission update at a time");
        }
        await connectDB();

        if (statusUpdate) {
            if (typeof body.active !== "boolean") return fail("active must be true or false");
            if (!User.schema.path("active")) {
                return fail("Add active to the User schema and restart the server", 500);
            }
            const user = await User.findByIdAndUpdate(
                userId, { $set: { active: body.active } },
                { new: true, runValidators: true }
            ).select(safeSelection);
            if (!user) return fail("User not found", 404);
            return NextResponse.json({ success: true, user });
        }

        if (profileUpdate) {
            const result = validateProfile(body);
            if (result.error) return fail(result.error);
            const updates = result.updates!;
            const passwordError = validatePassword(body.password, false);
            if (passwordError) return fail(passwordError);
            for (const field of Object.keys(updates)) {
                if (!User.schema.path(field)) {
                    return fail(`Add ${field} to the User schema and restart the server`, 500);
                }
            }
            if (updates.email) {
                const existing = await User.exists({
                    _id: { $ne: userId }, email: emailQuery(updates.email),
                });
                if (existing) return fail("An account with this email already exists", 409);
            }
            // Never trim passwords. Empty or omitted means unchanged.
            if (typeof body.password === "string" && body.password !== "") {
                if (!User.schema.path("password")) return fail("Missing password in User schema", 500);
                updates.password = await bcrypt.hash(body.password, 12);
            }
            if (!Object.keys(updates).length) return fail("No profile changes supplied");
            const user = await User.findByIdAndUpdate(
                userId, { $set: updates }, { new: true, runValidators: true }
            ).select(safeSelection);
            if (!user) return fail("User not found", 404);
            return NextResponse.json({ success: true, user });
        }

        if (!validId(pageId)) return fail("Invalid or missing pageId");
        if (typeof access !== "boolean") return fail("access must be true or false");
        const [userExists, pageExists] = await Promise.all([
            User.exists({ _id: userId }), Page.exists({ _id: pageId }),
        ]);
        if (!userExists || !pageExists) {
            return fail(!userExists ? "User not found" : "Page not found", 404);
        }
        const permission = await Permission.findOneAndUpdate(
            { userId, pageId }, { $set: { userId, pageId, access } },
            { upsert: true, new: true, runValidators: true }
        );
        return NextResponse.json({ success: true, permission });
    } catch (error) {
        return handleError(error);
    }
}

export async function POST(req: Request) {
    try {
        const body = await readBody(req);
        if (!body) return fail("Invalid JSON or request body");
        const result = validateProfile(body, true);
        if (result.error) return fail(result.error);
        const passwordError = validatePassword(body.password, true);
        if (passwordError) return fail(passwordError);
        if (has(body, "active") && typeof body.active !== "boolean") {
            return fail("active must be true or false");
        }
        const details = result.updates!;
        details.role = details.role ?? "user";
        for (const field of ["phone", "dob", "address", "state", "pin", "gender"]) {
            details[field] = details[field] ?? "";
        }
        await connectDB();
        for (const field of [...Object.keys(details), "active", "password"]) {
            if (!User.schema.path(field)) {
                return fail(`Add ${field} to the User schema and restart the server`, 500);
            }
        }
        if (await User.exists({ email: emailQuery(details.email) })) {
            return fail("An account with this email already exists", 409);
        }
        const password = await bcrypt.hash(body.password as string, 12);
        const created = await User.create({ ...details, password, active: body.active ?? true });
        const user = {
            _id: String(created._id), id: String(created._id),
            name: created.name, email: created.email, phone: created.phone,
            dob: created.dob, address: created.address, state: created.state,
            pin: created.pin, gender: created.gender, role: created.role,
            active: created.active, profileImage: created.profileImage || "",
        };
        return NextResponse.json({ success: true, user }, { status: 201 });
    } catch (error) {
        return handleError(error);
    }
}