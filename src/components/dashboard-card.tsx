import { Card } from "@/components/ui/card";
import type { StatCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const tones = {
  red: "bg-red-700",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
  emerald: "bg-emerald-600",
  amber: "bg-amber-500",
  sky: "bg-sky-600",
};

export function DashboardCard({ stat }: { stat: StatCard }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", tones[stat.tone])} aria-hidden />
        <p className="text-sm font-medium text-slate-600">{stat.label}</p>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">{stat.value}</p>
      <p className="mt-1 text-sm text-slate-500">{stat.helper}</p>
    </Card>
  );
}

