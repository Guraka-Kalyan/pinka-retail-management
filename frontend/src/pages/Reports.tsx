import { useState, useMemo, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import {
  IndianRupee, Store, Package, Wallet, Smartphone,
  AlertTriangle, Download, Beef, Loader2, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

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
      
      if (dateRange === "Today") {
        from = now.toISOString().split("T")[0];
        to = from;
      } else if (dateRange === "This Week") {
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        from = weekAgo.toISOString().split("T")[0];
        to = now.toISOString().split("T")[0];
      } else if (dateRange === "This Month") {
        const monthAgo = new Date(now.getTime() - 30 * 86400000);
        from = monthAgo.toISOString().split("T")[0];
        to = now.toISOString().split("T")[0];
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

  const handleDownloadCSV = () => {
    if (!analyticsData || !analyticsData.dailySalesLog) return;
    
    const headers = "Date,Shop,Bill ID,Bone(kg),Boneless(kg),Fry(kg),Curry(kg),Mixed(kg),Total(₹)";
    const rows = analyticsData.dailySalesLog.map((r: any) => 
      `${r.date},${r.shopName},${r.billId},${r.boneSold||0},${r.bonelessSold||0},${r.frySold||0},${r.currySold||0},${r.mixedSold||0},${r.total||0}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reports_${dateRange.replace(" ", "_").toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentShopName = useMemo(() => {
    if (selectedShop === "all") return "all shops";
    const shop = shops.find(s => s._id === selectedShop);
    return shop ? shop.name.toLowerCase() : "selected shop";
  }, [selectedShop, shops]);

  // Derived Insights
  const bestMeat = useMemo(() => {
    if (!analyticsData?.salesByMeatType) return null;
    return [...analyticsData.salesByMeatType].sort((a,b) => b.kgSold - a.kgSold)[0];
  }, [analyticsData]);

  const leastMeat = useMemo(() => {
    if (!analyticsData?.salesByMeatType) return null;
    return [...analyticsData.salesByMeatType].filter(m => m.kgSold > 0).sort((a,b) => a.kgSold - b.kgSold)[0];
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
      s.billId.toLowerCase().includes(salesSearch.toLowerCase()) ||
      s.date.toLowerCase().includes(salesSearch.toLowerCase())
    );
  }, [analyticsData, salesSearch]);

  return (
    <div className="animate-fade-in pb-12 w-full">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-6">
        <div>
          <Breadcrumb items={[{ label: "Reports" }]} />
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight mt-2">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Performance across {currentShopName}</p>
        </div>
        <Button onClick={handleDownloadCSV} variant="outline" className="gap-2 h-10 md:h-[44px] rounded-sm font-bold bg-card border-[var(--border)] shadow-none w-full lg:w-auto hover:text-primary hover:border-primary/30 transition-all">
          <Download className="h-4 w-4" /> Download CSV
        </Button>
      </div>

      {/* GLOBAL FILTERS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card p-3 md:p-4 rounded-sm border border-[var(--border)] shadow-none mb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 w-full lg:w-auto">
          <select 
            className="h-10 md:min-h-[44px] px-3 border border-slate-200/60 bg-slate-50 text-sm font-bold rounded-sm shadow-none focus:outline-none focus:ring-1 focus:ring-primary w-full lg:w-[200px]"
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            <option value="all">All Shops</option>
            {shops.map(s => <option key={s._id} value={s._id}>{s.name} ({s.location})</option>)}
          </select>

          <div className="bg-slate-100 p-1 rounded-sm flex flex-wrap gap-1 items-center shadow-none border border-slate-200/60 w-full lg:w-auto">
            {["Today", "This Week", "This Month", "Custom"].map(t => (
              <button
                key={t}
                onClick={() => setDateRange(t as any)}
                className={cn(
                  "whitespace-nowrap flex-1 lg:flex-none min-h-[36px] md:min-h-[40px] px-3 md:px-5 rounded-sm text-xs md:text-sm font-bold transition-all",
                  dateRange === t ? "bg-primary text-white shadow-none" : "text-muted-foreground hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {dateRange === "Custom" && (
            <div className="flex items-center gap-2 w-full lg:w-auto animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="flex-1 lg:w-[130px]">
                 <AdvancedDatePicker value={customStart} onChange={setCustomStart} placeholder="Start Date" />
              </div>
              <span className="text-muted-foreground font-bold">-</span>
              <div className="flex-1 lg:w-[130px]">
                 <AdvancedDatePicker value={customEnd} onChange={setCustomEnd} placeholder="End Date" />
              </div>
            </div>
          )}
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
          <section>
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Financial Summary</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-4">
              <StatCard title="Gross Sales" value={`₹${analyticsData.overallSummary.grossSales?.toLocaleString() || 0}`} icon={<IndianRupee />} color="default" />
              <StatCard title="Discount" value={`₹${analyticsData.overallSummary.discountGiven?.toLocaleString() || 0}`} icon={<AlertTriangle />} color="warning" />
              <StatCard title="Net Revenue" value={`₹${analyticsData.overallSummary.netRevenue?.toLocaleString() || 0}`} icon={<Wallet />} color="info" />
              <StatCard title="Purchase Cost" value={`₹${analyticsData.overallSummary.purchaseCost?.toLocaleString() || 0}`} icon={<Package />} color="default" />
              <StatCard title="Operational Cost" value={`₹${analyticsData.overallSummary.operationalCost?.toLocaleString() || 0}`} icon={<ArrowDownRight />} color="destructive" />
              <StatCard 
                title="Profit" 
                value={`₹${analyticsData.overallSummary.profit?.toLocaleString() || 0}`} 
                icon={analyticsData.overallSummary.profit >= 0 ? <ArrowUpRight /> : <ArrowDownRight />} 
                color={analyticsData.overallSummary.profit >= 0 ? "success" : "destructive"} 
                className={analyticsData.overallSummary.profit >= 0 ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"}
              />
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
                    { header: "Discount", accessor: (r) => `₹${r.discount.toLocaleString()}` },
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
                     <div className="flex justify-between text-base py-1 mt-2 bg-slate-50 px-2 rounded-sm border">
                       <span className="font-bold">Total Pending</span>
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
                   placeholder="Search shop, bill ID, date..." 
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
                    { header: "Bill ID", accessor: "billId" },
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
