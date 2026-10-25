import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AppLogo } from "@/components/layout/app-logo";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <AppLogo />
        </div>
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-semibold text-slate-950">Create your account</h1>
          <p className="mt-2 text-sm text-slate-600">Register with your school details to access the student portal.</p>
        </div>
        <AuthForm mode="signup" />
        <p className="mt-5 text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link href="/sign-in" className="font-semibold text-brand hover:text-brand-dark">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
