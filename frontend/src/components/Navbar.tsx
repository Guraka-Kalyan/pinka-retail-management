import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Bell, 
  Menu, 
  X, 
  LayoutDashboard, 
  Workflow, 
  Boxes, 
  Store, 
  CircleDollarSign, 
  TrendingUp, 
  Moon,
  Sun
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Dressing", path: "/dressing", icon: Workflow },
  { label: "Inventory", path: "/supply", icon: Boxes },
  { label: "Shop", path: "/shop", icon: Store },
  { label: "Sales", path: "/sales", icon: CircleDollarSign },
  { label: "Reports", path: "/reports", icon: TrendingUp },
];

export default function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 border-b shadow-none transition-all duration-300" style={{backgroundColor: 'var(--navbar-bg)', borderColor: 'var(--navbar-border)'}}>
      <div className="container flex items-center justify-between min-h-[80px] sm:min-h-[96px] py-1 px-4 lg:px-6 max-w-[1600px] mx-auto">
        
        {/* Left Branding */}
        <Link to="/dashboard" className="flex items-center flex-shrink-0 group">
          <div className="flex flex-col justify-center">
            <span className="text-[26px] sm:text-[36px] font-black leading-none tracking-tighter text-[#FF6B00] pb-1">PINAKA</span>
          </div>
        </Link>

        {/* Center Nav Links - Desktop */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-3 flex-1 justify-center ml-2 lg:ml-8">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path!}
                className={cn(
                  "relative flex flex-col items-center justify-center w-[84px] h-[64px] rounded-sm transition-all duration-300 group overflow-hidden",
                  active
                    ? "bg-primary/20"
                    : "hover:bg-white/10"
                )}
              >
                {/* Active Indicator Bar */}
                {active && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-primary rounded-b-full shadow-[0_0_8px_var(--primary)]" />
                )}
                
                <Icon 
                  strokeWidth={active ? 2 : 1.5} 
                  className={cn(
                    "h-[22px] w-[22px] mb-1.5 transition-all duration-300", 
                    active 
                      ? "text-primary drop-shadow-none scale-110" 
                      : "text-muted-foreground group-hover:text-foreground"
                  )} 
                />
                <span className={cn(
                  "text-[11px] tracking-wide transition-colors",
                  active ? "font-bold text-primary" : "font-medium text-muted-foreground group-hover:text-foreground"
                )}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-5 flex-shrink-0">
        
          {/* Theme Toggle */}
          <div className="flex bg-muted p-1 rounded-sm items-center border border-border">
            <button
              onClick={() => setTheme("theme-light")}
              className={cn(
                "min-h-[44px] min-w-[44px] p-2 rounded-sm transition-colors flex items-center justify-center",
                theme === "theme-light" ? "bg-card shadow-none text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              title="Light Theme"
            >
              <Sun className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTheme("theme-dark")}
              className={cn(
                "min-h-[44px] min-w-[44px] p-2 rounded-sm transition-colors flex items-center justify-center",
                theme === "theme-dark" ? "bg-card shadow-none text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              title="Dark Theme"
            >
              <Moon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="h-8 w-px bg-border hidden sm:block mx-1"></div>

          <button className="relative min-h-[44px] min-w-[44px] p-2 rounded-full hover:bg-muted transition-colors group flex items-center justify-center">
            <Bell className="h-[24px] w-[24px] text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
            <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-primary rounded-full" style={{border: '2px solid var(--navbar-bg)'}} />
          </button>
          
          <div className="h-[44px] w-[44px] rounded-full flex items-center justify-center text-sm font-bold ring-2 ring-transparent cursor-pointer hover:ring-primary/20 transition-all flex-shrink-0" style={{backgroundColor: 'var(--primary)', color: '#FFFFFF'}}>
            BM
          </div>

          <button
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-7 w-7" strokeWidth={1.5} /> : <Menu className="h-7 w-7" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border bg-card px-4 pb-4 pt-2 space-y-1 shadow-none">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path!}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 text-sm font-bold rounded-sm transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon strokeWidth={active ? 2 : 1.5} className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
