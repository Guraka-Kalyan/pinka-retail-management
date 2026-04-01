const express = require('express');
const { getNotes, getAllNotes, createNote, updateNote, deleteNote } = require('../controllers/shopNote.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All notes across shops (for Dashboard)
router.get('/notes/all', protect, getAllNotes);

// Per-shop notes
router.route('/:shopId/notes')
  .get(protect, getNotes)
  .post(protect, createNote);

router.route('/notes/:noteId')
  .put(protect, updateNote)
  .delete(protect, deleteNote);

module.exports = router;
