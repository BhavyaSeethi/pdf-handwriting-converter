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
  { name: 'handwriting', maxCount: 1 } // optional, for future style reference
]);

app.post('/upload', multiUpload, async (req, res) => {
  const pdfFile = req.files?.file?.[0];
  const handwritingImage = req.files?.handwriting?.[0];

  if (!pdfFile || !handwritingImage) {
    return res.status(400).send('❌ Missing file or handwriting image');
  }

  try {
    const dataBuffer = fs.readFileSync(pdfFile.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    // Load handwriting images
    const charImages = {};
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (const char of chars) {
      const imgPath = path.join(__dirname, 'handwriting', `${char}.png`);
      if (fs.existsSync(imgPath)) {
        charImages[char] = await sharp(imgPath).resize(30, 40).png().toBuffer();
      }
    }

    // Create new PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
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
      }
    }

    const finalPdf = await pdfDoc.save();
    const outputPath = path.join(__dirname, 'output.pdf');
    fs.writeFileSync(outputPath, finalPdf);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=handwritten.pdf');
    res.sendFile(outputPath, (err) => {
      try {
        fs.unlinkSync(pdfFile.path);
        fs.unlinkSync(handwritingImage.path);
        fs.unlinkSync(outputPath);
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    });
  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).send('❌ Error processing PDF');
  }
});

app.get('/healthz', (req, res) => res.sendStatus(200));

app.listen(10000, '0.0.0.0', () => {
  console.log('🚀 Server is live on port 10000');
})        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=handwritten.pdf');

        res.sendFile(outputPath, (err) => {
          // Cleanup files after sending
          try {
            fs.unlinkSync(pdfFile.path);
            fs.unlinkSync(handwritingImage.path);
            fs.unlinkSync(outputPath);
          } catch (cleanupErr) {
            console.error('Cleanup error:', cleanupErr);
          }
        });
      });
    });
  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).send('❌ Error processing PDF');
  }
});

// Health check for Render
app.get('/healthz', (req, res) => res.sendStatus(200));

// Start server
app.listen(10000, '0.0.0.0', () => {
  console.log('🚀 Server is live on port 10000');
});
