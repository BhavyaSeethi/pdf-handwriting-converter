const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { PDFDocument } = require('pdf-lib');
const pdfjsLib = require('pdfjs-dist');
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
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charWidth = 40;
    const charHeight = 50;
    const charImages = {};

    for (let i = 0; i < chars.length; i++) {
      const row = i < 26 ? 0 : i < 52 ? 1 : 2;
      const col = i % 26;
      const left = col * charWidth;
      const top = row * charHeight;

      try {
        const buffer = await sharp(handwritingImage.path)
          .extract({ left, top, width: charWidth, height: charHeight })
          .resize(30, 40)
          .png()
          .toBuffer();
        charImages[chars[i]] = buffer;
      } catch {
        console.warn(`⚠️ Could not extract character: "${chars[i]}"`);
      }
    }

    const data = new Uint8Array(await fsPromises.readFile(pdfFile.path));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pdfDoc = await PDFDocument.create();

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 1.5 });
      const textContent = await page.getTextContent();
      const newPage = pdfDoc.addPage([viewport.width, viewport.height]);

      for (const item of textContent.items) {
        const str = item.str;
        const x = item.transform[4];
        const y = viewport.height - item.transform[5];

        let offsetX = x;
        for (const char of str) {
          const imgBuffer = charImages[char];
          if (imgBuffer) {
            const img = await pdfDoc.embedPng(imgBuffer);
            newPage.drawImage(img, {
              x: offsetX,
              y,
              width: 30,
              height: 40
            });
            offsetX += 32;
          } else {
            offsetX += 20;
          }
        }
      }
    }

    const outputDir = path.join(__dirname, 'public');
    const outputPath = path.join(outputDir, 'handwritten.pdf');
    await fsPromises.mkdir(outputDir, { recursive: true });
    const finalPdfBuffer = await pdfDoc.save();
    await fsPromises.writeFile(outputPath, finalPdfBuffer);

    res.status(200).json({
      success: true,
      downloadUrl: `${req.protocol}://${req.get('host')}/handwritten.pdf`
    });

    fsPromises.unlink(pdfFile.path).catch(() => {});
    fsPromises.unlink(handwritingImage.path).catch(() => {});
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ success: false, error: 'Conversion failed. Please try again.' });
  }
});

app.get('/healthz', (req, res) => res.sendStatus(200));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
