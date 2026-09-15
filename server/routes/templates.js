const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/templates
router.get('/', (req, res) => {
  const templates = db.prepare('SELECT * FROM email_template WHERE store_id = ? ORDER BY sequence_step ASC').all(req.storeId);
  res.json(templates);
});

// PUT /api/templates/:id
router.put('/:id', (req, res) => {
  const { subject, body, name } = req.body;
  const template = db.prepare('SELECT * FROM email_template WHERE id = ? AND store_id = ?').get(req.params.id, req.storeId);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  db.prepare('UPDATE email_template SET subject = ?, body = ?, name = ? WHERE id = ?')
    .run(subject ?? template.subject, body ?? template.body, name ?? template.name, template.id);

  res.json(db.prepare('SELECT * FROM email_template WHERE id = ?').get(template.id));
});

module.exports = router;
