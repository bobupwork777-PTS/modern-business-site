import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";

export async function POST(req: Request) {

    try {

        await connectDB();

        const { email, password } = await req.json();


        const user = await User.findOne({ email, password });


        if (!user) {

            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );

        }


        return NextResponse.json({

            message: "Login successful",

            user: {
                id: user._id,
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


    }
    catch (error) {

        console.log(error);

        return NextResponse.json(
            { error: "Login failed" },
            { status: 500 }
        );

    }

}