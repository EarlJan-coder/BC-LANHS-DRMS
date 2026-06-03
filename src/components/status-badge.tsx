import type { RequestStatus } from "@/db/schema";
import { statusLabel, statusTone } from "@/lib/utils";
import { Badge } from "./ui/badge";

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge className={statusTone(status)}>{statusLabel(status)}</Badge>;
}

