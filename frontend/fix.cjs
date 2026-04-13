const fs = require('fs');
const file = 'e:/freelancing/Pig-farm/retail-dashboard/Pinaka/frontend/src/pages/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The crash reported is around line 719-720: TypeError: Cannot read properties of null (reading '_id')
content = content.replace(
  /const map = new Map<string, { shopId: string; shopName: string; notes: Array<{ _id: string; text: string; date: string }> }>\(\);\n\s*notes\.forEach\(n => {/g,
  `const map = new Map<string, { shopId: string; shopName: string; notes: Array<{ _id: string; text: string; date: string }> }>();
    notes.forEach(n => {
      if (!n || !n.shopId) return;`
);

content = content.replace(
  /const combinedDressingData = batches\.map\(b => {/g,
  `const combinedDressingData = batches.map(b => {
      if (!b || !b._id || !b.batchNo) return null;`
);

content = content.replace(
  /\}\)\.filter\(b => b\.before > 0 \|\| b\.packed > 0\);/g,
  `}).filter(b => b && (b.before > 0 || b.packed > 0));`
);

content = content.replace(
  /shopIds\.forEach\(shopId => {/g,
  `shopIds.forEach(shopId => {
      if (!shopId) return;`
);

content = content.replace(
  /shopInventory\.forEach\(i => {/g,
  `shopInventory.forEach(i => {
        if (!i || !i._id) return;`
);

content = content.replace(
  /batches\.forEach\(b => \{\n?\s*batchMap\[b\.batchNo\]/g,
  `batches.forEach(b => {
      if (!b || !b._id || !b.batchNo) return;
      batchMap[b.batchNo]`
);

content = content.replace(
  /fSupplies\.forEach\(s => {\n?\s*if \(!batchMap\[s\.batch\]\)/g,
  `fSupplies.forEach(s => {
      if (!s || !s._id) return;
      if (!batchMap[s.batch])`
);

content = content.replace(
  /fPackagings\.forEach\(item => {\n?\s*const key = item\.batchNo \|\| item\._id;/g,
  `fPackagings.forEach(item => {
      if (!item || !item._id) return;
      const key = item.batchNo || item._id;`
);

content = content.replace(
  /const batchStats = fBatches\.map\(b => {/g,
  `const batchStats = fBatches.map(b => {
      if (!b || !b._id) return null;`
);

content = content.replace(
  /const lineData = batchStats\.filter\(d => d\.before > 0 \|\| d\.after > 0\);/g,
  `const lineData = batchStats.filter((d: any) => d && (d.before > 0 || d.after > 0));`
);

// THIS IS THE ONE THAT FAILED
const origBarData = `const barData = uniquePackagings.map(item => ({
      name:   item.batchNo || "Unknown",
      weight: getValue(item.packedWeight || item.totalWeight),
      value:  getValue(item.packedAmount || item.totalAmount),
    }));`;
const newBarData = `const barData = uniquePackagings.map(item => {
      if (!item || !item._id) return null;
      return {
        name:   item.batchNo || "Unknown",
        weight: getValue(item.packedWeight || item.totalWeight),
        value:  getValue(item.packedAmount || item.totalAmount),
      };
    }).filter((d: any) => d !== null);`;

content = content.replace(origBarData, newBarData);

// Also wrap the inline maps at the start:
content = content.replace(
  /const allSales  = perShop\.flatMap\(r => r\.sales\.map\(\(s: any\)  => \(\{ \.\.\.s, shopId: r\.shopId \}\)\)\);/g,
  `const allSales  = perShop.flatMap(r => (r.sales || []).filter((s:any) => s && s._id).map((s: any)  => ({ ...s, shopId: r.shopId })));`
);
content = content.replace(
  /const allCosts  = perShop\.flatMap\(r => r\.costs\.map\(\(c: any\)  => \(\{ \.\.\.c, shopId: r\.shopId \}\)\)\);/g,
  `const allCosts  = perShop.flatMap(r => (r.costs || []).filter((c:any) => c && c._id).map((c: any)  => ({ ...c, shopId: r.shopId })));`
);
content = content.replace(
  /const allInvIn  = perShop\.flatMap\(r => r\.invIn\.map\(\(i: any\)  => \(\{ \.\.\.i, shopId: r\.shopId \}\)\)\);/g,
  `const allInvIn  = perShop.flatMap(r => (r.invIn || []).filter((i:any) => i && i._id).map((i: any)  => ({ ...i, shopId: r.shopId })));`
);


// Replace the specific `typeof n.shopId` with a safer format that doesn't trigger TypeError just in case:
content = content.replace(
  /typeof n\.shopId === "object" \? n\.shopId\._id : n\.shopId/g,
  `(typeof n.shopId === "object" && n.shopId) ? n.shopId._id : n.shopId`
);

fs.writeFileSync(file, content);
console.log('Done refactoring');
