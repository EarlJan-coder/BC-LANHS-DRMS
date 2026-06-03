import { RequestForm } from "@/components/request-form";
import { SectionHeading } from "@/components/section-heading";

export default function SubmitRequestPage() {
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

