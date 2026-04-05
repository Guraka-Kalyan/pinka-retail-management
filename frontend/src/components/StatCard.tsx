import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  color?: "default" | "success" | "info" | "warning" | "destructive" | "insights";
  subtitle?: string;
  className?: string;
}

const colorMap = {
  default: "text-foreground",
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
  insights: "text-insights",
};

const dotMap = {
  default: "bg-muted-foreground",
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  insights: "bg-insights",
};

export default function StatCard({ title, value, icon, color = "default", subtitle, className }: StatCardProps) {
  return (
    <div className={cn("rounded-sm border border-border bg-card p-3 lg:p-6 shadow-none transition-all relative overflow-hidden group hover:bg-card-hover", className)}>
      <div className="flex items-start justify-between gap-2 lg:gap-4">
        <div className="space-y-0.5 lg:space-y-1 flex-1">
          <div className="flex items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1">
            <p className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-tight lg:tracking-wider leading-tight whitespace-normal break-words line-clamp-2 md:line-clamp-none">{title}</p>
          </div>
          <p className={cn("text-lg lg:text-2xl font-black text-foreground tracking-tight")}>{value}</p>
          {subtitle && <p className="text-[10px] lg:text-xs text-muted-foreground font-medium mt-0.5 lg:mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={cn("hidden sm:flex p-1.5 lg:p-2.5 rounded-sm bg-secondary/50 border shadow-none transition-transform", colorMap[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
