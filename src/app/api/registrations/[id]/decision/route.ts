import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ensureCurrentDbUser } from "@/lib/auth";
import { decideRegistration } from "@/lib/services/registrations";
import { registrationDecisionSchema } from "@/lib/validators";
import { AppError } from "@/lib/utils";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (user.role !== "registrar" && user.role !== "admin") {
    return NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const values = registrationDecisionSchema.parse(await request.json());
    const registrationStatus = await decideRegistration({
      id,
      ...values,
      actorUserId: user.id,
      actorRole: user.role,
    });
    return NextResponse.json({ data: { registrationStatus } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid registration decision." }, { status: 400 });
    }
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to review this registration right now." }, { status: 500 });
  }
}
