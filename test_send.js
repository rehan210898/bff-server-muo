require('dotenv').config({ path: 'C:\\New folder (2)\\bff-server-muo\\bff-server-muo\\.env' });
const axios = require('axios');

async function testSend() {
  try {
    const res = await axios.post('http://localhost:3000/api/v1/notifications/send', {
      userId: 123,
      title: 'Order Confirmed! 🎉',
      body: 'Your order is being processed.',
      data: {
        screen: 'OrderTracking',
        params: { orderId: 999 }
      }
    }, {
      headers: {
        'X-API-Key': process.env.API_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
testSend();
