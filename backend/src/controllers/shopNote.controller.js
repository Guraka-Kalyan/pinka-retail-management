const ShopNote = require('../models/ShopNote.model');

// @desc   Get all notes for a shop
// @route  GET /api/shops/:shopId/notes
const getNotes = async (req, res) => {
  const notes = await ShopNote.find({ shopId: req.params.shopId }).sort({ createdAt: -1 });
  res.json({ success: true, data: notes });
};

// @desc   Get all notes across all shops
// @route  GET /api/notes/all
const getAllNotes = async (req, res) => {
  const notes = await ShopNote.find().populate('shopId', 'name').sort({ createdAt: -1 });
  res.json({ success: true, data: notes });
};

// @desc   Create a note
// @route  POST /api/shops/:shopId/notes
const createNote = async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Note text is required' });
  }

  const note = await ShopNote.create({ shopId: req.params.shopId, text: text.trim() });
  res.status(201).json({ success: true, data: note });
};

// @desc   Update a note
// @route  PUT /api/notes/:noteId
const updateNote = async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Note text is required' });
  }

  const note = await ShopNote.findByIdAndUpdate(
    req.params.noteId,
    { text: text.trim() },
    { new: true, runValidators: true }
  );
  if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
  res.json({ success: true, data: note });
};

// @desc   Delete a note
// @route  DELETE /api/notes/:noteId
const deleteNote = async (req, res) => {
  const note = await ShopNote.findByIdAndDelete(req.params.noteId);
  if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
  res.json({ success: true, message: 'Note deleted' });
};

module.exports = { getNotes, getAllNotes, createNote, updateNote, deleteNote };
