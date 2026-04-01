import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface AdvancedDatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
}

export function AdvancedDatePicker({ value, onChange, placeholder = "Pick a date" }: AdvancedDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = value ? new Date(value) : undefined;

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      // Return YYYY-MM-DD string
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    } else {
      onChange("");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[140px] h-10 justify-between text-left font-normal bg-background text-foreground shadow-none",
            !date && "text-muted-foreground"
          )}
        >
          {date ? format(date, "MM/dd/yyyy") : <span>{placeholder}</span>}
          <CalendarIcon className="mr-0 h-4 w-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
        />
        <div className="flex items-center justify-between p-3 border-t">
          <Button variant="ghost" size="sm" onClick={() => handleSelect(undefined)} className="text-primary hover:bg-muted text-sm px-4">
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleSelect(new Date())} className="text-primary hover:bg-muted text-sm px-4">
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
