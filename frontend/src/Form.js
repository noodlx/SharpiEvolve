import './Form.css';
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import 'bulma/css/bulma.min.css';

function Form() {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1); // State for current page
  const [totalResults, setTotalResults] = useState(0); // State for total results
  const [colors, setColors] = useState([]);
  const [types, setTypes] = useState([]);
  const [supertype, setSupertype] = useState(''); // State for supertype
  const [subtypes, setSubtypes] = useState(''); // State for subtypes
  const [matchColorsExactly, setMatchColorsExactly] = useState(false);
  const [matchTypesExactly, setMatchTypesExactly] = useState(false); // New state for 'Match Card Types Exactly'
  const [lookupMode, setLookupMode] = useState(true); // true for 'Lookup', false for 'Sharpie Match'
  const [searchSubmitted, setSearchSubmitted] = useState(false); // State to track if a search has been submitted

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validation check: Ensure at least one field is filled
    if (!name && !text && colors.length === 0 && types.length === 0 && !supertype && !subtypes) {
      console.log('Form is empty. Please fill in at least one field.');
      return; // Exit the function if all fields are empty
    }

    setSearchSubmitted(true); // Set searchSubmitted to true when a search is submitted
  };

  useEffect(() => {
    if (searchSubmitted) {
      fetchResults(1); // Reset to first page on new search
      setSearchSubmitted(false); // Reset searchSubmitted state
    }
  }, [searchSubmitted]);

  const fetchResults = async (page) => {
    const sanitizedText = text.replace(/\{[^}]*\}/g, ''); // Remove {} and all text within
    const query = new URLSearchParams({ name, text: sanitizedText, page, colors: colors.sort().join(','), types: types.sort().join(','), supertype, subtypes: subtypes.split(' ').map(subtype => subtype.trim()).join(','), matchColorsExactly, matchTypesExactly, lookupMode }).toString();

    // Debug output for parameters
    console.log('Fetching results with the following parameters:');
    console.log('Name:', name);
    console.log('Sanitized Text:', sanitizedText);
    console.log('Page:', page);
    console.log('Colors:', colors.sort().join(', '));
    console.log('Types:', types.sort().join(', '));
    console.log('Supertype:', supertype);
    console.log('Subtypes:', subtypes.split(', ').join(','));
    console.log('Match Colors Exactly:', matchColorsExactly);
    console.log('Match Types Exactly:', matchTypesExactly);
    console.log('Lookup Mode:', lookupMode);

    try {
      const response = await fetch(`http://localhost:8000/endpoint?${query}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setTotalResults(data.length); // Assuming the server returns the total number of results
        setPage(page); // Update the current page
        console.log('Data retrieved successfully', data);
      } else {
        console.error('Error retrieving data');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleNextPage = () => {
    console.log('running handleNextPage...');
    fetchResults(page + 1);
  };

  const handlePreviousPage = () => {
    console.log('running handlePreviousPage...');
    if (page > 1) {
      fetchResults(page - 1);
    }
  };

  const replaceSymbolsWithSVGs = (text) => {
    if (!text) return ''; // Return an empty string if text is null or undefined
    //console.log('PreSVGtext:', text);
    console.log('running replaceSymbolsWithSVGs...');

    // Replace symbols with SVGs
    text = text.replace(/\{([^}]+)\}/g, (match, p1) => {
      const sanitizedSymbol = p1.replace('/', '/'); // Keep '/' for deeper file layer
      return `<img src="/assets/symbols/${sanitizedSymbol}.svg" alt="${p1}" style="width: 1em; height: 1em; vertical-align: middle;" />`;
    });

    // Replace '\n' with '<br>' outside of { }
    let result = '';
    let insideBraces = false;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        insideBraces = true;
      } else if (text[i] === '}') {
        insideBraces = false;
      }

      if (text[i] === '\\' && !insideBraces && text[i + 1] == 'n') {
        result += '<br>';
        i++;
      } else {
        result += text[i];
      }
    }

    //console.log('post-replacement text:', result);
    return result;
  };

  const getCardImagePath = (card) => {
    if (!card || !card.rowid) {
      console.error('Invalid card object or missing artID:', card);
      return '/assets/cards/default.jpg'; // Return a default image path or handle the error as needed
    }

    // Pad the artID with leading zeros to ensure it has at least 5 digits
    const rowidString = card.rowid.toString().padStart(5, '0');
    const firstDigit = rowidString[0];
    const secondDigit = rowidString[1];
    const thirdDigit = rowidString[2];
    const imagePath = `/assets/cards/${firstDigit}/${secondDigit}/${thirdDigit}/${card.rowid}.jpg`;
    return imagePath;
  };

  const getFallbackImagePath = (card) => {
    const placeholderImagePath = '/assets/placeholder.jpg';
    return placeholderImagePath;
  };

  const handleColorChange = (event) => {
    const value = event.target.value;
    setColors(prevColors => 
      prevColors.includes(value) ? prevColors.filter(color => color !== value) : [...prevColors, value]
    );
  };

  const handleTypeChange = (event) => {
    const value = event.target.value;
    setTypes(prevTypes => 
      prevTypes.includes(value) ? prevTypes.filter(type => type !== value) : [...prevTypes, value]
    );
  };

  const handleSupertypeChange = (event) => {
    const value = event.target.checked ? 'Legendary' : '';
    setSupertype(value);
  };

  const handleSubtypesChange = (event) => {
    setSubtypes(event.target.value);
  };

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        handleSubmit(event);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, [name, text, colors, types, supertype, subtypes, matchColorsExactly, matchTypesExactly, lookupMode]);

  // Memoize the results with SVG replacements
  const memoizedResults = useMemo(() => {
    return results.map(card => ({
      ...card,
      memoizedManaCost: replaceSymbolsWithSVGs(card.manaCost),
      memoizedAllText: replaceSymbolsWithSVGs(card.allText)
    }));
  }, [results]);

  return ( 
    <div className="container">
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="label">Card Name:</label>
          <div className="control">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div className="field">
          <label className="label">Card Text:</label>
          <div className="control">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows="4"
              className="textarea"
            />
          </div>
        </div>
        <div className="columns">
          <div className="column">
            <div className="field">
              <label className="label">Colors:</label>
              <div className="checkbox-columns">
                <div className="checkbox-column">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="W"
                      checked={colors.includes("W")}
                      onChange={handleColorChange}
                    />
                    White
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="U"
                      checked={colors.includes("U")}
                      onChange={handleColorChange}
                    />
                    Blue
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="B"
                      checked={colors.includes("B")}
                      onChange={handleColorChange}
                    />
                    Black
                  </label>
                </div>
                <div className="checkbox-column">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="R"
                      checked={colors.includes("R")}
                      onChange={handleColorChange}
                    />
                    Red
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="G"
                      checked={colors.includes("G")}
                      onChange={handleColorChange}
                    />
                    Green
                  </label>
                </div>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={matchColorsExactly}
                  onChange={(e) => setMatchColorsExactly(e.target.checked)}
                />
                Match Colors Exactly
              </label>
            </div>
          </div>
          <div className="vertical-divider"></div>
          <div className="column">
            <div className="field">
              <label className="label">Types:</label>
              <div className="checkbox-columns">
                <div className="checkbox-column">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="Creature"
                      checked={types.includes("Creature")}
                      onChange={handleTypeChange}
                    />
                    Creature
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="Instant"
                      checked={types.includes("Instant")}
                      onChange={handleTypeChange}
                    />
                    Instant
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="Sorcery"
                      checked={types.includes("Sorcery")}
                      onChange={handleTypeChange}
                    />
                    Sorcery
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={supertype === 'Legendary'}
                      onChange={handleSupertypeChange}
                    />
                    Legendary
                  </label>
                </div>
                <div className="checkbox-column">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="Artifact"
                      checked={types.includes("Artifact")}
                      onChange={handleTypeChange}
                    />
                    Artifact
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="Enchantment"
                      checked={types.includes("Enchantment")}
                      onChange={handleTypeChange}
                    />
                    Enchantment
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="Planeswalker"
                      checked={types.includes("Planeswalker")}
                      onChange={handleTypeChange}
                    />
                    Planeswalker
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      value="Land"
                      checked={types.includes("Land")}
                      onChange={handleTypeChange}
                    />
                    Land
                  </label>
                </div>
              </div>
              <div className="field">
                <label className="label">Subtypes:</label>
                <div className="control">
                  <input
                    type="text"
                    value={subtypes}
                    onChange={handleSubtypesChange}
                    className="input"
                  />
                </div>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={matchTypesExactly}
                  onChange={(e) => setMatchTypesExactly(e.target.checked)}
                />
                Match Card Types Exactly
              </label>
            </div>
          </div>
        </div>
        <div className="field radio-group">
          <label className="radio">
            <input
              type="radio"
              checked={lookupMode}
              onChange={() => setLookupMode(true)}
            />
            Lookup Mode
          </label>
          <label className="radio">
            <input
              type="radio"
              checked={!lookupMode}
              onChange={() => setLookupMode(false)}
            />
            Sharpie Match Mode
          </label>
        </div>
        <div className="field no-border">
          <div className="control">
            <button type="submit" className="button is-primary">Submit</button>
          </div>
        </div>
      </form>
      <div className="section">
        <ul>
          {memoizedResults.map((card, index) => (
            <li key={index}>
              <img
                src={getCardImagePath(card)}
                alt={card.name}
                className="card-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = getFallbackImagePath(card);
                }}
              />
              <div>
                <strong>Name:</strong> {card.faceName ? card.faceName : card.name}<br />
                <strong>Rarity:</strong> {card.rarity}<br />
                {card.manaCost && (<> <strong>Mana Cost:</strong>
                  <span dangerouslySetInnerHTML={{ __html: card.memoizedManaCost }} /><br /></> )}
                <strong>Types:</strong> {card.type}<br />
                {card.allText && (<>
                  <span dangerouslySetInnerHTML={{ __html: card.memoizedAllText }} /><br /></> )}
                {card.power && (<> <strong>P/T:</strong> {card.power} / {card.toughness}<br /> </> )}
              </div>
            </li>
          ))}
        </ul>
        <h1><br /></h1>
        <div className="pagination">
          {page > 1 && (
            <button onClick={handlePreviousPage} className="button is-link previous-page">Previous</button>
          )}
          {results.length === 50 && (
            <button onClick={handleNextPage} className="button is-link next-page">Next</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Form;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Form />);