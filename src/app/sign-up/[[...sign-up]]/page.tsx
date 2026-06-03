import { SignUp } from "@clerk/nextjs";
import { AppLogo } from "@/components/layout/app-logo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SignUpPage() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <AppLogo />
        </div>
        {hasClerk ? (
          <SignUp />
        ) : (
          <Card className="p-6 text-center">
            <h1 className="text-xl font-semibold text-slate-950">Registration needs Clerk keys</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Configure Clerk to enable student and alumni registration. Demo routes remain open for capstone review.
            </p>
            <div className="mt-5 flex justify-center">
              <ButtonLink href="/">Back to system</ButtonLink>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

