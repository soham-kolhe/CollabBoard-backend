import mongoose from 'mongoose';

const boardSchema = new mongoose.Schema({
  boardId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // tldraw JSON state snapshot (replaces old PNG base64)
  tldrawState: {
    type: String,
    default: null,
  },
}, { timestamps: true });

const Board = mongoose.model('Board', boardSchema);
export default Board;
