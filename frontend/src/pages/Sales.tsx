import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Breadcrumb from "@/components/Breadcrumb";
import InventoryOut from "@/pages/InventoryOut";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndianRupee, Store, Settings2, Wallet, CookingPot, ShoppingCart, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";

export default function Sales({ isDailyMode = false }: { isDailyMode?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const [selectedShop, setSelectedShop] = useState("");
  const [isCostsOpen, setIsCostsOpen] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: shopsList = [] } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const res = await api.get("/shops");
      const mapped = res.data.data.map((s: any) => ({ id: s._id, name: s.name }));
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
      return mapped;
    }
  });

  const { data: counterCashData, isLoading: isCounterLoading } = useQuery({
    queryKey: ["counterCash", selectedShop, todayStr],
    queryFn: async () => {
      const res = await api.get(`/shops/${selectedShop}/counter-cash?date=${todayStr}`);
      return res.data.data || null;
    },
    enabled: !!selectedShop && selectedShop !== "global",
  });

  const { data: sellingCostsData } = useQuery({
    queryKey: ["sellingCosts", selectedShop],
    queryFn: async () => {
      const res = await api.get(`/settings/selling-costs?shopId=${selectedShop}`);
      return res.data.data || { fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 };
    },
    enabled: !!selectedShop && selectedShop !== "global",
  });

  // Local state for modals so users can edit before saving
  const [sellingCosts, setSellingCosts] = useState<Record<string, number>>({ fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 });
  useEffect(() => {
    if (sellingCostsData) setSellingCosts(sellingCostsData);
  }, [sellingCostsData]);

  // Modals state
  const [isCounterCashOpen, setIsCounterCashOpen] = useState(false);
  const [counterDate, setCounterDate] = useState(todayStr);
  const [counterCashInput, setCounterCashInput] = useState("");
  const [finalCashInput, setFinalCashInput] = useState("");

  const [isPrepOpen, setIsPrepOpen] = useState(false);
  const [prepDate, setPrepDate] = useState(todayStr);
  const [boneFry, setBoneFry] = useState("");
  const [bonelessFry, setBonelessFry] = useState("");
  const [fryOutput, setFryOutput] = useState("");
  const [boneCurry, setBoneCurry] = useState("");
  const [bonelessCurry, setBonelessCurry] = useState("");
  const [curryOutput, setCurryOutput] = useState("");
  const [stockError, setStockError] = useState<any>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  // Auto computations
  useEffect(() => {
    if (boneFry || bonelessFry) setFryOutput(((Number(boneFry) || 0) + (Number(bonelessFry) || 0)).toString());
  }, [boneFry, bonelessFry]);

  useEffect(() => {
    if (boneCurry || bonelessCurry) setCurryOutput(((Number(boneCurry) || 0) + (Number(bonelessCurry) || 0)).toString());
  }, [boneCurry, bonelessCurry]);

  const { data: cashHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["cashHistory", selectedShop],
    queryFn: async () => {
      const res = await api.get(`/shops/${selectedShop}/counter-cash/history`);
      return res.data.data || [];
    },
    enabled: isHistoryOpen && !!selectedShop && selectedShop !== "global",
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveCostsMutation = useMutation({
    mutationFn: async () => api.put("/settings/selling-costs", { ...sellingCosts, shopId: selectedShop }),
    onSuccess: () => {
      toast({ title: "Success", description: "Selling costs updated successfully!" });
      setIsCostsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sellingCosts", selectedShop] });
      queryClient.invalidateQueries({ queryKey: ["inventoryOutData", selectedShop] }); 
    },
    onError: () => toast({ title: "Error", description: "Failed to update costs", variant: "destructive" }),
  });

  const saveCounterCashMutation = useMutation({
    mutationFn: async () => api.post(`/shops/${selectedShop}/counter-cash`, {
      date: counterDate,
      openingCash: Number(counterCashInput),
      finalCash: Number(finalCashInput)
    }),
    onSuccess: () => {
      toast({ title: "Success", description: "Counter Cash saved." });
      setIsCounterCashOpen(false);
      queryClient.invalidateQueries({ queryKey: ["counterCash", selectedShop, todayStr] });
    },
    onError: () => toast({ title: "Error", description: "Failed to save counter cash.", variant: "destructive" }),
  });

  const savePrepMutation = useMutation({
    mutationFn: async (payload: any) => api.post(`/shops/${selectedShop}/preparations`, payload),
    onSuccess: () => {
      toast({ title: "Success", description: "Daily preparation logged successfully." });
      setIsPrepOpen(false);
      setBoneFry(""); setBonelessFry(""); setFryOutput("");
      setBoneCurry(""); setBonelessCurry(""); setCurryOutput("");
      // Need to refresh stock
      queryClient.invalidateQueries({ queryKey: ["shopStock", selectedShop] });
      queryClient.invalidateQueries({ queryKey: ["inventoryOutData", selectedShop] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.response?.data?.message || "Failed to save preparation.", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSavePreparation = async () => {
    if (!selectedShop || selectedShop === "global") return;
    try {
      const stockRes = await api.get(`/shops/${selectedShop}/stock`);
      const stock = stockRes.data.data;
      
      const bFry = Number(boneFry) || 0;
      const bCurry = Number(boneCurry) || 0;
      const reqBone = bFry + bCurry;
      
      const blFry = Number(bonelessFry) || 0;
      const blCurry = Number(bonelessCurry) || 0;
      const reqBoneless = blFry + blCurry;

      if (reqBone > stock.boneStock) return setStockError({ item: "Bone", available: stock.boneStock, requested: reqBone, field: "Bone" });
      if (reqBoneless > stock.bonelessStock) return setStockError({ item: "Boneless", available: stock.bonelessStock, requested: reqBoneless, field: "Boneless" });

      savePrepMutation.mutate({
        date: prepDate,
        boneFry: bFry,
        bonelessFry: blFry,
        fryOutput: Number(fryOutput) || 0,
        boneCurry: bCurry,
        bonelessCurry: blCurry,
        curryOutput: Number(curryOutput) || 0,
      });
    } catch {
      toast({ title: "Error", description: "Failed to verify stock", variant: "destructive" });
    }
  };

  const openCounterCashModal = () => {
    if (!selectedShop || selectedShop === "global") {
      toast({ title: "Error", description: "Please select a specific shop from the dropdown first.", variant: "destructive" });
      return;
    }
    setCounterDate(todayStr);
    setCounterCashInput(counterCashData?.openingCash?.toString() || "0");
    setFinalCashInput(counterCashData?.finalCash?.toString() || "0");
    setIsCounterCashOpen(true);
  };

  const selectedShopName = selectedShop ? shopsList.find((s: any) => s.id === selectedShop)?.name || "Shop" : "Select a Shop";
  const hasOpeningCash = !!counterCashData;
  const counterCashVal = counterCashData?.openingCash || 0;
  const finalCashVal = counterCashData?.finalCash || 0;

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[{ label: "Sales" }]} />
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Sales Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage sales, calculate billing, and configure daily shop costs.</p>
        </div>
      </div>

      {/* FILTER BAR & Modal Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6 w-full">
        {/* Shop Selector */}
        <div className="flex items-center gap-3 bg-card px-3 py-1.5 rounded-sm border border-[var(--border)] shadow-none h-[40px] sm:h-11 w-full sm:w-auto hover:border-slate-300 transition-all">
          <Store className="w-5 h-5 text-primary shrink-0" />
          <Select value={selectedShop} onValueChange={setSelectedShop}>
            <SelectTrigger className="w-full sm:w-[220px] border-0 bg-transparent p-0 h-auto focus:ring-0 shadow-none font-bold text-sm text-foreground">
              <SelectValue placeholder="Select a Shop" />
            </SelectTrigger>
            <SelectContent>
              {shopsList.map((shop: any) => (
                <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Daily Costs */}
        <Button disabled={!selectedShop || selectedShop === "global"} onClick={() => setIsCostsOpen(true)} variant="outline" className="h-[40px] sm:h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm" style={{color: 'var(--text-primary)'}}>
          <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" /> Daily Costs
        </Button>
        <Dialog open={isCostsOpen} onOpenChange={setIsCostsOpen}>
          <DialogContent className="sm:max-w-[425px]">
             {/* Same costs modal logic */}
             <DialogHeader><DialogTitle>Daily Selling Costs</DialogTitle></DialogHeader>
             <div className="grid grid-cols-2 gap-4 py-4">
               {["bone", "boneless", "fry", "curry", "mixed"].map((cut) => (
                 <div key={cut} className="space-y-2">
                   <Label className="capitalize">{cut} (₹/kg)</Label>
                   <Input type="number" className="h-11 bg-card font-bold" value={sellingCosts[cut] || 0} onChange={(e) => setSellingCosts({...sellingCosts, [cut]: Number(e.target.value)})} />
                 </div>
               ))}
             </div>
             <DialogFooter><Button onClick={() => saveCostsMutation.mutate()} disabled={saveCostsMutation.isPending} className="w-full">Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Counter Cash */}
        <Button disabled={!selectedShop || selectedShop === "global"} onClick={openCounterCashModal} variant="outline" className="h-[40px] sm:h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm" style={{color: 'var(--text-primary)'}}>
          <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" /> Counter Cash
        </Button>
        <Dialog open={isCounterCashOpen} onOpenChange={setIsCounterCashOpen}>
          <DialogContent className="sm:max-w-[425px]">
             <DialogHeader><DialogTitle>Counter Cash</DialogTitle></DialogHeader>
             <div className="grid gap-6 py-4">
                 <Input type="date" value={counterDate} onChange={e=>setCounterDate(e.target.value)} className="h-11 font-bold"/>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label>Opening Cash (₹)</Label><Input type="number" value={counterCashInput} onChange={e=>setCounterCashInput(e.target.value)} className="h-11 font-bold"/></div>
                   <div className="space-y-2"><Label>Final Cash (₹)</Label><Input type="number" value={finalCashInput} onChange={e=>setFinalCashInput(e.target.value)} className="h-11 font-bold"/></div>
                 </div>
             </div>
             <DialogFooter><Button onClick={() => saveCounterCashMutation.mutate()} disabled={saveCounterCashMutation.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cash History */}
        <Button disabled={!selectedShop || selectedShop === "global"} onClick={() => setIsHistoryOpen(true)} variant="outline" className="h-[40px] sm:h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
          <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" /> Cash History
        </Button>
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader><DialogTitle>Cash History</DialogTitle></DialogHeader>
            <div className="overflow-y-auto flex-1 mt-2">
              {historyLoading ? <div className="p-4"><Skeleton className="w-full h-10 mb-2"/><Skeleton className="w-full h-10 mb-2"/></div> : (
                cashHistory.length === 0 ? <p className="text-center p-8">No records</p> : (
                  <table className="w-full text-sm">
                    <thead><tr><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Opening</th><th className="text-right px-3 py-2">Final</th></tr></thead>
                    <tbody>
                      {cashHistory.map((r: any) => (
                        <tr key={r._id}><td className="px-3 py-2">{r.date}</td><td className="px-3 py-2 text-right">₹{r.openingCash}</td><td className="px-3 py-2 text-right font-bold">₹{r.finalCash}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Preparation */}
        <Button disabled={!selectedShop || selectedShop === "global"} onClick={() => { setPrepDate(todayStr); setIsPrepOpen(true); }} variant="outline" className="h-[40px] sm:h-11 rounded-sm bg-card border-[var(--border)] shadow-none transition-all hover:text-primary hover:border-primary/30 font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm" style={{color: 'var(--text-primary)'}}>
          <CookingPot className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" /> Preparation
        </Button>
        <Dialog open={isPrepOpen} onOpenChange={setIsPrepOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Preparation Entry</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-2 max-h-[75vh] overflow-y-auto">
              {/* Date */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</Label>
                <Input type="date" value={prepDate} onChange={e => setPrepDate(e.target.value)} className="font-bold border-2 h-11 focus-visible:ring-primary focus-visible:border-primary" />
              </div>

              {/* Fry Preparation */}
              <div className="bg-muted/30 p-4 rounded-sm border border-border">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary">
                  <CookingPot className="w-4 h-4" /> Fry Preparation
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Bone for Fry (kg)</Label>
                    <Input type="number" placeholder="0" value={boneFry} onChange={e => setBoneFry(e.target.value)} className="h-10 font-bold border-2" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Boneless for Fry (kg)</Label>
                    <Input type="number" placeholder="0" value={bonelessFry} onChange={e => setBonelessFry(e.target.value)} className="h-10 font-bold border-2" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-primary">Fry Output (kg)</Label>
                  <Input type="number" placeholder="0" value={fryOutput} onChange={e => setFryOutput(e.target.value)} className="h-10 font-bold border-2 border-primary/40 bg-primary/5" />
                </div>
              </div>

              {/* Curry Preparation */}
              <div className="bg-muted/30 p-4 rounded-sm border border-border">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary">
                  <CookingPot className="w-4 h-4" /> Curry Preparation
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Bone for Curry (kg)</Label>
                    <Input type="number" placeholder="0" value={boneCurry} onChange={e => setBoneCurry(e.target.value)} className="h-10 font-bold border-2" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Boneless for Curry (kg)</Label>
                    <Input type="number" placeholder="0" value={bonelessCurry} onChange={e => setBonelessCurry(e.target.value)} className="h-10 font-bold border-2" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-primary">Curry Output (kg)</Label>
                  <Input type="number" placeholder="0" value={curryOutput} onChange={e => setCurryOutput(e.target.value)} className="h-10 font-bold border-2 border-primary/40 bg-primary/5" />
                </div>
              </div>

              {/* Stock error */}
              {stockError && (
                <div className="p-3 rounded-sm border border-destructive/40 bg-destructive/5 text-sm text-destructive font-semibold">
                  ⚠️ Not enough <strong>{stockError.item}</strong> stock. Available: {stockError.available} kg, Requested: {stockError.requested} kg
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" className="rounded-sm font-bold" onClick={() => setIsPrepOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePreparation} disabled={savePrepMutation.isPending} className="bg-primary hover:bg-primary/80 text-white font-bold rounded-sm px-8">
                {savePrepMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sales */}
        <Button disabled={!selectedShop || selectedShop === "global"} onClick={() => setIsSalesModalOpen(true)} variant="outline" className="h-[40px] sm:h-11 rounded-sm bg-primary border-primary shadow-none transition-all font-bold w-full sm:w-auto px-3 sm:px-4 text-xs sm:text-sm text-white hover:bg-primary/90">
          <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" /> Sales
        </Button>
      </div>

      {!selectedShop || selectedShop === "global" ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-sm border shadow-none text-center">
          <Store className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="font-bold text-lg mb-1">No Shop Selected</p>
          <p className="text-sm text-muted-foreground">Select a shop from the dropdown to continue.</p>
        </div>
      ) : (
        <>
          {/* SUMMARY STRIP */}
          <div className="bg-card w-full rounded-sm border mb-4 sm:mb-6 px-4 py-3 sm:px-6 sm:py-4 shadow-none">
            {isCounterLoading ? <Skeleton className="w-full h-8"/> : (
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
            )}
          </div>

          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-card rounded-sm shadow-none border overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-bold">Sales Records</h2>
              </div>
              <div className="p-0">
                <InventoryOut 
                  shopIdFilter={selectedShop} 
                  salesModalOpen={isSalesModalOpen} 
                  onSalesModalClose={() => setIsSalesModalOpen(false)} 
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
