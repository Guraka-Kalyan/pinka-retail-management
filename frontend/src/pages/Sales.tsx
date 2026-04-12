import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import InventoryOut from "@/pages/InventoryOut";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndianRupee, Store, Settings2, Wallet, CookingPot, ShoppingCart, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

export default function Sales({ isDailyMode = false }: { isDailyMode?: boolean }) {
  const { toast } = useToast();
  const [isCostsOpen, setIsCostsOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState("");
  const [shopsList, setShopsList] = useState<{id: string, name: string}[]>([]);
  const todayStr = new Date().toISOString().split("T")[0];

  const fetchShops = async () => {
    try {
      const res = await api.get("/shops");
      const mapped = res.data.data.map((s: any) => ({ id: s._id, name: s.name }));
      setShopsList(mapped);

      if (isDailyMode) {
        const userStr = localStorage.getItem("pinaka_user");
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.assignedShop) {
            setSelectedShop(user.assignedShop);
          } else if (mapped.length > 0) {
            setSelectedShop(mapped[0].id);
          }
        }
      }
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
  const [costsRefresh, setCostsRefresh] = useState(0);

  useEffect(() => {
    const fetchSellingCosts = async () => {
      try {
        if (!selectedShop || selectedShop === "global") return;
        setIsCostsLoading(true);
        const res = await api.get(`/settings/selling-costs?shopId=${selectedShop}`);
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
  }, [selectedShop]);

  const handleSaveCosts = async () => {
    try {
      if (!selectedShop || selectedShop === "global") {
        toast({ title: "Error", description: "Please select a shop first.", variant: "destructive" });
        return;
      }
      await api.put("/settings/selling-costs", { ...sellingCosts, shopId: selectedShop });
      toast({ title: "Success", description: "Selling costs updated successfully! New prices will apply to Sales." });
      setIsCostsOpen(false);
      setCostsRefresh(prev => prev + 1);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update selling costs", variant: "destructive" });
    }
  };

  const [isCounterCashOpen, setIsCounterCashOpen] = useState(false);
  const [counterDate, setCounterDate] = useState(new Date().toISOString().split("T")[0]);
  const [counterCashInput, setCounterCashInput] = useState("");
  const [finalCashInput, setFinalCashInput] = useState("");
  
  const [counterCashVal, setCounterCashVal] = useState(0);
  const [finalCashVal, setFinalCashVal] = useState(0);
  const [hasOpeningCash, setHasOpeningCash] = useState(false);
  const [todayCashSales, setTodayCashSales] = useState(0);

  // Counter Cash History
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  const openHistory = async () => {
    if (!selectedShop || selectedShop === "global") {
      toast({ title: "Error", description: "Please select a shop first.", variant: "destructive" });
      return;
    }
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/shops/${selectedShop}/counter-cash/history`);
      setHistoryRecords(res.data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load history.", variant: "destructive" });
    } finally {
      setHistoryLoading(false);
    }
  };

  const [isPrepOpen, setIsPrepOpen] = useState(false);
  const [prepDate, setPrepDate] = useState(todayStr);
  const [stockError, setStockError] = useState<{item: string, available: number, requested: number, field: string} | null>(null);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [boneFry, setBoneFry] = useState("");
  const [bonelessFry, setBonelessFry] = useState("");
  const [fryOutput, setFryOutput] = useState("");
  const [boneCurry, setBoneCurry] = useState("");
  const [bonelessCurry, setBonelessCurry] = useState("");
  const [curryOutput, setCurryOutput] = useState("");

  useEffect(() => {
    if (boneFry || bonelessFry) {
      setFryOutput(((Number(boneFry) || 0) + (Number(bonelessFry) || 0)).toString());
    }
  }, [boneFry, bonelessFry]);

  useEffect(() => {
    if (boneCurry || bonelessCurry) {
      setCurryOutput(((Number(boneCurry) || 0) + (Number(bonelessCurry) || 0)).toString());
    }
  }, [boneCurry, bonelessCurry]);

  const handleSavePreparation = async () => {
    if (!selectedShop || selectedShop === "global") {
      toast({ title: "Error", description: "Please select a shop first.", variant: "destructive" });
      return;
    }
    try {
      const stockRes = await api.get(`/shops/${selectedShop}/stock`);
      const stock = stockRes.data.data;
      
      const bFry = Number(boneFry) || 0;
      const bCurry = Number(boneCurry) || 0;
      const reqBone = bFry + bCurry;
      
      const blFry = Number(bonelessFry) || 0;
      const blCurry = Number(bonelessCurry) || 0;
      const reqBoneless = blFry + blCurry;

      if (reqBone > stock.boneStock) {
        setStockError({ item: "Bone", available: stock.boneStock, requested: reqBone, field: "Bone" });
        return;
      }
      if (reqBoneless > stock.bonelessStock) {
        setStockError({ item: "Boneless", available: stock.bonelessStock, requested: reqBoneless, field: "Boneless" });
        return;
      }

      await api.post(`/shops/${selectedShop}/preparations`, {
        date: prepDate,
        boneFry: Number(boneFry) || 0,
        bonelessFry: Number(bonelessFry) || 0,
        fryOutput: Number(fryOutput) || 0,
        boneCurry: Number(boneCurry) || 0,
        bonelessCurry: Number(bonelessCurry) || 0,
        curryOutput: Number(curryOutput) || 0,
      });
      toast({ title: "Success", description: "Daily preparation logged successfully." });
      setIsPrepOpen(false);
      setBoneFry(""); setBonelessFry(""); setFryOutput("");
      setBoneCurry(""); setBonelessCurry(""); setCurryOutput("");
      fetchDataForShop();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.response?.data?.message || "Failed to save preparation.", 
        variant: "destructive" 
      });
    }
  };

  const fetchDataForShop = async () => {
    if (!selectedShop || selectedShop === "global") return;
    try {
      // Fetch Counter Cash
      const counterRes = await api.get(`/shops/${selectedShop}/counter-cash?date=${todayStr}`);
      if (counterRes.data.data) {
        setCounterCashVal(counterRes.data.data.openingCash || 0);
        setFinalCashVal(counterRes.data.data.finalCash || 0);
        setHasOpeningCash(true);
      } else {
        setCounterCashVal(0);
        setFinalCashVal(0);
        setHasOpeningCash(false);
      }
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
        openingCash: Number(counterCashInput),
        finalCash: Number(finalCashInput)
      });
      toast({ title: "Success", description: "Counter Cash saved." });
      setCounterCashVal(Number(counterCashInput));
      setFinalCashVal(Number(finalCashInput));
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
    setFinalCashInput(finalCashVal.toString());
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6 w-full">
        {/* Shop Selector */}
        <div className="flex items-center gap-3 bg-card px-3 py-1.5 rounded-sm border border-[var(--border)] shadow-none h-[40px] sm:h-11 w-full sm:w-auto hover:border-slate-300 transition-all">
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
        <Dialog open={isCostsOpen} onOpenChange={setIsCostsOpen}>
          <DialogTrigger asChild>
            <span title={!selectedShop || selectedShop === "global" ? "Select a shop first" : ""}>
              <Button disabled={!selectedShop || selectedShop === "global"} onClick={(e) => { e.preventDefault(); setIsCostsOpen(true); }} variant="outline" className="h-[40px] sm:h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm" style={{color: 'var(--text-primary)'}}>
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                Daily Costs
              </Button>
            </span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Daily Selling Costs</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Configure selling prices per kg for <span className="font-bold text-foreground">{selectedShopName}</span></p>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Bone (₹/kg)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9 h-11 bg-card border-zinc-200 font-bold" value={sellingCosts.bone || 0} onChange={(e) => setSellingCosts({...sellingCosts, bone: Number(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Boneless (₹/kg)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9 h-11 bg-card border-zinc-200 font-bold" value={sellingCosts.boneless || 0} onChange={(e) => setSellingCosts({...sellingCosts, boneless: Number(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fry (₹/kg)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9 h-11 bg-card border-zinc-200 font-bold" value={sellingCosts.fry || 0} onChange={(e) => setSellingCosts({...sellingCosts, fry: Number(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Curry (₹/kg)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9 h-11 bg-card border-zinc-200 font-bold" value={sellingCosts.curry || 0} onChange={(e) => setSellingCosts({...sellingCosts, curry: Number(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mixed (₹/kg)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9 h-11 bg-card border-zinc-200 font-bold" value={sellingCosts.mixed || 0} onChange={(e) => setSellingCosts({...sellingCosts, mixed: Number(e.target.value)})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCostsOpen(false)} className="rounded-sm font-bold w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleSaveCosts} disabled={isCostsLoading} className="bg-primary hover:bg-primary/80 text-white font-bold w-full sm:w-auto shadow-none rounded-sm">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Counter Cash Button */}
        <Dialog open={isCounterCashOpen} onOpenChange={setIsCounterCashOpen}>
          <DialogTrigger asChild>
            <span title={!selectedShop || selectedShop === "global" ? "Select a shop first" : ""}>
              <Button disabled={!selectedShop || selectedShop === "global"} onClick={(e) => { e.preventDefault(); openCounterCashModal(); }} variant="outline" className="h-[40px] sm:h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm" style={{color: 'var(--text-primary)'}}>
                <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                Counter Cash
              </Button>
            </span>
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
              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label>Final Cash (₹)</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0"
                      className="pl-9 h-11 bg-card border-zinc-200 font-bold"
                      value={finalCashInput}
                      onChange={(e) => setFinalCashInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCounterCashOpen(false)} className="rounded-sm font-bold w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleSaveCounterCash} className="bg-primary hover:bg-primary/80 text-white font-bold w-full sm:w-auto shadow-none rounded-sm">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Counter Cash History Button */}
        <span title={!selectedShop || selectedShop === "global" ? "Select a shop first" : ""}>
          <Button
            disabled={!selectedShop || selectedShop === "global"}
            onClick={openHistory}
            variant="outline"
            className="h-[40px] sm:h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
            Cash History
          </Button>
        </span>

        {/* History Dialog */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Cash History — {selectedShopName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Daily opening &amp; final cash log</p>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 mt-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading history...</div>
              ) : historyRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Wallet className="w-10 h-10 mb-3 opacity-30" />
                  <p className="font-semibold">No records found for this shop.</p>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-3 py-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                      <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">Opening Cash</th>
                      <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">Final Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map((r, i) => (
                      <tr key={r._id || i} className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="px-3 py-2.5 font-bold text-foreground">{r.date}</td>
                        <td className="px-3 py-2.5 text-right">₹{(r.openingCash || 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-primary">₹{(r.finalCash || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/40 border-t-2">
                    <tr>
                      <td className="px-3 py-2.5 font-black text-xs uppercase tracking-wider">Total ({historyRecords.length} days)</td>
                      <td className="px-3 py-2.5 text-right font-bold">₹{historyRecords.reduce((s,r)=>s+(r.openingCash||0),0).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-primary">₹{historyRecords.reduce((s,r)=>s+(r.finalCash||0),0).toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button variant="outline" onClick={() => setIsHistoryOpen(false)} className="rounded-sm font-bold">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preparation Button */}
        <Dialog open={isPrepOpen} onOpenChange={setIsPrepOpen}>
          <DialogTrigger asChild>
            <span title={!selectedShop || selectedShop === "global" ? "Select a shop first" : ""}>
              <Button 
                disabled={!selectedShop || selectedShop === "global"}
                onClick={(e) => { 
                  e.preventDefault(); 
                  setPrepDate(new Date().toISOString().split("T")[0]);
                  setIsPrepOpen(true); 
                }} 
                variant="outline" 
                className="h-[40px] sm:h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm" 
                style={{color: 'var(--text-primary)'}}
              >
                <CookingPot className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                Preparation
              </Button>
            </span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Preparation Entry</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Daily preparation for <span className="font-bold text-foreground">{selectedShopName}</span> — {prepDate}</p>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" className="h-11 bg-card border-zinc-200 font-bold" value={prepDate} onChange={(e) => setPrepDate(e.target.value)} />
              </div>
              
              <div className="bg-muted/30 p-4 rounded-sm border border-border">
                <h3 className="font-bold mb-3 text-sm flex items-center"><CookingPot className="w-4 h-4 mr-2 text-primary" /> Fry Preparation</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1"><Label className="text-xs">Bone for Fry (kg)</Label><Input type="number" placeholder="0" className="h-10 font-bold" value={boneFry} onChange={(e) => setBoneFry(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Boneless for Fry (kg)</Label><Input type="number" placeholder="0" className="h-10 font-bold" value={bonelessFry} onChange={(e) => setBonelessFry(e.target.value)} /></div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-primary font-bold">Fry Output (kg)</Label>
                  <Input type="number" placeholder="0" className="h-10 font-bold border-primary/50 bg-primary/5" value={fryOutput} onChange={(e) => setFryOutput(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground uppercase mt-1 tracking-wider">Auto-calculated but fully editable</p>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-sm border border-border">
                <h3 className="font-bold mb-3 text-sm flex items-center"><CookingPot className="w-4 h-4 mr-2 text-primary" /> Curry Preparation</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1"><Label className="text-xs">Bone for Curry (kg)</Label><Input type="number" placeholder="0" className="h-10 font-bold" value={boneCurry} onChange={(e) => setBoneCurry(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Boneless for Curry (kg)</Label><Input type="number" placeholder="0" className="h-10 font-bold" value={bonelessCurry} onChange={(e) => setBonelessCurry(e.target.value)} /></div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-primary font-bold">Curry Output (kg)</Label>
                  <Input type="number" placeholder="0" className="h-10 font-bold border-primary/50 bg-primary/5" value={curryOutput} onChange={(e) => setCurryOutput(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground uppercase mt-1 tracking-wider">Auto-calculated but fully editable</p>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPrepOpen(false)} className="rounded-sm font-bold w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleSavePreparation} className="text-white font-bold w-full sm:w-auto shadow-none rounded-sm" style={{ backgroundColor: "#FF6B00" }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sales Button */}
        <span title={!selectedShop || selectedShop === "global" ? "Select a shop first" : ""}>
          <Button
            disabled={!selectedShop || selectedShop === "global"}
            onClick={() => setIsSalesModalOpen(true)}
            variant="outline"
            className="h-[40px] sm:h-11 rounded-sm bg-primary border-primary shadow-none transition-all font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm text-white hover:bg-primary/90 hover:text-white"
          >
            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
            Sales
          </Button>
        </span>
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
          <div className="bg-card w-full rounded-sm border border-[var(--border)] mb-4 sm:mb-6 px-4 py-3 sm:px-6 sm:py-4 shadow-none">
            <div className="grid grid-cols-2 gap-4 w-full text-sm font-semibold">
              <div className="flex flex-col">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground/80 mb-0.5 sm:mb-1">Opening Cash</span>
                {hasOpeningCash ? (
                  <span className="text-sm sm:text-lg text-foreground font-bold leading-tight">₹{counterCashVal.toLocaleString()}</span>
                ) : (
                  <Button variant="link" onClick={openCounterCashModal} className="p-0 h-auto text-[10px] sm:text-sm text-primary font-bold justify-start leading-tight">Set Opening Cash</Button>
                )}
              </div>
              <div className="flex flex-col border-l pl-4">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground/80 mb-0.5 sm:mb-1">Final Cash</span>
                <span className="text-sm sm:text-lg text-foreground font-black text-primary leading-tight">₹{finalCashVal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-card rounded-sm shadow-none border overflow-hidden">
              <div className="px-6 py-4 border-b" style={{backgroundColor: 'var(--table-header)'}}>
                <h2 className="text-xl font-bold" style={{color: 'var(--text-primary)'}}>Sales Records</h2>
              </div>
              <div className="p-0">
                <InventoryOut 
                  shopIdFilter={selectedShop}
                  salesModalOpen={isSalesModalOpen}
                  onSalesModalClose={() => setIsSalesModalOpen(false)}
                  refreshTrigger={costsRefresh}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Stock Error Modal */}
      <Dialog open={!!stockError} onOpenChange={(open) => !open && setStockError(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">
              ⚠️ Insufficient Stock
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-foreground text-base">Not enough <strong className="text-primary">{stockError?.item}</strong> stock available.</p>
            <div className="bg-muted p-4 rounded-md space-y-2 border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-semibold">Available:</span>
                <span className="font-bold text-lg">{stockError?.available.toFixed(2)} <span className="text-xs">kg</span></span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-semibold">Requested:</span>
                <span className="text-destructive font-bold text-lg">{stockError?.requested.toFixed(2)} <span className="text-xs">kg</span></span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Please adjust the quantity to continue.</p>
          </div>
          <DialogFooter className="mt-2">
            <Button 
              className="w-full bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-bold h-12 text-lg"
              onClick={() => setStockError(null)}
            >
              Fix Quantity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
