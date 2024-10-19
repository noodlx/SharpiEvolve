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

// Function to download image
const downloadImage = async (url, filepath) => {
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

// Function to get subdirectory path based on ID
const getSubdirectoryPathById = (id) => {
  const idStr = id.toString().padStart(5, '0');
  return path.join(idStr[0], idStr[1], idStr[2]);
};



// Function to sleep for a given number of milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to log errors to a file
const logErrorToFile = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync('error.log', logMessage);
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

// Main function
const main = async () => {
  try {
    // Query the database
    console.log('Querying the database...');
    const startTime = Date.now();
    db.all(`
      SELECT c.rowid AS id, c.name, ci.scryfallId
      FROM cards c
      JOIN cardIdentifiers ci ON c.rowid = ci.rowid
    `, async (err, rows) => {
      if (err) {
        throw err;
      }

      

      const endTime = Date.now();
      console.log(`Query executed in ${endTime - startTime} ms`);
      console.log(`Retrieved ${rows.length} rows from the database`);
    
      // Process each row
      let faceTracker = 0;
      let counter = 0;
      for (const row of rows) {
        const { id, name, scryfallId } = row;
        const scryfallUrl = `https://api.scryfall.com/cards/${scryfallId}`;
        
        try {
          
          const subdirectoryPath = getSubdirectoryPathById(id);
          const filepath = path.join(__dirname, '../../frontend/public/assets/cards', subdirectoryPath, `${id}.jpg`);

          // Ensure the subdirectory exists
          fs.mkdirSync(path.dirname(filepath), { recursive: true });

          // Check if the file already exists
          if (!fs.existsSync(filepath)) {
            // Download the image
            let imageUrl;
            // Fetch data from Scryfall API with retry logic
            const response = await fetchDataWithRetry(scryfallUrl);
            console.log(`Image for ${name} (ID: ${id}) Downloading...`);
            if (response.data.image_uris) {
            // Single-faced card
              imageUrl = response.data.image_uris.normal;
              if( faceTracker === 1) {
                faceTracker = 0;
              }
            } else if (response.data.card_faces && response.data.card_faces.length > 0) {
            // Double-faced card
              imageUrl = response.data.card_faces[faceTracker].image_uris.normal;
              faceTracker = faceTracker === 0 ? 1 : 0;
            } else {
              throw new Error('No image URL found');
            }
            await downloadImage(imageUrl, filepath);
            // Sleep for 200 milliseconds to maintain a rate of 5 requests per second
            await sleep(100);
          } else {
            //console.log(`Image for ${name} (ID: ${id}) already exists. Skipping download.`);
          }
        } catch (error) {
          // Log error message
          const errorMessage = `Failed to download image for ${name} (ID: ${id}): ${error.message}`;
          console.error(errorMessage);
          logErrorToFile(errorMessage);
        }
        // Increment counter and log progress every 10 cards
        counter++;
        if (counter % 100 === 0) {
          console.log(`Processed ${counter} cards out of ${rows.length}`);
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

main();