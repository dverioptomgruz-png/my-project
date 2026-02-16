// Avito API Client
const AVITO_API_URL = 'https://api.avito.ru';
const AVITO_TOKEN_URL = 'https://api.avito.ru/token';

interface AvitoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AvitoError {
  error: string;
  error_description?: string;
}

// Get access token using client credentials
export async function getAvitoToken(): Promise<string> {
  const clientId = process.env.AVITO_CLIENT_ID;
  const clientSecret = process.env.AVITO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Avito API credentials not configured');
  }

  const response = await fetch(AVITO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error: AvitoError = await response.json();
    throw new Error(error.error_description || 'Failed to get Avito token');
  }

  const data: AvitoTokenResponse = await response.json();
  return data.access_token;
}

// Make authenticated request to Avito API
export async function avitoFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAvitoToken();

  const response = await fetch(`${AVITO_API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Avito API request failed');
  }

  return response.json();
}

// Get user info
export async function getAvitoUserInfo() {
  return avitoFetch('/core/v1/accounts/self');
}

// Get user's items (listings)
export async function getAvitoItems(userId: string, params?: {
  per_page?: number;
  page?: number;
  status?: 'active' | 'removed' | 'old' | 'blocked';
}) {
  const searchParams = new URLSearchParams();
  if (params?.per_page) searchParams.set('per_page', String(params.per_page));
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return avitoFetch(`/core/v1/accounts/${userId}/items${query ? '?' + query : ''}`);
}

// Get item statistics
export async function getItemStats(userId: string, itemIds: string[]) {
  return avitoFetch(`/stats/v1/accounts/${userId}/items`, {
    method: 'POST',
    body: JSON.stringify({ itemIds }),
  });
}

// Get messenger chats
export async function getChats(userId: string) {
  return avitoFetch(`/messenger/v2/accounts/${userId}/chats`);
}

// Send message
export async function sendMessage(
  userId: string,
  chatId: string,
  message: { text: string }
) {
  return avitoFetch(`/messenger/v1/accounts/${userId}/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
