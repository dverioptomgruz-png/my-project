/**
 * Advanced CRM integration module.
 *
 * Designed for flexible integration with a user's own CRM stack:
 * - custom objects and field mapping
 * - pipeline and stage mapping
 * - webhook/event routing
 * - sync policy configuration
 */
export class CrmIntegrationModule {
  constructor() {
    this.config = {
      providerName: null,
      authType: 'oauth2',
      syncMode: 'hybrid',
      objects: {
        lead: true,
        contact: true,
        deal: true,
        task: false
      },
      fieldMapping: {
        leadId: 'external_id',
        title: 'title',
        price: 'budget',
        phone: 'phone',
        chatId: 'channel_thread_id',
        createdAt: 'created_at'
      },
      pipelineMapping: {
        newLead: 'inbox',
        inProgress: 'processing',
        won: 'won',
        lost: 'lost'
      },
      webhookSubscriptions: ['lead.created', 'message.received', 'deal.updated'],
      rateLimitPolicy: {
        requestsPerMinute: 100,
        burst: 20,
        backoffSeconds: 30
      }
    };

    this.runtime = {
      connected: false,
      tokenExpiresAt: null,
      refreshTokenPresent: false,
      webhookActive: false,
      lastSyncAt: null,
      lastSyncSummary: null,
      errors: []
    };
  }

  configure(partialConfig = {}) {
    this.config = {
      ...this.config,
      ...partialConfig,
      objects: {
        ...this.config.objects,
        ...(partialConfig.objects ?? {})
      },
      fieldMapping: {
        ...this.config.fieldMapping,
        ...(partialConfig.fieldMapping ?? {})
      },
      pipelineMapping: {
        ...this.config.pipelineMapping,
        ...(partialConfig.pipelineMapping ?? {})
      },
      rateLimitPolicy: {
        ...this.config.rateLimitPolicy,
        ...(partialConfig.rateLimitPolicy ?? {})
      }
    };

    return this.getSnapshot();
  }

  connect({ providerName, accessToken, refreshToken, tokenExpiresAt, webhookActive }) {
    if (!providerName || !accessToken) {
      throw new Error('providerName and accessToken are required for CRM connection.');
    }

    this.config.providerName = providerName;
    this.runtime.connected = true;
    this.runtime.refreshTokenPresent = Boolean(refreshToken);
    this.runtime.tokenExpiresAt = tokenExpiresAt ?? null;
    this.runtime.webhookActive = Boolean(webhookActive);

    return this.getSnapshot();
  }

  sync(records = []) {
    if (!this.runtime.connected) {
      throw new Error('CRM is not connected.');
    }

    const synced = records.map((record) => this.normalizeRecord(record));
    this.runtime.lastSyncAt = new Date().toISOString();
    this.runtime.lastSyncSummary = {
      syncedCount: synced.length,
      objects: this.config.objects,
      mode: this.config.syncMode
    };

    return synced;
  }

  normalizeRecord(record) {
    const mapField = (sourceKey) => this.config.fieldMapping[sourceKey] ?? sourceKey;

    return {
      [mapField('leadId')]: record.id,
      [mapField('title')]: record.title,
      [mapField('price')]: record.price,
      [mapField('phone')]: record.phone,
      [mapField('chatId')]: record.chatId,
      [mapField('createdAt')]: record.createdAt,
      source: 'avito'
    };
  }

  getSnapshot() {
    const now = Date.now();
    const tokenTtlMinutes = this.runtime.tokenExpiresAt
      ? Math.max(0, Math.round((new Date(this.runtime.tokenExpiresAt).getTime() - now) / 60000))
      : null;

    return {
      configuration: this.config,
      runtime: {
        ...this.runtime,
        tokenTtlMinutes
      }
    };
  }
}
