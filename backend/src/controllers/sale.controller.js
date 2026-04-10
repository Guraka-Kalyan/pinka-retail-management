const Sale = require('../models/Sale.model');
const PDFDocument = require('pdfkit');
const Shop = require('../models/Shop.model');
const { getLiveStock } = require('./shop.controller');

// @desc   Get sales for a shop (with optional date filter)
// @route  GET /api/shops/:shopId/sales
const getSales = async (req, res) => {
  const { date, from, to } = req.query;
  const query = { shopId: req.params.shopId, deletedAt: null };

  if (date) {
    query.date = date;
  } else if (from && to) {
    query.date = { $gte: from, $lte: to };
  }

  const sales = await Sale.find(query).sort({ createdAt: -1 });
  res.json({ success: true, data: sales });
};

// @desc   Create sale
// @route  POST /api/shops/:shopId/sales
const createSale = async (req, res) => {
  const { date, boneSold, bonelessSold, frySold, currySold, mixedSold, boneUsed, bonelessUsed, fry, curry, cash, phonePe, total, discountGiven } = req.body;
  if (!date) return res.status(400).json({ success: false, message: 'date is required' });

  // Stock Validation
  const stock = await getLiveStock(req.params.shopId);

  const reqBone = Number(boneSold) || 0;
  const reqBoneless = Number(bonelessSold) || 0;
  const reqMixed = Number(mixedSold) || 0;
  const reqFry = Number(frySold) || 0;
  const reqCurry = Number(currySold) || 0;

  if (reqBone > stock.boneStock) return res.status(400).json({ success: false, message: `Insufficient stock for Bone. Available: ${stock.boneStock.toFixed(2)} kg, Requested: ${reqBone} kg.`});
  if (reqBoneless > stock.bonelessStock) return res.status(400).json({ success: false, message: `Insufficient stock for Boneless. Available: ${stock.bonelessStock.toFixed(2)} kg, Requested: ${reqBoneless} kg.`});
  if (reqMixed > stock.mixedStock) return res.status(400).json({ success: false, message: `Insufficient stock for Mixed. Available: ${stock.mixedStock.toFixed(2)} kg, Requested: ${reqMixed} kg.`});
  if (reqFry > stock.fryStock) return res.status(400).json({ success: false, message: `Insufficient stock for Fry. Available: ${stock.fryStock.toFixed(2)} kg, Requested: ${reqFry} kg.`});
  if (reqCurry > stock.curryStock) return res.status(400).json({ success: false, message: `Insufficient stock for Curry. Available: ${stock.curryStock.toFixed(2)} kg, Requested: ${reqCurry} kg.`});

  // Auto-generate billId
  const count = await Sale.countDocuments({ shopId: req.params.shopId });
  const billId = `PK-${String(count + 1).padStart(3, '0')}`;

  const sale = await Sale.create({
    shopId: req.params.shopId,
    date,
    billId,
    boneSold: Number(boneSold) || 0,
    bonelessSold: Number(bonelessSold) || 0,
    frySold: Number(frySold) || 0,
    currySold: Number(currySold) || 0,
    mixedSold: Number(mixedSold) || 0,
    boneUsed: Number(boneUsed) || 0,
    bonelessUsed: Number(bonelessUsed) || 0,
    fry: Number(fry) || 0,
    curry: Number(curry) || 0,
    cash: Number(cash) || 0,
    phonePe: Number(phonePe) || 0,
    total: Number(total) || 0,
    discountGiven: Number(discountGiven) || 0,
    deletedAt: null,
  });

  res.status(201).json({ success: true, data: sale });
};

// @desc   Update sale
// @route  PUT /api/shops/:shopId/sales/:saleId
const updateSale = async (req, res) => {
  const sale = await Sale.findOneAndUpdate(
    { _id: req.params.saleId, shopId: req.params.shopId, deletedAt: null },
    req.body,
    { new: true, runValidators: true }
  );
  if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
  res.json({ success: true, data: sale });
};

// @desc   Soft delete sale
// @route  DELETE /api/shops/:shopId/sales/:saleId
const deleteSale = async (req, res) => {
  const sale = await Sale.findOneAndUpdate(
    { _id: req.params.saleId, shopId: req.params.shopId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );
  if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
  res.json({ success: true, message: 'Sale deleted' });
};

// @desc   Generate PDF receipt for a sale
// @route  GET /api/shops/:shopId/sales/:saleId/receipt
const generateReceipt = async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.saleId, shopId: req.params.shopId });
  if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

  const shop = await Shop.findById(req.params.shopId);
  const shopName = shop ? shop.name : 'Pinaka Shop';
  const shopLocation = shop ? shop.location : '';

  // Generate PDF
  const doc = new PDFDocument({ margin: 40, size: 'A5' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=receipt-${sale.billId}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('PINAKA', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text(shopName, { align: 'center' });
  if (shopLocation) doc.text(shopLocation, { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.5);

  // Bill info
  doc.fontSize(11).font('Helvetica-Bold').text(`Bill No: ${sale.billId}`, { continued: true });
  doc.font('Helvetica').text(`    Date: ${sale.date}`, { align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.5);

  // Items
  const items = [
    { name: 'Bone', qty: sale.boneSold, rate: 200 },
    { name: 'Boneless', qty: sale.bonelessSold, rate: 400 },
    { name: 'Fry', qty: sale.frySold, rate: 280 },
    { name: 'Curry', qty: sale.currySold, rate: 250 },
    { name: 'Mixed', qty: sale.mixedSold, rate: 200 },
  ].filter(i => i.qty > 0);

  doc.font('Helvetica-Bold').text('Item', 40, doc.y, { width: 150 });
  doc.text('Qty (kg)', 190, doc.y - doc.currentLineHeight(), { width: 80 });
  doc.text('Rate', 270, doc.y - doc.currentLineHeight(), { width: 80 });
  doc.text('Amount', 350, doc.y - doc.currentLineHeight(), { width: 100, align: 'right' });
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).dash(3, { space: 3 }).stroke();
  doc.undash();
  doc.moveDown(0.3);

  items.forEach(item => {
    const amount = item.qty * item.rate;
    doc.font('Helvetica').text(item.name, 40, doc.y, { width: 150 });
    doc.text(`${item.qty} kg`, 190, doc.y - doc.currentLineHeight(), { width: 80 });
    doc.text(`₹${item.rate}`, 270, doc.y - doc.currentLineHeight(), { width: 80 });
    doc.text(`₹${amount.toLocaleString('en-IN')}`, 350, doc.y - doc.currentLineHeight(), { width: 100, align: 'right' });
    doc.moveDown(0.3);
  });

  if (sale.discountGiven > 0) {
    doc.font('Helvetica').text('Discount', 40, doc.y, { width: 300 });
    doc.text(`-₹${sale.discountGiven}`, 350, doc.y - doc.currentLineHeight(), { width: 100, align: 'right' });
    doc.moveDown(0.3);
  }

  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(0.3);

  // Totals
  doc.font('Helvetica-Bold').text('Total', 40, doc.y, { width: 300 });
  doc.text(`₹${sale.total.toLocaleString('en-IN')}`, 350, doc.y - doc.currentLineHeight(), { width: 100, align: 'right' });
  doc.moveDown(0.5);

  doc.font('Helvetica').text(`Cash: ₹${sale.cash.toLocaleString('en-IN')}`, 40);
  doc.text(`PhonePe: ₹${sale.phonePe.toLocaleString('en-IN')}`, 40);
  doc.moveDown(0.5);

  doc.fontSize(10).text('Thank you for your purchase!', { align: 'center' });

  doc.end();
};

module.exports = { getSales, createSale, updateSale, deleteSale, generateReceipt };
