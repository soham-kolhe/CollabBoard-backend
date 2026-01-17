import mongoose from "mongoose";

const DrawingSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
  },

  snapshot: {
    type: String, // base64 image
    default: null,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
    index: { expires: '24h' } // Automatically deletes 24 hours after updatedAt
  },
});

export default mongoose.model("Drawing", DrawingSchema);
