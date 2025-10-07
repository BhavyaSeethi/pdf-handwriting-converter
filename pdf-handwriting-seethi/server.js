const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).send('No PDF uploaded');
  res.send(`PDF received: ${req.file.originalname}`);
});

app.listen(10000, '0.0.0.0', () => {
  console.log('Server is live on port 10000');
});
