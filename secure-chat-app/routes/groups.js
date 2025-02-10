const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const jwt = require('jsonwebtoken');

// Create group
router.post('/', async (req, res) => {
  const { name } = req.body;
  try {
    const newGroup = new Group({ name });
    await newGroup.save();
    res.status(201).json(newGroup);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Join group
router.post('/:groupId/join', async (req, res) => {
  const { groupId } = req.params;
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const group = await Group.findById(groupId);
    if (!group.members.includes(decoded.id)) {
      group.members.push(decoded.id);
      await group.save();
    }
    res.status(200).json({ message: 'Joined group successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;