import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

/**
 * ContextNote Model
 * -----------------
 * Stores sticky notes and code snippets that are anchored to specific
 * canvas coordinates. These live OUTSIDE the Tldraw store so they:
 *   - Don't interfere with diagram export/cleanup
 *   - Can have richer UI (syntax highlighting, markdown)
 *   - Persist independently from board tldrawState
 */
const ContextNoteSchema = new mongoose.Schema({
  boardId: {
    type: String,
    required: true,
    index: true,
  },
  noteId: {
    type: String,
    required: true,
    unique: true,
    default: () => nanoid(12),
  },
  type: {
    type: String,
    enum: ['note', 'code'],
    default: 'note',
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  language: {
    type: String,
    default: 'javascript', // For code snippets: js, python, sql, etc.
  },
  color: {
    type: String,
    default: '#fde68a', // Amber yellow — classic sticky note
  },
  x: { type: Number, default: 200 },
  y: { type: Number, default: 200 },
  width: { type: Number, default: 280 },
  authorName: { type: String, default: 'Anonymous' },
  authorId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Auto-update updatedAt on save
ContextNoteSchema.pre('save', function () {
  this.updatedAt = new Date();
});

export default mongoose.model('ContextNote', ContextNoteSchema);
