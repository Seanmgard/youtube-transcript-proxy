'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Copy, 
  Check,
  Loader2,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface PromoterData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  promotion_code: string;
  commission_rate: number;
  status: string;
  total_referrals: number;
  total_commission_earned: number;
  total_commission_paid: number;
  created_at: string;
}

interface Referral {
  id: string;
  referred_user_id: string;
  subscription_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
  stripe_subscription_id: string;
}

export default function PromoterDashboard() {
  const [promoterData, setPromoterData] = useState<PromoterData | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/sign-in');
        return;
      }

      // Check if user is a promoter
      const { data: promoter } = await supabase
        .from('promoters')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (!promoter) {
        router.push('/dashboard');
        return;
      }

      setPromoterData(promoter);
      await loadReferrals(promoter.id);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/auth/sign-in');
    } finally {
      setIsLoading(false);
    }
  };

  const loadReferrals = async (promoterId: string) => {
    try {
      const supabase = await createClient();
      const { data: referralsData, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('promoter_id', promoterId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setReferrals(referralsData || []);
    } catch (error) {
      console.error('Error loading referrals:', error);
      toast({
        title: 'Error',
        description: 'Failed to load referral data',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = async () => {
    if (!promoterData) return;
    
    try {
      await navigator.clipboard.writeText(promoterData.promotion_code);
      setCopiedCode(true);
      toast({
        title: 'Copied!',
        description: 'Your promo code has been copied to clipboard',
        variant: 'default',
      });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || variants.pending}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-gray-500">Loading your promoter dashboard...</p>
      </div>
    );
  }

  if (!promoterData) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <p className="text-gray-500">You are not registered as a promoter.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const activeReferrals = referrals.filter(r => r.status === 'active');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');
  const totalEarned = referrals.reduce((sum, r) => sum + r.commission_amount, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Promoter Dashboard</h1>
          <p className="text-gray-600">
            Track your referrals and earnings from promoting QuizLabAI.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 mb-1">Your Promo Code</p>
          <div className="flex items-center gap-2">
            <code className="bg-gray-100 px-3 py-2 rounded font-mono text-lg">
              {promoterData.promotion_code}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
            >
              {copiedCode ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referrals.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeReferrals.length} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Referrals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReferrals.length}</div>
            <p className="text-xs text-muted-foreground">
              {pendingReferrals.length} pending
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarned.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {(promoterData.commission_rate * 100).toFixed(0)}% commission
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${promoterData.total_commission_paid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Commission paid out
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Promoter Info */}
      <Card>
        <CardHeader>
          <CardTitle>Your Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">
                {promoterData.company || `${promoterData.first_name} ${promoterData.last_name}`.trim() || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{promoterData.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Commission Rate</p>
              <p className="font-medium">{(promoterData.commission_rate * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <div className="mt-1">
                {getStatusBadge(promoterData.status)}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="font-medium">{formatDate(promoterData.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Promo Code</p>
              <p className="font-mono font-medium">{promoterData.promotion_code}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No referrals yet</p>
              <p className="text-sm text-gray-400">
                Share your promo code to start earning commissions!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map((referral) => (
                <div 
                  key={referral.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">Referral #{referral.id.slice(-8)}</h3>
                      {getStatusBadge(referral.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(referral.created_at)}
                      </span>
                      <span>${referral.subscription_amount.toFixed(2)} subscription</span>
                      <span className="font-medium text-green-600">
                        ${referral.commission_amount.toFixed(2)} commission
                      </span>
                    </div>
                  </div>
                  
                  {referral.stripe_subscription_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // You could link to a subscription details page here
                        toast({
                          title: 'Subscription ID',
                          description: referral.stripe_subscription_id,
                          variant: 'default',
                        });
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to Use */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use Your Promo Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium">Share Your Code</p>
                <p className="text-sm text-gray-600">
                  Share your promo code <code className="bg-gray-100 px-1 rounded">{promoterData.promotion_code}</code> with potential customers.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium">Customer Uses Code</p>
                <p className="text-sm text-gray-600">
                  When customers sign up for premium using your code, you'll earn {(promoterData.commission_rate * 100).toFixed(0)}% commission.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium">Track Earnings</p>
                <p className="text-sm text-gray-600">
                  Monitor your referrals and earnings in real-time on this dashboard.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 