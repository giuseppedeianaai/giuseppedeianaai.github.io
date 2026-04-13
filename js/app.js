const API_BASE = 'https://sol.massimilianopili.com/apps/puzzle-verify';
const PUZZLE_ORDER = ['63', '59', '80'];
const STORAGE_KEY = 'puzzleCerts';

function getCerts() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function saveCert(puzzleId, cert) {
    const c = getCerts();
    c[puzzleId] = cert;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

function setCerts(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || {}));
}

async function fetchProgress() {
    if (window.progressPromise) {
        try {
            return await window.progressPromise;
        } catch (e) {
            return null;
        }
    }
    try {
        const res = await fetch(API_BASE + '/progress');
        if (!res.ok) return null;
        return res.json();
    } catch (e) {
        return null;
    }
}

function currentStep() {
    const c = getCerts();
    for (let i = 0; i < PUZZLE_ORDER.length; i++) {
        if (!c[PUZZLE_ORDER[i]]) return i;
    }
    return PUZZLE_ORDER.length;
}

function nextPuzzleUrl() {
    const step = currentStep();
    if (step >= PUZZLE_ORDER.length) return 'reveal.html';
    return 'puzzle/' + PUZZLE_ORDER[step] + '.html';
}

async function renderIndex() {
    const remote = await fetchProgress();
    if (remote && remote.certificates) {
        setCerts(remote.certificates);
    } else {
        setCerts({});
    }
    const certs = getCerts();
    const step = currentStep();
    PUZZLE_ORDER.forEach((id, idx) => {
        const card = document.getElementById('card-' + id);
        if (!card) return;
        if (certs[id]) {
            card.classList.add('solved');
            const status = card.querySelector('.card-status');
            if (status) status.textContent = '✓ Risolto';
        } else if (idx > step) {
            card.style.display = 'none';
        }
    });
    const revealCard = document.getElementById('card-reveal');
    if (revealCard) {
        if (step >= PUZZLE_ORDER.length) {
            revealCard.classList.add('solved');
        } else {
            revealCard.style.display = 'none';
        }
    }
    document.body.classList.remove('loading');
}

async function submitAnswer(puzzleId, answer) {
    const res = await fetch(API_BASE + '/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle_id: puzzleId, answer: answer })
    });
    if (res.status === 429) {
        throw new Error('Troppi tentativi ravvicinati. Riprova tra un minuto.');
    }
    if (!res.ok) {
        throw new Error('Errore di rete (HTTP ' + res.status + ')');
    }
    return res.json();
}

function renderExamples() {
    const span = document.getElementById('format-examples');
    const examples = window.PUZZLE_EXAMPLES;
    if (!span || !Array.isArray(examples) || examples.length === 0) return;
    const pool = examples.slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pick = pool.slice(0, 3);
    while (span.firstChild) span.removeChild(span.firstChild);
    pick.forEach((ex, idx) => {
        if (idx > 0) span.appendChild(document.createTextNode(', '));
        const code = document.createElement('code');
        code.textContent = ex;
        span.appendChild(code);
    });
}

function initPuzzlePage() {
    const puzzleId = window.PUZZLE_ID;
    if (!puzzleId) return;
    renderExamples();
    const form = document.getElementById('answer-form');
    const input = document.getElementById('answer-input');
    const feedback = document.getElementById('feedback');
    const button = form.querySelector('button');

    const certs = getCerts();
    if (certs[puzzleId]) {
        feedback.classList.add('show', 'ok');
        feedback.textContent = 'Enigma già risolto. Certificato: ' + certs[puzzleId].slice(0, 16) + '…';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const answer = input.value.trim();
        if (!answer) return;
        button.disabled = true;
        feedback.className = 'feedback';
        try {
            const result = await submitAnswer(puzzleId, answer);
            if (result.ok) {
                saveCert(puzzleId, result.certificate);
                feedback.classList.add('show', 'ok');
                feedback.textContent = 'Corretto. Certificato ottenuto. Torno all\'indice…';
                setTimeout(() => { window.location.href = '../index.html'; }, 1400);
            } else {
                feedback.classList.add('show', 'err');
                feedback.textContent = 'Risposta non corretta. Riprova.';
                button.disabled = false;
            }
        } catch (err) {
            feedback.classList.add('show', 'err');
            feedback.textContent = err.message;
            button.disabled = false;
        }
    });
}

function renderCredentials(container, creds) {
    while (container.firstChild) container.removeChild(container.firstChild);
    if (!Array.isArray(creds) || creds.length === 0) return;
    const title = document.createElement('div');
    title.className = 'credentials-title';
    title.textContent = 'Credenziali Google (SSO per GitHub e Cloudflare)';
    container.appendChild(title);
    creds.forEach(function (pair) {
        if (!Array.isArray(pair) || pair.length !== 2) return;
        const row = document.createElement('div');
        row.className = 'cred-row';

        const label = document.createElement('span');
        label.className = 'cred-label';
        label.textContent = pair[0];

        const value = document.createElement('code');
        value.className = 'cred-value';
        value.textContent = pair[1];

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cred-copy';
        btn.textContent = 'copia';
        btn.addEventListener('click', async function () {
            try {
                await navigator.clipboard.writeText(pair[1]);
                btn.textContent = 'copiato ✓';
                setTimeout(function () { btn.textContent = 'copia'; }, 1500);
            } catch (e) {
                btn.textContent = 'errore';
            }
        });

        row.appendChild(label);
        row.appendChild(value);
        row.appendChild(btn);
        container.appendChild(row);
    });
    container.style.display = 'block';
}

async function initRevealPage() {
    const content = document.getElementById('reveal-content');
    const credsContainer = document.getElementById('reveal-credentials');
    const status = document.getElementById('reveal-status');
    status.textContent = 'Decrittazione del messaggio in corso…';
    try {
        const res = await fetch(API_BASE + '/reveal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        const data = await res.json();
        if (data.unlock) {
            status.textContent = '';
            content.textContent = data.payload;
            content.style.display = 'block';
            renderCredentials(credsContainer, data.credentials);
        } else {
            const missing = PUZZLE_ORDER.length - PUZZLE_ORDER.filter(id => (getCerts())[id]).length;
            status.textContent = 'Devi prima risolvere tutti gli enigmi. Ne mancano ' + missing + '.';
        }
    } catch (err) {
        status.textContent = 'Errore: ' + err.message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'index') renderIndex();
    if (document.body.dataset.page === 'puzzle') initPuzzlePage();
    if (document.body.dataset.page === 'reveal') initRevealPage();
});
