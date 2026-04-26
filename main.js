document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const splashScreen = document.getElementById('splash-screen');
    const loginScreen = document.getElementById('login-screen');
    const homeScreen = document.getElementById('home-screen');
    
    const splashText = document.getElementById('splash-text');
    const googleLoginBtn = document.getElementById('google-login-btn');
    
    const searchInput = document.getElementById('search-input');
    const askBtn = document.getElementById('ask-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const chatHistory = document.getElementById('chat-history');

    // --- Splash Screen Logic ---
    const textToType = "G&SR 2026";
    let typeIndex = 0;

    function typeWriter() {
        if (typeIndex < textToType.length) {
            splashText.innerHTML += textToType.charAt(typeIndex);
            typeIndex++;
            setTimeout(typeWriter, 150);
        } else {
            // Typing done, wait a bit then show login
            setTimeout(() => {
                splashScreen.classList.remove('active');
                setTimeout(() => {
                    splashScreen.classList.add('hidden');
                    loginScreen.classList.remove('hidden');
                    // slight delay to trigger opacity transition
                    setTimeout(() => loginScreen.classList.add('active'), 50);
                }, 500); // Wait for fade out
            }, 1000);
        }
    }

    // Start Splash
    setTimeout(typeWriter, 500);

    // --- Login Logic ---
    googleLoginBtn.addEventListener('click', () => {
        // Mock Google Login
        loginScreen.classList.remove('active');
        setTimeout(() => {
            loginScreen.classList.add('hidden');
            homeScreen.classList.remove('hidden');
            setTimeout(() => homeScreen.classList.add('active'), 50);
        }, 500);
    });

    // --- Home Screen Logic ---
    async function addChatCard(question) {
        const card = document.createElement('div');
        card.className = 'chat-card glass-panel';
        
        // Show loading state
        card.innerHTML = `<div class="chat-question">प्रश्न: ${question}</div><div class="chat-answer">शोधत आहे... (Searching...)</div>`;
        chatHistory.prepend(card);
        
        // Use our database search
        let results = [];
        if (window.searchRules) {
            results = await window.searchRules(question);
        }
        
        let answerHTML = '';
        if (results && results.length > 0) {
            const topResult = results[0];
            // Get a snippet
            const snippet = topResult.text.substring(0, 300) + '...';
            
            // Note: Since we don't have Gemini API key yet, this is the raw matched text.
            answerHTML = `
                <div class="chat-question">प्रश्न: ${question}</div>
                <div class="chat-answer">
                    <p style="color:#fbbf24; font-size:0.8rem; margin-bottom:10px;">[Offline Search Mode: Gemini API Not Configured]</p>
                    <p><strong>Raw Rule Extract:</strong> ${snippet}</p>
                </div>
                <div class="chat-meta">
                    Page Number: ${topResult.page}
                </div>
            `;
        } else {
            answerHTML = `
                <div class="chat-question">प्रश्न: ${question}</div>
                <div class="chat-answer">
                    <p>माफ करा, या प्रश्नासाठी PDF मध्ये कोणताही संबंधित नियम सापडला नाही.</p>
                </div>
            `;
        }
        
        card.innerHTML = answerHTML;
    }

    askBtn.addEventListener('click', async () => {
        const q = searchInput.value.trim();
        if (q) {
            askBtn.disabled = true;
            await addChatCard(q);
            searchInput.value = '';
            askBtn.disabled = false;
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            askBtn.click();
        }
    });

    // --- Voice Input (Web Speech API) ---
    voiceBtn.addEventListener('click', () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice input is not supported in your browser. Please try Chrome.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'mr-IN'; // Default to Marathi for testing
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        voiceBtn.style.color = '#ef4444'; // Red mic while listening
        
        recognition.start();

        recognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            searchInput.value = speechResult;
            voiceBtn.style.color = '#f8fafc'; // Reset
        };

        recognition.onspeechend = () => {
            recognition.stop();
            voiceBtn.style.color = '#f8fafc';
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error detected: ' + event.error);
            voiceBtn.style.color = '#f8fafc';
        };
    });
});
