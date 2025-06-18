import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { promoterId, amount, paymentMethod, paymentReference, notes } = await request.json();

    if (!promoterId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid promoter ID and amount are required' }, { status: 400 });
    }

    // Create service role client for admin operations
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if promoter exists and get current stats
    const { data: promoter, error: promoterError } = await supabaseAdmin
      .from('promoters')
      .select('id, email, first_name, last_name, company, total_commission_earned, total_commission_paid')
      .eq('id', promoterId)
      .single();

    if (promoterError || !promoter) {
      return NextResponse.json({ error: 'Promoter not found' }, { status: 404 });
    }

    // Calculate available commission for payout
    const availableCommission = promoter.total_commission_earned - promoter.total_commission_paid;
    
    if (amount > availableCommission) {
      return NextResponse.json({ 
        error: `Amount exceeds available commission. Available: $${availableCommission.toFixed(2)}` 
      }, { status: 400 });
    }

    // Create commission payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('commission_payments')
      .insert({
        promoter_id: promoterId,
        amount: amount,
        period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(), // Current month
        period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(), // End of current month
        payment_method: paymentMethod || 'manual',
        payment_reference: paymentReference || null,
        status: 'paid',
        notes: notes || null
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating commission payment:', paymentError);
      return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 });
    }

    // Update promoter's total_commission_paid
    const { error: updateError } = await supabaseAdmin
      .from('promoters')
      .update({
        total_commission_paid: promoter.total_commission_paid + amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', promoterId);

    if (updateError) {
      console.error('Error updating promoter commission paid:', updateError);
      return NextResponse.json({ error: 'Failed to update promoter stats' }, { status: 500 });
    }

    const promoterName = promoter.company || `${promoter.first_name} ${promoter.last_name}`.trim() || promoter.email;

    return NextResponse.json({
      success: true,
      message: `Commission payout of $${amount.toFixed(2)} processed for ${promoterName}`,
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        created_at: payment.created_at
      }
    });

  } catch (error) {
    console.error('Error in commission payout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get payout history for a promoter
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const promoterId = searchParams.get('promoterId');

    if (!promoterId) {
      return NextResponse.json({ error: 'Promoter ID is required' }, { status: 400 });
    }

    // Create service role client for admin operations
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get payout history
    const { data: payments, error } = await supabaseAdmin
      .from('commission_payments')
      .select('*')
      .eq('promoter_id', promoterId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commission payments:', error);
      return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 });
    }

    return NextResponse.json({ payments: payments || [] });

  } catch (error) {
    console.error('Error fetching commission payments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 