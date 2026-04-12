import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CookingPot, Trash2, Loader2 } from "lucide-react";
import DataTable from "@/components/DataTable";
import api from "@/lib/api";

export default function Preparation() {
  const { toast } = useToast();
  const params = useParams();
  const id = params.id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [invIn, setInvIn] = useState<any[]>([]);
  const [liveStock, setLiveStock] = useState<any>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [prepRes, invRes, stockRes] = await Promise.all([
        api.get(`/shops/${id}/preparations`),
        api.get(`/shops/${id}/inventory-in`),
        api.get(`/shops/${id}/stock`)
      ]);
      setRecords(prepRes.data.data || []);
      setInvIn(invRes.data.data || []);
      setLiveStock(stockRes.data.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const [boneFry, setBoneFry] = useState("");
  const [bonelessFry, setBonelessFry] = useState("");
  const [boneCurry, setBoneCurry] = useState("");
  const [bonelessCurry, setBonelessCurry] = useState("");
  const [fryOutput, setFryOutput] = useState("");
  const [curryOutput, setCurryOutput] = useState("");
  const [isFryOverride, setIsFryOverride] = useState(false);
  const [isCurryOverride, setIsCurryOverride] = useState(false);

  // Auto-calculate fryOutput
  useEffect(() => {
    if (!isFryOverride) {
      const b = Number(boneFry) || 0;
      const bl = Number(bonelessFry) || 0;
      const val = b + bl;
      setFryOutput(val > 0 ? val.toString() : "");
    }
  }, [boneFry, bonelessFry, isFryOverride]);

  // Auto-calculate curryOutput
  useEffect(() => {
    if (!isCurryOverride) {
      const b = Number(boneCurry) || 0;
      const bl = Number(bonelessCurry) || 0;
      const val = b + bl;
      setCurryOutput(val > 0 ? val.toString() : "");
    }
  }, [boneCurry, bonelessCurry, isCurryOverride]);

  const todayStr = new Date().toISOString().split("T")[0];

  const availBone = Number(liveStock?.boneStock) || 0;
  const availBoneless = Number(liveStock?.bonelessStock) || 0;

  const b_fry = Number(boneFry) || 0;
  const bl_fry = Number(bonelessFry) || 0;
  const b_curry = Number(boneCurry) || 0;
  const bl_curry = Number(bonelessCurry) || 0;
  
  const total_bone_used = b_fry + b_curry;
  const total_boneless_used = bl_fry + bl_curry;
  const totalInputCalculated = total_bone_used + total_boneless_used;

  const isExceedingBone = total_bone_used > availBone;
  const isExceedingBoneless = total_boneless_used > availBoneless;

  const handleSavePrep = async () => {
    
    if (totalInputCalculated === 0) {
      toast({ title: "Submission Error", description: "Please enter preparation quantities", variant: "destructive" });
      return;
    }

    // Auto-calculate if user cleared or didn't set output fields
    let out_fry = fryOutput === "" ? 0 : Number(fryOutput);
    let out_curry = curryOutput === "" ? 0 : Number(curryOutput);

    if (out_fry === 0 && (b_fry > 0 || bl_fry > 0)) {
      out_fry = b_fry + bl_fry;
    }
    if (out_curry === 0 && (b_curry > 0 || bl_curry > 0)) {
      out_curry = b_curry + bl_curry;
    }

    if (isExceedingBone || isExceedingBoneless) {
      toast({ 
        title: "Stock Alert", 
        description: "Not enough stock in shop inventory. Please review quantities.", 
        variant: "destructive" 
      });
      return;
    }

    const payload = {
      date: todayStr,
      boneFry: b_fry,
      bonelessFry: bl_fry,
      boneCurry: b_curry,
      bonelessCurry: bl_curry,
      fryOutput: out_fry,
      curryOutput: out_curry,
    };
    
    try {
      await api.post(`/shops/${id}/preparations`, payload);
      toast({ title: "Success", description: "Preparation data recorded successfully." });
      setBoneFry(""); setBonelessFry(""); setBoneCurry(""); setBonelessCurry(""); 
      setFryOutput(""); setCurryOutput("");
      setIsFryOverride(false); setIsCurryOverride(false);
      fetchData();
    } catch (err: any) {
      if (err.response?.status !== 400) {
        console.error(err);
      }
      
      let errorMsg = err.response?.data?.message || "Failed to submit preparation";
      if (errorMsg === "Insufficient stock for preparation") {
        errorMsg = "Not enough stock in shop inventory";
      }

      toast({ 
        title: "Submission Error", 
        description: errorMsg, 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async (prepId: string) => {
    if (!confirm("Are you sure you want to delete this preparation entry?")) return;
    try {
      await api.delete(`/shops/${id}/preparations/${prepId}`);
      toast({ title: "Deleted", description: "Preparation record removed." });
      fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
    }
  };


  return (
    <div className="rounded-sm border bg-card shadow-none mb-8 overflow-hidden animate-fade-in w-full max-w-full">
      <div className="bg-primary px-6 py-3">
        <h2 className="text-lg font-semibold text-white">Daily Entry Form</h2>
      </div>
      <div className="p-6 border-b border-zinc-200">
        <div className="space-y-6">
          {isLoading && (
            <div className="flex justify-center items-center py-4 text-primary">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> <span>Loading data...</span>
            </div>
          )}
          <h3 className="text-xl font-bold text-muted-foreground uppercase flex items-center gap-3 border-b pb-3 mb-4">
            <CookingPot className="h-6 w-6" /> Section A - Preparation
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            {/* Input Side */}
            <div className="space-y-5 border-2 p-5 bg-secondary/20 rounded-sm shadow-none">
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 border-b pb-2">Raw Usage</h4>
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Bone for Fry (kg)</Label>
                    <span className={cn("text-xs font-bold", isExceedingBone ? "text-destructive" : "text-muted-foreground")}>{availBone} kg avail</span>
                  </div>
                  <Input type="number" className={cn("h-[56px] text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none", isExceedingBone && "border-destructive focus-visible:ring-destructive focus-visible:border-destructive")} value={boneFry} onChange={(e) => setBoneFry(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Boneless for Fry (kg)</Label>
                    <span className={cn("text-xs font-bold", isExceedingBoneless ? "text-destructive" : "text-muted-foreground")}>{availBoneless} kg avail</span>
                  </div>
                  <Input type="number" className={cn("h-[56px] text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none", isExceedingBoneless && "border-destructive focus-visible:ring-destructive focus-visible:border-destructive")} value={bonelessFry} onChange={(e) => setBonelessFry(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Bone for Curry (kg)</Label>
                    <span className={cn("text-xs font-bold", isExceedingBone ? "text-destructive" : "text-muted-foreground")}>{availBone} kg avail</span>
                  </div>
                  <Input type="number" className={cn("h-[56px] text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none", isExceedingBone && "border-destructive focus-visible:ring-destructive focus-visible:border-destructive")} value={boneCurry} onChange={(e) => setBoneCurry(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Boneless for Curry (kg)</Label>
                    <span className={cn("text-xs font-bold", isExceedingBoneless ? "text-destructive" : "text-muted-foreground")}>{availBoneless} kg avail</span>
                  </div>
                  <Input type="number" className={cn("h-[56px] text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none", isExceedingBoneless && "border-destructive focus-visible:ring-destructive focus-visible:border-destructive")} value={bonelessCurry} onChange={(e) => setBonelessCurry(e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>

            {/* Output Side */}
            <div className="space-y-5 border-2 p-5 bg-secondary/20 rounded-sm shadow-none">
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 border-b pb-2">Prepared Output</h4>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2 text-center md:text-left">
                  <Label className="text-lg font-bold">Fry Output (kg)</Label>
                  <Input type="number" 
                    className={cn("h-[56px] text-3xl font-black border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none text-info", isFryOverride && "border-amber-400 bg-amber-50/30")} 
                    value={fryOutput} 
                    onChange={(e) => { 
                      setFryOutput(e.target.value); 
                      setIsFryOverride(true); 
                    }} 
                    placeholder="0" 
                  />
                  <p className="text-[10px] text-muted-foreground italic font-medium">Auto-calculated (editable)</p>
                </div>
                <div className="space-y-2 text-center md:text-left">
                  <Label className="text-lg font-bold">Curry Output (kg)</Label>
                  <Input type="number" 
                    className={cn("h-[56px] text-3xl font-black border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none text-info", isCurryOverride && "border-amber-400 bg-amber-50/30")} 
                    value={curryOutput} 
                    onChange={(e) => { 
                      setCurryOutput(e.target.value); 
                      setIsCurryOverride(true); 
                    }} 
                    placeholder="0" 
                  />
                  <p className="text-[10px] text-muted-foreground italic font-medium">Auto-calculated (editable)</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-5 text-lg text-muted-foreground mr-2 font-black border-t mt-4">
             Total Used: {totalInputCalculated} kg &nbsp;|&nbsp; 
             Output: {(Number(fryOutput) || (Number(boneFry) || 0) + (Number(bonelessFry) || 0)) + 
                      (Number(curryOutput) || (Number(boneCurry) || 0) + (Number(bonelessCurry) || 0))} kg
          </div>
          
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSavePrep} 
              disabled={totalInputCalculated === 0 || isExceedingBone || isExceedingBoneless}
              className="w-full md:w-auto h-[60px] text-xl bg-primary hover:bg-primary/80 font-bold text-white shadow-none px-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Preparation
            </Button>
          </div>
        </div>
      </div>
      
      {/* Preparation Data Log */}
      <div className="p-6">
        <h3 className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2 mb-4 border-b pb-2">
           Preparation Log
        </h3>
        <DataTable
          columns={[
            { header: "Date", accessor: "date" },
            { header: "Ref ID", accessor: (r: any) => r.refId || r.billId },
            { header: "Bone Used (kg)", accessor: (r: any) => `${r.boneUsed || 0}` },
            { header: "Boneless Used (kg)", accessor: (r: any) => `${r.bonelessUsed || 0}` },
            { header: "Fry Prep (kg)", accessor: (r: any) => `${r.fry || 0}` },
            { header: "Curry Prep (kg)", accessor: (r: any) => `${r.curry || 0}` },
            {
              header: "Actions",
              accessor: (r: any) => (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r._id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )
            }
          ]}
          data={records}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
