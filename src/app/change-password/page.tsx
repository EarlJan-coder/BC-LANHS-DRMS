import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ChangePasswordSignOut } from "@/components/change-password-sign-out";
import { AppLogo } from "@/components/layout/app-logo";
import { getCurrentDbUser } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const user = await getCurrentDbUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <AppLogo />
        </div>
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-semibold text-slate-950">Set a new password</h1>
          {user.mustChangePassword ? (
            <p className="mt-2 text-sm text-slate-600">Your account has a temporary password.</p>
          ) : null}
        </div>
        <ChangePasswordForm mustChangePassword={user.mustChangePassword} />
        <div className="mt-4 flex justify-center">
          <ChangePasswordSignOut />
        </div>
      </div>
    </main>
  );
}
