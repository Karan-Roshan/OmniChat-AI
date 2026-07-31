const questionInput = document.getElementById('questionInput');
const sendButton = document.getElementById('sendButton');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatScreen = document.getElementById('chatScreen');
const chatMessages = document.getElementById('chatMessages');
const chatHistory = document.getElementById('chatHistory');
const newChatBtn = document.getElementById('newChatBtn');

let conversation = [];
let currentConversationId = null;

const USER_AVATAR_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>`;

const ASSISTANT_AVATAR_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="8" width="16" height="12" rx="2" />
    <path d="M12 8V4" />
    <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
    <line x1="9" y1="13" x2="9" y2="15" />
    <line x1="15" y1="13" x2="15" y2="15" />
    <path d="M4 13H2" />
    <path d="M22 13h-2" />
  </svg>`;

questionInput.addEventListener('input', () => {
  sendButton.disabled = questionInput.value.trim() === '';
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 180) + 'px';
});

questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendButton.disabled) sendMessage();
  }
});

sendButton.addEventListener('click', sendMessage);

newChatBtn.addEventListener('click', () => {
  chatMessages.innerHTML = '';
  chatScreen.classList.remove('visible');
  welcomeScreen.classList.remove('hidden');
  questionInput.value = '';
  questionInput.style.height = 'auto';
  sendButton.disabled = true;
  conversation = [];
  currentConversationId = null;
});

function fillInput(el) {
  const text = el.textContent.replace(' →', '').trim();
  questionInput.value = text;
  questionInput.dispatchEvent(new Event('input'));
  questionInput.focus();
}

function sendMessage() {
  const text = questionInput.value.trim();
  if (!text) return;

  welcomeScreen.classList.add('hidden');
  chatScreen.classList.add('visible');

  appendMessage('user', text);

  questionInput.value = '';
  questionInput.style.height = 'auto';
  sendButton.disabled = true;

  const typingEl = appendTyping();
  const historyForRequest = conversation.slice();
  const isNewConversation = !currentConversationId;

  fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: text, history: historyForRequest, conversation_id: currentConversationId })
  })
    .then(r => r.json())
    .then(data => {
      typingEl.remove();
      const answer = data.answer || data.response || data.message || 'No response received.';
      appendMessage('assistant', answer);
      conversation.push({ role: 'user', content: text });
      conversation.push({ role: 'assistant', content: answer });
      currentConversationId = data.conversation_id || currentConversationId;
      if (isNewConversation) {
        addHistoryItem(text, currentConversationId);
      }
    })
    .catch(() => {
      typingEl.remove();
      appendMessage('assistant', 'Something went wrong. Please try again.');
    });
}

function capitalizeFirst(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function addHistoryItem(question, id) {
  const item = document.createElement('div');
  item.className = 'chat-item';
  if (id) item.dataset.id = id;
  item.innerHTML = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
  <span></span>
  <button class="chat-delete-btn" title="Delete">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  </button>`;
  item.querySelector('span').textContent = capitalizeFirst(question);
  chatHistory.insertBefore(item, chatHistory.firstChild);
}

chatHistory.addEventListener('click', (e) => {
  const item = e.target.closest('.chat-item');
  if (!item) return;

  const deleteBtn = e.target.closest('.chat-delete-btn');
  if (deleteBtn) {
    const id = item.dataset.id;
    if (!id) {
      item.remove();
      return;
    }
    fetch(`/chat/${id}`, { method: 'DELETE' })
      .then(r => {
        if (r.ok) item.remove();
      });
    return;
  }

  const id = item.dataset.id;
  if (!id) return;

  fetch(`/chat/${id}`)
    .then(r => r.json())
    .then(data => {
      const messages = data.messages || [];
      if (!messages.length) return;

      welcomeScreen.classList.add('hidden');
      chatScreen.classList.add('visible');
      chatMessages.innerHTML = '';
      messages.forEach(m => appendMessage(m.role === 'assistant' ? 'assistant' : 'user', m.content));

      conversation = messages.map(m => ({ role: m.role, content: m.content }));
      currentConversationId = id;
      questionInput.focus();
    });
});

function appendMessage(role, text) {
  const msg = document.createElement('div');
  msg.className = `message ${role} fade-in`;
  const content = role === 'assistant' ? renderMarkdown(text) : escapeHtml(text);
  msg.innerHTML = `
  <div class="message-inner">
    <div class="avatar ${role}">${role === 'user' ? USER_AVATAR_ICON : ASSISTANT_AVATAR_ICON}</div>
    <div class="message-content">${content}</div>
  </div>`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

function appendTyping() {
  const msg = document.createElement('div');
  msg.className = 'message assistant fade-in';
  msg.innerHTML = `
  <div class="message-inner">
    <div class="avatar assistant">${ASSISTANT_AVATAR_ICON}</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  </div>`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

function escapeText(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return escapeText(str).replace(/\n/g, '<br>');
}

// Renders a small, safe subset of markdown (headings, bold/italic, inline
// code, links, lists) into HTML. All text is HTML-escaped before any tags
// are introduced, so raw model output can never inject markup.
function renderInline(line) {
  let s = escapeText(line);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

function renderMarkdown(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let listType = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html += `<p>${paragraph.join('<br>')}</p>`;
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    const fenceMatch = line.match(/^```(\S*)$/);
    if (fenceMatch) {
      flushParagraph();
      closeList();
      const codeLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      html += `<pre><code>${escapeText(codeLines.join('\n'))}</code></pre>`;
      continue;
    }

    if (line === '') {
      flushParagraph();
      closeList();
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      html += `<h${level}>${renderInline(headingMatch[2])}</h${level}>`;
      i++;
      continue;
    }

    if (/^[-=]{3,}$/.test(line)) {
      flushParagraph();
      closeList();
      html += '<hr>';
      i++;
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li>${renderInline(ulMatch[1])}</li>`;
      i++;
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
      html += `<li>${renderInline(olMatch[1])}</li>`;
      i++;
      continue;
    }

    closeList();
    paragraph.push(renderInline(line));
    i++;
  }

  flushParagraph();
  closeList();
  return html;
}
