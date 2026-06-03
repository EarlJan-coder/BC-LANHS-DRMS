import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { StatCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const tones = {
  red: "bg-red-50 text-brand",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
};

export function DashboardCard({ stat }: { stat: StatCard }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{stat.label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</p>
        </div>
        <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-md", tones[stat.tone])}>
          <ArrowUpRight className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-500">{stat.helper}</p>
    </Card>
  );
}

