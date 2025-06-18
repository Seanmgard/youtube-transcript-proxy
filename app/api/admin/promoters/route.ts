import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// GET - List all promoters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query - simplified without the problematic join
    let query = supabase
      .from('promoters')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: promoters, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching promoters:', error);
      return NextResponse.json({ error: 'Failed to fetch promoters' }, { status: 500 });
    }

    return NextResponse.json({
      promoters,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error in promoters GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new promoter
export async function POST(request: Request) {
  try {
    const { email, first_name, last_name, company, commission_rate = 0.25, custom_promo_code } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    let promoCode = custom_promo_code;

    // If custom code provided, validate it
    if (custom_promo_code) {
      // Check if the custom code already exists
      const { data: existingPromoter, error: checkError } = await supabase
        .from('promoters')
        .select('id')
        .eq('promotion_code', custom_promo_code.toUpperCase())
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing promo code:', checkError);
        return NextResponse.json({ error: 'Failed to validate promo code' }, { status: 500 });
      }

      if (existingPromoter) {
        return NextResponse.json({ error: 'Promo code already exists. Please choose a different one.' }, { status: 400 });
      }

      promoCode = custom_promo_code.toUpperCase();
    } else {
      // Generate unique promotion code if no custom code provided
      const { data: generatedCode, error: codeError } = await supabase
        .rpc('generate_promo_code', { base_name: company || first_name });

      if (codeError) {
        console.error('Error generating promo code:', codeError);
        return NextResponse.json({ error: 'Failed to generate promo code' }, { status: 500 });
      }

      promoCode = generatedCode;
    }

    // Create promoter record
    const { data: promoter, error: insertError } = await supabase
      .from('promoters')
      .insert({
        email,
        first_name,
        last_name,
        company,
        promotion_code: promoCode,
        commission_rate: parseFloat(commission_rate)
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating promoter:', insertError);
      return NextResponse.json({ error: 'Failed to create promoter' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      promoter,
      message: `Promoter created with code: ${promoCode}`
    });

  } catch (error) {
    console.error('Error in promoters POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
    const promoterId = searchParams.get('id');

    if (!promoterId) {
      return NextResponse.json({ error: 'Promoter ID is required' }, { status: 400 });
    }

    console.log('Attempting to delete promoter:', promoterId);

    // Create service role client for admin operations
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Check if promoter exists
    const { data: promoter, error: fetchError } = await supabaseAdmin
      .from('promoters')
      .select('id, promotion_code')
      .eq('id', promoterId)
      .single();

    if (fetchError || !promoter) {
      console.error('Error fetching promoter for deletion:', fetchError);
      return NextResponse.json({ error: 'Promoter not found' }, { status: 404 });
    }

    console.log('Found promoter to delete:', promoter);

    // Delete related records first (cascade delete)
    // Delete commission payments
    const { error: commissionError } = await supabaseAdmin
      .from('commission_payments')
      .delete()
      .eq('promoter_id', promoterId);

    if (commissionError) {
      console.error('Error deleting commission payments:', commissionError);
    } else {
      console.log('Commission payments deleted successfully');
    }

    // Delete referrals
    const { error: referralError } = await supabaseAdmin
      .from('referrals')
      .delete()
      .eq('promoter_id', promoterId);

    if (referralError) {
      console.error('Error deleting referrals:', referralError);
    } else {
      console.log('Referrals deleted successfully');
    }

    // Delete the promoter
    const { error: deleteError } = await supabaseAdmin
      .from('promoters')
      .delete()
      .eq('id', promoterId);

    if (deleteError) {
      console.error('Error deleting promoter:', deleteError);
      return NextResponse.json({ error: 'Failed to delete promoter: ' + deleteError.message }, { status: 500 });
    }

    console.log('Promoter deleted successfully');

    return NextResponse.json({ 
      message: `Promoter with code ${promoter.promotion_code} deleted successfully` 
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/promoters:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
} 