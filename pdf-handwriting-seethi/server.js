const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });
const multiUpload = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'handwriting', maxCount: 1 }
]);

app.post('/upload', multiUpload, async (req, res) => {
  const pdfFile = req.files?.pdf?.[0];
  const handwritingImage = req.files?.handwriting?.[0];

  if (!pdfFile || !handwritingImage) {
    return res.status(400).json({ success: false, error: 'Missing file or handwriting image' });
  }

  try {
    const dataBuffer = await fsPromises.readFile(pdfFile.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text || '';

    const charImages = {};
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!? ';
    const handwritingDir = path.join(__dirname, 'handwriting');

    for (const char of chars) {
      const imgPath = path.join(handwritingDir, `${char}.png`);
      if (fs.existsSync(imgPath)) {
        const buffer = await sharp(imgPath).resize(30, 40).png().toBuffer();
        charImages[char] = buffer;
      } else {
        console.warn(`⚠️ Missing image for character: "${char}"`);
      }
    }

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]);
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

      if (y < 50) {
        page = pdfDoc.addPage([595, 842]);
        y = 750;
        x = 50;
      }
    }

    const outputDir = path.join(__dirname, 'public');
    const outputPath = path.join(outputDir, 'handwritten.pdf');

    if (!fs.existsSync(outputDir)) {
      await fsPromises.mkdir(outputDir);
    }

    const finalPdfBuffer = await pdfDoc.save();
    await fsPromises.writeFile(outputPath, finalPdfBuffer);

    res.status(200).json({
      success: true,
      downloadUrl: '/handwritten.pdf'
    });

    fsPromises.unlink(pdfFile.path).catch(() => {});
    fsPromises.unlink(handwritingImage.path).catch(() => {});
  } catch (err) {
    console.error('❌ Processing error:', err.message);
    res.status(500).json({ success: false, error: 'Conversion failed. Please try again.' });
  }
});

app.get('/healthz', (req, res) => res.sendStatus(200));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is live on port ${PORT}`);
});
