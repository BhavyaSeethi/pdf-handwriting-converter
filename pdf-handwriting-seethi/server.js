const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const handwritten = require('handwritten.js');
const app = express();

const upload = multer({ dest: 'uploads/' });

const multiUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'handwriting', maxCount: 1 }
]);

app.post('/upload', multiUpload, async (req, res) => {
  const pdfFile = req.files?.file?.[0];
  const handwritingImage = req.files?.handwriting?.[0];

  if (!pdfFile || !handwritingImage) {
    return res.status(400).send('Missing file or handwriting image');
  }

  try {
    const dataBuffer = fs.readFileSync(pdfFile.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    handwritten(extractedText).then((converted) => {
      const outputPath = path.join(__dirname, 'output.pdf');
      const stream = fs.createWriteStream(outputPath);
      converted.pipe(stream);

      stream.on('finish', () => {
        res.download(outputPath, () => {
          fs.unlinkSync(pdfFile.path);
          fs.unlinkSync(handwritingImage.path);
          fs.unlinkSync(outputPath);
        });
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
