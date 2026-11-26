"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export function UserStatusActions({
  userId,
  status,
}: {
  userId: string;
  status: string;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to update user.");
        return;
      }

      toast.success("User updated.");
      router.refresh();
    } catch {
      toast.error("Unable to update user. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-w-[200px] items-center gap-2">
      <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} aria-label="Status">
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </Select>
      <Button
        type="button"
        size="icon"
        tone="ghost"
        className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900"
        onClick={save}
        loading={loading}
        aria-label="Save user"
        title="Save user"
      >
        {loading ? null : <Save className="h-4 w-4" />}
      </Button>
    </div>
  );
}
