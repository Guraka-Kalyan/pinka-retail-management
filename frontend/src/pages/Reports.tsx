import { useState, useMemo, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import {
  IndianRupee, Store, Package, Wallet, Smartphone,
  AlertTriangle, Beef, Loader2, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

import { downloadReportsPDF, downloadReportsExcel } from "@/utils/exportReports";

export default function Reports() {
  const [dateRange, setDateRange] = useState<"Today" | "This Week" | "This Month" | "Custom">("This Month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedShop, setSelectedShop] = useState<string>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    if (dateRange !== "Custom" || (customStart && customEnd)) {
      fetchAnalytics();
    }
  }, [dateRange, customStart, customEnd, selectedShop]);

  const fetchShops = async () => {
    try {
      const res = await api.get("/shops");
      setShops(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch shops", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      
      let from = "";
      let to = "";
      const now = new Date();
      
      // Helper to format local date as YYYY-MM-DD
      const formatLocalStr = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };
      
      if (dateRange === "Today") {
        from = formatLocalStr(now);
        to = from;
      } else if (dateRange === "This Week") {
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        from = formatLocalStr(weekAgo);
        to = formatLocalStr(now);
      } else if (dateRange === "This Month") {
        // True "This Month": from the 1st of the current local month
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        from = formatLocalStr(firstDay);
        to = formatLocalStr(now);
      } else if (dateRange === "Custom") {
        from = customStart;
        to = customEnd;
      }

      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      if (selectedShop !== "all") params.append("shopId", selectedShop);

      const res = await api.get(`/reports/analytics?${params.toString()}`);
      setAnalyticsData(res.data.data || null);
    } catch (err) {
      console.error("Error fetching analytics", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = (type: "executive" | "detailed") => {
    if (!analyticsData) return;
    const periodStr = dateRange === "Custom" ? `${customStart} to ${customEnd}` : dateRange;
    downloadReportsPDF(analyticsData, type, periodStr);
  };

  const handleExportExcel = () => {
    if (!analyticsData) return;
    const periodStr = dateRange === "Custom" ? `${customStart} to ${customEnd}` : dateRange;
    downloadReportsExcel(analyticsData, periodStr);
  };

  const currentShopName = useMemo(() => {
    if (selectedShop === "all") return "all shops";
    const shop = shops.find(s => s._id === selectedShop);
    return shop ? shop.name.toLowerCase() : "selected shop";
  }, [selectedShop, shops]);

  // Derived Insights
  const bestMeat = useMemo(() => {
    if (!analyticsData?.salesByMeatType) return null;
    // Only consider meat types that actually have sales
    const withSales = analyticsData.salesByMeatType.filter((m: any) => m.kgSold > 0);
    if (withSales.length === 0) return null;
    return [...withSales].sort((a: any, b: any) => b.kgSold - a.kgSold)[0];
  }, [analyticsData]);

  const leastMeat = useMemo(() => {
    if (!analyticsData?.salesByMeatType) return null;
    // Filter by kgSold > 0 (revenue per meat type is not tracked)
    const withSales = analyticsData.salesByMeatType.filter((m: any) => m.kgSold > 0);
    // Only show "least" if there are at least 2 different meat types selling
    if (withSales.length < 2) return null;
    return [...withSales].sort((a: any, b: any) => a.kgSold - b.kgSold)[0];
  }, [analyticsData]);

  const topShop = useMemo(() => {
    if (!analyticsData?.shopPerformance) return null;
    return [...analyticsData.shopPerformance].sort((a,b) => b.revenue - a.revenue)[0];
  }, [analyticsData]);

  const lowestShop = useMemo(() => {
    if (!analyticsData?.shopPerformance) return null;
    const active = analyticsData.shopPerformance.filter((s:any) => s.revenue > 0);
    return active.length > 1 ? active.sort((a:any,b:any) => a.revenue - b.revenue)[0] : null;
  }, [analyticsData]);

  const topPendingShop = useMemo(() => {
    if (!analyticsData?.shopPerformance) return null;
    const pending = [...analyticsData.shopPerformance].sort((a,b) => b.pendingStock - a.pendingStock);
    return pending.length > 0 && pending[0].pendingStock > 0 ? pending[0] : null;
  }, [analyticsData]);

  // Daily Sales Search
  const [salesSearch, setSalesSearch] = useState("");
  const filteredSalesData = useMemo(() => {
    if (!analyticsData?.dailySalesLog) return [];
    return analyticsData.dailySalesLog.filter((s:any) => 
      s.shopName.toLowerCase().includes(salesSearch.toLowerCase()) || 
      s.date.toLowerCase().includes(salesSearch.toLowerCase())
    );
  }, [analyticsData, salesSearch]);

  return (
    <div className="animate-fade-in pb-12 w-full">
      {/* ── DATE HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border-b border-border p-4 -mx-6 -mt-6 mb-6">
        <div>
          <h1 className="text-xl font-black text-foreground uppercase tracking-tight">Reports &amp; Analytics</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide font-bold">Performance across {currentShopName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">

          {/* Shop selector */}
          <select
            className="h-9 px-3 border border-input bg-background text-foreground text-sm font-bold rounded-sm shadow-none focus:outline-none focus:ring-1 focus:ring-primary min-w-[140px]"
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            <option value="all" className="bg-background text-foreground">All Shops</option>
            {shops.map(s => <option key={s._id} value={s._id} className="bg-background text-foreground">{s.name}</option>)}
          </select>

          {/* Timeframe buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-primary/5 rounded-md p-1 border border-primary/10 w-fit">
            {(["Today", "This Week", "This Month", "Custom"] as const).map(t => (
              <button
                key={t}
                onClick={() => setDateRange(t as any)}
                className={cn(
                  "px-4 py-1.5 rounded-sm text-sm font-bold transition-all whitespace-nowrap",
                  dateRange === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
                )}
              >{t}</button>
            ))}
          </div>

          {/* Custom date range */}
          {dateRange === "Custom" && (
            <div className="flex items-center gap-2 bg-card border rounded-sm px-3 py-1">
              <AdvancedDatePicker value={customStart} onChange={setCustomStart} placeholder="Start" />
              <span className="text-muted-foreground font-bold">–</span>
              <AdvancedDatePicker value={customEnd} onChange={setCustomEnd} placeholder="End" />
            </div>
          )}

          {/* PDF Export — matches Dashboard exactly */}
          <Button onClick={() => handleExportPDF("executive")} className="bg-red-500 hover:bg-red-600 text-white rounded-sm h-9 px-3 text-xs font-bold uppercase tracking-wider">
            PDF Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col h-[50vh] items-center justify-center p-12 text-center text-muted-foreground w-full">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">Loading Analytics...</h2>
        </div>
      ) : !analyticsData ? (
        <div className="flex flex-col h-[50vh] items-center justify-center text-center text-muted-foreground">
          <AlertTriangle className="h-16 w-16 mb-4 text-muted/50" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">No data available</h2>
          <p>Adjust the filters or check your connection.</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* FINANCIAL SUMMARY */}
          <section className="space-y-4">
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Financial Summary</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* REVENUE GROUP */}
              <div className="lg:col-span-4 bg-card/30 border border-border rounded-md p-3 md:p-4 relative">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">Revenue Flow</h3>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <StatCard title="Gross Sales" value={`₹${analyticsData.overallSummary.grossSales?.toLocaleString() || 0}`} icon={<IndianRupee />} color="default" className="col-span-2" />
                  <StatCard title="Discount" value={`₹${analyticsData.overallSummary.discountGiven?.toLocaleString() || 0}`} icon={<AlertTriangle />} color="warning" />
                  <StatCard title="Net Revenue" value={`₹${analyticsData.overallSummary.netRevenue?.toLocaleString() || 0}`} icon={<Wallet />} color="info" className="bg-blue-50/50 dark:bg-blue-900/10" />
                </div>
              </div>

              {/* COST GROUP */}
              <div className="lg:col-span-5 bg-card/30 border border-border rounded-md p-3 md:p-4 relative">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">Cost Breakdown</h3>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <StatCard title="Purchase Cost" value={`₹${analyticsData.overallSummary.purchaseCost?.toLocaleString() || 0}`} icon={<Package />} color="default" />
                  <StatCard title="Ext. Purchases" value={`₹${analyticsData.overallSummary.externalCost?.toLocaleString() || 0}`} icon={<Package />} color="warning" />
                  <StatCard title="Op. Cost" value={`₹${analyticsData.overallSummary.operationalCost?.toLocaleString() || 0}`} icon={<ArrowDownRight />} color="destructive" />
                  <StatCard title="Total Cost" value={`₹${analyticsData.overallSummary.totalCost?.toLocaleString() || 0}`} icon={<ArrowDownRight />} color="destructive" className="bg-red-50/50 dark:bg-red-900/10" />
                </div>
              </div>

              {/* PROFIT GROUP */}
              <div className={cn(
                "lg:col-span-3 border rounded-md p-4 md:p-5 flex flex-col justify-center relative overflow-hidden text-center",
                analyticsData.overallSummary.profit >= 0 
                  ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900/30" 
                  : "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900/30"
              )}>
                <div className="absolute right-[-10%] top-[-10%] opacity-10 pointer-events-none">
                   {analyticsData.overallSummary.profit >= 0 ? <ArrowUpRight className="w-32 h-32 text-green-500" /> : <ArrowDownRight className="w-32 h-32 text-red-500" />}
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 relative z-10">Net Profit</h3>
                <div className={cn(
                  "text-3xl lg:text-4xl font-black mt-1 relative z-10", 
                  analyticsData.overallSummary.profit >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
                )}>
                  {analyticsData.overallSummary.profit >= 0 ? "+" : "−"}₹{Math.abs(analyticsData.overallSummary.profit || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-4 relative z-10 font-medium">Net Revenue − Total Cost</p>
              </div>
            </div>
          </section>

          {/* OPERATIONS & PAYMENTS (COMBINED) */}
          <section>
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Operations & Payments</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
              <StatCard title="Total Kg Sold" value={`${analyticsData.overallSummary.totalKgSold?.toLocaleString() || 0} kg`} icon={<Beef />} color="info" />
              <StatCard title="Pending Stock" value={`${analyticsData.overallSummary.pendingStock?.toLocaleString() || 0} kg`} icon={<Package />} color="warning" />
              <StatCard title="Cash Collection" value={`₹${analyticsData.overallSummary.cashCollection?.toLocaleString() || 0}`} icon={<Wallet />} color="default" />
              <StatCard title="PhonePe Collection" value={`₹${analyticsData.overallSummary.phonePeCollection?.toLocaleString() || 0}`} icon={<Smartphone />} color="info" />
            </div>
          </section>

          {/* SALES & STOCK INSIGHTS */}
          <section>
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Sales & Stock Insights</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4">
              {topShop && (
                <div className="rounded-sm border bg-card p-3 shadow-none border-success/30 bg-success/5">
                  <p className="text-[10px] sm:text-xs font-bold text-success uppercase mb-1">Top Performing Shop</p>
                  <p className="font-black text-sm md:text-lg text-foreground line-clamp-1">{topShop.shopName}</p>
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground">₹{topShop.revenue.toLocaleString()}</p>
                </div>
              )}
              {lowestShop && (
                <div className="rounded-sm border bg-card p-3 shadow-none border-destructive/30 bg-destructive/5">
                  <p className="text-[10px] sm:text-xs font-bold text-destructive uppercase mb-1">Needs Attention</p>
                  <p className="font-black text-sm md:text-lg text-foreground line-clamp-1">{lowestShop.shopName}</p>
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground">₹{lowestShop.revenue.toLocaleString()}</p>
                </div>
              )}
              {topPendingShop && (
                <div className="rounded-sm border bg-card p-3 shadow-none border-warning/50 bg-warning/5">
                  <p className="text-[10px] sm:text-xs font-bold text-warning uppercase mb-1">Highest Pending (Shop)</p>
                  <p className="font-black text-sm md:text-lg text-foreground line-clamp-1">{topPendingShop.shopName}</p>
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground">{topPendingShop.pendingStock} kg</p>
                </div>
              )}
              {bestMeat && (
                <div className="rounded-sm border bg-card p-3 shadow-none">
                  <p className="text-[10px] sm:text-xs font-bold text-primary uppercase mb-1">Top Selling Meat</p>
                  <p className="font-black text-sm md:text-lg text-foreground line-clamp-1">{bestMeat.meatType}</p>
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground">{bestMeat.kgSold} kg</p>
                </div>
              )}
              {leastMeat && (
                <div className="rounded-sm border bg-card p-3 shadow-none">
                  <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase mb-1">Least Selling Meat</p>
                  <p className="font-black text-sm md:text-lg text-foreground line-clamp-1">{leastMeat.meatType}</p>
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground">{leastMeat.kgSold} kg</p>
                </div>
              )}
            </div>
          </section>

          {/* SHOP PERFORMANCE COMPARISON */}
          <section>
             <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Shop Performance Comparison</h2>
             <div className="rounded-sm border bg-card p-0 md:p-5 shadow-none overflow-hidden container-padding-mobile">
                <DataTable
                  columns={[
                    { header: "Shop", accessor: "shopName" },
                    { header: "Revenue", accessor: (r) => `₹${r.revenue.toLocaleString()}` },
                    { header: "KG Sold", accessor: (r) => `${r.kgSold} kg` },
                    { header: "Bills", accessor: "bills" },
                    { header: "Pending Stock", accessor: (r) => `${r.pendingStock} kg` },
                    { header: "Discount", accessor: (r: any) => `₹${r.discount?.toLocaleString() || 0}` },
                    { header: "Op. Cost", accessor: (r: any) => `₹${r.costs?.toLocaleString() || 0}` },
                    { header: "Ext. Cost", accessor: (r: any) => `₹${r.externalCost?.toLocaleString() || 0}` },
                    { 
                      header: "Status", 
                      accessor: (r) => (
                        <span className={cn("px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider", r.status === "Top" ? "badge-success" : r.status === "Needs Attention" ? "badge-error" : "badge-info")}>
                          {r.status}
                        </span>
                      )
                    }
                  ]}
                  data={analyticsData.shopPerformance}
                  pageSize={10}
                />
             </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* SALES BY MEAT TYPE */}
            <section>
              <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Sales by Meat Type</h2>
              <div className="rounded-sm border bg-card p-0 md:p-5 shadow-none overflow-hidden container-padding-mobile">
                  <DataTable
                    columns={[
                      { header: "Meat Type", accessor: "meatType" },
                      { header: "Total KG Sold", accessor: (r) => `${r.kgSold} kg` },
                    ]}
                    data={analyticsData.salesByMeatType.filter((m:any) => m.kgSold > 0)}
                    pageSize={5}
                  />
              </div>
            </section>

            {/* PENDING INVENTORY SUMMARY */}
            <section>
              <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Pending Inventory Summary</h2>
              <div className="rounded-sm border bg-card p-0 md:p-5 shadow-none overflow-hidden container-padding-mobile">
                  <DataTable
                    columns={[
                      { header: "Shop", accessor: "shopName" },
                      { header: "Bone", accessor: (r) => `${r.bonePending} kg` },
                      { header: "Boneless", accessor: (r) => `${r.bonelessPending} kg` },
                      { header: "Mixed", accessor: (r) => `${r.mixedPending} kg` },
                      { header: "Total Pending", accessor: (r) => `${r.pendingStock} kg` },
                      { 
                        header: "Status", 
                        accessor: (r) => (
                          <span className={cn("px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider", r.status === "Critical" ? "badge-error" : r.status === "Moderate" ? "badge-warning" : "badge-success")}>
                            {r.status}
                          </span>
                        )
                      }
                    ]}
                    data={analyticsData.inventoryMonitoring}
                    pageSize={5}
                  />
              </div>
            </section>
          </div>

          {/* INVENTORY MONITORING — PER SHOP (CARDS) */}
          <section>
             <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Inventory Monitoring — Per Shop</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
               {analyticsData.inventoryMonitoring.map((shop: any) => (
                 <div key={shop.shopId} className="rounded-sm border bg-card p-4 shadow-none flex flex-col justify-between">
                   <div className="flex justify-between items-start mb-4">
                     <h3 className="font-bold text-lg leading-tight">{shop.shopName}</h3>
                     <span className={cn("px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider", shop.status === "Critical" ? "badge-error" : shop.status === "Moderate" ? "badge-warning" : "badge-success")}>
                       {shop.status}
                     </span>
                   </div>
                   <div className="space-y-2">
                     <div className="flex justify-between text-sm py-1 border-b">
                       <span className="text-muted-foreground font-semibold">Bone Stock</span>
                       <span className="font-bold">{shop.bonePending} kg<span className="text-xs font-normal text-muted-foreground ml-1">({shop.boneIn} In)</span></span>
                     </div>
                     <div className="flex justify-between text-sm py-1 border-b">
                       <span className="text-muted-foreground font-semibold">Boneless Stock</span>
                       <span className="font-bold">{shop.bonelessPending} kg<span className="text-xs font-normal text-muted-foreground ml-1">({shop.bonelessIn} In)</span></span>
                     </div>
                     <div className="flex justify-between text-sm py-1 border-b">
                       <span className="text-muted-foreground font-semibold">Mixed Stock</span>
                       <span className="font-bold">{shop.mixedPending} kg<span className="text-xs font-normal text-muted-foreground ml-1">({shop.mixedIn} In)</span></span>
                     </div>
                     <div className="flex justify-between text-base py-2 mt-2 bg-muted/50 dark:bg-muted px-2 rounded-sm border border-border">
                       <span className="font-bold text-foreground">Total Pending</span>
                       <span className={cn("font-black", shop.pendingStock > 50 ? "text-destructive" : shop.pendingStock > 20 ? "text-warning" : "text-success")}>{shop.pendingStock} kg</span>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </section>

          {/* PREPARATION (FRY & CURRY) */}
          <section>
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Preparation (Fry & Curry)</h2>
            <div className="rounded-sm border bg-card p-0 md:p-5 shadow-none overflow-hidden container-padding-mobile">
               <DataTable
                  columns={[
                    { header: "Shop", accessor: "shopName" },
                    { header: "Fry Prepared", accessor: (r) => `${r.fryPrepared} kg` },
                    { header: "Curry Prepared", accessor: (r) => `${r.curryPrepared} kg` },
                    { header: "Bone Used", accessor: (r) => `${r.boneUsed} kg` },
                    { header: "Boneless Used", accessor: (r) => `${r.bonelessUsed} kg` },
                  ]}
                  data={analyticsData.preparations}
                  pageSize={5}
                />
            </div>
          </section>

          {/* DAILY SALES LOG */}
          <section>
             <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-3 gap-3">
               <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Daily Sales Log</h2>
               <div className="w-full sm:w-[250px]">
                 <Input 
                   placeholder="Search shop or date..." 
                   className="h-10 text-sm shadow-none"
                   value={salesSearch}
                   onChange={(e) => setSalesSearch(e.target.value)}
                 />
               </div>
             </div>
             
             <div className="rounded-sm border bg-card p-0 md:p-5 shadow-none overflow-hidden w-full container-padding-mobile">
                <DataTable
                  columns={[
                    { header: "Date", accessor: "date" },
                    { header: "Shop", accessor: "shopName" },
                    { header: "Bone(kg)", accessor: "boneSold" },
                    { header: "Boneless(kg)", accessor: "bonelessSold" },
                    { header: "Fry(kg)", accessor: "frySold" },
                    { header: "Curry(kg)", accessor: "currySold" },
                    { header: "Mixed(kg)", accessor: "mixedSold" },
                    { header: "Total(₹)", accessor: (r) => `₹${r.total.toLocaleString()}` },
                  ]}
                  data={filteredSalesData}
                  pageSize={10}
                />
             </div>
          </section>
        </div>
      )}
    </div>
  );
}
