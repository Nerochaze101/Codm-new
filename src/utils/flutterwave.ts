/**
 * Flutterwave Payment Gateway Helper (v3 Inline Checkout)
 */

declare global {
  interface Window {
    FlutterwaveCheckout?: (options: {
      public_key: string;
      tx_ref: string;
      amount: number;
      currency: string;
      payment_options?: string;
      customer: {
        email: string;
        phone_number?: string;
        name: string;
      };
      customizations?: {
        title: string;
        description: string;
        logo: string;
      };
      meta?: Record<string, any>;
      callback: (response: {
        transaction_id: number;
        tx_ref: string;
        flw_ref: string;
        status: string;
        amount: number;
        currency: string;
      }) => void;
      onclose: () => void;
    }) => void;
  }
}

export const FLUTTERWAVE_PUBLIC_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY) ||
  '';

export interface FlutterwaveOptions {
  email: string;
  name: string;
  phone?: string;
  amountNaira: number;
  reference?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
  onSuccess: (txRef: string, transactionId?: number) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

export function openFlutterwavePopup(options: FlutterwaveOptions): boolean {
  const {
    email,
    name,
    phone,
    amountNaira,
    reference,
    title = 'CODM Stake Escrow',
    description = '1v1 Match Stake Payment',
    metadata,
    onSuccess,
    onClose,
    onError,
  } = options;

  if (amountNaira < 100) {
    if (onError) onError(new Error('Minimum transaction amount on Flutterwave is ₦100'));
    return false;
  }

  const txRef = reference || `FLW_CODM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  if (typeof window !== 'undefined' && window.FlutterwaveCheckout) {
    try {
      const pubKey = FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK_TEST-SANDBOX';
      window.FlutterwaveCheckout({
        public_key: pubKey,
        tx_ref: txRef,
        amount: amountNaira,
        currency: 'NGN',
        payment_options: 'card,banktransfer,account,ussd',
        customer: {
          email: email || 'player@codmstakes.ng',
          phone_number: phone || '08000000000',
          name: name || 'CODM Player',
        },
        customizations: {
          title,
          description,
          logo: `${window.location.origin}/18012397-6DAC-458A-9230-E51DC47747A9.png`,
        },
        meta: metadata || {},
        callback: (response) => {
          console.log('✅ Flutterwave Payment Successful! Ref:', response.tx_ref, response);
          if (response.status === 'successful' || response.status === 'completed') {
            onSuccess(response.tx_ref || txRef, response.transaction_id);
          } else {
            console.warn('Flutterwave payment status:', response.status);
            onSuccess(response.tx_ref || txRef, response.transaction_id);
          }
        },
        onclose: () => {
          console.log('Flutterwave popup closed by user');
          if (onClose) onClose();
        },
      });

      return true;
    } catch (err: any) {
      console.warn('Flutterwave checkout error:', err);
      if (onError) onError(err);
      return false;
    }
  }

  console.warn('Flutterwave SDK not loaded on window');
  if (onError) onError(new Error('Flutterwave payment script is still loading. Please try again.'));
  return false;
}
