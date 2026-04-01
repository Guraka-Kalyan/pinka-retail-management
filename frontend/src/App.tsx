import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Dressing from "@/pages/Dressing";
import Supply from "@/pages/Supply";
import InventoryIn from "@/pages/InventoryIn";
import InventoryOut from "@/pages/InventoryOut";
import Sales from "@/pages/Sales";
import Reports from "@/pages/Reports";
import Shop from "@/pages/Shop";
import ShopDashboard from "@/pages/ShopDashboard";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="theme-default" storageKey="pinaka-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dressing" element={<Dressing />} />
              <Route path="/supply" element={<Supply />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:id" element={<ShopDashboard />} />
              <Route path="/inventory/in" element={<InventoryIn />} />
              <Route path="/inventory/out" element={<InventoryOut />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
