import { CrmIntegrationModule } from './modules/crmIntegration.js';
import { OnlinePresenceController } from './modules/onlinePresence.js';
import { AbTestingAssistant } from './modules/abTesting.js';

const crmModule = new CrmIntegrationModule();
const onlineController = new OnlinePresenceController();
const abAssistant = new AbTestingAssistant();

const crmState = document.getElementById('crm-state');
const onlineState = document.getElementById('online-state');
const abChat = document.getElementById('ab-chat-log');
const abQuestions = document.getElementById('ab-questions');
const abResult = document.getElementById('ab-result');

let currentSessionId = null;

function printState(node, data) {
  node.textContent = JSON.stringify(data, null, 2);
}

function renderCrm() {
  printState(crmState, crmModule.getSnapshot());
}

function renderOnline() {
  printState(onlineState, onlineController.getState());
}

function addChatLine(author, text) {
  const row = document.createElement('div');
  row.className = `chat-row chat-row--${author}`;
  row.textContent = `${author === 'ai' ? 'AI' : '\u0412\u044b'}: ${text}`;
  abChat.appendChild(row);
  abChat.scrollTop = abChat.scrollHeight;
}

function renderQuestions(session) {
  abQuestions.innerHTML = '';

  session.questions.forEach((question) => {
    const wrap = document.createElement('div');
    wrap.className = 'question-item';

    const label = document.createElement('label');
    label.textContent = question;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043e\u0442\u0432\u0435\u0442';

    wrap.appendChild(label);
    wrap.appendChild(input);
    abQuestions.appendChild(wrap);
  });
}

function collectAnswers() {
  const rows = Array.from(document.querySelectorAll('#ab-questions .question-item'));
  return rows.map((row) => {
    const question = row.querySelector('label').textContent;
    const answer = row.querySelector('input').value.trim();
    return { question, answer };
  });
}

document.getElementById('crm-connect').addEventListener('click', () => {
  crmModule.configure({
    syncMode: 'hybrid',
    objects: { lead: true, contact: true, deal: true, task: true },
    webhookSubscriptions: ['lead.created', 'lead.updated', 'message.received', 'deal.updated']
  });

  crmModule.connect({
    providerName: document.getElementById('crm-provider').value || 'Custom CRM',
    accessToken: 'demo-access-token',
    refreshToken: 'demo-refresh-token',
    tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    webhookActive: true
  });

  crmModule.sync([
    {
      id: 'avito-lead-1',
      title: '\u0417\u0430\u043f\u0440\u043e\u0441 \u0438\u0437 Avito \u0447\u0430\u0442\u0430',
      price: 13000,
      phone: '+79998887766',
      chatId: 'chat-44',
      createdAt: new Date().toISOString()
    }
  ]);

  renderCrm();
});

document.getElementById('always-online-toggle').addEventListener('change', (event) => {
  onlineController.toggle(event.target.checked);
  renderOnline();
});

document.getElementById('ab-start').addEventListener('click', () => {
  const nichePrompt = document.getElementById('ab-prompt').value.trim();
  if (!nichePrompt) {
    addChatLine('ai', '\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u043d\u0438\u0448\u0443, \u0447\u0442\u043e\u0431\u044b \u044f \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u043b \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044e A/B \u0442\u0435\u0441\u0442\u0430.');
    return;
  }

  const session = abAssistant.createSession({ nichePrompt });
  currentSessionId = session.id;
  addChatLine('user', nichePrompt);
  addChatLine('ai', '\u041e\u0442\u043b\u0438\u0447\u043d\u043e, \u043d\u0430\u0447\u0438\u043d\u0430\u044e \u0441\u043a\u0432\u043e\u0437\u043d\u043e\u0439 \u0430\u043d\u0430\u043b\u0438\u0437. \u041d\u0443\u0436\u043d\u044b \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u044f:');
  session.questions.forEach((question) => addChatLine('ai', question));
  renderQuestions(session);
  abResult.textContent = '';
});

document.getElementById('ab-generate').addEventListener('click', () => {
  if (!currentSessionId) {
    addChatLine('ai', '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u0430\u043d\u0430\u043b\u0438\u0437 \u043f\u043e \u043d\u0438\u0448\u0435.');
    return;
  }

  const answers = collectAnswers();
  answers.forEach(({ question, answer }) => {
    if (answer) {
      abAssistant.answerQuestion(currentSessionId, question, answer);
      addChatLine('user', `${question} ${answer}`);
    }
  });

  const plan = abAssistant.generatePlan(currentSessionId);
  addChatLine('ai', '\u0413\u043e\u0442\u043e\u0432\u043e. \u042f \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u0438\u043b \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b \u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043a\u043e\u0432, \u0442\u0435\u043a\u0441\u0442\u043e\u0432 \u0438 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438 \u043f\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f\u043c.');
  printState(abResult, plan);
});

renderCrm();
renderOnline();
