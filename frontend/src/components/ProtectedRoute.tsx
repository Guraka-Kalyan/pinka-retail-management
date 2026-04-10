import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute() {
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("pinaka_token");
      
      if (!token) {
        setIsValidating(false);
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        if (response.data && response.data.success) {
          setIsAuthenticated(true);
        } else {
          throw new Error("Invalid token response");
        }
      } catch (error) {
        localStorage.removeItem("pinaka_token");
        localStorage.removeItem("pinaka_user");
        setIsAuthenticated(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, []);

  if (isValidating) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Authenticating...</p>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
