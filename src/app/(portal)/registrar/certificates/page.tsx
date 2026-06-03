import { FileBadge } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

export default function CertificateGenerationPage() {
  return (
    <div>
      <SectionHeading
        title="Certificate generation"
        description="Prepare Certificate of Grades and school documents from validated records."
      />
      <Card>
        <CardHeader>
          <CardTitle>Generate Certificate of Grades</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="student">Student number or LRN</Label>
              <Input id="student" placeholder="LANHS-2022-0014" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schoolYear">School year</Label>
              <Select id="schoolYear" defaultValue="2026-2027">
                <option>2026-2027</option>
                <option>2025-2026</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="button">
                <FileBadge className="h-4 w-4" aria-hidden />
                Generate preview
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

