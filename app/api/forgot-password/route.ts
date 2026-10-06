import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { sendMail } from "@/lib/sendMail";

export const runtime = "nodejs";

const resetResponse = () => NextResponse.json(
    { message: "If an account exists for this email, a password reset link will be sent." },
    { headers: { "Cache-Control": "no-store" } }
);

export async function POST(req: Request) {
    try {
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        const { email } = body as Record<string, unknown>;
        if (typeof email !== "string" || !email.trim()) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
        }

        await connectDB();
        const user = await User.findOne({ email: normalizedEmail }).select("_id email");
        // Use the same response to avoid revealing registered email addresses.
        if (!user) return resetResponse();

        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Keep the token format compatible with the existing reset-password API.
        const updated = await User.updateOne(
            { _id: user._id },
            { $set: { resetToken: token, resetTokenExpiry: expiresAt } },
            { runValidators: true }
        );
        if (!updated.matchedCount) return resetResponse();

        try {
            // sendMail must throw if delivery fails and construct the reset URL
            // from a trusted application URL configured on the server.
            await sendMail(user.email, token);
        } catch {
            // Only remove this request's token; preserve any newer reset link.
            await User.updateOne(
                { _id: user._id, resetToken: token },
                { $unset: { resetToken: "", resetTokenExpiry: "" } }
            );
            console.error("FORGOT PASSWORD: email delivery failed");
            return resetResponse();
        }

        return resetResponse();
    } catch {
        // Do not expose database errors, mail credentials, or reset tokens.
        console.error("FORGOT PASSWORD API FAILED");
        return NextResponse.json(
            { error: "Unable to process your request. Please try again." },
            { status: 500 }
        );
    }
}
