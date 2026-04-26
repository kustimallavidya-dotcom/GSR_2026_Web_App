import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const splashScreen = document.getElementById('splash-screen');
    const loginScreen = document.getElementById('login-screen');
    const homeScreen = document.getElementById('home-screen');
    
    const splashText = document.getElementById('splash-text');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');
    
    const searchInput = document.getElementById('search-input');
    const askBtn = document.getElementById('ask-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const chatHistory = document.getElementById('chat-history');

    // --- State ---
    let genAI = null;
    let model = null;

    // --- Initialization ---
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        initGemini(savedKey);
    }

    function initGemini(key) {
        try {
            genAI = new GoogleGenerativeAI(key);
            model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            return true;
        } catch (e) {
            console.error("Gemini init failed:", e);
            return false;
        }
    }

    // --- Splash Screen Logic ---
    const textToType = "G&SR 2026";
    let typeIndex = 0;

    function typeWriter() {
        if (typeIndex < textToType.length) {
            splashText.innerHTML += textToType.charAt(typeIndex);
            typeIndex++;
            setTimeout(typeWriter, 150);
        } else {
            // Typing done, wait a bit then check login
            setTimeout(() => {
                splashScreen.classList.remove('active');
                setTimeout(() => {
                    splashScreen.classList.add('hidden');
                    
                    if (localStorage.getItem('gemini_api_key')) {
                        // Go direct to home
                        homeScreen.classList.remove('hidden');
                        setTimeout(() => homeScreen.classList.add('active'), 50);
                    } else {
                        // Go to login/config
                        loginScreen.classList.remove('hidden');
                        setTimeout(() => loginScreen.classList.add('active'), 50);
                    }
                }, 500);
            }, 1000);
        }
    }

    setTimeout(typeWriter, 500);

    // --- Login/Config Logic ---
    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key && initGemini(key)) {
            localStorage.setItem('gemini_api_key', key);
            loginScreen.classList.remove('active');
            setTimeout(() => {
                loginScreen.classList.add('hidden');
                homeScreen.classList.remove('hidden');
                setTimeout(() => homeScreen.classList.add('active'), 50);
            }, 500);
        } else {
            alert("Please enter a valid API Key.");
        }
    });

    // --- Home Screen Logic ---
    async function addChatCard(question) {
        const card = document.createElement('div');
        card.className = 'chat-card glass-panel';
        card.innerHTML = `<div class="chat-question">प्रश्न: ${question}</div><div class="chat-answer">शोधत आहे... (Searching offline & analyzing with AI)</div>`;
        chatHistory.prepend(card);
        
        try {
            // 1. Offline Database Search
            let results = [];
            if (window.searchRules) {
                results = await window.searchRules(question);
            }
            
            if (!results || results.length === 0) {
                card.innerHTML = `
                    <div class="chat-question">प्रश्न: ${question}</div>
                    <div class="chat-answer">
                        <p>माफ करा, या प्रश्नासाठी PDF मध्ये कोणताही संबंधित नियम सापडला नाही.</p>
                    </div>
                `;
                return;
            }

            const topResult = results[0];
            const ruleContext = topResult.text;
            const pageNum = topResult.page;

            // 2. AI Processing
            const prompt = `
You are a strict Railway Rule Assistant based on the G&SR 2026 PDF.
Do NOT use external knowledge. Use ONLY the following PDF rule content to answer the user's question.

PDF Content Context:
${ruleContext}

User Question: ${question}

Format your response STRICTLY exactly as follows:

उत्तर:
<Answer in Marathi based ONLY on the content>
<Answer in Hindi based ONLY on the content>
<Answer in English based ONLY on the content>

Rule Number: <Extract the rule number from the text if present, else write "Not specifically numbered">
Page Number: ${pageNum}
`;

            const result = await model.generateContent(prompt);
            const aiResponseText = result.response.text();
            
            // Format output safely (convert newlines to <br>)
            const formattedOutput = aiResponseText.replace(/\n/g, '<br>');

            card.innerHTML = `
                <div class="chat-question">प्रश्न: ${question}</div>
                <div class="chat-answer" style="margin-top: 10px;">
                    ${formattedOutput}
                </div>
            `;
            
        } catch (error) {
            console.error("Error generating answer:", error);
            card.innerHTML = `
                <div class="chat-question">प्रश्न: ${question}</div>
                <div class="chat-answer" style="color:#ef4444;">
                    <p>AI सोबत कनेक्ट करण्यात अडचण आली. कृपया तुमची API Key तपासा.</p>
                </div>
            `;
        }
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

    // --- Voice Input ---
    voiceBtn.addEventListener('click', () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice input is not supported in your browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'mr-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        voiceBtn.style.color = '#ef4444'; 
        
        recognition.start();

        recognition.onresult = (event) => {
            searchInput.value = event.results[0][0].transcript;
            voiceBtn.style.color = '#f8fafc';
        };

        recognition.onspeechend = () => {
            recognition.stop();
            voiceBtn.style.color = '#f8fafc';
        };

        recognition.onerror = () => {
            voiceBtn.style.color = '#f8fafc';
        };
    });
});
