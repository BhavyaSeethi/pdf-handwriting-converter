const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });
const multiUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'handwriting', maxCount: 1 }
]);

app.post('/upload', multiUpload, async (req, res) => {
  const pdfFile = req.files?.file?.[0] || req.files?.pdf?.[0];
  const handwritingImage = req.files?.handwriting?.[0];

  if (!pdfFile || !handwritingImage) {
    return res.status(400).json({ success: false, error: 'Missing file or handwriting image' });
  }

  const userId = uuidv4();
  const userDir = path.join(__dirname, 'user_handwriting', userId);
  fs.mkdirSync(userDir, { recursive: true });

  try {
    // Simulate character extraction from handwriting image
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!? ';
    for (const char of chars) {
      const charPath = path.join(userDir, `${char}.png`);
      await sharp(handwritingImage.path).extract({ left: 0, top: 0, width: 30, height: 40 }) // placeholder crop
        .resize(30, 40)
        .toFile(charPath);
    }

    const dataBuffer = fs.readFileSync(pdfFile.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text || '';

    const charImages = {};
    for (const char of chars) {
      const imgPath = path.join(userDir, `${char}.png`);
      if (fs.existsSync(imgPath)) {
        const buffer = await sharp(imgPath).png().toBuffer();
        charImages[char] = buffer;
      } else {
        console.log(`Missing image for: ${char}`);
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

    const finalPdfBuffer = await pdfDoc.save();
    const outputFilename = `handwritten_${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, 'public', outputFilename);
    fs.writeFileSync(outputPath, finalPdfBuffer);

    res.status(200).json({
      success: true,
      downloadUrl: `/${outputFilename}`,
      previewUrl: `/preview/${outputFilename}`
    });

    fs.unlink(pdfFile.path, () => {});
    fs.unlink(handwritingImage.path, () => {});
    fs.rmSync(userDir, { recursive: true, force: true }); // cleanup user handwriting
  } catch (err) {
    console.error('❌ Processing error:', err);
    res.status(500).json({ success: false, error: 'Error processing PDF' });
  }
});

app.get('/preview/:filename', (req, res) => {
  const previewPath = path.join(__dirname, 'public', req.params.filename);
  if (fs.existsSync(previewPath)) {
    res.sendFile(previewPath);
  } else {
    res.status(404).send('Preview file not found');
  }
});

app.get('/healthz', (req, res) => res.sendStatus(200));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is live on port ${PORT}`);
});
