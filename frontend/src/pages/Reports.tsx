import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import { 
  IndianRupee, Store, Package, Wallet, Smartphone, AlertTriangle, 
  Download, Beef, Activity, Loader2, ArrowUpCircle, ArrowDownCircle, 
  TrendingUp, TrendingDown, Clock, Scale
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export default function Reports() {
  const [dateRange, setDateRange] = useState<"Today" | "This Week" | "This Month" | "Custom">("This Month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("all");
  
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch for shops to populate dropdown
    api.get("/shops").then(res => {
      setShops(res.data.data || []);
    }).catch(err => {
      console.error("Error fetching shops", err);
      setErrorMsg("Failed to load shops.");
    });
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        let from = "";
        let to = "";
        
        const today = new Date();
        const yyyymmdd = (d: Date) => {
          const m = d.getMonth() + 1;
          const day = d.getDate();
          return `${d.getFullYear()}-${m < 10 ? '0'+m : m}-${day < 10 ? '0'+day : day}`;
        };

        if (dateRange === "Today") {
          from = yyyymmdd(today);
          to = yyyymmdd(today);
        } else if (dateRange === "This Week") {
          const start = new Date(today);
          start.setDate(today.getDate() - today.getDay());
          from = yyyymmdd(start);
          to = yyyymmdd(today);
        } else if (dateRange === "This Month") {
          const start = new Date(today.getFullYear(), today.getMonth(), 1);
          from = yyyymmdd(start);
          to = yyyymmdd(today);
        } else if (dateRange === "Custom" && customStart && customEnd) {
          from = customStart;
          to = customEnd;
        }

        let url = `/reports/analytics?t=${Date.now()}`;
        if (from && to) {
          url += `&from=${from}&to=${to}`;
        }
        if (selectedShopId !== "all") {
          url += `&shopId=${selectedShopId}`;
        }

        const res = await api.get(url);
        if (res.data && res.data.success) {
          setReportData(res.data.data);
        } else {
          setErrorMsg("Failed to parse analytics payload.");
        }
      } catch (err: any) {
        console.error("Error fetching analytics", err);
        setErrorMsg(err.response?.data?.message || err.message || "Failed to fetch analytics");
      } finally {
        setIsLoading(false);
      }
    };
    
    // Auto-fetch if not custom, or if custom and both dates exist
    if (dateRange !== "Custom" || (dateRange === "Custom" && customStart && customEnd)) {
      fetchAnalytics();
    }
  }, [dateRange, customStart, customEnd, selectedShopId]);

  const handleDownloadCSV = () => {
    if (!reportData || !reportData.dailySalesLog) return;
    
    const headers = "Shop,Date,Bill ID,Bone(kg),Boneless(kg),Mixed(kg),Fry(kg),Curry(kg),Total(kg),Cash(₹),PhonePe(₹),Discount(₹),Total(₹)";
    const rows = reportData.dailySalesLog.map((r: any) => 
      `${r.shopName},${r.date},${r.billId},${r.bone||0},${r.boneless||0},${r.mixed||0},${r.fry||0},${r.curry||0},${r.totalKg||0},${r.cash||0},${r.phonePe||0},${r.discount||0},${r.total||0}`
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

  return (
    <div className="animate-fade-in pb-12 w-full">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-2 mb-6">
        <Breadcrumb items={[{ label: "Reports & Analytics" }]} />
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Performance across all shops</p>
        </div>
      </div>

      {/* Filters Configuration */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card p-4 rounded-sm border border-[var(--border)] shadow-none mb-6">
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 w-full lg:w-auto">
          {/* Shop Filter */}
          <div className="flex items-center">
            <select 
              value={selectedShopId} 
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="w-full lg:w-[200px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-sm px-3 py-2 font-semibold shadow-none outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Shops</option>
              {shops.map(s => (
                <option key={s._id} value={s._id}>{s.name} - {s.location}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-sm flex flex-wrap gap-1 items-center shadow-none border border-slate-200/60 dark:border-slate-700 w-full lg:w-auto overflow-x-auto no-scrollbar">
            {["Today", "This Week", "This Month", "Custom"].map(t => (
              <button
                key={t}
                onClick={() => setDateRange(t as any)}
                className={cn(
                  "whitespace-nowrap flex-1 lg:flex-none px-3 py-1.5 rounded-sm text-xs font-bold transition-all",
                  dateRange === t ? "bg-primary text-white shadow-none" : "text-muted-foreground hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {dateRange === "Custom" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-300 w-full lg:w-auto">
              <div className="w-full lg:w-[130px]">
                 <AdvancedDatePicker value={customStart} onChange={setCustomStart} placeholder="Start Date" />
              </div>
              <span className="text-muted-foreground font-bold">-</span>
              <div className="w-full lg:w-[130px]">
                 <AdvancedDatePicker value={customEnd} onChange={setCustomEnd} placeholder="End Date" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center w-full lg:w-auto mt-2 lg:mt-0">
          <Button onClick={handleDownloadCSV} disabled={!reportData || isLoading} variant="outline" className="w-full lg:w-auto gap-2 h-10 rounded-sm font-bold bg-card border-[var(--border)] shadow-none hover:text-primary hover:border-primary/30 transition-all">
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        </div>
      </div>

      {errorMsg ? (
        <div className="flex flex-col h-[40vh] items-center justify-center p-12 text-center w-full">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">Analytics Error</h2>
          <p className="text-muted-foreground">{errorMsg}</p>
        </div>
      ) : isLoading || !reportData ? (
        <div className="flex flex-col h-[40vh] items-center justify-center p-12 text-center text-muted-foreground w-full">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">Loading Analytics...</h2>
        </div>
      ) : (
        <>
          {/* 2. Overall Summary (Combined) */}
          <div className="mb-8">
            <h2 className="font-semibold mb-3 text-base">Overall Summary</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <StatCard title="Total Revenue" value={`₹${(reportData.overall.totalRevenue || 0).toLocaleString()}`} icon={<IndianRupee />} color="success" />
              <StatCard title="Total KG Sold" value={`${(reportData.overall.totalKgSold || 0).toLocaleString()} kg`} icon={<Scale />} color="info" />
              <StatCard title="Warehouse Stock" value={`${(reportData.overall.warehouseStock || 0).toLocaleString()} kg`} icon={<Package />} color="default" />
              <StatCard title="Pending Stock" value={`${(reportData.overall.pendingStock || 0).toLocaleString()} kg`} icon={<Clock />} color="warning" />
              <StatCard title="Cash Collection" value={`₹${(reportData.overall.cashCollection || 0).toLocaleString()}`} icon={<Wallet />} color="default" />
              <StatCard title="PhonePe Collection" value={`₹${(reportData.overall.phonePeCollection || 0).toLocaleString()}`} icon={<Smartphone />} color="info" />
              <StatCard title="Discount Given" value={`₹${(reportData.overall.discountGiven || 0).toLocaleString()}`} icon={<AlertTriangle />} color="destructive" />
              <StatCard title="Operational Cost" value={`₹${(reportData.overall.operationalCost || 0).toLocaleString()}`} icon={<Activity />} color="warning" />
              <StatCard title="Active Shops" value={`${reportData.overall.activeShops || 0} shops`} icon={<Store />} color="default" />
            </div>
          </div>

          {/* 3. Sales & Stock Insights */}
          <div className="mb-8">
            <h2 className="font-semibold mb-3 text-base">Sales & Stock Insights</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="bg-card p-3 lg:p-4 rounded-sm border flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-tight mb-1">Top Selling Meat</p>
                  <p className="font-bold text-sm lg:text-base">{reportData.salesStockInsights.topSellingMeat || 'N/A'}</p>
                </div>
                <ArrowUpCircle className="h-6 w-6 text-success opacity-80" />
              </div>
              <div className="bg-card p-3 lg:p-4 rounded-sm border flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-tight mb-1">Least Selling Meat</p>
                  <p className="font-bold text-sm lg:text-base">{reportData.salesStockInsights.leastSellingMeat || 'N/A'}</p>
                </div>
                <ArrowDownCircle className="h-6 w-6 text-destructive opacity-80" />
              </div>
              <div className="bg-card p-3 lg:p-4 rounded-sm border flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-tight mb-1">Top Performing Shop</p>
                  <p className="font-bold text-sm lg:text-base">{reportData.salesStockInsights.topShop || 'N/A'}</p>
                </div>
                <TrendingUp className="h-6 w-6 text-success opacity-80" />
              </div>
              <div className="bg-card p-3 lg:p-4 rounded-sm border flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-tight mb-1">Highest Pending Shop</p>
                  <p className="font-bold text-sm lg:text-base">{reportData.salesStockInsights.highestPendingShop || 'N/A'}</p>
                </div>
                <AlertTriangle className="h-6 w-6 text-warning opacity-80" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* 4. Sales by Meat Type */}
            <div>
              <h2 className="font-semibold mb-3 text-base">Sales by Meat Type</h2>
              <div className="rounded-sm border bg-card p-4 shadow-none">
                <DataTable
                  columns={[
                    { header: "Meat Type", accessor: "type" },
                    { header: "Total KG Sold", accessor: (r) => `${r.kgSold} kg` },
                  ]}
                  data={reportData.salesByMeat.filter((m: any) => m.kgSold > 0)}
                  pageSize={5}
                />
              </div>
            </div>

            {/* 8. Preparation (Fry & Curry) */}
            <div>
              <h2 className="font-semibold mb-3 text-base">Preparation (Fry & Curry)</h2>
              <div className="rounded-sm border bg-card p-4 shadow-none">
                <DataTable
                  columns={[
                    { header: "Shop", accessor: "shopName" },
                    { header: "Fry Prepared", accessor: (r) => `${r.fryPrepared} kg` },
                    { header: "Curry Prepared", accessor: (r) => `${r.curryPrepared} kg` },
                    { header: "Bone Used", accessor: (r) => `${r.boneUsed} kg` },
                    { header: "Boneless Used", accessor: (r) => `${r.bonelessUsed} kg` },
                  ]}
                  data={reportData.preparationLogs}
                  pageSize={5}
                />
              </div>
            </div>
          </div>

          {/* 5. Shop Performance Comparison */}
          <div className="mb-8">
            <h2 className="font-semibold mb-3 text-base">Shop Performance Comparison</h2>
            <div className="rounded-sm border bg-card p-4 shadow-none">
              <div className="w-full">
                <DataTable
                  columns={[
                    { header: "Shop Name", accessor: (r) => <span className="font-semibold">{r.shopName}</span> },
                    { header: "Revenue", accessor: (r) => `₹${r.revenue.toLocaleString()}` },
                    { header: "Op. Cost", accessor: (r) => `₹${(r.operationalCost || 0).toLocaleString()}` },
                    { header: "KG Sold", accessor: (r) => `${r.kgSold} kg` },
                    { header: "Bills", accessor: "bills" },
                    { header: "Pending Stock", accessor: (r) => `${r.pendingStock} kg` },
                    { header: "Discount", accessor: (r) => `₹${r.discount}` },
                    { 
                      header: "Status", 
                      accessor: (r) => (
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] lg:text-xs font-bold uppercase",
                          r.shopName === reportData.salesStockInsights.topShop ? "badge-success" : 
                          r.status === 'Critical' ? "badge-error" : 
                          r.status === 'Moderate' ? "badge-warning" : "bg-secondary text-foreground border"
                        )}>
                          {r.shopName === reportData.salesStockInsights.topShop ? "Top Performer" : r.status === 'Critical' ? "Needs Attention" : r.status}
                        </span>
                      )
                    },
                  ]}
                  data={reportData.shopPerformance.sort((a: any, b: any) => b.revenue - a.revenue)}
                  pageSize={10}
                />
              </div>
            </div>
          </div>

          {/* 6. Inventory Monitoring — Per Shop */}
          <div className="mb-8">
            <h2 className="font-semibold mb-3 text-base">Inventory Monitoring — Per Shop</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
              {reportData.inventoryMonitoring.map((shop: any) => (
                <div key={shop.shopId} className="bg-card rounded-sm border p-4 shadow-none">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-sm lg:text-base">{shop.shopName}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                      shop.status === 'Good' ? 'badge-success' : shop.status === 'Moderate' ? 'badge-warning' : 'badge-error'
                    )}>
                      {shop.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs lg:text-sm">
                    <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 border p-2 rounded-sm">
                      <span className="text-muted-foreground uppercase text-[10px] font-bold">Bone</span>
                      <span className="font-bold text-foreground">{shop.bone} kg</span>
                    </div>
                    <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 border p-2 rounded-sm">
                      <span className="text-muted-foreground uppercase text-[10px] font-bold">Boneless</span>
                      <span className="font-bold text-foreground">{shop.boneless} kg</span>
                    </div>
                    <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 border p-2 rounded-sm">
                      <span className="text-muted-foreground uppercase text-[10px] font-bold">Mixed</span>
                      <span className="font-bold text-foreground">{shop.mixed} kg</span>
                    </div>
                    <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 border p-2 rounded-sm">
                      <span className="text-muted-foreground uppercase text-[10px] font-bold">Pending Tot.</span>
                      <span className="font-bold text-primary">{shop.pending} kg</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 7. Pending Inventory Summary table */}
          <div className="mb-8">
            <h2 className="font-semibold mb-3 text-base">Pending Inventory Summary</h2>
            <div className="rounded-sm border bg-card p-4 shadow-none">
              <DataTable
                columns={[
                  { header: "Shop", accessor: "shopName" },
                  { header: "Bone Pending", accessor: (r) => `${r.bonePending} kg` },
                  { header: "Boneless Pending", accessor: (r) => `${r.bonelessPending} kg` },
                  { header: "Mixed Pending", accessor: (r) => `${r.mixedPending} kg` },
                  { header: "Total Pending", accessor: (r) => <span className="font-semibold">{r.totalPending} kg</span> },
                  { 
                    header: "Status", 
                    accessor: (r) => (
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        r.status === 'Good' ? 'badge-success' : r.status === 'Moderate' ? 'badge-warning' : 'badge-error'
                      )}>
                        {r.status}
                      </span>
                    )
                  },
                ]}
                data={reportData.pendingInventorySummary}
                pageSize={5}
              />
            </div>
          </div>

          {/* 9. Daily Sales Log */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-base">Daily Sales Log</h2>
            </div>
            
            <div className="rounded-sm border bg-card p-4 shadow-none">
              {/* Search is naturally full width inside DataTable but table itself scrolls */}
              {/* Modified DataTable internally via prior fix already handles this perfectly. */}
              <div className="w-full">
                <DataTable
                  columns={[
                    { header: "Date", accessor: "date" },
                    { header: "Shop", accessor: "shopName" },
                    { header: "Bill ID", accessor: "billId" },
                    { header: "Bone (kg)", accessor: "bone" },
                    { header: "Boneless (kg)", accessor: "boneless" },
                    { header: "Fry (kg)", accessor: "fry" },
                    { header: "Curry (kg)", accessor: "curry" },
                    { header: "Mixed (kg)", accessor: "mixed" },
                    { header: "Total KG", accessor: (r) => <span className="font-semibold text-primary">{r.totalKg} kg</span> },
                    { header: "Cash", accessor: (r) => `₹${r.cash}` },
                    { header: "PhonePe", accessor: (r) => `₹${r.phonePe}` },
                    { header: "Discount", accessor: (r) => `₹${r.discount}` },
                    { header: "Total", accessor: (r) => <span className="font-bold text-foreground">₹{r.total}</span> },
                  ]}
                  data={reportData.dailySalesLog}
                  pageSize={10}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
