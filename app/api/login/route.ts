import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";

export const runtime = "nodejs";

const Session =
    mongoose.models.LoginSession ||
    mongoose.model(
        "LoginSession",
        new mongoose.Schema({
            tokenHash: {
                type: String,
                required: true,
                unique: true,
            },
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            expiresAt: {
                type: Date,
                required: true,
                expires: 0,
            },
        })
    );

const hashToken = (token: string) =>
    createHash("sha256").update(token).digest("hex");

const publicFields =
    "name email phone dob address state pin gender role active profileImage";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
};

function publicUser(user: InstanceType<typeof User>) {
    const id = user._id.toString();

    return {
        _id: id,
        id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        dob: user.dob,
        address: user.address,
        state: user.state,
        pin: user.pin,
        gender: user.gender,
        role: user.role,
        active: user.active !== false,
        profileImage: user.profileImage || "",
    };
}

export async function POST(req: Request) {
    try {
        let body: unknown;

        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON" },
                { status: 400 }
            );
        }

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json(
                { error: "Invalid request body" },
                { status: 400 }
            );
        }

        const { email, password } = body as Record<string, unknown>;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (
            normalizedEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
            return NextResponse.json(
                { error: "Enter a valid email address" },
                { status: 400 }
            );
        }

        if (Buffer.byteLength(password, "utf8") > 72) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        await connectDB();

        const escapedEmail = normalizedEmail.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const user = await User.findOne({
            email: {
                $regex: `^${escapedEmail}$`,
                $options: "i",
            },
        }).select(`password ${publicFields}`);

        const storedPassword =
            typeof user?.password === "string" ? user.password : "";

        const isBcrypt = /^\$2[aby]\$/.test(storedPassword);
        let passwordMatches = false;

        if (storedPassword) {
            passwordMatches = isBcrypt
                ? await bcrypt.compare(password, storedPassword)
                : timingSafeEqual(
                      createHash("sha256").update(password).digest(),
                      createHash("sha256").update(storedPassword).digest()
                  );
        }

        if (!user || !passwordMatches) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        if (user.active === false) {
            return NextResponse.json(
                {
                    error: "Your account is inactive. Please contact the administrator.",
                },
                { status: 403 }
            );
        }

        // Convert matching older plaintext passwords to bcrypt.
        if (!isBcrypt) {
            const hashedPassword = await bcrypt.hash(password, 12);

            const migration = await User.updateOne(
                {
                    _id: user._id,
                    password: storedPassword,
                    active: { $ne: false },
                },
                { $set: { password: hashedPassword } },
                { runValidators: true }
            );

            if (!migration.matchedCount) {
                return NextResponse.json(
                    { error: "Account changed. Please log in again." },
                    { status: 401 }
                );
            }
        }

        const token = randomBytes(32).toString("hex");

        await Session.create({
            tokenHash: hashToken(token),
            userId: user._id,
            expiresAt: new Date(Date.now() + 86400 * 1000),
        });

        const response = NextResponse.json({
            message: "Login successful",
            user: publicUser(user),
        });

        response.headers.set("Cache-Control", "no-store");

        response.cookies.set("token", token, {
            ...cookieOptions,
            maxAge: 86400,
        });

        response.cookies.set("role", "", {
            path: "/",
            maxAge: 0,
        });

        return response;
    } catch {
        console.error("LOGIN API FAILED");

        return NextResponse.json(
            { error: "Unable to log in. Please try again." },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get("token")?.value;

        if (!token || !/^[a-f0-9]{64}$/.test(token)) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        await connectDB();

        const session = await Session.findOne({
            tokenHash: hashToken(token),
            expiresAt: { $gt: new Date() },
        });

        const user = session
            ? await User.findById(session.userId).select(publicFields)
            : null;

        if (!user || user.active === false) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        const response = NextResponse.json({
            user: publicUser(user),
        });

        response.headers.set("Cache-Control", "no-store");
        return response;
    } catch {
        console.error("SESSION CHECK FAILED");

        return NextResponse.json(
            { error: "Unable to check session" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const token = req.cookies.get("token")?.value;

        if (token && /^[a-f0-9]{64}$/.test(token)) {
            await connectDB();

            await Session.deleteOne({
                tokenHash: hashToken(token),
            });
        }

        const response = NextResponse.json({
            message: "Logged out",
        });

        response.headers.set("Cache-Control", "no-store");

        response.cookies.set("token", "", {
            ...cookieOptions,
            maxAge: 0,
        });

        response.cookies.set("role", "", {
            path: "/",
            maxAge: 0,
        });

        return response;
    } catch {
        return NextResponse.json(
            { error: "Unable to log out. Please try again." },
            { status: 500 }
        );
    }
}