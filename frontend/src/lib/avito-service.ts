import { createClient } from '@supabase/supabase-js';
import { safeEncrypt, safeDecrypt } from './crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AvitoAccount {
  id: string;
  user_id: string;
  account_name: string;
  client_id: string | null;
  client_secret: string | null; // Decrypted
  access_token: string | null;  // Decrypted
  refresh_token: string | null; // Decrypted
  token_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AvitoAccountDB {
  id: string;
  user_id: string;
  account_name: string;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Creates or updates an Avito account with encrypted tokens
 */
export async function saveAvitoAccount(params: {
  userId: string;
  accountName: string;
  clientId?: string;
  clientSecret?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<{ success: boolean; error?: string; accountId?: string }> {
  try {
    // Encrypt sensitive data
    const encryptedClientSecret = safeEncrypt(params.clientSecret || null);
    const encryptedAccessToken = safeEncrypt(params.accessToken);
    const encryptedRefreshToken = safeEncrypt(params.refreshToken);

    // Check if account already exists for this user
    const { data: existing } = await supabase
      .from('avito_accounts')
      .select('id')
      .eq('user_id', params.userId)
      .eq('account_name', params.accountName)
      .single();

    if (existing) {
      // Update existing account
      const { error } = await supabase
        .from('avito_accounts')
        .update({
          client_id: params.clientId,
          client_secret: encryptedClientSecret,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: params.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
      return { success: true, accountId: existing.id };
    } else {
      // Create new account
      const { data, error } = await supabase
        .from('avito_accounts')
        .insert({
          user_id: params.userId,
          account_name: params.accountName,
          client_id: params.clientId,
          client_secret: encryptedClientSecret,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: params.expiresAt.toISOString(),
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;
      return { success: true, accountId: data?.id };
    }
  } catch (error) {
    console.error('Error saving Avito account:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Gets Avito account with decrypted tokens
 */
export async function getAvitoAccount(accountId: string): Promise<AvitoAccount | null> {
  try {
    const { data, error } = await supabase
      .from('avito_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !data) return null;

    // Decrypt sensitive fields
    return {
      ...data,
      client_secret: safeDecrypt(data.client_secret),
      access_token: safeDecrypt(data.access_token),
      refresh_token: safeDecrypt(data.refresh_token),
    };
  } catch (error) {
    console.error('Error getting Avito account:', error);
    return null;
  }
}

/**
 * Gets all Avito accounts for a user with decrypted tokens
 */
export async function getUserAvitoAccounts(userId: string): Promise<AvitoAccount[]> {
  try {
    const { data, error } = await supabase
      .from('avito_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !data) return [];

    // Decrypt sensitive fields for each account
    return data.map(account => ({
      ...account,
      client_secret: safeDecrypt(account.client_secret),
      access_token: safeDecrypt(account.access_token),
      refresh_token: safeDecrypt(account.refresh_token),
    }));
  } catch (error) {
    console.error('Error getting user Avito accounts:', error);
    return [];
  }
}

/**
 * Refreshes Avito access token using refresh token
 */
export async function refreshAvitoToken(accountId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const account = await getAvitoAccount(accountId);
    if (!account || !account.refresh_token) {
      return { success: false, error: 'Account not found or no refresh token' };
    }

    const clientId = process.env.NEXT_PUBLIC_AVITO_CLIENT_ID;
    const clientSecret = process.env.AVITO_CLIENT_SECRET;

    const response = await fetch('https://api.avito.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: account.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error_description || 'Token refresh failed' };
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Save new tokens (encrypted)
    await saveAvitoAccount({
      userId: account.user_id,
      accountName: account.account_name,
      clientId: account.client_id || undefined,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || account.refresh_token,
      expiresAt,
    });

    return { success: true };
  } catch (error) {
    console.error('Error refreshing Avito token:', error);
    return { success: false, error: String(error) };
  }
}
