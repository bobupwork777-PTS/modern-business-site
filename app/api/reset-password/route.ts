import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";

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
        const { token, password } = body as Record<string, unknown>;
        if (typeof token !== "string" || !token.trim()) {
            return NextResponse.json({ error: "Reset token is required" }, { status: 400 });
        }
        if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
            return NextResponse.json(
                { error: "Password must contain at least 8 characters and be at most 72 bytes" },
                { status: 400 }
            );
        }

        await connectDB();
        const resetToken = token.trim();
        const validLink = await User.exists({
            resetToken,
            resetTokenExpiry: { $gt: new Date() },
        });
        if (!validLink) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
        }

        // Preserve the password exactly as entered, including spaces.
        const hashedPassword = await bcrypt.hash(password, 12);

        // Check and consume the token atomically, including expiry after hashing.
        // Concurrent requests using the same link cannot both change the password.
        const updated = await User.findOneAndUpdate(
            { resetToken, resetTokenExpiry: { $gt: new Date() } },
            {
                $set: { password: hashedPassword },
                $unset: { resetToken: "", resetTokenExpiry: "" },
            },
            { new: true, runValidators: true }
        ).select("_id");

        if (!updated) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
        }
        return NextResponse.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        // Do not log the request body, reset token, password, or validation values.
        console.error("RESET PASSWORD API FAILED");
        return NextResponse.json({ error: "Unable to reset password. Please try again." }, { status: 500 });
    }
}
