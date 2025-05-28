const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();

// Validate environment variables
const { HASS_TOKEN, HASS_BASE_URL } = process.env;
if (!HASS_TOKEN || !HASS_BASE_URL) {
  console.error('Missing required environment variables: HASS_TOKEN and HASS_BASE_URL must be set in .env');
  process.exit(1);
}

app.use(express.json());
app.use('/', express.static('public'));

app.use('/webhook', createProxyMiddleware({
  target: HASS_BASE_URL,
  changeOrigin: true,
  pathRewrite: { '^/webhook': '/api/webhook' },
  logLevel: 'debug'
}));

app.use('/api', createProxyMiddleware({
  target: HASS_BASE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '/api' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('Authorization', `Bearer ${HASS_TOKEN}`);
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.writeData(bodyData);
    }
  },
  logLevel: 'debug'
}));

app.listen(port=80, () => {
  console.log('HA dashboard and proxy listening on port 80');
});