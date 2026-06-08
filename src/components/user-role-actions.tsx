"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { UserRole } from "@/db/schema";

export function UserRoleActions({
  userId,
  role,
  status,
}: {
  userId: string;
  role: UserRole;
  status: string;
}) {
  const router = useRouter();
  const [nextRole, setNextRole] = useState<UserRole>(role);
  const [nextStatus, setNextStatus] = useState(status);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const response = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole, status: nextStatus }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Unable to update user.");
      return;
    }

    toast.success("User updated.");
    router.refresh();
  }

  return (
    <div className="flex min-w-[280px] items-center gap-2">
      <Select value={nextRole} onChange={(event) => setNextRole(event.target.value as UserRole)} aria-label="Role">
        <option value="student">Student</option>
        <option value="alumni">Alumni</option>
        <option value="registrar">Registrar</option>
        <option value="admin">Admin</option>
      </Select>
      <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} aria-label="Status">
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
      </Select>
      <Button type="button" size="icon" tone="secondary" onClick={save} disabled={loading} aria-label="Save user">
        <Save className="h-4 w-4" />
      </Button>
    </div>
  );
}
