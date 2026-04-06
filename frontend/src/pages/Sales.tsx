import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import InventoryOut from "@/pages/InventoryOut";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndianRupee, Store, Settings2, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

export default function Sales() {
  const { toast } = useToast();
  const [selectedShop, setSelectedShop] = useState("");
  const [shopsList, setShopsList] = useState<{id: string, name: string}[]>([]);
  const todayStr = new Date().toISOString().split("T")[0];

  const fetchShops = async () => {
    try {
      const res = await api.get("/shops");
      const mapped = res.data.data.map((s: any) => ({ id: s._id, name: s.name }));
      setShopsList(mapped);
    } catch {
      toast({ title: "Error", description: "Failed to load shops.", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const defaultCosts = { fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 };
  const [sellingCosts, setSellingCosts] = useState<Record<string, number>>(defaultCosts);
  const [isCostsLoading, setIsCostsLoading] = useState(false);

  useEffect(() => {
    const fetchSellingCosts = async () => {
      try {
        setIsCostsLoading(true);
        const res = await api.get("/settings/selling-costs");
        if (res.data.data) {
          setSellingCosts(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch selling costs", err);
      } finally {
        setIsCostsLoading(false);
      }
    };
    fetchSellingCosts();
  }, []);

  const handleSaveCosts = async () => {
    try {
      await api.put("/settings/selling-costs", sellingCosts);
      toast({ title: "Success", description: "Selling costs updated successfully! New prices will apply to Sales." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update selling costs", variant: "destructive" });
    }
  };

  const [isCounterCashOpen, setIsCounterCashOpen] = useState(false);
  const [counterDate, setCounterDate] = useState(new Date().toISOString().split("T")[0]);
  const [counterCashInput, setCounterCashInput] = useState("");
  
  const [counterCashVal, setCounterCashVal] = useState(0);
  const [hasOpeningCash, setHasOpeningCash] = useState(false);
  const [todayCashSales, setTodayCashSales] = useState(0);

  const fetchDataForShop = async () => {
    if (!selectedShop || selectedShop === "global") return;
    try {
      // Fetch Counter Cash
      const counterRes = await api.get(`/shops/${selectedShop}/counter-cash?date=${todayStr}`);
      if (counterRes.data.data) {
        setCounterCashVal(counterRes.data.data.openingCash);
        setHasOpeningCash(true);
      } else {
        setCounterCashVal(0);
        setHasOpeningCash(false);
      }

      // Fetch Sales
      const salesRes = await api.get(`/shops/${selectedShop}/sales?date=${todayStr}`);
      let totalCash = 0;
      (salesRes.data.data || []).forEach((r: any) => {
        if (!String(r.billId).startsWith("PREP")) {
          totalCash += Number(r.cash || 0);
        }
      });
      setTodayCashSales(totalCash);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDataForShop();
  }, [selectedShop]);

  const handleSaveCounterCash = async () => {
    if (selectedShop === "global") {
      toast({ title: "Error", description: "Please select a specific shop.", variant: "destructive" });
      return;
    }
    try {
      await api.post(`/shops/${selectedShop}/counter-cash`, {
        date: counterDate,
        openingCash: Number(counterCashInput)
      });
      toast({ title: "Success", description: "Counter Cash saved." });
      setCounterCashVal(Number(counterCashInput));
      setHasOpeningCash(true);
      setIsCounterCashOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save counter cash.", variant: "destructive" });
    }
  };

  const openCounterCashModal = () => {
    if (!selectedShop || selectedShop === "global") {
      toast({ title: "Error", description: "Please select a specific shop from the dropdown first to set Opening Cash.", variant: "destructive" });
      return;
    }
    setCounterDate(new Date().toISOString().split("T")[0]);
    setCounterCashInput(counterCashVal.toString());
    setIsCounterCashOpen(true);
  };

  const selectedShopName = selectedShop ? shopsList.find(s => s.id === selectedShop)?.name || "Shop" : "Select a Shop";

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[{ label: "Sales" }]} />
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Sales Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage sales, calculate billing, and configure daily shop costs.</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 w-full">
        {/* Shop Selector */}
        <div className="flex items-center gap-3 bg-card px-3 py-1.5 rounded-sm border border-[var(--border)] shadow-none h-11 w-full sm:w-auto hover:border-slate-300 transition-all">
          <Store className="w-5 h-5 text-primary shrink-0" />
          <Select value={selectedShop} onValueChange={setSelectedShop}>
            <SelectTrigger className="w-full sm:w-[220px] border-0 bg-transparent p-0 h-auto focus:ring-0 shadow-none font-bold text-sm text-foreground">
              <SelectValue placeholder="Select a Shop" />
            </SelectTrigger>
            <SelectContent>
              {shopsList.map(shop => (
                <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Daily Costs Button */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto" style={{color: 'var(--text-primary)'}}>
              <Settings2 className="w-4 h-4 mr-2" />
              Daily Costs
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Daily Selling Costs</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6">
              <p className="text-sm text-muted-foreground">Configure exactly how much each item cuts and mixes should cost today.</p>
              {["fry", "curry", "bone", "boneless", "mixed"].map((cut) => (
                <div key={cut} className="flex items-center justify-between gap-4 border-b border-secondary pb-4 last:border-0 last:pb-0">
                  <label className="font-bold text-sm tracking-wide text-muted-foreground w-24 uppercase">{cut}</label>
                  <div className="relative flex-1">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="pl-9 h-11 bg-card border-zinc-200 font-bold"
                      value={sellingCosts[cut] || 0}
                      onChange={(e) => setSellingCosts(prev => ({...prev, [cut]: Number(e.target.value)}))}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <Button
                  onClick={handleSaveCosts}
                  className="w-full bg-primary hover:bg-primary/80 text-white h-12 shadow-none font-bold tracking-widest uppercase rounded-sm"
                >
                  Save Costs
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Counter Cash Button */}
        <Dialog open={isCounterCashOpen} onOpenChange={setIsCounterCashOpen}>
          <DialogTrigger asChild>
            <Button onClick={(e) => { e.preventDefault(); openCounterCashModal(); }} variant="outline" className="h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto" style={{color: 'var(--text-primary)'}}>
              <Wallet className="w-4 h-4 mr-2" />
              Counter Cash
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Counter Cash</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Set opening cash for <span className="font-bold text-foreground">{selectedShopName}</span> — {todayStr}</p>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  className="h-11 bg-card border-zinc-200 font-bold"
                  value={counterDate}
                  onChange={(e) => setCounterDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Opening Cash (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0"
                    className="pl-9 h-11 bg-card border-zinc-200 font-bold"
                    value={counterCashInput}
                    onChange={(e) => setCounterCashInput(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCounterCashOpen(false)} className="rounded-sm font-bold w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleSaveCounterCash} className="bg-primary hover:bg-primary/80 text-white font-bold w-full sm:w-auto shadow-none rounded-sm">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!selectedShop ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-sm border border-[var(--border)] shadow-none text-center">
          <Store className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="font-bold text-foreground text-lg mb-1">No Shop Selected</p>
          <p className="text-sm text-muted-foreground">Select a shop from the dropdown above to view and manage its sales records.</p>
        </div>
      ) : (
        <>
          {/* SUMMARY STRIP */}
          <div className="bg-card w-full rounded-sm border border-[var(--border)] mb-6 px-6 py-4 shadow-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-sm font-semibold">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-muted-foreground/80 mb-1">Opening Cash</span>
                {hasOpeningCash ? (
                  <span className="text-lg text-foreground font-bold">₹{counterCashVal.toLocaleString()}</span>
                ) : (
                  <Button variant="link" onClick={openCounterCashModal} className="p-0 h-auto text-primary font-bold justify-start">Set Opening Cash</Button>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-muted-foreground/80 mb-1">Sales</span>
                <span className="text-lg text-foreground font-bold">₹{todayCashSales.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-muted-foreground/80 mb-1">Counter Total</span>
                <span className="text-lg text-foreground font-black text-primary">₹{(counterCashVal + todayCashSales).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-card rounded-sm shadow-none border overflow-hidden">
              <div className="px-6 py-4 border-b" style={{backgroundColor: 'var(--table-header)'}}>
                <h2 className="text-xl font-bold" style={{color: 'var(--text-primary)'}}>Sales Records</h2>
              </div>
              <div className="p-6">
                <InventoryOut shopIdFilter={selectedShop} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
