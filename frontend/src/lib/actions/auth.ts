'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function signUp(formData: FormData) {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = formData.get('password') as string;
  const name = formData.get('full_name') as string;
  try {
    const res = await fetch(API_URL + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) });
    const data = await res.json();
    if (!res.ok) { redirect('/auth/register?error=' + encodeURIComponent(data.message || 'Registration failed')); }
    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    if (!accessToken) {
      redirect('/auth/register?error=' + encodeURIComponent('Missing access token in response'));
    }
    const cookieStore = await cookies();
    cookieStore.set('access_token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 86400, path: '/' });
    if (refreshToken) { cookieStore.set('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 604800, path: '/' }); }
  } catch (e: any) {
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e;
    redirect('/auth/register?error=' + encodeURIComponent(e.message || 'Registration failed'));
  }
  revalidatePath('/', 'layout');
  redirect('/app');
}

export async function signIn(formData: FormData) {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = formData.get('password') as string;
  try {
    const res = await fetch(API_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) { redirect('/auth/login?error=' + encodeURIComponent(data.message || 'Invalid credentials')); }
    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    if (!accessToken) {
      redirect('/auth/login?error=' + encodeURIComponent('Missing access token in response'));
    }
    const cookieStore = await cookies();
    cookieStore.set('access_token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 86400, path: '/' });
    if (refreshToken) { cookieStore.set('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 604800, path: '/' }); }
  } catch (e: any) {
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e;
    redirect('/auth/login?error=' + encodeURIComponent(e.message || 'Login failed'));
  }
  revalidatePath('/', 'layout');
  redirect('/app');
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
  revalidatePath('/', 'layout');
  redirect('/auth/login');
}
