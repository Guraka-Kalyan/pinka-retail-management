import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, 'src', 'pages');

const outPath = path.join(pagesDir, 'InventoryOut.tsx');
let outContent = fs.readFileSync(outPath, 'utf8');

// Apply colors dynamically to InventoryOut
outContent = outContent.replace(
  /<StatCard title="Overall Total".*?\/>/g,
  '<StatCard title="Overall Total" value={`${totalStock} kg`} color={totalStock < 0 ? "destructive" : "info"} icon={<Package className="h-4 w-4" />} />'
);
outContent = outContent.replace(
  /<StatCard title="Bone Available".*?\/>/g,
  '<StatCard title="Bone Available" value={`${availBone} kg`} color={availBone < 0 ? "destructive" : "success"} icon={<Bone className="h-4 w-4" />} />'
);
outContent = outContent.replace(
  /<StatCard title="Boneless Avail\.".*?\/>/g,
  '<StatCard title="Boneless Avail." value={`${availBoneless} kg`} color={availBoneless < 0 ? "destructive" : "success"} icon={<Beef className="h-4 w-4" />} />'
);
outContent = outContent.replace(
  /<StatCard title="Mixed Avail\.".*?\/>/g,
  '<StatCard title="Mixed Avail." value={`${availMixed} kg`} color={availMixed < 0 ? "destructive" : "success"} icon={<Package className="h-4 w-4" />} />'
);
outContent = outContent.replace(
  /<StatCard title="Cash Received".*?\/>/g,
  '<StatCard title="Cash Received" value={`₹${totalCash.toLocaleString("en-IN")}`} color="success" icon={<Wallet className="h-4 w-4" />} />'
);
outContent = outContent.replace(
  /<StatCard title="PhonePe Received".*?\/>/g,
  '<StatCard title="PhonePe Received" value={`₹${totalPhonePe.toLocaleString("en-IN")}`} color="info" icon={<Smartphone className="h-4 w-4" />} />'
);
outContent = outContent.replace(
  /<StatCard title="Discount Given".*?\/>/g,
  '<StatCard title="Discount Given" value={`₹${discountedAmount.toLocaleString("en-IN")}`} color="insights" icon={<TrendingUp className="h-4 w-4" />} />'
);
outContent = outContent.replace(
  /<StatCard title="Fry Prep\.".*?\/>/g,
  '<StatCard title="Fry Prep." value={`${availFry} kg`} color="info" icon={<Beef className="h-4 w-4" />} />'
);
outContent = outContent.replace(
  /<StatCard title="Curry Prep\.".*?\/>/g,
  '<StatCard title="Curry Prep." value={`${availCurry} kg`} color="info" icon={<CookingPot className="h-4 w-4" />} />'
);

fs.writeFileSync(outPath, outContent);

// Add styling mapping to ShopDashboard.tsx
const shopPath = path.join(pagesDir, 'ShopDashboard.tsx');
let shopContent = fs.readFileSync(shopPath, 'utf8');

shopContent = shopContent.replace(/<Card className="rounded-none border-t-[3px] border-t-success.*?>/g, '<Card className="rounded-lg shadow-md border-t-4 border-t-success bg-card hover:bg-secondary/20 transition-colors">');
shopContent = shopContent.replace(/<Card className="rounded-none border-border shadow-sm bg-card hover:border-primary\/50 transition-colors">/g, '<Card className="rounded-lg border shadow-md bg-card hover:border-primary/50 transition-colors">');

shopContent = shopContent.replace(/text-destructive/g, 'text-destructive');
shopContent = shopContent.replace(/text-info/g, 'text-info');
shopContent = shopContent.replace(/text-success/g, 'text-success');

fs.writeFileSync(shopPath, shopContent);

console.log('KPI Cards Styled');
