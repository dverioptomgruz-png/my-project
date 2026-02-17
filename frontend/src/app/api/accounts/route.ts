import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function getSupabaseClient() {
  return createClient();
}


async function getUserFromRequest() {
  const supabase = await getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

// GET - получить все аккаунты пользователя
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getSupabaseClient();
    const { data: accounts, error } = await supabase
      .from('avito_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    return NextResponse.json({ accounts: accounts || [] });
  } catch (error) {
    console.error('Error in accounts API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - создать новый аккаунт
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { account_name, client_id, client_secret } = body;

    if (!account_name || !client_id || !client_secret) {
      return NextResponse.json(
        { error: 'account_name, client_id and client_secret are required' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();

    // Проверяем лимит аккаунтов по тарифу
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    const { data: existingAccounts } = await supabase
      .from('avito_accounts')
      .select('id')
      .eq('user_id', user.id);

    const accountCount = existingAccounts?.length || 0;
    let maxAccounts = 2; // Старт план по умолчанию

    if (subscription?.plan_id) {
      const { data: plan } = await supabase
        .from('tariff_plans')
        .select('max_accounts')
        .eq('id', subscription.plan_id)
        .single();
      
      if (plan?.max_accounts) {
        maxAccounts = plan.max_accounts;
      }
    }

    if (maxAccounts !== -1 && accountCount >= maxAccounts) {
      return NextResponse.json(
        { error: `Достигнут лимит аккаунтов (${maxAccounts}). Обновите тариф для добавления новых.` },
        { status: 403 }
      );
    }

    // Создаем новый аккаунт
    const { data: newAccount, error } = await supabase
      .from('avito_accounts')
      .insert({
        user_id: user.id,
        account_name,
        client_id,
        client_secret,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    return NextResponse.json({ account: newAccount }, { status: 201 });
  } catch (error) {
    console.error('Error in POST accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - удалить аккаунт
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const supabase = await getSupabaseClient();
    
    // Проверяем, принадлежит ли аккаунт пользователю
    const { data: account } = await supabase
      .from('avito_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('avito_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting account:', error);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}