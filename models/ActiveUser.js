import mongoose from 'mongoose';

const activeUserSchema = new mongoose.Schema({
  socketId: {
    type: String,
    required: true,
    unique: true,
  },
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  userName: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['Admin', 'User'],
    default: 'User',
  },
  canDraw: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: '24h' }, // cleanup abandoned sockets
  },
});

export default mongoose.model('ActiveUser', activeUserSchema);
