import { RequestForm } from "@/components/request-form";
import { SectionHeading } from "@/components/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRequestEligibility } from "@/lib/services/document-requests";
import Link from "next/link";

export default async function SubmitRequestPage() {
  const eligibility = await getRequestEligibility();

  if (!eligibility.eligible) {
    const reason = eligibility.reason;
    const message =
      reason === "no_record"
        ? "We couldn't find a student record for your account. Set up your profile and add your LRN before submitting a document request."
        : "Your student profile has no LRN yet. Add your Learner Reference Number on your profile page before submitting a document request.";

    return (
      <div>
        <SectionHeading
          title="Submit document request"
          description="Choose the school document needed, add the purpose, and receive a tracking number after submission."
        />
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader>
            <CardTitle className="text-rose-800">Unable to submit request</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-rose-700">{message}</p>
            <Link href="/student/profile">
              <Button tone="secondary">Go to profile</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        title="Submit document request"
        description="Choose the school document needed, add the purpose, and receive a tracking number after submission."
      />
      <RequestForm />
    </div>
  );
}

