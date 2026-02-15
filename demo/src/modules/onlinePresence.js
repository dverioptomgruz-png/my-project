/**
 * "Always online" controller as lightweight toggle.
 */
export class OnlinePresenceController {
  constructor() {
    this.state = {
      enabled: false,
      autoReplyTemplate: '\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435! \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435. \u042f \u043d\u0430 \u0441\u0432\u044f\u0437\u0438 \u0438 \u0441\u043a\u043e\u0440\u043e \u0432\u0435\u0440\u043d\u0443\u0441\u044c \u0441 \u0442\u043e\u0447\u043d\u044b\u043c \u043e\u0442\u0432\u0435\u0442\u043e\u043c.',
      heartbeatMinutes: 5,
      lastHeartbeatAt: null
    };
  }

  toggle(enabled) {
    this.state.enabled = Boolean(enabled);
    if (this.state.enabled) {
      this.state.lastHeartbeatAt = new Date().toISOString();
    }
    return this.getState();
  }

  configure({ autoReplyTemplate, heartbeatMinutes } = {}) {
    if (autoReplyTemplate) {
      this.state.autoReplyTemplate = autoReplyTemplate;
    }
    if (heartbeatMinutes) {
      this.state.heartbeatMinutes = heartbeatMinutes;
    }
    return this.getState();
  }

  heartbeat() {
    if (!this.state.enabled) {
      return null;
    }

    this.state.lastHeartbeatAt = new Date().toISOString();
    return this.state.lastHeartbeatAt;
  }

  getState() {
    return { ...this.state };
  }
}
