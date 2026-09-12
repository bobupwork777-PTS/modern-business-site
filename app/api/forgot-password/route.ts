import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import crypto from "crypto";
import { sendMail } from "@/lib/sendMail";

export async function POST(req: Request) {

    try {

        await connectDB();

        const { email } = await req.json();


        const user = await User.findOne({ email });


        if (!user) {

            return NextResponse.json(
                { error: "Email not found" },
                { status: 404 }
            );

        }


        const token = crypto.randomBytes(32).toString("hex");


        user.resetToken = token;

        user.resetTokenExpiry =
            new Date(Date.now() + 15 * 60 * 1000);


        await user.save();


        await sendMail(email, token);


        return NextResponse.json({
            message: "Reset link sent to your email"
        });


    }
    catch (error: any) {

        console.log("FORGOT PASSWORD ERROR:", error);


        return NextResponse.json(
            {
                error: error.message || "Reset email failed"
            },
            {
                status: 500
            }
        );

    }

}