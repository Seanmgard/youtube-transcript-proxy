'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Copy, 
  Check,
  Loader2,
  AlertCircle,
  Trash2,
  CreditCard
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface Promoter {
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

export default function PromotersPage() {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [payoutModal, setPayoutModal] = useState<string | null>(null);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    company: '',
    commission_rate: '0.25',
    custom_promo_code: ''
  });

  const [useCustomCode, setUseCustomCode] = useState(false);

  useEffect(() => {
    checkAuthAndLoadPromoters();
  }, []);

  const checkAuthAndLoadPromoters = async () => {
    try {
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/sign-in');
        return;
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (!profile?.is_admin) {
        router.push('/dashboard');
        return;
      }

      await loadPromoters();
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/auth/sign-in');
    }
  };

  const loadPromoters = async () => {
    try {
      const response = await fetch('/api/admin/promoters');
      if (!response.ok) {
        throw new Error('Failed to load promoters');
      }
      
      const data = await response.json();
      setPromoters(data.promoters || []);
    } catch (error) {
      console.error('Error loading promoters:', error);
      toast({
        title: 'Error',
        description: 'Failed to load promoters',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePromoter = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const requestData = {
        ...formData,
        custom_promo_code: useCustomCode ? formData.custom_promo_code : undefined
      };

      const response = await fetch('/api/admin/promoters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create promoter');
      }

      toast({
        title: 'Success',
        description: data.message,
        variant: 'default',
      });

      // Reset form and reload promoters
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        company: '',
        commission_rate: '0.25',
        custom_promo_code: ''
      });
      setUseCustomCode(false);
      setShowCreateForm(false);
      await loadPromoters();
    } catch (error) {
      console.error('Error creating promoter:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create promoter',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({
        title: 'Copied!',
        description: 'Promo code copied to clipboard',
        variant: 'default',
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDeletePromoter = async (promoterId: string, promoCode: string) => {
    console.log('Starting deletion of promoter:', promoterId, promoCode);
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/admin/promoters?id=${promoterId}`, {
        method: 'DELETE',
      });

      console.log('Delete response status:', response.status);
      const data = await response.json();
      console.log('Delete response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete promoter');
      }

      toast({
        title: 'Success',
        description: data.message,
        variant: 'default',
      });

      console.log('Reloading promoters list...');
      // Reload promoters list
      await loadPromoters();
      console.log('Promoters list reloaded');
    } catch (error) {
      console.error('Error deleting promoter:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete promoter',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handlePayout = async (promoterId: string) => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid payout amount',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessingPayout(true);
    
    try {
      const response = await fetch('/api/admin/promoters/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoterId,
          amount: parseFloat(payoutAmount),
          paymentMethod: 'manual',
          notes: payoutNotes
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process payout');
      }

      toast({
        title: 'Payout Processed',
        description: data.message,
        variant: 'default',
      });

      // Reset form and reload promoters
      setPayoutAmount('');
      setPayoutNotes('');
      setPayoutModal(null);
      await loadPromoters();
    } catch (error) {
      console.error('Error processing payout:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process payout',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || variants.inactive}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-gray-500">Loading promoters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Promoter Management</h1>
          <p className="text-gray-600">
            Manage your affiliate promoters and track their performance.
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Promoter
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Promoters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promoters.length}</div>
            <p className="text-xs text-muted-foreground">
              {promoters.filter(p => p.status === 'active').length} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {promoters.reduce((sum, p) => sum + p.total_referrals, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all promoters
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${promoters.reduce((sum, p) => sum + p.total_commission_earned, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Commission earned
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${promoters.reduce((sum, p) => sum + p.total_commission_paid, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Commission paid out
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create Promoter Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Promoter</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePromoter} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="commission_rate">Commission Rate</Label>
                  <Input
                    id="commission_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter as decimal (0.25 = 25%)</p>
                </div>
              </div>

              {/* Custom Promo Code Option */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-custom-code"
                    checked={useCustomCode}
                    onCheckedChange={setUseCustomCode}
                  />
                  <Label htmlFor="use-custom-code">Use custom promo code</Label>
                </div>
                
                {useCustomCode && (
                  <div>
                    <Label htmlFor="custom_promo_code">Custom Promo Code *</Label>
                    <Input
                      id="custom_promo_code"
                      placeholder="e.g., WELCOME2024, STUDENT50"
                      value={formData.custom_promo_code}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        custom_promo_code: e.target.value.toUpperCase() 
                      })}
                      required={useCustomCode}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter a unique promo code. It will be automatically converted to uppercase.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Promoter
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateForm(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Promoters List */}
      <Card>
        <CardHeader>
          <CardTitle>All Promoters</CardTitle>
        </CardHeader>
        <CardContent>
          {promoters.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No promoters found. Create your first promoter to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {promoters.map((promoter) => (
                <div 
                  key={promoter.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">
                        {promoter.company || `${promoter.first_name} ${promoter.last_name}`.trim() || promoter.email}
                      </h3>
                      {getStatusBadge(promoter.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{promoter.email}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{promoter.total_referrals} referrals</span>
                      <span>${promoter.total_commission_earned.toFixed(2)} earned</span>
                      <span>${promoter.total_commission_paid.toFixed(2)} paid</span>
                      <span>{(promoter.commission_rate * 100).toFixed(0)}% commission</span>
                      {promoter.total_commission_earned > promoter.total_commission_paid && (
                        <span className="text-green-600 font-medium">
                          ${(promoter.total_commission_earned - promoter.total_commission_paid).toFixed(2)} available
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {promoter.promotion_code}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(promoter.promotion_code)}
                    >
                      {copiedCode === promoter.promotion_code ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    {promoter.total_commission_earned > promoter.total_commission_paid && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPayoutModal(promoter.id)}
                        disabled={isProcessingPayout}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(promoter.id)}
                      disabled={isDeleting}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this promoter? This action cannot be undone and will also delete all associated referrals and commission payments.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const promoter = promoters.find(p => p.id === deleteConfirm);
                  if (promoter) {
                    handleDeletePromoter(deleteConfirm, promoter.promotion_code);
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Promoter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {payoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Process Commission Payout</h3>
            
            {(() => {
              const promoter = promoters.find(p => p.id === payoutModal);
              if (!promoter) return null;
              
              const availableCommission = promoter.total_commission_earned - promoter.total_commission_paid;
              
              return (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-600">Promoter: <span className="font-medium">{promoter.company || `${promoter.first_name} ${promoter.last_name}`.trim() || promoter.email}</span></p>
                    <p className="text-sm text-gray-600">Available for payout: <span className="font-medium text-green-600">${availableCommission.toFixed(2)}</span></p>
                  </div>
                  
                  <div>
                    <Label htmlFor="payout-amount">Payout Amount ($)</Label>
                    <Input
                      id="payout-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={availableCommission}
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      placeholder={`Max: $${availableCommission.toFixed(2)}`}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="payout-notes">Notes (Optional)</Label>
                    <Input
                      id="payout-notes"
                      value={payoutNotes}
                      onChange={(e) => setPayoutNotes(e.target.value)}
                      placeholder="e.g., Monthly payout, PayPal transfer"
                    />
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPayoutModal(null);
                        setPayoutAmount('');
                        setPayoutNotes('');
                      }}
                      disabled={isProcessingPayout}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handlePayout(payoutModal)}
                      disabled={isProcessingPayout || !payoutAmount || parseFloat(payoutAmount) <= 0 || parseFloat(payoutAmount) > availableCommission}
                    >
                      {isProcessingPayout ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Process Payout
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
} 