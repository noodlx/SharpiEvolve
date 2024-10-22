const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const os = require('os');

const app = express();
const port = 8080;

// Connect to the SQLite database
const dbPath = path.resolve(__dirname, '../data/mtg_cards.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());

app.get('/endpoint', async (req, res) => {
  let { name, text, colors, types, subtypes, supertype, matchColorsExactly, matchTypesExactly, page = 1 } = req.query;
  const lookupMode = req.query.lookupMode === 'true';
  const limit = 50;
  const offset = (page - 1) * limit;
  
  const chalkModule = await import('chalk');
  const chalk = chalkModule.default;

  // Sanitize inputs
  name = sanitizeHtml(name || '');
  text = sanitizeHtml(text || '');
  subtypes = sanitizeHtml(subtypes || '');

  // Log the incoming request parameters
  console.log('Incoming request parameters:', req.query);
  console.time('Backend Operation Time');

  // Construct the SQL query based on the request parameters
  // Default Query for Lookup Mode... rewritten if Sharpie Match Mode is enabled
  let query = 'SELECT rowid, artID, name, faceName, allText, supertypes, type, types, subtypes, colors, power, toughness, manaCost, rarity, layout, side FROM cards WHERE 1=1';
  const params = [];

  if (text) {
    // Simple Lookup Mode Block
    if (lookupMode) {
      query += ' AND allText LIKE ?';
      const param = `%${text}%`;
      console.log('Parameter for lookupMode:', param);
      params.push(param);
    } else {  // Sharpie Match Mode Block
      let noSpaceText = text.replace(/\s/g, '_');  
      query = 'SELECT rowid, artID, name, faceName, allText, supertypes, type, types, subtypes, colors, power, toughness, manaCost, rarity, layout, side, setCode FROM cards WHERE realText LIKE ?';
      const param = `%${noSpaceText.split('').join('%')}%`;
      console.log('Parameter for Sharpie Match Mode:', param);
      params.push(param);
    }
  }

  if (name) {
    query += ' AND (CASE WHEN faceName IS NOT NULL THEN faceName ELSE name END) LIKE ?';
    params.push(`%${name}%`);
  }

  if (colors) {
    const matchColorsExactlyBool = matchColorsExactly === 'true';
    const colorArray = colors.split(',');
    if (matchColorsExactlyBool) {
      query += ' AND colors = ?';
      params.push(colorArray.join(', '));
    } else {
      query += ' AND (';
      let colorCount = colorArray.length;
      colorArray.forEach(color => {
        query += ' colors LIKE ?';
        if (colorCount > 1) {
          query += ' OR';
          colorCount--;
        } else {
          query += ')';
        }
        params.push(`%${color}%`);
      });
    }
  }

  if (types) {
    const matchTypesExactlyBool = matchTypesExactly === 'true';
    const typeArray = types.split(',');
    if (matchTypesExactlyBool) {
      query += ' AND types = ?';
      params.push(typeArray.join(', '));
    } else {
      query += ' AND (';
      let typeCount = typeArray.length;
      typeArray.forEach(type => {
        query += ' types LIKE ?';
        if (typeCount > 1) {
          query += ' OR';
          typeCount--;
        } else {
          query += ')';
        }
        params.push(`%${type}%`);
      });
    }
  }

  if (subtypes) {
    const matchTypesExactlyBool = matchTypesExactly === 'true';
    const subtypeArray = subtypes.split(',');
    if (matchTypesExactlyBool) {
      query += ' AND subtypes = ?';
      params.push(subtypeArray.join(', '));
    } else {
      query += ' AND (';
      let typeCount = subtypeArray.length;
      subtypeArray.forEach(subtype => {
        query += ' subtypes LIKE ?';
        if (typeCount > 1) {
          query += ' OR';
          typeCount--;
        } else {
          query += ')';
        }
        params.push(`%${subtype}%`);
      });
    }
  }

  if (supertype) {
    const matchTypesExactlyBool = matchTypesExactly === 'true';
    if (matchTypesExactlyBool) {
      query += ' AND supertypes = ?';
      params.push(supertype);
    } else {
      query += ' AND supertypes LIKE ?';
      params.push(`%${supertype}%`);
    }
  }
  query += ' ORDER BY LENGTH(realText) ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  console.log('Constructed SQL query:', query);
  console.log('Query parameters:', params);

  try {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error executing query:', err.message);
        res.status(500).send('Error retrieving data');
      } else {
        console.log('Query executed successfully, number of rows retrieved:', rows.length);
        
        if (!lookupMode) {
          console.log('Looking for Text:', text);
          let matches = 0;
          let matchedRows = rows.filter(row => {            
            if(!text) {
              return true;
            }
            let inCurlyBraces = false;
            let textIndex = 0;            
            let formattedMatch = '<span class="strikethrough">';
            let matchedText = '';
            let charactersEvaluated = 0;
        
            //console.log('Processing row:', row);
            if (row.allText != null) {
              for (let i = 0; i < row.allText.length; i++) {
                if(matches == limit) {
                  break;
                }
                charactersEvaluated++;
                if (row.allText[i] === '{') {
                  inCurlyBraces = true;
                  formattedMatch += row.allText[i];
                  //console.log('Entering curly braces:', formattedMatch);
                } else if (row.allText[i] === '}') {
                  inCurlyBraces = false;
                  formattedMatch += row.allText[i];
                  //console.log('Exiting curly braces:', formattedMatch);
                } else if (!inCurlyBraces && row.allText[i].toLowerCase() === text[textIndex].toLowerCase()) {
                  textIndex++;
                  formattedMatch += `</span><span class="matchedChar">${row.allText[i]}</span><span class="strikethrough">`;
                  matchedText += row.allText[i];
                  //process.stdout.write(chalk.blue(row.allText[i]));
                  //console.log('Matched character:', row.allText[i], 'Formatted match:', formattedMatch);
                } else if (!inCurlyBraces && row.allText[i].toLowerCase() != text[textIndex].toLowerCase() && text[textIndex] === ' ') {
                  textIndex++;
                  formattedMatch += row.allText[i];
                  //process.stdout.write(chalk.red(row.allText[i]));
                  // console.log('Skipping space:', formattedMatch);
                } else {
                  formattedMatch += row.allText[i];
                  //process.stdout.write(chalk.red(row.allText[i]));
                  //console.log('Non-matching character:', row.allText[i], 'Formatted match:', formattedMatch);
                }
                if (textIndex === text.length) {
                 //console.log('Full text matched:', formattedMatch);
                 
                  formattedMatch += `${row.allText.slice(i + 1)}</span>`;
                  row.allText = formattedMatch;
                  return true;
                }
              }
              //console.log('');
            }
            //console.log('');
            console.log('Text not fully matched for row:', row);
            console.log('Matched text:', matchedText);
            console.log('Characters evaluated:', charactersEvaluated);
            return false;
          });
          console.log('Matched rows:', matchedRows.length);
          res.json( matchedRows);
        }
        else {
          res.json( rows);
        }
      }
      console.timeEnd('Backend Operation Time');
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error retrieving data');
    console.timeEnd('Backend Operation Time');
  }
});

app.listen(port, () => {
  const hostname = process.env.HOSTNAME || '0.0.0.0';
  const protocol = process.env.PROTOCOL || 'http';
  const fullUrl = `${protocol}://${hostname}:${port}`;
  console.log(`Server is running at ${fullUrl}`);
});