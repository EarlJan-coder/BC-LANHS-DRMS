import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { composeAddress } from "@/lib/ph-address";
import { AppError } from "@/lib/utils";

export type ProfileUpdateValues = {
  contactNumber?: string;
  email?: string;
  lastSchoolYearAttended?: string;
  addressCity?: string;
  addressBarangay?: string;
  addressStreetLine?: string;
};

const ADDRESS_FIELDS = ["addressCity", "addressBarangay", "addressStreetLine"] as const;

/**
 * Apply a student's self-service profile edit. Address parts are composed into
 * the single `students.address` column so certificates and registrar views
 * keep working. Throws AppError 400 for a partial address and 409 when
 * student-record fields are sent without a linked student record.
 */
export async function updateStudentProfile(userId: string, values: ProfileUpdateValues) {
  const db = getDb();
  const existingProfile = await db.query.students.findFirst({
    where: eq(students.userId, userId),
  });

  const addressParts = ADDRESS_FIELDS.filter((field) => values[field] !== undefined);
  if (addressParts.length > 0 && addressParts.length < ADDRESS_FIELDS.length) {
    throw new AppError(
      "Complete the city, barangay, and house no. / street to update your address.",
      400,
    );
  }
  const updatesAddress = addressParts.length === ADDRESS_FIELDS.length;

  const updatesStudentRecord =
    values.contactNumber !== undefined ||
    values.lastSchoolYearAttended !== undefined ||
    updatesAddress;

  if (updatesStudentRecord && !existingProfile) {
    throw new AppError(
      "Your student record is not linked yet. Contact the registrar to update your profile details.",
      409,
    );
  }

  const now = new Date();

  // One transaction: the email writes to both students and users, and the
  // users.email unique violation must not leave a half-applied update.
  await db.transaction(async (tx) => {
    if (existingProfile) {
      await tx
        .update(students)
        .set({
          ...(values.contactNumber !== undefined ? { contactNumber: values.contactNumber || null } : {}),
          ...(values.lastSchoolYearAttended !== undefined
            ? { lastSchoolYearAttended: values.lastSchoolYearAttended }
            : {}),
          ...(updatesAddress
            ? {
                address: composeAddress({
                  streetLine: values.addressStreetLine ?? "",
                  barangay: values.addressBarangay ?? "",
                  city: values.addressCity ?? "",
                }),
              }
            : {}),
          ...(values.email !== undefined ? { email: values.email } : {}),
          updatedAt: now,
        })
        .where(eq(students.id, existingProfile.id));
    }

    if (values.email !== undefined) {
      await tx
        .update(users)
        .set({ email: values.email, updatedAt: now })
        .where(eq(users.id, userId));
    }
  });
}
