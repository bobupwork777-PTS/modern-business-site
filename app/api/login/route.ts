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

    console.log("LOGIN: connecting to MongoDB...");

    await connectDB();

    console.log("LOGIN: MongoDB connected");

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      password
    }).lean();

    console.log("LOGIN: user found:", !!user);

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
    console.error("========== LOGIN ERROR ==========");
    console.error(error);
    console.error("Message:", error?.message);
    console.error("Name:", error?.name);
    console.error("================================");

    return NextResponse.json(
      {
        error: "Login failed",
        message: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}