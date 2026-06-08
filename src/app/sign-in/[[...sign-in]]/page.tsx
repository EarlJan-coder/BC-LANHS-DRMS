import { SignIn } from "@clerk/nextjs";
import { AppLogo } from "@/components/layout/app-logo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SignInPage() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <AppLogo />
        </div>
        {hasClerk ? (
          <SignIn
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                cardBox: "shadow-sm border border-border",
                formButtonPrimary: "bg-brand hover:bg-brand-dark",
                headerTitle: "text-slate-950",
                headerSubtitle: "text-slate-500",
              },
            }}
          />
        ) : (
          <Card className="p-6 text-center">
            <h1 className="text-xl font-semibold text-slate-950">Clerk is not configured</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Add Clerk keys in `.env.local` to enable hosted login. Demo dashboards are available while credentials
              are not configured.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <ButtonLink href="/student/dashboard">Student</ButtonLink>
              <ButtonLink href="/registrar/dashboard" tone="secondary">
                Registrar
              </ButtonLink>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
