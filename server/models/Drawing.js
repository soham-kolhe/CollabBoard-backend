import mongoose from "mongoose";

const DrawingSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },

  strokes: {
    type: Array,
    default: [],
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Drawing", DrawingSchema);
