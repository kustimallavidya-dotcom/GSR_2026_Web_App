const DB_NAME = 'GSR_Database';
const DB_VERSION = 1;
const STORE_NAME = 'rules';

let db;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // We'll use the 'page' number as the key path for now
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'page' });
                // Create an index to search text
                store.createIndex('text', 'text', { unique: false });
            }
        };
    });
}

// Check if data is already loaded
function isDataLoaded() {
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            resolve(countRequest.result > 0);
        };
    });
}

// Load rules.json into IndexedDB
async function loadRulesIntoDB() {
    try {
        console.log("Fetching rules.json...");
        const response = await fetch('rules.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        console.log(`Loaded ${data.length} pages from JSON. Saving to IndexedDB...`);
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            transaction.oncomplete = () => {
                console.log("All data saved to IndexedDB.");
                resolve();
            };
            transaction.onerror = (event) => reject(event.target.error);
            
            data.forEach(item => {
                store.put(item);
            });
        });
    } catch (e) {
        console.error("Failed to load rules:", e);
    }
}

// Basic search function (finding pages containing ALL keywords)
async function searchRules(query) {
    if (!db) await initDB();
    
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const allPages = request.result;
            const keywords = query.toLowerCase().split(' ').filter(k => k.length > 2);
            
            if (keywords.length === 0) {
                resolve([]);
                return;
            }
            
            // Filter pages that contain at least one keyword (or all, depending on logic)
            // Let's sort by relevance (number of keyword matches)
            const results = allPages.map(page => {
                const textLower = page.text.toLowerCase();
                let score = 0;
                keywords.forEach(kw => {
                    // Count occurrences
                    const matches = textLower.split(kw).length - 1;
                    score += matches;
                });
                return { ...page, score };
            }).filter(p => p.score > 0);
            
            // Sort by score descending
            results.sort((a, b) => b.score - a.score);
            
            // Return top 5 results
            resolve(results.slice(0, 5));
        };
    });
}

// Initialize database on load
initDB().then(async () => {
    const loaded = await isDataLoaded();
    if (!loaded) {
        // Show a loading indicator in UI if possible
        await loadRulesIntoDB();
    } else {
        console.log("Database is already populated.");
    }
});

// Expose to global scope for main.js
window.searchRules = searchRules;
