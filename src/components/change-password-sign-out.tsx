"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ChangePasswordSignOut() {
  const [loading, setLoading] = useState(false);

  async function signOut() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Hard navigation: purges every client cache with the signed-out state.
      window.location.replace("/sign-in");
    }
  }

  return (
    <Button type="button" tone="secondary" loading={loading} onClick={signOut}>
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
