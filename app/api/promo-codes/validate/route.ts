import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { promoCode } = await request.json();
    
    if (!promoCode) {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Check if the promo code exists and is active
    const { data: promoter, error } = await supabase
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
      .eq('promotion_code', promoCode.toUpperCase())
      .eq('status', 'active')
      .single();

    if (error || !promoter) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid or inactive promo code' 
      }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      promoter: {
        id: promoter.id,
        code: promoter.promotion_code,
        commissionRate: promoter.commission_rate,
        promoterName: promoter.company || `${promoter.first_name} ${promoter.last_name}`.trim() || 'Partner'
      }
    });

  } catch (error) {
    console.error('Error validating promo code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 