// API Base URL
const API_BASE = window.location.origin;

// State
let currentSessionId = null;
let sessions = [];
let documents = [];
let currentUser = null;

// Get currently selected response language
function getSelectedLanguage() {
    const sel = document.getElementById('languageSelect');
    return sel ? sel.value : (localStorage.getItem('preferredLanguage') || 'English');
}

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No token found, redirecting to signin');
        window.location.href = '/signin';
        return false;
    }
    return token;
}

// API Headers with auth
function getHeaders() {
    const token = checkAuth();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Get user initials from name or email
function getInitials(name, email) {
    if (name && name.trim()) {
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    if (email) {
        return email.substring(0, 2).toUpperCase();
    }
    return 'U';
}

// Load user profile
async function loadUserProfile() {
    try {
        const userEmail = localStorage.getItem('userEmail');
        const userName = localStorage.getItem('userName');
        
        if (!userEmail) {
            console.warn('No user email found in localStorage');
            return;
        }
        
        currentUser = {
            email: userEmail,
            username: userName || userEmail.split('@')[0]
        };
        
        // Update UI with user info
        const initials = getInitials(currentUser.username, currentUser.email);
        
        // Update avatar initials
        document.getElementById('userInitials').textContent = initials;
        document.getElementById('dropdownInitials').textContent = initials;
        
        // Update dropdown user info
        document.getElementById('dropdownUsername').textContent = currentUser.username;
        document.getElementById('dropdownEmail').textContent = currentUser.email;
        
        console.log('User profile loaded:', currentUser);
        
    } catch (error) {
        console.error('Load user profile error:', error);
    }
}

// Toggle dropdown menu
function toggleDropdown() {
    const dropdown = document.getElementById('dropdownMenu');
    const overlay = document.getElementById('dropdownOverlay');
    
    console.log('Toggle dropdown called');
    console.log('Dropdown element:', dropdown);
    console.log('Overlay element:', overlay);
    
    if (!dropdown || !overlay) {
        console.error('Dropdown or overlay not found!');
        return;
    }
    
    const isOpen = dropdown.classList.contains('show');
    console.log('Is dropdown open?', isOpen);
    
    if (isOpen) {
        closeDropdown();
    } else {
        dropdown.classList.add('show');
        overlay.classList.add('show');
        console.log('Dropdown opened');
    }
}

function closeDropdown() {
    const dropdown = document.getElementById('dropdownMenu');
    const overlay = document.getElementById('dropdownOverlay');
    
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    if (overlay) {
        overlay.classList.remove('show');
    }
    
    console.log('Dropdown closed');
}

// PDF Functions
async function loadDocuments() {
    try {
        console.log('Loading documents...');
        const response = await fetch(`${API_BASE}/api/pdf/documents`, {
            headers: getHeaders()
        });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/signin';
            return;
        }
        
        if (response.ok) {
            documents = await response.json();
            console.log('Documents loaded:', documents.length);
            renderDocuments();
        }
    } catch (error) {
        console.error('Load documents error:', error);
    }
}

function renderDocuments() {
    const documentsList = document.getElementById('documentsList');
    
    if (documents.length === 0) {
        documentsList.innerHTML = '<div class="empty-documents">No documents uploaded yet</div>';
        return;
    }
    
    documentsList.innerHTML = documents.map(doc => `
        <div class="document-item">
            <div>
                <div class="document-name" title="${doc.filename}">📄 ${doc.filename}</div>
                <div class="document-info">${doc.chunks_count} chunks</div>
            </div>
            <button class="document-delete" onclick="deleteDocument('${doc.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" 
                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    `).join('');
}

async function uploadPDF(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const documentsList = document.getElementById('documentsList');
        documentsList.insertAdjacentHTML('afterbegin', `
            <div class="upload-progress" id="uploadProgress">
                <div class="upload-progress-bar">
                    <div class="upload-progress-fill" style="width: 50%"></div>
                </div>
                <div class="upload-progress-text">Uploading ${file.name}...</div>
            </div>
        `);
        
        const response = await fetch(`${API_BASE}/api/pdf/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${checkAuth()}`
            },
            body: formData
        });
        
        document.getElementById('uploadProgress')?.remove();
        
        if (response.ok) {
            const data = await response.json();
            console.log('PDF uploaded:', data);
            alert(`✅ ${data.filename} uploaded! Processed ${data.chunks_count} chunks.`);
            await loadDocuments();
        } else {
            const error = await response.json();
            alert(`❌ Upload failed: ${error.detail}`);
        }
    } catch (error) {
        document.getElementById('uploadProgress')?.remove();
        console.error('Upload error:', error);
        alert('❌ Upload failed. Check console for details.');
    }
}

async function deleteDocument(documentId) {
    if (!confirm('Delete this document? It will no longer be used for answers.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/pdf/document/${documentId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            console.log('Document deleted');
            await loadDocuments();
        } else {
            const error = await response.json();
            alert(`❌ Delete failed: ${error.detail}`);
        }
    } catch (error) {
        console.error('Delete document error:', error);
    }
}

// Chat Functions
async function loadSessions() {
    try {
        console.log('Loading sessions...');
        const response = await fetch(`${API_BASE}/api/chat/sessions`, {
            headers: getHeaders()
        });
        
        console.log('Sessions response status:', response.status);
        
        if (response.status === 401) {
            console.error('Unauthorized - token expired or invalid');
            alert('Your session has expired. Please login again.');
            localStorage.removeItem('token');
            window.location.href = '/signin';
            return;
        }
        
        if (response.ok) {
            sessions = await response.json();
            console.log('Sessions loaded:', sessions.length);
            renderSessions();
        } else {
            console.error('Failed to load sessions:', await response.text());
        }
    } catch (error) {
        console.error('Load sessions error:', error);
    }
}

function renderSessions() {
    const sessionsList = document.getElementById('sessionsList');
    
    if (sessions.length === 0) {
        sessionsList.innerHTML = '<div class="empty-sessions">No chat history yet.<br>Start a new conversation!</div>';
        return;
    }
    
    sessionsList.innerHTML = sessions.map(session => `
        <div class="session-item ${session.id === currentSessionId ? 'active' : ''}" 
             onclick="loadSession('${session.id}')">
            <span class="session-title">${session.title}</span>
            <button class="session-delete" onclick="deleteSession(event, '${session.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" 
                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    `).join('');
}

async function loadSession(sessionId) {
    console.log('Loading session:', sessionId);
    currentSessionId = sessionId;
    renderSessions();
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/session/${sessionId}`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const session = await response.json();
            console.log('Session loaded with', session.messages.length, 'messages');
            renderMessages(session.messages);
        } else {
            console.error('Failed to load session:', await response.text());
        }
    } catch (error) {
        console.error('Load session error:', error);
    }
}

async function deleteSession(event, sessionId) {
    event.stopPropagation();
    
    if (!confirm('Delete this conversation?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/session/${sessionId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            console.log('Session deleted:', sessionId);
            if (currentSessionId === sessionId) {
                currentSessionId = null;
                clearMessages();
            }
            await loadSessions();
        } else {
            console.error('Delete failed:', await response.text());
        }
    } catch (error) {
        console.error('Delete session error:', error);
    }
}

function renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    const welcomeMsg = document.getElementById('welcomeMessage');
    
    if (welcomeMsg) {
        welcomeMsg.style.display = 'none';
    }
    
    container.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
    scrollToBottom();
}

function createMessageHTML(message) {
    const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const avatar = message.role === 'user' ? '👤' : '🤖';
    const { msgId } = message;
    
    let content = escapeHtml(message.content);
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    let extraHTML = '';
    let messageClass = message.role;
    
    // Emergency Handling UI
    if (message.is_emergency) {
        messageClass += ' emergency-msg';
        extraHTML += `
            <div style="margin-top: 15px; display:flex; gap:10px;">
                <button onclick="window.open('https://www.google.com/maps/search/hospitals+near+me', '_blank')" style="background:#ef4444; color:white; padding:8px 12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">🏥 Find Nearby Hospital</button>
                <button onclick="window.location.href='tel:911'" style="background:#1e293b; color:white; padding:8px 12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📞 Call Emergency (911)</button>
            </div>
        `;
    }
    
    // Source Citations UI
    if (message.sources && message.sources.length > 0) {
        extraHTML += '<div class="sources-container" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">';
        message.sources.forEach((src, idx) => {
            const srcStr = encodeURIComponent(JSON.stringify(src));
            extraHTML += `<button onclick="window.openSourceModal('${srcStr}')" style="background:#e0e7ff; color:#3730a3; padding:4px 10px; border:1px solid #c7d2fe; border-radius:15px; font-size:0.8rem; cursor:pointer; font-weight:500;">🔍 ${src.file || 'Source'} (Page ${src.page || '?'})</button>`;
        });
        extraHTML += '</div>';
    }

    // Per-message Read Aloud button for assistant messages
    if (message.role === 'assistant' && msgId) {
        extraHTML += `<button id="read-${msgId}" class="btn-read-aloud" aria-label="Read this response aloud">🔊 Read Aloud</button>`;
    }
    
    return `
        <div class="message ${messageClass}" role="article" aria-label="${message.role === 'user' ? 'Your message' : 'Assistant response'}">
            <div class="message-avatar" aria-hidden="true">${avatar}</div>
            <div class="message-content">
                <div class="message-text" aria-live="${message.role === 'assistant' ? 'polite' : 'off'}">${content}</div>
                ${extraHTML}
                <div class="message-time" aria-label="Sent at ${time}">${time}</div>
            </div>
        </div>
    `;
}

// =============================================
// TTS — Simple Reliable Implementation
// Works by queuing short utterances natively.
// The Read Aloud button (user click) is the
// guaranteed path; auto-read queues immediately.
// =============================================

const TTS = {
    synth: window.speechSynthesis || null,
    voices: [],
    activeBtnEl: null,
    _isSpeaking: false,

    /** Strip markdown/emoji so text sounds natural when spoken */
    cleanText(raw) {
        return raw
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/#{1,6}\s/g, '')
            .replace(/`[^`]*`/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
            .replace(/[🚨♿🔊▶⏹🎤🏥📞🔍📚✅❌⚠️]/g, '')
            .replace(/_{2,}/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    },

    /** Load system voices into the selector dropdown */
    loadVoices() {
        if (!this.synth) return;
        this.voices = this.synth.getVoices();
        const sel = document.getElementById('voiceSelect');
        if (!sel) return;
        if (this.voices.length === 0) return;
        sel.innerHTML = '<option value="">🔊 Default Voice</option>';
        this.voices.forEach((v, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${v.name} (${v.lang})`;
            sel.appendChild(opt);
        });
        const saved = localStorage.getItem('ttsVoiceIndex');
        if (saved !== null) sel.value = saved;
    },

    getRate() {
        const sl = document.getElementById('rateSlider');
        return sl ? parseFloat(sl.value) : 1.0;
    },

    getVoice() {
        const sel = document.getElementById('voiceSelect');
        if (!sel || sel.value === '') return null;
        return this.voices[parseInt(sel.value)] || null;
    },

    isAutoRead() {
        const toggle = document.getElementById('autoReadToggle');
        return toggle ? toggle.checked : true;
    },

    _showSpeaking(btnEl) {
        this._isSpeaking = true;
        this.activeBtnEl = btnEl || null;
        if (btnEl) { btnEl.classList.add('speaking'); btnEl.textContent = '⏸ Speaking...'; }
        const badge = document.getElementById('ttsSpeakingBadge');
        if (badge) badge.style.display = 'inline-flex';
    },

    _hideSpeaking() {
        this._isSpeaking = false;
        const badge = document.getElementById('ttsSpeakingBadge');
        if (badge) badge.style.display = 'none';
        if (this.activeBtnEl) {
            this.activeBtnEl.classList.remove('speaking');
            this.activeBtnEl.innerHTML = '🔊 Read Aloud';
        }
        this.activeBtnEl = null;
    },

    /**
     * Core speak function.
     * Splits text into sentence chunks and queues them all at once
     * using the native synth queue — NO setTimeout, NO keepalive needed.
     * This works reliably because:
     *  - All speak() calls happen synchronously before any await
     *  - Chrome's native queue handles sequential chunks automatically
     *  - The cancel() + immediate speak() chain is the only reliable pattern
     */
    speak(text, btnEl) {
        if (!this.synth) {
            alert('Your browser does not support Text-to-Speech. Please use Chrome or Edge.');
            return;
        }

        // Cancel any current speech
        this.synth.cancel();

        const clean = this.cleanText(text);
        if (!clean) return;

        // Split into sentence chunks (~200 chars each)
        const sentences = (clean.match(/[^.!?]+[.!?]*/g) || [clean]);
        const chunks = [];
        let buf = '';
        for (const s of sentences) {
            if (buf.length + s.length > 200) {
                if (buf.trim()) chunks.push(buf.trim());
                buf = s;
            } else {
                buf += s;
            }
        }
        if (buf.trim()) chunks.push(buf.trim());
        if (chunks.length === 0) chunks.push(clean);

        this._showSpeaking(btnEl);

        // Push all chunks to the native queue — they play one after another automatically
        const voice = this.getVoice();
        const rate  = this.getRate();

        chunks.forEach((chunk, i) => {
            const utt = new SpeechSynthesisUtterance(chunk);
            utt.rate  = rate;
            utt.pitch = 1.0;
            if (voice) utt.voice = voice;

            // Only the LAST chunk triggers the "done" callback
            if (i === chunks.length - 1) {
                utt.onend   = () => this._hideSpeaking();
                utt.onerror = (e) => {
                    if (e.error !== 'interrupted') this._hideSpeaking();
                };
            }
            this.synth.speak(utt);
        });

        // Push response to screen-reader live region for NVDA/JAWS/VoiceOver
        const sr = document.getElementById('srLiveRegion');
        if (sr) { sr.textContent = ''; setTimeout(() => { sr.textContent = clean; }, 80); }
    },

    stop() {
        if (!this.synth) return;
        this.synth.cancel();
        this._hideSpeaking();
    }
};

function speakText(text) {
    if (TTS.isAutoRead()) TTS.speak(text, null);
}

// ─── Browser Autoplay Permission Guard ────────────────────────────────────
// Chrome/Edge block speechSynthesis unless it's triggered within a user
// gesture (click/keypress). We track whether audio has been 'unlocked' and
// warm it up on the first send so auto-read works immediately after.
let _audioUnlocked = false;

function warmUpAudio() {
    if (_audioUnlocked || !window.speechSynthesis) return;
    // Speak a silent (zero-length pause) utterance to unlock the audio context
    // inside the click event handler so the browser considers it user-initiated
    const silent = new SpeechSynthesisUtterance(' ');
    silent.volume = 0;   // completely silent - user won't hear anything
    silent.rate   = 10;  // finish instantly
    silent.onend  = () => { _audioUnlocked = true; };
    window.speechSynthesis.cancel(); // clear any queue
    window.speechSynthesis.speak(silent);
    _audioUnlocked = true;
}
function addMessage(role, content, sources=[], is_emergency=false) {
    const container = document.getElementById('messagesContainer');
    const welcomeMsg = document.getElementById('welcomeMessage');
    
    if (welcomeMsg) {
        welcomeMsg.style.display = 'none';
    }
    
    // Create a unique ID for each assistant message for per-message TTS
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    
    const messageHTML = createMessageHTML({
        role,
        content,
        timestamp: new Date().toISOString(),
        sources,
        is_emergency,
        msgId
    });
    
    container.insertAdjacentHTML('beforeend', messageHTML);
    
    // Bind per-message read-aloud button
    if (role === 'assistant') {
        const readBtn = document.getElementById(`read-${msgId}`);
        if (readBtn) {
            readBtn.addEventListener('click', () => {
                // User click = fresh user gesture = always works in Chrome
                if (TTS._isSpeaking && TTS.activeBtnEl === readBtn) {
                    TTS.stop();
                } else {
                    TTS.stop(); // cancel any other speech first
                    TTS.speak(content, readBtn);
                }
            });
        }
    }
    
    scrollToBottom();
}

function showTyping() {
    const container = document.getElementById('messagesContainer');
    const typingHTML = `
        <div class="message assistant" id="typingIndicator">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', typingHTML);
    scrollToBottom();
}

function hideTyping() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

async function sendMessage(message) {
    console.log('Sending message:', message);
    
    // ============================================================
    // CHROME AUTOPLAY FIX — THE ONLY RELIABLE APPROACH:
    // Chrome's "Transient User Activation" expires ~5 seconds after
    // a click. Since LLM responses take longer, we MUST start an
    // audible speech utterance SYNCHRONOUSLY inside this click handler
    // BEFORE any `await`. This permanently unlocks speechSynthesis
    // for the rest of this page session.
    // ============================================================
    const synth = window.speechSynthesis;
    let autoReadEnabled = TTS.isAutoRead() && synth;
    
    if (autoReadEnabled) {
        synth.cancel();
        const primer = new SpeechSynthesisUtterance('Thinking...');
        primer.rate   = 1.1;
        primer.volume = 0.8;
        synth.speak(primer);
        // Audio context is now unlocked for ALL future synth.speak() calls
    }
    
    addMessage('user', message);
    showTyping();
    
    const sendBtn     = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    sendBtn.disabled  = true;
    
    try {
        const requestBody = {
            message,
            session_id: currentSessionId,
            target_language: getSelectedLanguage()
        };
        
        const response = await fetch(`${API_BASE}/api/chat/message`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(requestBody)
        });
        
        hideTyping();
        
        if (response.ok) {
            const data = await response.json();
            addMessage('assistant', data.response, data.sources, data.is_emergency);
            
            if (autoReadEnabled) {
                // Cancel "Thinking..." and speak the real response.
                // Works because the audio context was unlocked above.
                synth.cancel();
                TTS.speak(data.response, null);
            }
            
            if (!currentSessionId) {
                currentSessionId = data.session_id;
                await loadSessions();
            }
        } else {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            if (autoReadEnabled) synth.cancel(); // stop "Thinking..."
            
            if (response.status === 401) {
                alert('Your session has expired. Please login again.');
                localStorage.removeItem('token');
                window.location.href = '/signin';
            } else {
                addMessage('assistant', `❌ Sorry, I encountered an error: ${errorText}`);
            }
        }
    } catch (error) {
        hideTyping();
        if (autoReadEnabled) synth.cancel();
        console.error('Send message error:', error);
        addMessage('assistant', `❌ Network error: ${error.message}`);
    } finally {
        sendBtn.disabled    = false;
        messageInput.value  = '';
        messageInput.style.height = 'auto';
    }
}

function clearMessages() {
    const container = document.getElementById('messagesContainer');
    const welcomeMsg = document.getElementById('welcomeMessage');
    
    container.innerHTML = '';
    if (welcomeMsg) {
        container.appendChild(welcomeMsg);
        welcomeMsg.style.display = 'block';
    }
}

function newChat() {
    console.log('Starting new chat');
    currentSessionId = null;
    clearMessages();
    renderSessions();
    document.getElementById('messageInput').focus();
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function logout() {
    console.log('Logging out');
    closeDropdown();
    
    // Clear all user data
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    
    // Redirect to signin
    window.location.href = '/signin';
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Chat page loaded');
    console.log('Token exists:', !!localStorage.getItem('token'));
    
    checkAuth();
    
    // Load user profile first
    loadUserProfile();
    
    // Load sessions and documents
    loadSessions();
    loadDocuments();
    
    // User avatar click handler - FIXED
    const userAvatarBtn = document.getElementById('userAvatarBtn');
    if (userAvatarBtn) {
        userAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Avatar clicked');
            toggleDropdown();
        });
    }
    
    // Profile button click handler - NEW
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            console.log('Profile button clicked');
            closeDropdown();
            window.location.href = '/profile';
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Close dropdown when clicking overlay
    const overlay = document.getElementById('dropdownOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeDropdown);
    }
    
    // PDF upload handler
    document.getElementById('pdfUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadPDF(file);
            e.target.value = '';
        }
    });

    // Language selector initialization
    const languageSelect = document.getElementById('languageSelect');
    const langActiveBadge = document.getElementById('langActiveBadge');
    if (languageSelect) {
        // Restore saved preference
        const savedLang = localStorage.getItem('preferredLanguage') || 'English';
        languageSelect.value = savedLang;
        if (savedLang !== 'English') {
            langActiveBadge.textContent = `Active: ${savedLang}`;
            langActiveBadge.classList.add('visible');
        }

        // Save on change and show confirmation
        languageSelect.addEventListener('change', () => {
            const lang = languageSelect.value;
            localStorage.setItem('preferredLanguage', lang);
            if (lang !== 'English') {
                langActiveBadge.textContent = `Active: ${lang}`;
                langActiveBadge.classList.add('visible');
            } else {
                langActiveBadge.textContent = '';
                langActiveBadge.classList.remove('visible');
            }
            // Notify user with a friendly system message
            addMessage('assistant', `🌐 Language changed to **${lang}**! All future responses will be in ${lang}.`);
        });
    }

    // Source Modal Listeners
    window.openSourceModal = function(srcStr) {
        const src = JSON.parse(decodeURIComponent(srcStr));
        document.getElementById('sourceTitle').innerText = src.file;
        document.getElementById('sourcePage').innerText = src.page;
        document.getElementById('sourceText').innerText = src.text;
        document.getElementById('sourceModal').style.display = 'flex';
    };

    document.getElementById('closeSourceModal')?.addEventListener('click', () => {
        document.getElementById('sourceModal').style.display = 'none';
    });

    // Medical Report handling
    const reportUpload = document.getElementById('reportUpload');
    if (reportUpload) {
        reportUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await uploadReport(file);
                e.target.value = '';
            }
        });
    }

    async function uploadReport(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            addMessage('user', `Uploaded Medical Report: ${file.name}`);
            showTyping();
            
            const response = await fetch(`${API_BASE}/api/report/simplify`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${checkAuth()}` },
                body: formData
            });
            
            hideTyping();
            if (response.ok) {
                const data = await response.json();
                addMessage('assistant', data.explanation);
                speakText("I have analyzed your medical report.");
            } else {
                const error = await response.json();
                addMessage('assistant', `❌ Report upload failed: ${error.detail}`);
            }
        } catch (e) {
            hideTyping();
            addMessage('assistant', `❌ Report upload error: ${e.message}`);
        }
    }

    // Voice Mic handling
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
        let recognition = null;
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRec();
            recognition.continuous = false;
            recognition.interimResults = false;
            
            recognition.onstart = function() {
                micBtn.style.color = 'red';
            };
            
            recognition.onresult = function(event) {
                const transcript = event.results[0][0].transcript;
                document.getElementById('messageInput').value = transcript;
                sendMessage(transcript);
            };
            
            recognition.onerror = function() {
                micBtn.style.color = '';
            };
            
            recognition.onend = function() {
                micBtn.style.color = '';
            };
            
            micBtn.addEventListener('click', () => {
                recognition.start();
            });
        } else {
            micBtn.style.display = 'none';
        }
    }

    // Dashboard navigation
    document.getElementById('dashboardBtn')?.addEventListener('click', () => {
        closeDropdown();
        window.location.href = '/dashboard';
    });
    
    // Chat form
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Form submitted');
        const message = messageInput.value.trim();
        console.log('Message:', message);
        if (message) {
            sendMessage(message);
        } else {
            console.warn('Empty message, not sending');
        }
    });
    
    messageInput.addEventListener('input', () => autoResize(messageInput));
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log('Enter pressed, submitting form');
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
    
    document.getElementById('newChatBtn').addEventListener('click', newChat);
    document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('dropdownMenu');
        const avatar = document.getElementById('userAvatarBtn');
        
        if (dropdown && avatar) {
            if (!dropdown.contains(e.target) && !avatar.contains(e.target)) {
                closeDropdown();
            }
        }
    });
    
    console.log('All event listeners attached');

    // ==================================
    // TTS Engine initialization
    // ==================================
    if ('speechSynthesis' in window) {
        // Voices may load async in some browsers
        TTS.loadVoices();
        window.speechSynthesis.onvoiceschanged = () => TTS.loadVoices();

        // Speed slider
        const rateSlider = document.getElementById('rateSlider');
        const rateValue  = document.getElementById('rateValue');
        if (rateSlider && rateValue) {
            // Restore saved rate
            const savedRate = localStorage.getItem('ttsRate');
            if (savedRate) {
                rateSlider.value = savedRate;
                rateValue.textContent = parseFloat(savedRate).toFixed(1) + '×';
            }
            rateSlider.addEventListener('input', () => {
                const v = parseFloat(rateSlider.value).toFixed(1);
                rateValue.textContent = v + '×';
                rateSlider.setAttribute('aria-valuenow', v);
                localStorage.setItem('ttsRate', rateSlider.value);
            });
        }

        // Voice selector save
        const voiceSelect = document.getElementById('voiceSelect');
        if (voiceSelect) {
            voiceSelect.addEventListener('change', () => {
                localStorage.setItem('ttsVoiceIndex', voiceSelect.value);
            });
        }

        // Stop button
        const stopTtsBtn = document.getElementById('stopTtsBtn');
        if (stopTtsBtn) {
            stopTtsBtn.addEventListener('click', () => TTS.stop());
        }

        // Auto-read toggle persistence
        const autoReadToggle = document.getElementById('autoReadToggle');
        if (autoReadToggle) {
            const savedAutoRead = localStorage.getItem('ttsAutoRead');
            if (savedAutoRead === 'false') autoReadToggle.checked = false;
            autoReadToggle.addEventListener('change', () => {
                localStorage.setItem('ttsAutoRead', autoReadToggle.checked);
                if (!autoReadToggle.checked) TTS.stop();
            });
        }

        // Keyboard shortcut: Alt+S to stop, Alt+R to re-read last message
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 's') { e.preventDefault(); TTS.stop(); }
        });
    } else {
        // Hide TTS toolbar if browser doesn't support speech synthesis
        const toolbar = document.getElementById('ttsToolbar');
        if (toolbar) {
            toolbar.style.display = 'none';
        }
    }
});