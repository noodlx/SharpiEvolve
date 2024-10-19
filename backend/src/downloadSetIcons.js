const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Open SQLite database
const db = new sqlite3.Database(path.join(__dirname, '../data/mtg_cards.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Function to download SVG icon
const downloadSvgIcon = async (url, filepath) => {
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
    // Query the database for unique set codes
    console.log('Querying the database for unique set codes...');
    db.all('SELECT DISTINCT setCode FROM cards', async (err, rows) => {
      if (err) {
        throw err;
      }

      console.log(`Retrieved ${rows.length} unique set codes from the database`);

      // Process each set code
      let counter = 0;
      for (const row of rows) {
        const { setCode } = row;
        const scryfallUrl = `https://api.scryfall.com/sets/${setCode}`;

        try {
          // Fetch set data from Scryfall API with retry logic
          const response = await fetchDataWithRetry(scryfallUrl);
          const iconSvgUri = response.data.icon_svg_uri;

          if (iconSvgUri) {
            const filepath = path.join(__dirname, '../../frontend/public/assets/sets', `${setCode}.svg`);

            // Ensure the directory exists
            fs.mkdirSync(path.dirname(filepath), { recursive: true });

            // Download the SVG icon
            await downloadSvgIcon(iconSvgUri, filepath);
            console.log(`Downloaded SVG icon for set ${setCode}`);
          } else {
            console.warn(`No icon_svg_uri found for set ${setCode}`);
          }

          // Sleep for 100 milliseconds to maintain a rate of 10 requests per second
          await sleep(100);
        } catch (error) {
          // Log error message
          const errorMessage = `Failed to download SVG icon for set ${setCode}: ${error.message}`;
          console.error(errorMessage);
          logErrorToFile(errorMessage);
        }

        // Increment counter and log progress every 10 sets
        counter++;
        if (counter % 10 === 0) {
          console.log(`Processed ${counter} sets out of ${rows.length}`);
        }
      }
    });
  } catch (error) {
    // Log error message
    const errorMessage = `Error: ${error.message}`;
    console.error(errorMessage);
    logErrorToFile(errorMessage);
  } finally {
    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing the database:', err);
      } else {
        console.log('Database connection closed.');
      }
    });
  }
};

// Function to fetch data with retry logic
const fetchDataWithRetry = async (url, retries = 5, backoff = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'sharpievolve/1.0',
          'Accept': 'application/json;q=0.9,*/*;q=0.8'
        }
      });
      return response;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.warn(`Rate limited. Retrying in ${backoff} ms...`);
        await sleep(backoff);
        backoff *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries reached');
};

// Function to log errors to a file
const logErrorToFile = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync('error.log', logMessage);
};

main();