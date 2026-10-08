/**
 * Paystack Payment Gateway Helper
 */

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number; // Amount in kobo (Naira * 100)
        currency?: string;
        ref?: string;
        metadata?: Record<string, any>;
        callback: (response: { reference: string; status: string; message: string; trxref: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

export const PAYSTACK_PUBLIC_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PAYSTACK_PUBLIC_KEY) ||
  'pk_test_95bf08d249f0ecba8ce6b09320b9eef833075249';

export interface PaystackOptions {
  email: string;
  amountNaira: number;
  reference?: string;
  metadata?: Record<string, any>;
  onSuccess: (reference: string) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

export function openPaystackPopup(options: PaystackOptions): boolean {
  const { email, amountNaira, reference, metadata, onSuccess, onClose, onError } = options;

  if (amountNaira < 100) {
    if (onError) onError(new Error('Minimum transaction amount on Paystack is ₦100'));
    return false;
  }

  const koboAmount = Math.round(amountNaira * 100);
  const txRef = reference || `CODM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  if (typeof window !== 'undefined' && window.PaystackPop) {
    try {
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email || 'player@codmstakes.ng',
        amount: koboAmount,
        currency: 'NGN',
        ref: txRef,
        metadata: metadata || {
          custom_fields: [
            {
              display_name: 'Platform',
              variable_name: 'platform',
              value: 'CODM Stake 1v1 Escrow',
            },
          ],
        },
        callback: (response) => {
          console.log('✅ Paystack Payment Successful! Ref:', response.reference);
          onSuccess(response.reference || txRef);
        },
        onClose: () => {
          console.log('Paystack popup closed by user');
          if (onClose) onClose();
        },
      });

      handler.openIframe();
      return true;
    } catch (err: any) {
      console.warn('Paystack setup error:', err);
      if (onError) onError(err);
      return false;
    }
  }

  console.warn('Paystack SDK not loaded on window');
  return false;
}
