import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiGuardEffects, requireAdmin } from "@/lib/api-guards";
import { getSystemSettings, saveSystemSettings } from "@/lib/services/system-settings";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ data: await getSystemSettings() });
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await apiGuardEffects.resolveUser();
  try {
    const data = await saveSystemSettings(await request.json(), user?.id);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to save the settings." }, { status: 500 });
  }
}
