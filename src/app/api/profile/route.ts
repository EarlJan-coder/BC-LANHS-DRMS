import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/db";
import { students } from "@/db/schema";
import { ensureCurrentDbUser } from "@/lib/auth";

const profileUpdateSchema = z.object({
  lrn: z.string().trim().min(1, "LRN is required."),
  contactNumber: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export async function PATCH(request: Request) {
  try {
    const values = profileUpdateSchema.parse(await request.json());
    const db = getDb();
    const user = await ensureCurrentDbUser();

    if (!user) {
      return NextResponse.json({ error: "User profile is not available." }, { status: 401 });
    }

    const existingProfile = await db.query.students.findFirst({
      where: eq(students.userId, user.id),
    });
    const lrnOwner = await db.query.students.findFirst({
      where: eq(students.lrn, values.lrn),
    });

    if (lrnOwner?.userId && lrnOwner.userId !== user.id) {
      return NextResponse.json({ error: "This LRN is already linked to another account." }, { status: 409 });
    }

    const updateValues = {
      contactNumber: values.contactNumber,
      guardianName: values.guardianName,
      address: values.address,
      email: user.email,
      updatedAt: new Date(),
    };

    if (existingProfile) {
      if (lrnOwner && lrnOwner.id !== existingProfile.id) {
        return NextResponse.json({ error: "This LRN already belongs to another student record." }, { status: 409 });
      }

      await db
        .update(students)
        .set({
          ...updateValues,
          lrn: values.lrn,
        })
        .where(eq(students.id, existingProfile.id));
    } else if (lrnOwner) {
      await db
        .update(students)
        .set({
          ...updateValues,
          userId: user.id,
        })
        .where(eq(students.id, lrnOwner.id));
    } else {
      await db.insert(students).values({
        userId: user.id,
        lrn: values.lrn,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        contactNumber: values.contactNumber,
        guardianName: values.guardianName,
        address: values.address,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid profile data." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update profile." },
      { status: 500 },
    );
  }
}
