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
                        homeScreen.classList.remove('hidden');
                        setTimeout(() => homeScreen.classList.add('active'), 50);
                    } else {
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
        card.innerHTML = `<div class="chat-question">प्रश्न: ${question}</div><div class="chat-answer">शोधत आहे... (Translating query & analyzing rules...)</div>`;
        chatHistory.prepend(card);
        
        try {
            // 1. Translate User Query into English Keywords for Offline Search
            let searchKeywords = question;
            if (model) {
                const keywordPrompt = `Translate the essence of this query into 2-3 English root words separated by spaces. This will be used to search an English Railway PDF document. Examples: If query is "पॉइनसतस्मान ड्युटीवर झोप काढत असल्यास", return "pointsman sleep duty". If query is "सिग्नल लाल असताना", return "signal danger red". 
Query: ${question}
Return ONLY the English keywords.`;
                const keywordResult = await model.generateContent(keywordPrompt);
                searchKeywords = keywordResult.response.text().trim();
                console.log("English Search Keywords: ", searchKeywords);
            }

            // 2. Offline Database Search using translated keywords
            let results = [];
            if (window.searchRules) {
                results = await window.searchRules(searchKeywords);
            }
            
            if (!results || results.length === 0) {
                // If offline search fails, maybe the wording was too strict. 
                // Let's ask Gemini if it knows generally based on its training, but mention it's an AI answer, not direct PDF match.
                const fallbackPrompt = `
You are a strict Railway Rule Assistant. The user asked: "${question}".
We couldn't find the exact match in our local PDF search index. 
Based on standard Indian Railways G&SR rules, answer this question strictly in this format:

उत्तर:
<Answer in Marathi>
<Answer in Hindi>
<Answer in English>

Rule Number: <General Rule number if you know it, otherwise say "Not found in local PDF">
`;
                const fallbackResult = await model.generateContent(fallbackPrompt);
                const fallbackText = fallbackResult.response.text().replace(/\n/g, '<br>');

                card.innerHTML = `
                    <div class="chat-question">प्रश्न: ${question}</div>
                    <div class="chat-answer" style="margin-top: 10px;">
                        <p style="color:#fbbf24; font-size:0.8rem; margin-bottom:10px;">[PDF मधून थेट शब्द न सापडल्याने AI च्या जनरल माहितीनुसार उत्तर दिले आहे]</p>
                        ${fallbackText}
                    </div>
                `;
                return;
            }

            // If we found results, combine the top 3 results for better context
            let combinedContext = "";
            let pageNum = results[0].page;
            for(let i=0; i < Math.min(3, results.length); i++) {
                combinedContext += results[i].text + "\n\n";
            }

            // 3. AI Processing
            const prompt = `
You are a strict Railway Rule Assistant based on the G&SR 2026 PDF.
Use ONLY the following PDF rule content context to answer the user's question.

PDF Content Context:
${combinedContext}

User Question: ${question}

Format your response STRICTLY exactly as follows:

उत्तर:
<Answer in Marathi based ONLY on the content>
<Answer in Hindi based ONLY on the content>
<Answer in English based ONLY on the content>

Rule Number: <Extract the specific rule number from the text if present, else write "Not specifically numbered">
Page Number: ${pageNum}
`;

            const result = await model.generateContent(prompt);
            const aiResponseText = result.response.text();
            
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
