import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Loader2, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";

export default function Login() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const response = await api.post("/auth/login", { name, password });
      if (response.data.success) {
        localStorage.setItem("pinaka_token", response.data.token);
        localStorage.setItem("pinaka_user", JSON.stringify(response.data.user));
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className="min-h-screen flex w-full">
      {/* LEFT PANEL */}
      <div 
        className="hidden md:flex w-1/2 flex-col justify-center items-center p-12 text-center"
        style={{ backgroundColor: '#FF6B00' }}
      >
        <div className="max-w-lg w-full flex flex-col items-center">
          <h1 className="text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-4">
            PINAKA
          </h1>
          <p className="text-xl lg:text-2xl text-white/80 font-medium mb-12">
            Retail Meat Shop Management System
          </p>
          
          <div className="space-y-5 text-left w-full max-w-sm mx-auto">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-xl text-white font-medium">Track Sales & Revenue</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-xl text-white font-medium">Manage Stock & Inventory</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-xl text-white font-medium">Monitor All Shops</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL (FORM) */}
      <div 
        className="w-full md:w-1/2 flex items-center justify-center relative transition-colors duration-300"
        style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }}
      >
        <button 
          onClick={toggleTheme}
          className={`absolute top-6 right-6 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors ${
            isDarkMode ? "hover:bg-white/10 text-white" : "hover:bg-black/5 text-gray-800"
          }`}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>

        <div className="w-full max-w-md p-8 sm:p-12">
          <div className="flex flex-col mb-10 text-center sm:text-left">
            <h2 className="text-4xl font-bold tracking-tight text-[#FF6B00] mb-3">
              PINAKA
            </h2>
            <p 
              className={`text-base transition-colors duration-300 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Sign in to manage your inventory
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 text-sm p-3 rounded-md font-medium text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label className={isDarkMode ? "text-gray-200" : "text-gray-700"}>Name</Label>
              <Input 
                type="text" 
                placeholder="Enter your name" 
                className={`text-lg py-6 transition-colors duration-300 focus-visible:ring-[#FF6B00] focus-visible:ring-1 ${
                  isDarkMode 
                    ? "bg-black/20 border-white/10 text-white placeholder:text-gray-500" 
                    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                }`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className={isDarkMode ? "text-gray-200" : "text-gray-700"}>Password</Label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••" 
                  className={`text-lg py-6 pr-12 transition-colors duration-300 focus-visible:ring-[#FF6B00] focus-visible:ring-1 ${
                    isDarkMode 
                      ? "bg-black/20 border-white/10 text-white placeholder:text-gray-500" 
                      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                  }`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                    isDarkMode ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full text-lg py-6 mt-4 bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-none flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
