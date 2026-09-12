import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        await connectDB();

        const user = await User.findOne({
            email: email.trim().toLowerCase(),
            password
        }).lean();

        if (!user) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        return NextResponse.json({
            message: "Login successful",
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                phone: user.phone,
                dob: user.dob,
                address: user.address,
                state: user.state,
                pin: user.pin,
                gender: user.gender,
                role: user.role
            }
        });
    } catch (error: any) {
        console.error("LOGIN ERROR:", error);

        return NextResponse.json(
            {
                error: "Login failed",
                details:
                    process.env.NODE_ENV === "development"
                        ? error.message
                        : undefined
            },
            { status: 500 }
        );
    }
}