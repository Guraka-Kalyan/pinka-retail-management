import { useState } from "react";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const MonthPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [yr, mo] = value.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const nowYr = new Date().getFullYear();
  const nowMo = new Date().getMonth() + 1;
  const pick = (y: number, m: number) => { onChange(`${y}-${pad(m)}`); setOpen(false); };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "h-9 px-3 rounded-sm border text-sm font-bold flex items-center gap-1.5 transition-colors z-30",
          open ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-foreground hover:border-primary/40"
        )}
      >
        {MONTHS[mo - 1]} {yr}
        <svg className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 sm:left-0 z-50 w-56 bg-card border border-border rounded-md shadow-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => onChange(`${yr - 1}-${pad(mo)}`)} className="w-7 h-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center font-bold text-base">&#8592;</button>
              <span className="text-sm font-black">{yr}</span>
              <button onClick={() => onChange(`${yr + 1}-${pad(mo)}`)} className="w-7 h-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center font-bold text-base">&#8594;</button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MONTHS.map((m, i) => {
                const mVal = i + 1;
                return (
                  <button key={m} onClick={() => pick(yr, mVal)}
                    className={cn("h-8 text-xs font-semibold rounded transition-colors",
                      mVal === mo ? "bg-gray-800 text-white dark:bg-white dark:text-gray-900" : "text-foreground hover:bg-muted"
                    )}
                  >{m}</button>
                );
              })}
            </div>
            <div className="flex justify-end mt-3 pt-2 border-t border-border">
              <button onClick={() => pick(nowYr, nowMo)} className="text-xs font-semibold text-primary hover:underline">This month</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
