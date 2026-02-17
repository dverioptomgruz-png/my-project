import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { saveAvitoAccount } from '@/lib/avito-service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle errors from Avito
  if (error) {
    return NextResponse.redirect(
      new URL(`/app/connect-avito?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/app/connect-avito?error=no_code', request.url)
    );
  }

  try {
    const clientId = process.env.NEXT_PUBLIC_AVITO_CLIENT_ID;
    const clientSecret = process.env.AVITO_CLIENT_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/auth/avito/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.avito.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Avito token error:', errorData);
      return NextResponse.redirect(
        new URL(`/app/connect-avito?error=${encodeURIComponent(errorData.error_description || 'token_error')}`, request.url)
      );
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Avito
    const userResponse = await fetch('https://api.avito.ru/core/v1/accounts/self', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    let avitoUserName = 'Avito Account';
    if (userResponse.ok) {
      const userData = await userResponse.json();
      avitoUserName = userData.name || userData.email || 'Avito Account';
    }

    // Get current user from Supabase auth cookie
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });

    // Get user from cookies
    const cookieHeader = request.headers.get('cookie');
    // Parse auth token from cookies (simplified - you may need to adjust based on your auth setup)
    
    // For now, we'll use the state parameter to pass user_id (you should validate this properly)
    // In production, use proper session validation
    const userId = state; // This should be the authenticated user's ID

    if (!userId) {
      return NextResponse.redirect(
        new URL('/app/connect-avito?error=not_authenticated', request.url)
      );
    }

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Save account with encrypted tokens
    const result = await saveAvitoAccount({
      userId,
      accountName: avitoUserName,
      clientId: clientId,
      clientSecret: clientSecret,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
    });

    if (!result.success) {
      return NextResponse.redirect(
        new URL(`/app/connect-avito?error=${encodeURIComponent(result.error || 'save_error')}`, request.url)
      );
    }

    // Success! Redirect to dashboard
    return NextResponse.redirect(
      new URL('/app?avito_connected=true', request.url)
    );

  } catch (error) {
    console.error('Avito OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/app/connect-avito?error=${encodeURIComponent('server_error')}`, request.url)
    );
  }
}
