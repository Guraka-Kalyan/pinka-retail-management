import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CookingPot, RotateCcw, Loader2, Pencil, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import DataTable from "@/components/DataTable";
import api from "@/lib/api";

export default function Preparation() {
  const { toast } = useToast();
  const params = useParams();
  const id = params.id;

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [liveStock, setLiveStock] = useState<any>(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const [prepDate, setPrepDate] = useState(todayStr);

  // ── Delete confirm dialog ───────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Edit dialog ─────────────────────────────────────────────────────────
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const [editBoneFry, setEditBoneFry] = useState("");
  const [editBonelessFry, setEditBonelessFry] = useState("");
  const [editBoneCurry, setEditBoneCurry] = useState("");
  const [editBonelessCurry, setEditBonelessCurry] = useState("");
  const [editFryOutput, setEditFryOutput] = useState("");
  const [editCurryOutput, setEditCurryOutput] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [prepRes, stockRes] = await Promise.all([
        api.get(`/shops/${id}/preparations`),
        api.get(`/shops/${id}/stock`)
      ]);
      setRecords(prepRes.data.data || []);
      setLiveStock(stockRes.data.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  // ── New entry form state ────────────────────────────────────────────────
  const [boneFry, setBoneFry] = useState("");
  const [bonelessFry, setBonelessFry] = useState("");
  const [boneCurry, setBoneCurry] = useState("");
  const [bonelessCurry, setBonelessCurry] = useState("");
  const [fryOutput, setFryOutput] = useState("");
  const [curryOutput, setCurryOutput] = useState("");
  const [isFryOverride, setIsFryOverride] = useState(false);
  const [isCurryOverride, setIsCurryOverride] = useState(false);

  useEffect(() => {
    if (!isFryOverride) {
      const val = (Number(boneFry) || 0) + (Number(bonelessFry) || 0);
      setFryOutput(val > 0 ? val.toString() : "");
    }
  }, [boneFry, bonelessFry, isFryOverride]);

  useEffect(() => {
    if (!isCurryOverride) {
      const val = (Number(boneCurry) || 0) + (Number(bonelessCurry) || 0);
      setCurryOutput(val > 0 ? val.toString() : "");
    }
  }, [boneCurry, bonelessCurry, isCurryOverride]);

  // todayStr kept for reference
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

  // ── Save new preparation ────────────────────────────────────────────────
  const handleSavePrep = async () => {
    if (totalInputCalculated === 0) {
      toast({ title: "Submission Error", description: "Please enter preparation quantities", variant: "destructive" });
      return;
    }
    let out_fry = fryOutput === "" ? 0 : Number(fryOutput);
    let out_curry = curryOutput === "" ? 0 : Number(curryOutput);
    if (out_fry === 0 && (b_fry > 0 || bl_fry > 0)) out_fry = b_fry + bl_fry;
    if (out_curry === 0 && (b_curry > 0 || bl_curry > 0)) out_curry = b_curry + bl_curry;
    if (isExceedingBone || isExceedingBoneless) {
      toast({ title: "Stock Alert", description: "Not enough stock in shop inventory. Please review quantities.", variant: "destructive" });
      return;
    }
    try {
      await api.post(`/shops/${id}/preparations`, {
        date: prepDate, boneFry: b_fry, bonelessFry: bl_fry,
        boneCurry: b_curry, bonelessCurry: bl_curry,
        fryOutput: out_fry, curryOutput: out_curry,
      });
      toast({ title: "Success", description: "Preparation data recorded successfully." });
      setBoneFry(""); setBonelessFry(""); setBoneCurry(""); setBonelessCurry("");
      setFryOutput(""); setCurryOutput("");
      setIsFryOverride(false); setIsCurryOverride(false);
      fetchData();
    } catch (err: any) {
      let errorMsg = err.response?.data?.message || "Failed to submit preparation";
      if (errorMsg === "Insufficient stock for preparation") errorMsg = "Not enough stock in shop inventory";
      toast({ title: "Submission Error", description: errorMsg, variant: "destructive" });
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/shops/${id}/preparations/${deleteTarget}`);
      toast({ title: "Deleted", description: "Preparation record removed." });
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Open edit modal ─────────────────────────────────────────────────────
  const openEdit = (r: any) => {
    setEditRecord(r);
    setEditBoneFry(String(r.boneFry ?? ""));
    setEditBonelessFry(String(r.bonelessFry ?? ""));
    setEditBoneCurry(String(r.boneCurry ?? ""));
    setEditBonelessCurry(String(r.bonelessCurry ?? ""));
    setEditFryOutput(String(r.fryOutput ?? r.fry ?? ""));
    setEditCurryOutput(String(r.curryOutput ?? r.curry ?? ""));
  };

  // ── Save edit ───────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editRecord) return;
    setIsSavingEdit(true);
    try {
      await api.put(`/shops/${id}/preparations/${editRecord._id}`, {
        boneFry: Number(editBoneFry) || 0,
        bonelessFry: Number(editBonelessFry) || 0,
        boneCurry: Number(editBoneCurry) || 0,
        bonelessCurry: Number(editBonelessCurry) || 0,
        fryOutput: Number(editFryOutput) || 0,
        curryOutput: Number(editCurryOutput) || 0,
      });
      toast({ title: "Updated", description: `${editRecord.refId || "Record"} updated successfully.` });
      setEditRecord(null);
      fetchData(); // refresh so all displays reflect changes
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update record.", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
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

          {/* Date picker */}
          <div className="flex items-center gap-4 bg-muted/30 border rounded-sm px-4 py-3 w-full sm:w-auto">
            <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Preparation Date</Label>
            <Input
              type="date"
              value={prepDate}
              onChange={(e) => setPrepDate(e.target.value)}
              className="h-10 font-bold border-2 focus-visible:ring-primary focus-visible:border-primary w-auto"
            />
          </div>

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
                  <Input type="number" className={cn("h-[56px] text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none", isExceedingBone && "border-destructive")} value={boneFry} onChange={(e) => setBoneFry(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Boneless for Fry (kg)</Label>
                    <span className={cn("text-xs font-bold", isExceedingBoneless ? "text-destructive" : "text-muted-foreground")}>{availBoneless} kg avail</span>
                  </div>
                  <Input type="number" className={cn("h-[56px] text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none", isExceedingBoneless && "border-destructive")} value={bonelessFry} onChange={(e) => setBonelessFry(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Bone for Curry (kg)</Label>
                    <span className={cn("text-xs font-bold", isExceedingBone ? "text-destructive" : "text-muted-foreground")}>{availBone} kg avail</span>
                  </div>
                  <Input type="number" className={cn("h-[56px] text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none", isExceedingBone && "border-destructive")} value={boneCurry} onChange={(e) => setBoneCurry(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Boneless for Curry (kg)</Label>
                    <span className={cn("text-xs font-bold", isExceedingBoneless ? "text-destructive" : "text-muted-foreground")}>{availBoneless} kg avail</span>
                  </div>
                  <Input type="number" className={cn("h-[56px] text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none", isExceedingBoneless && "border-destructive")} value={bonelessCurry} onChange={(e) => setBonelessCurry(e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>

            {/* Output Side */}
            <div className="space-y-5 border-2 p-5 bg-secondary/20 rounded-sm shadow-none">
              <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 border-b pb-2">Prepared Output</h4>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label className="text-lg font-bold">Fry Output (kg)</Label>
                  <Input type="number" className={cn("h-[56px] text-3xl font-black border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none text-info", isFryOverride && "border-amber-400 bg-amber-50/30")} value={fryOutput} onChange={(e) => { setFryOutput(e.target.value); setIsFryOverride(true); }} placeholder="0" />
                  <p className="text-[10px] text-muted-foreground italic font-medium">Auto-calculated (editable)</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-lg font-bold">Curry Output (kg)</Label>
                  <Input type="number" className={cn("h-[56px] text-3xl font-black border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none text-info", isCurryOverride && "border-amber-400 bg-amber-50/30")} value={curryOutput} onChange={(e) => { setCurryOutput(e.target.value); setIsCurryOverride(true); }} placeholder="0" />
                  <p className="text-[10px] text-muted-foreground italic font-medium">Auto-calculated (editable)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-5 text-lg text-muted-foreground mr-2 font-black border-t mt-4">
            Total Used: {totalInputCalculated} kg &nbsp;|&nbsp;
            Output: {(Number(fryOutput) || b_fry + bl_fry) + (Number(curryOutput) || b_curry + bl_curry)} kg
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleSavePrep} disabled={totalInputCalculated === 0 || isExceedingBone || isExceedingBoneless}
              className="w-full md:w-auto h-[60px] text-xl bg-primary hover:bg-primary/80 font-bold text-white shadow-none px-12 disabled:opacity-50">
              Save Preparation
            </Button>
          </div>
        </div>
      </div>

      {/* Preparation Log */}
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
            { header: "Fry Prep (g)", accessor: (r: any) => `${parseFloat(((Number(r.fry) || 0) * 1000).toFixed(2))} g` },
            { header: "Curry Prep (g)", accessor: (r: any) => `${parseFloat(((Number(r.curry) || 0) * 1000).toFixed(2))} g` },
            {
              header: "Actions",
              accessor: (r: any) => (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-primary hover:bg-primary/10"
                    onClick={() => openEdit(r)}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                    onClick={() => setDeleteTarget(r._id)}
                    title="Move to Inventory"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            }
          ]}
          data={records}
          isLoading={isLoading}
        />
      </div>

      {/* ── Move to Inventory Confirm Dialog ─────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <RotateCcw className="h-5 w-5" /> Move Back to Inventory
            </DialogTitle>
            <DialogDescription className="pt-1">
              This will reverse the preparation and return the <strong>bone &amp; boneless</strong> stock back to shop inventory. The preparation record will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" className="flex-1 rounded-sm font-bold" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-sm font-bold bg-orange-500 hover:bg-orange-600 text-white" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              {isDeleting ? "Moving..." : "Yes, Move to Inventory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" /> Edit Preparation — {editRecord?.refId}
            </DialogTitle>
            <DialogDescription>Update the preparation quantities. Stock will be recalculated automatically.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Fry row */}
            <div className="bg-muted/30 p-4 rounded-sm border">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><CookingPot className="h-4 w-4 text-primary" /> Fry</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bone for Fry (kg)</Label>
                  <Input type="number" value={editBoneFry} onChange={(e) => setEditBoneFry(e.target.value)} className="h-10 font-bold" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Boneless for Fry (kg)</Label>
                  <Input type="number" value={editBonelessFry} onChange={(e) => setEditBonelessFry(e.target.value)} className="h-10 font-bold" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-primary font-bold">Fry Output (kg)</Label>
                <Input type="number" value={editFryOutput} onChange={(e) => setEditFryOutput(e.target.value)} className="h-10 font-bold border-primary/40 bg-primary/5" />
              </div>
            </div>

            {/* Curry row */}
            <div className="bg-muted/30 p-4 rounded-sm border">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><CookingPot className="h-4 w-4 text-primary" /> Curry</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bone for Curry (kg)</Label>
                  <Input type="number" value={editBoneCurry} onChange={(e) => setEditBoneCurry(e.target.value)} className="h-10 font-bold" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Boneless for Curry (kg)</Label>
                  <Input type="number" value={editBonelessCurry} onChange={(e) => setEditBonelessCurry(e.target.value)} className="h-10 font-bold" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-primary font-bold">Curry Output (kg)</Label>
                <Input type="number" value={editCurryOutput} onChange={(e) => setEditCurryOutput(e.target.value)} className="h-10 font-bold border-primary/40 bg-primary/5" />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1 rounded-sm font-bold" onClick={() => setEditRecord(null)} disabled={isSavingEdit}>Cancel</Button>
            <Button className="flex-1 rounded-sm font-bold bg-primary hover:bg-primary/80 text-white" onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
