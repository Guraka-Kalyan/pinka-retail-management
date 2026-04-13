import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import InventoryOut from "@/pages/InventoryOut";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndianRupee, Store, Settings2, Wallet, CookingPot, ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

export default function Daily() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCostsOpen, setIsCostsOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: shopsList = [] } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const res = await api.get("/shops");
      let mapped = res.data.data.map((s: any) => ({ id: s._id, name: s.name }));

      const userStr = localStorage.getItem("pinaka_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.shopAccess === "specific" && user.assignedShops) {
          mapped = mapped.filter((s: any) => user.assignedShops.includes(s.id));
        }
        if (user.assignedShop && mapped.some((s: any) => s.id === user.assignedShop)) {
          setSelectedShop(user.assignedShop);
        } else if (mapped.length > 0 && !selectedShop) {
          setSelectedShop(mapped[0].id);
        }
      }
      return mapped;
    },
  });

  const { data: sellingCostsConfig } = useQuery({
    queryKey: ["sellingCosts", selectedShop],
    queryFn: async () => {
      const res = await api.get(`/settings/selling-costs?shopId=${selectedShop}`);
      return res.data.data || { fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 };
    },
    enabled: !!selectedShop && selectedShop !== "global",
  });

  const { data: counterCashData } = useQuery({
    queryKey: ["counterCash", selectedShop, todayStr],
    queryFn: async () => {
      const counterRes = await api.get(`/shops/${selectedShop}/counter-cash?date=${todayStr}`);
      return counterRes.data.data || { openingCash: 0, finalCash: 0 };
    },
    enabled: !!selectedShop && selectedShop !== "global",
  });

  const { data: stockData } = useQuery({
    queryKey: ["shopStock", selectedShop],
    queryFn: async () => {
      const res = await api.get(`/shops/${selectedShop}/stock`);
      return res.data.data;
    },
    enabled: !!selectedShop && selectedShop !== "global",
  });

  // ── Modals & Local State ──────────────────────────────────────────────────────
  const [sellingCosts, setSellingCosts] = useState<Record<string, number>>({ fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 });

  useEffect(() => {
    if (sellingCostsConfig) setSellingCosts(sellingCostsConfig);
  }, [sellingCostsConfig]);

  const [isCounterCashOpen, setIsCounterCashOpen] = useState(false);
  const [counterDate, setCounterDate] = useState(todayStr);
  const [counterCashInput, setCounterCashInput] = useState("");
  const [finalCashInput, setFinalCashInput] = useState("");

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

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveCostsMutation = useMutation({
    mutationFn: async () => api.put("/settings/selling-costs", { ...sellingCosts, shopId: selectedShop }),
    onSuccess: () => {
      toast({ title: "Success", description: "Selling costs updated successfully!" });
      setIsCostsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sellingCosts", selectedShop] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update selling costs", variant: "destructive" }),
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
      queryClient.invalidateQueries({ queryKey: ["shopStock", selectedShop] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to save preparation.", variant: "destructive" });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openCounterCashModal = () => {
    if (!selectedShop) return;
    setCounterDate(todayStr);
    setCounterCashInput(counterCashData?.openingCash?.toString() || "0");
    setFinalCashInput(counterCashData?.finalCash?.toString() || "0");
    setIsCounterCashOpen(true);
  };

  const handleSavePreparation = () => {
    if (!selectedShop || selectedShop === "global" || !stockData) return;
    const bFry = Number(boneFry) || 0;
    const bCurry = Number(boneCurry) || 0;
    const reqBone = bFry + bCurry;
    
    const blFry = Number(bonelessFry) || 0;
    const blCurry = Number(bonelessCurry) || 0;
    const reqBoneless = blFry + blCurry;

    if (reqBone > stockData.boneStock) {
      setStockError({ item: "Bone", available: stockData.boneStock, requested: reqBone, field: "Bone" });
      return;
    }
    if (reqBoneless > stockData.bonelessStock) {
      setStockError({ item: "Boneless", available: stockData.bonelessStock, requested: reqBoneless, field: "Boneless" });
      return;
    }

    savePrepMutation.mutate({
      date: prepDate,
      boneFry: bFry,
      bonelessFry: blFry,
      fryOutput: Number(fryOutput) || 0,
      boneCurry: bCurry,
      bonelessCurry: blCurry,
      curryOutput: Number(curryOutput) || 0,
    });
  };

  const handleSignOut = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="bg-background min-h-screen overflow-y-auto w-full">
      <div className="flex flex-col p-6 pb-20 max-w-lg mx-auto justify-center min-h-screen">
        <div className="flex flex-col items-center justify-center text-center mb-10 w-full pt-8">
          <Store className="w-16 h-16 text-[#FF6B00] mb-4 drop-shadow-sm" />
          <div className="w-full max-w-xs mx-auto mb-2">
            <Select value={selectedShop} onValueChange={setSelectedShop}>
              <SelectTrigger className="w-full border-2 border-[#FF6B00]/20 bg-[#FF6B00]/5 text-[#FF6B00] focus:ring-[#FF6B00] h-14 font-black text-xl rounded-xl shadow-none outline-none">
                <SelectValue placeholder="Select a Shop" />
              </SelectTrigger>
              <SelectContent>
                {shopsList.map((shop: any) => (
                  <SelectItem key={shop.id} value={shop.id} className="font-bold text-base">{shop.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-lg text-muted-foreground font-medium mt-1">Daily Entrance</p>
        </div>

        <div className="flex flex-col gap-6 w-full">
          {!selectedShop && (
            <div className="text-center py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="font-bold text-destructive">Select a shop to continue</p>
            </div>
          )}
          
          <Button 
            disabled={!selectedShop}
            onClick={openCounterCashModal} 
            className="h-24 rounded-xl bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-black text-2xl shadow-xl transform transition active:scale-95 flex items-center justify-center gap-4 disabled:opacity-60 disabled:active:scale-100 disabled:shadow-none"
          >
            <Wallet className="w-8 h-8" />
            Counter Cash
          </Button>

          <Button 
            disabled={!selectedShop}
            onClick={() => { setPrepDate(todayStr); setIsPrepOpen(true); }} 
            className="h-24 rounded-xl bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-black text-2xl shadow-xl transform transition active:scale-95 flex items-center justify-center gap-4 disabled:opacity-60 disabled:active:scale-100 disabled:shadow-none"
          >
            <CookingPot className="w-8 h-8" />
            Preparation
          </Button>

          <Button 
            disabled={!selectedShop}
            onClick={() => setIsSalesModalOpen(true)} 
            className="h-24 rounded-xl bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-black text-2xl shadow-xl transform transition active:scale-95 flex items-center justify-center gap-4 disabled:opacity-60 disabled:active:scale-100 disabled:shadow-none"
          >
            <ShoppingCart className="w-8 h-8" />
            Sales Dashboard
          </Button>

          <Button 
            disabled={!selectedShop}
            onClick={() => setIsCostsOpen(true)} 
            className="h-24 rounded-xl bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-black text-2xl shadow-xl transform transition active:scale-95 flex items-center justify-center gap-4 disabled:opacity-60 disabled:active:scale-100 disabled:shadow-none"
          >
            <Settings2 className="w-8 h-8" />
            Daily Costs
          </Button>
        </div>

        <div className="mt-16 text-center">
          <Button variant="ghost" className="text-muted-foreground font-bold hover:text-foreground" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>

      {/* MODALS */}
      <Dialog open={isCostsOpen} onOpenChange={setIsCostsOpen}>
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
              <Button onClick={() => saveCostsMutation.mutate()} disabled={saveCostsMutation.isPending} className="w-full bg-primary hover:bg-primary/80 text-white h-12 shadow-none font-bold tracking-widest uppercase rounded-sm">
                Save Costs
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCounterCashOpen} onOpenChange={setIsCounterCashOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Counter Cash</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" className="h-11 bg-card border-zinc-200 font-bold" value={counterDate} onChange={(e) => setCounterDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Cash (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" placeholder="0" className="pl-9 h-11 bg-card border-zinc-200 font-bold" value={counterCashInput} onChange={(e) => setCounterCashInput(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Final Cash (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" placeholder="0" className="pl-9 h-11 bg-card border-zinc-200 font-bold" value={finalCashInput} onChange={(e) => setFinalCashInput(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCounterCashOpen(false)} className="rounded-sm font-bold w-full sm:w-auto">Cancel</Button>
            <Button onClick={() => saveCounterCashMutation.mutate()} disabled={saveCounterCashMutation.isPending} className="bg-primary hover:bg-primary/80 text-white font-bold w-full sm:w-auto shadow-none rounded-sm">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrepOpen} onOpenChange={setIsPrepOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Preparation Entry</DialogTitle>
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
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrepOpen(false)} className="rounded-sm font-bold w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSavePreparation} disabled={savePrepMutation.isPending} className="text-white font-bold w-full sm:w-auto shadow-none rounded-sm" style={{ backgroundColor: "#FF6B00" }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stockError} onOpenChange={(open) => !open && setStockError(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">⚠️ Insufficient Stock</DialogTitle>
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
          </div>
          <DialogFooter className="mt-2">
            <Button className="w-full bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-bold h-12 text-lg" onClick={() => setStockError(null)}>Fix Quantity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Modal */}
      {isSalesModalOpen && selectedShop && selectedShop !== "global" && (
        <InventoryOut
          shopIdFilter={selectedShop}
          salesModalOpen={isSalesModalOpen}
          onSalesModalClose={() => setIsSalesModalOpen(false)}
        />
      )}
    </div>
  );
}
