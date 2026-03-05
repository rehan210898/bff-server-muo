require('dotenv').config({ path: 'C:\\New folder (2)\\bff-server-muo\\bff-server-muo\\.env' });
const axios = require('axios');
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
const token = jwt.sign({ id: 123 }, secret);

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/v1/notifications/register', {
      token: 'ExponentPushToken[test-token-123]',
      platform: 'android'
    }, {
      headers: {
        'X-API-Key': process.env.API_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
test();
