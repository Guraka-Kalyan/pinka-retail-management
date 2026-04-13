const fs = require('fs');
const file = 'src/pages/Dashboard.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /const shopId = \(typeof n\.shopId === "object" && n\.shopId\) \? n\.shopId\._id : n\.shopId;\n\s*const shopName = typeof n\.shopId === "object" \? n\.shopId\.name : "Shop";/g,
  `if (!n || !n.shopId) return;
      const shopId = (typeof n.shopId === "object" && n.shopId) ? n.shopId._id : n.shopId;
      const shopName = (typeof n.shopId === "object" && n.shopId) ? n.shopId.name : "Shop";`
);

fs.writeFileSync(file, c);
console.log('Fixed notes iteration null check');
