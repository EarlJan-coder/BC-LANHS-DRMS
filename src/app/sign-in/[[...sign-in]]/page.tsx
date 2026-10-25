import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AppLogo } from "@/components/layout/app-logo";
import { sanitizeRedirectPath } from "@/lib/utils";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] | undefined }>;
}) {
  const { next } = await searchParams;
  const redirectTo = sanitizeRedirectPath(next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <AppLogo />
        </div>
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-semibold text-slate-950">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-600">Log in with your email or LRN and password.</p>
        </div>
        <AuthForm mode="login" next={redirectTo} />
        <p className="mt-5 text-center text-sm text-slate-600">
          New to the portal?{" "}
          <Link href="/sign-up" className="font-semibold text-brand hover:text-brand-dark">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
