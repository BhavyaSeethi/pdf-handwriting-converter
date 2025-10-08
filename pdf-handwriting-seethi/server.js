const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const handwritten = require('handwritten.js');
const app = express();

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).send('No PDF uploaded');

  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    handwritten(extractedText).then((converted) => {
      const outputPath = path.join(__dirname, 'output.pdf');
      const stream = fs.createWriteStream(outputPath);
      converted.pipe(stream);

      stream.on('finish', () => {
        res.download(outputPath); // Sends handwriting-style PDF
      });
    });
  } catch (err) {
    res.status(500).send('Error processing PDF');
  }
});

// ✅ Health check for Render
app.get('/healthz', (req, res) => res.sendStatus(200));

app.listen(10000, '0.0.0.0', () => {
  console.log('Server is live on port 10000');
});
