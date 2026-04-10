import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

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
          setUserRole(response.data.user.role || null);
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    if (userRole === "shopstaff") {
      return <Navigate to="/daily" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
