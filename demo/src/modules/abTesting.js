/**
 * A/B testing assistant for Avito niches.
 *
 * Flow:
 * 1) collect brief via chat
 * 2) ask clarifying questions when context is weak
 * 3) build 3-5 text/headline variants
 * 4) provide recommendations for cover images
 */
export class AbTestingAssistant {
  constructor() {
    this.sessions = new Map();
  }

  createSession({ nichePrompt }) {
    const id = `session-${Date.now()}`;
    const session = {
      id,
      nichePrompt,
      createdAt: new Date().toISOString(),
      answers: {},
      questions: this.getClarifyingQuestions(nichePrompt),
      result: null
    };

    this.sessions.set(id, session);
    return session;
  }

  getClarifyingQuestions(nichePrompt) {
    const questions = [];
    const text = String(nichePrompt ?? '').toLowerCase();

    if (!text.includes('\u0446\u0435\u043d\u0430') && !text.includes('\u0431\u044e\u0434\u0436\u0435\u0442')) {
      questions.push('\u041a\u0430\u043a\u043e\u0439 \u0446\u0435\u043d\u043e\u0432\u043e\u0439 \u0441\u0435\u0433\u043c\u0435\u043d\u0442 \u0443 \u0432\u0430\u0448\u0435\u0439 \u043d\u0438\u0448\u0438 \u0438 \u0441\u0440\u0435\u0434\u043d\u0438\u0439 \u0447\u0435\u043a?');
    }

    if (!text.includes('\u0446\u0435\u043b\u044c') && !text.includes('\u043a\u043e\u043d\u0432\u0435\u0440\u0441')) {
      questions.push('\u041a\u0430\u043a\u0443\u044e \u043a\u043b\u044e\u0447\u0435\u0432\u0443\u044e \u043a\u043e\u043d\u0432\u0435\u0440\u0441\u0438\u044e \u0442\u0435\u0441\u0442\u0438\u0440\u0443\u0435\u043c: \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435, \u0437\u0432\u043e\u043d\u043e\u043a \u0438\u043b\u0438 \u0437\u0430\u044f\u0432\u043a\u0443?');
    }

    questions.push('\u041a\u0442\u043e \u0446\u0435\u043b\u0435\u0432\u0430\u044f \u0430\u0443\u0434\u0438\u0442\u043e\u0440\u0438\u044f \u0438 \u0435\u0451 \u0433\u043b\u0430\u0432\u043d\u044b\u0439 \u043c\u043e\u0442\u0438\u0432 \u043f\u043e\u043a\u0443\u043f\u043a\u0438?');
    questions.push('\u0415\u0441\u0442\u044c \u043b\u0438 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f \u043f\u043e \u0442\u043e\u043d\u0443: \u044d\u043a\u0441\u043f\u0435\u0440\u0442\u043d\u044b\u0439, \u0434\u0440\u0443\u0436\u0435\u043b\u044e\u0431\u043d\u044b\u0439, \u043f\u0440\u0435\u043c\u0438\u0430\u043b\u044c\u043d\u044b\u0439?');

    return questions.slice(0, 4);
  }

  answerQuestion(sessionId, question, answer) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    session.answers[question] = answer;
    return session;
  }

  generatePlan(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found.');
    }

    const tone = this.detectTone(session.answers);
    const base = this.extractNiche(session.nichePrompt);
    const variantsCount = 4;

    const variants = Array.from({ length: variantsCount }, (_, index) => ({
      variant: `V${index + 1}`,
      headline: this.makeHeadline(base, tone, index),
      text: this.makeBody(base, tone, index)
    }));

    session.result = {
      niche: base,
      variants,
      imageRecommendations: this.makeImageRecommendations(base, tone),
      executionChecklist: [
        '\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0442\u0435\u0441\u0442 \u043d\u0430 7-10 \u0434\u043d\u0435\u0439 \u0441 \u0440\u0430\u0432\u043d\u044b\u043c \u0440\u0430\u0441\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435\u043c \u0442\u0440\u0430\u0444\u0438\u043a\u0430.',
        '\u041e\u0446\u0435\u043d\u0438\u0432\u0430\u0442\u044c CTR, \u0432\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0438 \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u043b\u0438\u0434\u0430 \u0432 \u0440\u0430\u0437\u0440\u0435\u0437\u0435 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u043e\u0432.',
        '\u041f\u043e\u0441\u043b\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u044f \u043f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u044f \u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0438\u043d\u0441\u0430\u0439\u0442 \u0438 \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0440\u0430\u0443\u043d\u0434.'
      ]
    };

    return session.result;
  }

  detectTone(answers) {
    const joined = Object.values(answers).join(' ').toLowerCase();
    if (joined.includes('преми')) {
      return 'premium';
    }
    if (joined.includes('эксперт')) {
      return 'expert';
    }
    return 'friendly';
  }

  extractNiche(prompt) {
    const text = String(prompt ?? '').trim();
    return text.length > 4 ? text : 'универсальная ниша';
  }

  makeHeadline(base, tone, index) {
    const patterns = {
      premium: [
        `Премиум-решение в нише «${base}» — результат с первого обращения`,
        `«${base}»: сервис уровня high-end для требовательных клиентов`,
        `Эксклюзив в «${base}»: персональный подход и прозрачные условия`,
        `Почему выбирают нас в «${base}»: качество, скорость, гарантия`
      ],
      expert: [
        `Профессионально о «${base}»: точная диагностика и прогноз результата`,
        `«${base}» под контролем экспертов: чёткий процесс без лишних рисков`,
        `Практичный подход к «${base}»: считаем эффективность до старта`,
        `Экспертный формат в «${base}»: фокус на измеримом результате`
      ],
      friendly: [
        `«${base}» без стресса: быстро, понятно и с заботой о клиенте`,
        `Поможем с «${base}» уже сегодня — оставьте сообщение`,
        `«${base}»: простое решение вашей задачи в 3 шага`,
        `Надёжный партнёр в «${base}»: отвечаем быстро, работаем честно`
      ]
    };

    return patterns[tone][index] ?? patterns[tone][0];
  }

  makeBody(base, tone, index) {
    const intros = {
      premium: 'Сфокусированы на качестве сервиса и максимальной прозрачности сделки.',
      expert: 'Опираемся на данные, сценарии спроса и лучшие практики вертикали.',
      friendly: 'Говорим простым языком, быстро отвечаем и ведём клиента до результата.'
    };

    return `${intros[tone]} Тестовый оффер #${index + 1} для ниши «${base}»: добавьте конкретные преимущества, сроки и безопасный следующий шаг (чат/звонок).`;
  }

  makeImageRecommendations(base, tone) {
    return [
      `Главное фото: крупный объект предложения в нише «${base}», чистый фон, высокий контраст.`,
      `Вариант lifestyle: показать применение продукта/услуги в реальной ситуации (${tone} настроение).`,
      'Вариант с инфографикой: 2-3 коротких преимущества поверх изображения без перегруза текстом.',
      'A/B для обложек: протестировать близкий план vs средний план и холодную vs тёплую цветовую схему.'
    ];
  }
}
