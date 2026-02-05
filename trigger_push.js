require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';
const API_URL = `http://localhost:${PORT}/api/${API_VERSION}`;
const API_KEY = process.env.API_KEY;

async function trigger() {
  try {
    console.log(`🚀 Triggering Broadcast to ${API_URL}/notifications/broadcast...`);
    const response = await axios.post(`${API_URL}/notifications/broadcast`, {}, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('✅ Success:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
  }
}

trigger();
