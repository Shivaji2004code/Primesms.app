#!/usr/bin/env node

const express = require('express');
const path = require('path');

const app = express();
const clientDir = path.resolve(__dirname, 'server/dist/client-static');

console.log('Testing MIME type serving...');
console.log('Client directory:', clientDir);

// Test the MIME type configuration
app.use('/assets', express.static(path.join(clientDir, 'assets'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    console.log('Serving file:', filePath);
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      console.log('Set MIME type: application/javascript for', filePath);
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      console.log('Set MIME type: text/css for', filePath);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

app.use(express.static(clientDir, {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

const port = 3001;
app.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
  console.log('Visit the site to test MIME types');
  console.log('Check browser dev tools for MIME type errors');
});