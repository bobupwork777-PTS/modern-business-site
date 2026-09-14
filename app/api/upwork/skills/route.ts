import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Skill from "@/lib/models/Skill";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function GET() {
  try {
    await connectDB();

    const skills = await Skill.find({ active: true })
      .sort({ name: 1 })
      .select("_id name active createdAt updatedAt")
      .lean();

    return NextResponse.json({
      success: true,
      skills,
      total: skills.length
    });
  } catch (error) {
    console.error("GET SKILLS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        skills: [],
        total: 0,
        error: "Unable to fetch skills"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    const name = String(body?.name || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Skill name is required"
        },
        { status: 400 }
      );
    }

    const normalizedName = normalizeName(name);

    const existing = await Skill.findOne({
      normalizedName
    });

    if (existing) {
      if (!existing.active) {
        existing.active = true;
        existing.name = name;
        await existing.save();
      }

      return NextResponse.json({
        success: true,
        alreadyExists: true,
        skill: existing
      });
    }

    const skill = await Skill.create({
      name,
      normalizedName,
      active: true
    });

    return NextResponse.json(
      {
        success: true,
        skill
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("ADD SKILL ERROR:", error);

    if (error?.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          error: "Skill already exists"
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to add skill"
      },
      { status: 500 }
    );
  }
}