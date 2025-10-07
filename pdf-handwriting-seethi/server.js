const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('PDF Handwriting Converter is running!');
});

app.listen(10000, '0.0.0.0', () => {
  console.log('Server is live on port 10000');
});
