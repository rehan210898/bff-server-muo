const axios = require('axios');

const consumerKey = "ck_0a0a2618c674917825df0e525a562427e58d550d";
const consumerSecret = "cs_eddf9274342d8065eed6548efdc7b5e0673012ad";
const url = "https://makeupocean.com/wp-json/wc/v3";

const auth = {
  username: consumerKey,
  password: consumerSecret
};

async function findBrands() {
  try {
    console.log('Fetching Attributes...');
    const response = await axios.get(url + '/products/attributes', { auth });
    const attributes = response.data;
    
    console.log('Available Attributes:');
    attributes.forEach(a => console.log(a.id + ': ' + a.name + ' (' + a.slug + ')'));

    const brandAttr = attributes.find(a => a.name.toLowerCase() === 'brand' || a.slug.toLowerCase().includes('brand'));
    
    if (brandAttr) {
        console.log('Found Brand Attribute: ' + brandAttr.name + ' ID: ' + brandAttr.id);
        
        const termsRes = await axios.get(url + '/products/attributes/' + brandAttr.id + '/terms?per_page=50', { auth });
        const brands = termsRes.data;
        
        console.log('Actual Brand IDs:');
        brands.forEach(b => console.log(b.id + ': ' + b.name));
        
        console.log('IDS Array:');
        console.log(JSON.stringify(brands.map(b => b.id)));
    } else {
        console.log('Attribute Brand not found. Checking /brands...');
        try {
           const brandsRes = await axios.get("https://makeupocean.com/wp-json/wc/v3/brands", { auth });
           console.log('Found /brands endpoint!');
           console.log(brandsRes.data.map(b => b.id + ':' + b.name));
        } catch(e) {
           console.log('No /brands endpoint found.');
        }
    }

  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
  }
}

findBrands();