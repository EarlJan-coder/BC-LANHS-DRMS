import Link from "next/link";
import { AlertCircle, UserCog } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface LrnReminderBannerProps {
  reason: "no_record" | "no_lrn";
}

export function LrnReminderBanner({ reason }: LrnReminderBannerProps) {
  const message =
    reason === "no_record"
      ? "We couldn't find a student record for your account. Please set up your profile and add your Learner Reference Number (LRN) so your document requests can be validated."
      : "Your student profile has no LRN yet. Please add your Learner Reference Number on your profile page so your document requests can be validated.";

  return (
    <Card className="mb-4 border-amber-200 bg-amber-50">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-800">Action required: Complete your student profile</p>
            <p className="text-sm text-amber-700 mt-1">{message}</p>
          </div>
        </div>
        <Link href="/student/profile">
          <Button tone="primary" size="sm" className="gap-1">
            <UserCog className="h-4 w-4" aria-hidden="true" />
            Go to profile
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}