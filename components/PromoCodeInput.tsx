'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface PromoCodeInputProps {
  onValidCode: (code: string, promoterInfo: any) => void;
  onClearCode: () => void;
  disabled?: boolean;
}

export function PromoCodeInput({ onValidCode, onClearCode, disabled = false }: PromoCodeInputProps) {
  const [promoCode, setPromoCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [promoterInfo, setPromoterInfo] = useState<any>(null);
  const { toast } = useToast();

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a promo code',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoCode.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setIsValid(true);
        setPromoterInfo(data.promoter);
        onValidCode(promoCode.trim(), data.promoter);
        toast({
          title: 'Valid Code!',
          description: `Promo code applied from ${data.promoter.promoterName}`,
          variant: 'default',
        });
      } else {
        setIsValid(false);
        setPromoterInfo(null);
        toast({
          title: 'Invalid Code',
          description: data.error || 'Please check your promo code and try again',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error validating promo code:', error);
      setIsValid(false);
      setPromoterInfo(null);
      toast({
        title: 'Error',
        description: 'Failed to validate promo code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const clearPromoCode = () => {
    setPromoCode('');
    setIsValid(false);
    setPromoterInfo(null);
    onClearCode();
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="promo-code">Have a promo code?</Label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            id="promo-code"
            type="text"
            placeholder="Enter promo code"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            disabled={disabled || isValid}
            className={`pr-10 ${isValid ? 'border-green-500 bg-green-50' : ''}`}
          />
          {isValid && (
            <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>
        {!isValid ? (
          <Button
            type="button"
            onClick={validatePromoCode}
            disabled={disabled || isValidating || !promoCode.trim()}
            variant="outline"
            size="sm"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Apply'
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={clearPromoCode}
            disabled={disabled}
            variant="outline"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {isValid && promoterInfo && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700">
              Promo code applied from <strong>{promoterInfo.promoterName}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
} 