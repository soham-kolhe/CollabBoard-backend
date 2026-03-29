import express from 'express';
import { nanoid } from 'nanoid';
import Board from '../models/Board.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// All board routes require auth
router.use(requireAuth);

// GET /api/boards — list boards owned by the authenticated user
router.get('/', async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id);
    const joinedIds = userDoc?.joinedBoards || [];

    const boards = await Board.find({
      $or: [
        { ownerId: req.user.id },
        { boardId: { $in: joinedIds } }
      ]
    }).sort({ createdAt: -1 });

    return res.json({ boards });
  } catch (err) {
    console.error('Fetch boards error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/boards — create a new board
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Board name is required')
      .isLength({ max: 80 })
      .withMessage('Board name cannot exceed 80 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { name } = req.body;

    const boardId = nanoid(10); // short unique ID e.g. "Vg3kLm0pQr"
    const board = await Board.create({
      boardId,
      name: name.trim(),
      ownerId: req.user.id,
    });

    return res.status(201).json({ board });
  } catch (err) {
    console.error('Create board error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/boards/:boardId — delete board (owner only)
router.delete('/:boardId', async (req, res) => {
  try {
    const board = await Board.findOne({ boardId: req.params.boardId });
    if (!board) return res.status(404).json({ message: 'Board not found' });

    if (board.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the owner can delete this board' });
    }

    await board.deleteOne();
    return res.json({ message: 'Board deleted' });
  } catch (err) {
    console.error('Delete board error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
