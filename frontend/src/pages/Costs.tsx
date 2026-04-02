import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Breadcrumb from "@/components/Breadcrumb";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee, TrendingUp, TrendingDown, DollarSign, Calendar, Pencil, Trash2, PieChart, Plus, X } from "lucide-react";
import api from "@/lib/api";

export default function Costs({ shopId }: { shopId?: string }) {
  const { toast } = useToast();
  const { id: paramId } = useParams();
  const id = shopId || paramId || "global";
  const [isLoading, setIsLoading] = useState(false);
  const [dailyCosts, setDailyCosts] = useState<any[]>([]);

  const fetchCosts = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await api.get(`/shops/${id}/daily-costs`);
      setDailyCosts(res.data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load costs.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCosts();
  }, [id]);

  const [dcDate, setDcDate] = useState(new Date().toISOString().split("T")[0]);
  const [dcLabour, setDcLabour] = useState("");
  const [dcTransport, setDcTransport] = useState("");
  const [dcIce, setDcIce] = useState("");
  const [dcMisc, setDcMisc] = useState("");
  const [dcNotes, setDcNotes] = useState("");
  const [dcOtherCosts, setDcOtherCosts] = useState<{name: string, amount: string}[]>([]);

  const handleSaveDailyCost = async () => {
    if (!id) return;
    if (!dcDate || (!dcLabour && !dcTransport && !dcIce && !dcMisc && dcOtherCosts.length === 0)) {
      toast({ title: "Validation Error", description: "Please fill date and at least one cost field.", variant: "destructive" });
      return;
    }
    const otherSum = dcOtherCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const total = (Number(dcLabour) || 0) + (Number(dcTransport) || 0) + (Number(dcIce) || 0) + (Number(dcMisc) || 0) + otherSum;
    const payload = {
      date: dcDate,
      labour: Number(dcLabour) || 0,
      transport: Number(dcTransport) || 0,
      ice: Number(dcIce) || 0,
      misc: Number(dcMisc) || 0,
      otherCosts: dcOtherCosts.filter(c => c.name.trim() && Number(c.amount)),
      notes: dcNotes,
      total
    };
    
    try {
      await api.post(`/shops/${id}/daily-costs`, payload);
      toast({ title: "Saved", description: "Daily cost recorded successfully." });
      setDcLabour(""); setDcTransport(""); setDcIce(""); setDcMisc(""); setDcNotes(""); setDcOtherCosts([]);
      fetchCosts();
    } catch {
      toast({ title: "Error", description: "Failed to save daily cost.", variant: "destructive" });
    }
  };

  const deleteDailyCost = async (delId: string) => {
    if (!id) return;
    try {
      await api.delete(`/shops/${id}/daily-costs/${delId}`);
      toast({ title: "Deleted", description: "Cost record deleted." });
      fetchCosts();
    } catch {
      toast({ title: "Error", description: "Failed to delete from server", variant: "destructive" });
    }
  };

  // Summary Metrics (Dynamically computed or initialized to 0)
  const totalCostsMonth = dailyCosts.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  const dailyAvgCost = dailyCosts.length > 0 ? Math.round(totalCostsMonth / dailyCosts.length) : 0;
  const revenueMonth = 0; // Placeholder until revenue is loaded here or tracked separatedly
  const netProfitMonth = revenueMonth - totalCostsMonth;
  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[{ label: "Costs" }]} />
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Operational Costs</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Log and analyze daily, monthly, and slaughterhouse expenses.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Costs This Month" 
          value={`₹${totalCostsMonth.toLocaleString("en-IN")}`} 
          icon={null}
        />
        <StatCard 
          title="Daily Avg Cost" 
          value={`₹${dailyAvgCost.toLocaleString("en-IN")}`} 
          icon={null}
        />
        <StatCard 
          title="Revenue This Month" 
          value={`₹${revenueMonth.toLocaleString("en-IN")}`} 
          icon={null}
        />
        <StatCard 
          title="Net Profit This Month" 
          value={`₹${netProfitMonth.toLocaleString("en-IN")}`} 
          icon={null}
        />
      </div>

      <div className="space-y-6">
        <div className="rounded-sm border bg-card p-6 shadow-none">
          <h2 className="text-lg font-semibold mb-4">Add Daily Cost</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div><Label>Date</Label><Input type="date" value={dcDate} onChange={e => setDcDate(e.target.value)} /></div>
              <div><Label>Labour Cost (₹)</Label><Input type="number" value={dcLabour} onChange={e => setDcLabour(e.target.value)} placeholder="0" /></div>
              <div><Label>Transport Cost (₹)</Label><Input type="number" value={dcTransport} onChange={e => setDcTransport(e.target.value)} placeholder="0" /></div>
              <div><Label>Ice Cost (₹)</Label><Input type="number" value={dcIce} onChange={e => setDcIce(e.target.value)} placeholder="0" /></div>
              <div><Label>Miscellaneous (₹)</Label><Input type="number" value={dcMisc} onChange={e => setDcMisc(e.target.value)} placeholder="0" /></div>
              <div><Label>Notes (Optional)</Label><Input value={dcNotes} onChange={e => setDcNotes(e.target.value)} placeholder="..." /></div>
            </div>

            {/* Custom Extra Costs Section */}
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between xl:justify-start gap-4 mb-3">
                <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Custom Costs (Optional)</Label>
                <Button variant="outline" size="sm" onClick={() => setDcOtherCosts([...dcOtherCosts, { name: "", amount: "" }])} className="h-8 shadow-none gap-1 bg-muted/20">
                  <Plus className="w-3.5 h-3.5" /> Add Other Cost
                </Button>
              </div>
              
              {dcOtherCosts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {dcOtherCosts.map((cost, index) => (
                     <div key={index} className="flex items-center gap-2 bg-muted/30 p-2 rounded-sm border border-border/50">
                       <Input 
                         placeholder="Cost Name (e.g. Fan)" 
                         value={cost.name} 
                         onChange={(e) => {
                           const updated = [...dcOtherCosts];
                           updated[index].name = e.target.value;
                           setDcOtherCosts(updated);
                         }} 
                         className="h-9 shadow-none bg-background"
                       />
                       <Input 
                         type="number" 
                         placeholder="Amount (₹)" 
                         value={cost.amount} 
                         onChange={(e) => {
                           const updated = [...dcOtherCosts];
                           updated[index].amount = e.target.value;
                           setDcOtherCosts(updated);
                         }} 
                         className="h-9 shadow-none w-28 bg-background"
                       />
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => setDcOtherCosts(dcOtherCosts.filter((_, i) => i !== index))} 
                         className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                       >
                         <X className="w-4 h-4" />
                       </Button>
                     </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm border border-border px-4 py-2 rounded-sm font-bold text-foreground" style={{backgroundColor: 'var(--table-header)'}}>
                Total: ₹{((Number(dcLabour) || 0) + (Number(dcTransport) || 0) + (Number(dcIce) || 0) + (Number(dcMisc) || 0) + dcOtherCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0)).toLocaleString("en-IN")}
              </div>
              <Button onClick={handleSaveDailyCost} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 rounded-sm shadow-none">Save Cost</Button>
            </div>
          </div>

          <div className="rounded-sm border bg-card p-6 shadow-none">
            <h2 className="text-lg font-semibold mb-4">Daily Costs Log</h2>
            <DataTable
              isLoading={isLoading}
              columns={[
                { header: "Date", accessor: "date" },
                { header: "Labour (₹)", accessor: (r) => `₹${r.labour}` },
                { header: "Transport (₹)", accessor: (r) => `₹${r.transport}` },
                { header: "Ice (₹)", accessor: (r) => `₹${r.ice}` },
                { header: "Misc & Custom", accessor: (r: any) => (
                  <div className="flex flex-col gap-0.5">
                    {Number(r.misc) > 0 && <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Misc:</span> ₹{r.misc}</span>}
                    {r.otherCosts && r.otherCosts.map((c: any, i: number) => (
                       <span key={i} className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{c.name || "Custom"}:</span> ₹{c.amount}</span>
                    ))}
                    {!Number(r.misc) && (!r.otherCosts || r.otherCosts.length === 0) && "-"}
                  </div>
                ) },
                { header: "Total (₹)", accessor: (r: any) => <strong className="text-primary">₹{r.total.toLocaleString()}</strong> },
                { header: "Notes", accessor: "notes" },
                { header: "Actions", accessor: (r) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteDailyCost(r._id || r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )},
              ]}
              data={dailyCosts}
            />
          </div>
        </div>
      </div>
  );
}
