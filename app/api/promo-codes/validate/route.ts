import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { promoCode } = await request.json();
    
    console.log('=== PROMO CODE VALIDATION START ===');
    console.log('Raw promo code received:', promoCode);
    console.log('Type of promo code:', typeof promoCode);
    
    if (!promoCode) {
      console.log('ERROR: No promo code provided');
      return NextResponse.json({ 
        valid: false,
        error: 'Promo code is required' 
      }, { status: 400 });
    }

    // Trim and uppercase the promo code
    const cleanCode = promoCode.trim().toUpperCase();
    console.log('Cleaned promo code:', cleanCode);
    console.log('Length of cleaned code:', cleanCode.length);

    // Use service role client to bypass RLS policies
    console.log('Creating service role client...');
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    console.log('Service role client created successfully');
    console.log('Querying database for promo code:', cleanCode);
    
    // First, let's see if we can query the table at all
    const { data: allPromoters, error: countError } = await supabaseAdmin
      .from('promoters')
      .select('promotion_code, status')
      .limit(5);
    
    console.log('Sample promoters query result:', { allPromoters, countError });
    
    // Check if the promo code exists and is active
    const { data: promoter, error } = await supabaseAdmin
      .from('promoters')
      .select(`
        id,
        promotion_code,
        commission_rate,
        status,
        first_name,
        last_name,
        company
      `)
      .eq('promotion_code', cleanCode)
      .eq('status', 'active')
      .single();

    console.log('Main query - SQL would be:');
    console.log(`SELECT * FROM promoters WHERE promotion_code = '${cleanCode}' AND status = 'active';`);
    console.log('Database query result:', { promoter, error });

    if (error) {
      console.error('Database error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid or inactive promo code',
        debug: `DB Error: ${error.message}`
      }, { status: 400 });
    }

    if (!promoter) {
      console.log('No promoter found for code:', cleanCode);
      
      // Let's also try a case-insensitive search to see if it exists with different casing
      const { data: altSearch } = await supabaseAdmin
        .from('promoters')
        .select('promotion_code, status')
        .ilike('promotion_code', cleanCode);
      
      console.log('Case-insensitive search result:', altSearch);
      
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid or inactive promo code',
        debug: `No promoter found for: ${cleanCode}`
      }, { status: 400 });
    }

    console.log('SUCCESS: Valid promoter found:', {
      id: promoter.id,
      code: promoter.promotion_code,
      status: promoter.status
    });

    const promoterName = promoter.company || `${promoter.first_name} ${promoter.last_name}`.trim() || 'Partner';

    console.log('=== PROMO CODE VALIDATION SUCCESS ===');

    return NextResponse.json({
      valid: true,
      promoter: {
        id: promoter.id,
        code: promoter.promotion_code,
        commissionRate: promoter.commission_rate,
        promoterName: promoterName
      }
    });

  } catch (error) {
    console.error('=== PROMO CODE VALIDATION ERROR ===');
    console.error('Unexpected error:', error);
    return NextResponse.json({ 
      valid: false,
      error: 'Internal server error',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 