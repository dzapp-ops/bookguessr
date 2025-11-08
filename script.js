// --- Global Game State Variables ---
let currentBook = null;        
let incorrectGuessCount = 0;   
let hasGuessedToday = false; 
let currentGameDate = '';      
let ALL_GAME_DATA = { DAILY_SCHEDULE: [], BOOK_DATA: [] };

const MAX_GUESSES = 5;
let guessHistory = []; 

// Hint structure remains the same
const HINT_REVEAL_SCHEDULE = [
    { guesses: 2, type: 'AuthorInitials', text: "Author's initials revealed." },
    { guesses: 3, type: 'Genre', text: "The primary genre is revealed." },
    { guesses: 4, type: 'Year', text: "The publication year is revealed." },
];
let HINTS_GIVEN = 0; 

// Cache all titles once for validation
let ALL_BOOK_TITLES = []; 

// --- Core Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch the JSON data
    try {
        const response = await fetch('book_data_ai.json'); 
        ALL_GAME_DATA = await response.json();
        ALL_BOOK_TITLES = getAllBookTitles(); 
        populateDatalist(); 
    } catch (e) {
        console.error("Failed to load book_data_ai.json. Run a local HTTP server.", e);
        document.getElementById('chapter-list').innerHTML = '<li>Error loading game data. Check console.</li>';
        return;
    }
    
    // 2. Start the game flow
    initializeGame();
});

function initializeGame() {
    currentGameDate = getGameDateFromURL();
    const todayBook = getDailyBook(); 
    
    if (!todayBook) {
        document.getElementById('game-content').innerHTML = `<p class="message error">Challenge data missing for ${currentGameDate}.</p>`;
        return;
    }
    
    currentBook = todayBook;
    loadGameProgress(); 
    
    if (hasGuessedToday) {
        // If solved, render the final state immediately
        handleCorrectGuess(currentBook, true); 
        lockGameControls();
    } 
    else if (incorrectGuessCount >= MAX_GUESSES) {
        // If failed, show Game Over state
        handleGameOver(currentBook, true);
        lockGameControls();
    } 
    else {
        // Otherwise, render the standard game UI
        renderGameUI();
    }
    
    setupNavigationButtons();
}

// --- Data & Datalist Management ---

function getAllBookTitles() {
    return ALL_GAME_DATA.BOOK_DATA.map(book => book.title);
}

function populateDatalist() {
    const datalist = document.getElementById('book-titles');
    datalist.innerHTML = '';
    
    const sortedTitles = ALL_BOOK_TITLES.sort();

    sortedTitles.forEach(title => {
        const option = document.createElement('option');
        option.value = title;
        datalist.appendChild(option);
    });
}

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function getGameDateFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    const today = getTodayDateString();
    
    if (dateParam && dateParam <= today) {
        return dateParam;
    }
    return today; 
}

function getDailyBook() {
    const targetDate = currentGameDate;
    const dailyEntry = ALL_GAME_DATA.DAILY_SCHEDULE.find(entry => entry.date === targetDate);

    if (dailyEntry) {
        return ALL_GAME_DATA.BOOK_DATA.find(book => book.id === dailyEntry.bookId);
    }
    return null;
}

// --- Local Storage ---

function loadGameProgress() {
    const key = `chapterGuesserSave-${currentGameDate}`;
    const savedState = localStorage.getItem(key);

    if (savedState) {
        try {
            const gameState = JSON.parse(savedState);
            incorrectGuessCount = gameState.guesses || 0;
            hasGuessedToday = gameState.solved || false;
            HINTS_GIVEN = gameState.hintsGiven || 0;
            guessHistory = gameState.history || [];
        } catch (e) {
            console.error("Error parsing saved state:", e);
            localStorage.removeItem(key);
        }
    } else {
        incorrectGuessCount = 0;
        hasGuessedToday = false;
        HINTS_GIVEN = 0; 
        guessHistory = [];
    }
}

function saveGameProgress(solved = false) {
    const key = `chapterGuesserSave-${currentGameDate}`;
    const gameState = {
        guesses: incorrectGuessCount,
        solved: solved,
        hintsGiven: HINTS_GIVEN,
        history: guessHistory 
    };
    localStorage.setItem(key, JSON.stringify(gameState));
}


// --- Game Action Functions ---

function checkGuessWrapper() {
    const input = document.getElementById('user-guess');
    
    // 1. Enforce Selection from Datalist 
    const normalizedGuess = input.value.trim(); 
    
    const exactMatch = ALL_BOOK_TITLES.some(title => title.trim() === normalizedGuess);
    
    if (!exactMatch) {
        showFeedback("Please select a valid title from the dropdown list.", 'error');
        return;
    }

    if (input.value.trim() !== '' && !hasGuessedToday) {
        checkGuess(input.value);
    }
}

function checkGuess(guess) {
    if (!currentBook || hasGuessedToday) return;

    guessHistory.push(guess.trim());

    const sanitizedGuess = guess.trim().toLowerCase().replace(/^(the|a|an)\s+/, '');
    const sanitizedAnswer = currentBook.title.trim().toLowerCase().replace(/^(the|a|an)\s+/, '');

    if (sanitizedGuess === sanitizedAnswer) {
        saveGameProgress(true); 
        handleCorrectGuess(currentBook);
    } else {
        incorrectGuessCount++;
        document.getElementById('user-guess').value = '';
        
        if (incorrectGuessCount >= MAX_GUESSES) {
            renderGameUI();
            handleGameOver(currentBook);
            saveGameProgress();
            return;
        }

        const hintToGive = HINT_REVEAL_SCHEDULE.find(h => h.guesses === incorrectGuessCount);
        if (hintToGive && HINTS_GIVEN < HINT_REVEAL_SCHEDULE.length) {
            HINTS_GIVEN++;
        }
        
        showFeedback(`Incorrect. ${MAX_GUESSES - incorrectGuessCount} guesses left!`, 'error');
        renderGameUI(); 
        saveGameProgress(); 
    }
}

function handleGameOver(book, isLoaded = false) {
    hasGuessedToday = true;
    lockGameControls();
    
    // 1. Reveal ALL metadata on the Title Page
    document.getElementById('first-page-author').textContent = `By: ${book.author}`;
    document.getElementById('first-page-genre').textContent = `Genre: ${book.genre}`;
    document.getElementById('first-page-year').textContent = `Published: ${book.publicationYear}`;
    document.getElementById('first-page-title').textContent = book.title;
    document.getElementById('first-page-title').style.color = '#af4c5cff'; 

    // 2. Ensure Title Page is visible
    document.getElementById('title-page-content').classList.remove('hidden'); 
    document.getElementById('reveal-content').classList.remove('hidden'); 

    // 3. Update status area
    showFeedback("Game Over! 😭 Max guesses reached. Answer revealed below.", 'error');

    // 4. Update the reveal content to show the answer (outside the book structure)
    document.getElementById('reveal-content').innerHTML = `
        <p class="small-text">Source: <a href="${book.wikipediaLink}" target="_blank" style="color:#ccc;">Wikipedia Article</a></p>
    `;
    
    if (isLoaded) renderGameUI(); 
}


// --- UI Rendering (FIXED PERSISTENCE) ---

function renderGameUI() {
    const guessesLeft = MAX_GUESSES - incorrectGuessCount;
    document.getElementById('guesses-remaining-display').textContent = 
        `Guesses Remaining: ${Math.max(0, guessesLeft)}/${MAX_GUESSES}`; 
    
    // --- Render Guess History ---
    const historyList = document.getElementById('guess-history-list');
    historyList.innerHTML = '';
    guessHistory.forEach(guess => {
        const li = document.createElement('li');
        li.textContent = guess;
        historyList.appendChild(li);
    });
    
    // --- Render Left Page (Title Page) - Hint Logic ---
    
    // *** FIX: Only reset placeholders if the game hasn't been solved ***
    if (!hasGuessedToday) {
        document.getElementById('first-page-title').textContent = '???'; 
        document.getElementById('first-page-title').style.color = 'var(--secondary-color)'; 
        document.getElementById('first-page-author').textContent = 'By [??]';
        document.getElementById('first-page-genre').textContent = 'Genre: [??]';
        document.getElementById('first-page-year').textContent = 'Year: [??]';
    }

    // Metadata Hint Revealing
    if (incorrectGuessCount >= 2 || hasGuessedToday) { 
        const authorText = hasGuessedToday ? currentBook.author : currentBook.author.split(' ').map(n => n[0]).join('. ') + '.';
        document.getElementById('first-page-author').textContent = `By ${authorText}`;
    }
    
    if (incorrectGuessCount >= 3 || hasGuessedToday) { 
        document.getElementById('first-page-genre').textContent = `Genre: ${currentBook.genre}`;
    }
    
    if (incorrectGuessCount >= 4 || hasGuessedToday) { 
        document.getElementById('first-page-year').textContent = `Published: ${currentBook.publicationYear}`;
    }

    // --- Render Right Page (Table of Contents) - Chapter Reveal Logic ---
    const ul = document.getElementById('chapter-list');
    ul.innerHTML = '';
    
    // If solved, show all chapters. Otherwise, show chapters based on incorrect guesses.
    const chaptersToShow = hasGuessedToday ? currentBook.chapters.length : incorrectGuessCount + 1; 
    
    currentBook.chapters.slice(0, chaptersToShow).forEach((chapter, index) => {
        const li = document.createElement('li');
        li.setAttribute('data-chapter-number', index + 1 + '.');
        li.innerHTML = `<span>${chapter}</span>`;
        ul.appendChild(li);
    });
}


// --- Final Reveal (CRITICALLY FIXED FOR PERSISTENCE) ---

function handleCorrectGuess(book, isLoaded = false) {
    hasGuessedToday = true;
    lockGameControls();
    
    const guessesUsed = guessHistory.length;
    
    // 1. Update the Left Page (Title Page) with the complete correct answer
    // NOTE: This update happens *before* renderGameUI is called if isLoaded=true.
    document.getElementById('first-page-title').textContent = book.title;
    document.getElementById('first-page-title').style.color = '#4caf50'; 
    
    // 2. Update status area
    document.getElementById('guesses-remaining-display').innerHTML = 
        `✅ SOLVED (Used ${guessesUsed} of ${MAX_GUESSES} attempts)`;
    showFeedback("Puzzle Solved!", 'success'); // Status message appears above input

    // 3. Ensure Title Page is visible
    document.getElementById('title-page-content').classList.remove('hidden'); 
    
    // Display source/attribution info below the main title blocks
    const hintDisplay = document.getElementById('hint-display');
    hintDisplay.innerHTML = `<p class="small-text">Source: <a href="${book.wikipediaLink}" target="_blank" style="color:#ccc;">Wikipedia Article</a></p>`;
         
    // 4. Call renderUI to update all hints, metadata, and chapters to final state
    renderGameUI();
}


// --- Navigation and Helpers ---

function setupNavigationButtons() {
    const navContainer = document.getElementById('archive-nav-container'); 
    navContainer.innerHTML = '';
    
    const currentDate = new Date(currentGameDate);
    
    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    const todayStr = getTodayDateString();
    
    const hasPrevEntry = ALL_GAME_DATA.DAILY_SCHEDULE.some(e => e.date === prevDateStr);
    
    navContainer.innerHTML = `
        <button onclick="navigateChallenge('${prevDateStr}')" id="prev-challenge-button" ${!hasPrevEntry ? 'disabled' : ''}>← Previous Challenge</button>
        <span class="date-display">${currentGameDate === todayStr ? 'Today' : currentGameDate}</span>
        <button onclick="navigateChallenge('${nextDateStr}')" id="next-challenge-button" ${nextDateStr > todayStr ? 'disabled' : ''}>Next Challenge →</button>
    `;
}

function navigateChallenge(dateString) {
    window.location.href = `index.html?date=${dateString}`;
}

function lockGameControls() {
    document.getElementById('user-guess').disabled = true;
    document.querySelector('.input-section button').disabled = true;
}

function showFeedback(message, type) {
    const feedback = document.getElementById('feedback-message');
    feedback.textContent = message;
    feedback.className = `message ${type}`;
}

function resetGameProgress() {
    if (confirm("Are you sure you want to reset ALL local progress and scores?")) {
        localStorage.clear();
        window.location.reload();
    }
}
