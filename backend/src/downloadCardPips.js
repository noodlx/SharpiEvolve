const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Function to download SVG
const downloadSVG = async (url, filepath) => {
  const response = await axios({
    url,
    responseType: 'stream',
    headers: {
      'User-Agent': 'sharpievolve/1.0',
      'Accept': 'application/json;q=0.9,*/*;q=0.8'
    }
  });
  return new Promise((resolve, reject) => {
    response.data.pipe(fs.createWriteStream(filepath))
      .on('finish', () => {
        resolve();
      })
      .on('error', e => {
        console.error(`Error downloading ${url}:`, e);
        reject(e);
      });
  });
};

// Function to sleep for a given number of milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main function
const main = async () => {
  try {
    // Fetch data from Scryfall API
    console.log('Fetching symbols from Scryfall API...');
    const response = await axios.get('https://api.scryfall.com/symbology', {
      headers: {
        'User-Agent': 'sharpievolve/1.0',
        'Accept': 'application/json;q=0.9,*/*;q=0.8'
      }
    });

    const symbols = response.data.data;
    console.log(`Retrieved ${symbols.length} symbols from the API`);

    // Process each symbol
    for (const symbol of symbols) {
      const { symbol: symbolText, svg_uri: svgUri } = symbol;
      const sanitizedSymbolText = symbolText.replace(/[{}]/g, ''); // Remove curly braces
      const filepath = path.join(__dirname, 'assets/symbols', `${sanitizedSymbolText}.svg`);

      // Ensure the directory exists
      fs.mkdirSync(path.dirname(filepath), { recursive: true });

      // Download the SVG
      await downloadSVG(svgUri, filepath);
      console.log(`Downloaded ${sanitizedSymbolText}.svg`);

      // Sleep for 200 milliseconds to maintain a rate of 5 requests per second
      await sleep(200);
    }
  } catch (error) {
    // Log error message
    console.error('Error:', error.message);
  }
};

main();