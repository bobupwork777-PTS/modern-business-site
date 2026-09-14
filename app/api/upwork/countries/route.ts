import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Country from "@/lib/models/Country";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function GET() {
  try {
    await connectDB();

    const countries = await Country.find({ active: true })
      .sort({ name: 1 })
      .select("_id name active createdAt updatedAt")
      .lean();

    return NextResponse.json({
      success: true,
      countries,
      total: countries.length
    });
  } catch (error) {
    console.error("GET COUNTRIES ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        countries: [],
        total: 0,
        error: "Unable to fetch countries"
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
          error: "Country name is required"
        },
        { status: 400 }
      );
    }

    const normalizedName = normalizeName(name);

    const existing = await Country.findOne({
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
        country: existing
      });
    }

    const country = await Country.create({
      name,
      normalizedName,
      active: true
    });

    return NextResponse.json(
      {
        success: true,
        country
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("ADD COUNTRY ERROR:", error);

    if (error?.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          error: "Country already exists"
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to add country"
      },
      { status: 500 }
    );
  }
}