const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const config = require('../config');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const store = db.prepare('SELECT * FROM store WHERE owner_email = ?').get(email);

  if (!store || !bcrypt.compareSync(password, store.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ storeId: store.id }, config.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, store: { id: store.id, name: store.name, owner_email: store.owner_email } });
});

router.get('/me', (req, res) => {
  // convenience for demo credentials display on the login screen
  const store = db.prepare('SELECT owner_email FROM store LIMIT 1').get();
  res.json({ demoEmail: store ? store.owner_email : null });
});

module.exports = router;
