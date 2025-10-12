const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const app = express();
const upload = multer({ dest: 'uploads/' });
const multiUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'handwriting', maxCount: 1 }
]);

app.use(express.static('public')); // Serve static files

app.post('/upload', multiUpload, async (req, res) => {
  const pdfFile = req.files?.file?.[0];
  const handwritingImage = req.files?.handwriting?.[0];

  if (!pdfFile || !handwritingImage) {
    return res.status(400).json({ success: false, error: 'Missing file or handwriting image' });
  }

  try {
    const dataBuffer = fs.readFileSync(pdfFile.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text || '';

    // Load handwriting images
    const charImages = {};
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (const char of chars) {
      const imgPath = path.join(__dirname, 'handwriting', `${char}.png`);
      if (fs.existsSync(imgPath)) {
        charImages[char] = await sharp(imgPath).resize(30, 40).png().toBuffer();
      }
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    let x = 50, y = 750;

    for (const char of extractedText) {
      if (char === '\n') {
        y -= 50;
        x = 50;
        continue;
      }

      const imgBuffer = charImages[char];
      if (imgBuffer) {
        const img = await pdfDoc.embedPng(imgBuffer);
        page.drawImage(img, { x, y, width: 30, height: 40 });
        x += 35;
        if (x > 500) {
          y -= 50;
          x = 50;
        }
      } else {
        x += 20;
      }
    }

    const finalPdfBuffer = await pdfDoc.save();
    const outputPath = path.join(__dirname, 'public', 'handwritten.pdf');
    fs.writeFileSync(outputPath, finalPdfBuffer);

    res.status(200).json({
      success: true,
      downloadUrl: '/handwritten.pdf'
    });

    fs.unlink(pdfFile.path, () => {});
    fs.unlink(handwritingImage.path, () => {});
  } catch (err) {
    console.error('❌ Processing error:', err);
    res.status(500).json({ success: false, error: 'Error processing PDF' });
  }
});

app.get('/healthz', (req, res) => res.sendStatus(200));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is live on port ${PORT}`);
});
