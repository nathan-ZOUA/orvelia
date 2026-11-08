// ============================================================================
// ORVÉLIA — MULTI-GATEWAY PAYMENT ENGINE (CINETPAY, NOTCH PAY, CAMPAY, FLUTTERWAVE)
// Architect & Lead Engineering: Nathan Zoua (NZ)
// Résout la contrainte terrain d'onboarding KYB au Cameroun :
// - Permet d'utiliser CinetPay, Notch Pay ou CamPay avec un RCCM/NIU camerounais
// - Conserve Flutterwave (endpoint /v3/charges?type=mobile_money_franco) si souhaité
// ============================================================================

import crypto from 'crypto';

export type PaymentState =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED';

export type PaymentProviderName =
  | 'CINETPAY'
  | 'NOTCHPAY'
  | 'CAMPAY'
  | 'FLUTTERWAVE';

export type SupportedCountry = 'CM' | 'SN' | 'CI' | 'FR' | 'US' | 'AE';
export type SupportedCurrency = 'XAF' | 'XOF' | 'EUR' | 'USD';

export type PaymentMethodCode =
  | 'CARD_VISA_MASTERCARD'
  | 'MTN_MOMO_CM'
  | 'ORANGE_MONEY_CM'
  | 'WAVE_SN_CI';

export const ALLOWED_STATE_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  PENDING: ['SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'],
  SUCCESS: ['REFUNDED'],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export function canTransitionPaymentState(
  currentState: PaymentState,
  nextState: PaymentState
): boolean {
  if (currentState === nextState) return false;
  return ALLOWED_STATE_TRANSITIONS[currentState]?.includes(nextState) ?? false;
}

/**
 * 1. Adaptateur CinetPay (Natif CEMAC / Cameroun — MTN MoMo, Orange Money CM, Visa/Mastercard)
 * Docs : https://cinetpay.com/
 */
export class CinetPayGatewayAdapter {
  private readonly apiKey = process.env.CINETPAY_API_KEY || '';
  private readonly siteId = process.env.CINETPAY_SITE_ID || '';
  private readonly secretKey = process.env.CINETPAY_SECRET_KEY || '';

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.siteId && !this.apiKey.includes('VOTRE_'));
  }

  public async initiatePayment(params: {
    txRef: string;
    amountXaf: number;
    description: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  }) {
    const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: this.apiKey,
        site_id: this.siteId,
        transaction_id: params.txRef,
        amount: params.amountXaf,
        currency: 'XAF',
        description: params.description,
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        customer_phone_number: params.customerPhone,
        channels: 'ALL', // MTN CM, Orange CM, Visa/Mastercard
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/cinetpay`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/verify`,
      }),
    });
    return await response.json();
  }

  public verifyWebhookHmac(rawTokenHeader: string | null, payloadConcatenated: string): boolean {
    if (!rawTokenHeader || !this.secretKey) return false;
    const computed = crypto
      .createHmac('sha256', this.secretKey)
      .update(payloadConcatenated)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(rawTokenHeader), Buffer.from(computed));
  }
}

/**
 * 2. Adaptateur Notch Pay (Natif Cameroun — API directe cm.mtn, cm.orange, cartes)
 * Docs : https://developer.notchpay.co/accept-payments/mobile-money
 */
export class NotchPayGatewayAdapter {
  private readonly publicKey = process.env.NOTCHPAY_PUBLIC_KEY || '';
  private readonly webhookSecret = process.env.NOTCHPAY_WEBHOOK_HASH || '';

  public isConfigured(): boolean {
    return Boolean(this.publicKey && !this.publicKey.includes('VOTRE_'));
  }

  public async initiateDirectMobileMoneyCharge(params: {
    txRef: string;
    amountXaf: number;
    email: string;
    phone: string;
    channel: 'cm.mtn' | 'cm.orange';
  }) {
    // Étape 1 : Initialiser le paiement sur https://api.notchpay.co/payments
    const initRes = await fetch('https://api.notchpay.co/payments', {
      method: 'POST',
      headers: {
        Authorization: this.publicKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amountXaf,
        currency: 'XAF',
        email: params.email,
        phone: params.phone,
        reference: params.txRef,
        description: `Commande ORVÉLIA ${params.txRef}`,
      }),
    });
    const initData = await initRes.json();

    // Étape 2 : Déclencher le push USSD direct (cm.mtn ou cm.orange)
    const chargeRes = await fetch(
      `https://api.notchpay.co/payments/${encodeURIComponent(initData.transaction.reference)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: this.publicKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: params.channel,
          data: { phone: params.phone },
        }),
      }
    );
    return await chargeRes.json();
  }

  public verifyWebhookSignature(rawSignatureHeader: string | null, rawBody: string): boolean {
    if (!rawSignatureHeader || !this.webhookSecret) return false;
    const computed = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(rawSignatureHeader), Buffer.from(computed));
  }
}

/**
 * 3. Adaptateur CamPay (Natif Cameroun — MTN & Orange Money XAF)
 * Docs : https://campay.net/
 */
export class CamPayGatewayAdapter {
  private readonly permanentToken = process.env.CAMPAY_PERMANENT_TOKEN || '';

  public isConfigured(): boolean {
    return Boolean(this.permanentToken && !this.permanentToken.includes('VOTRE_'));
  }

  public async collectMobileMoney(params: {
    txRef: string;
    amountXaf: number;
    phone237: string;
    description: string;
  }) {
    const res = await fetch('https://www.campay.net/api/collect/', {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.permanentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(params.amountXaf),
        currency: 'XAF',
        from: params.phone237,
        description: params.description,
        external_reference: params.txRef,
      }),
    });
    return await res.json();
  }
}

/**
 * 4. Adaptateur Flutterwave v3 (Endpoint Francophone Mobile Money & Cartes 3DS)
 * Docs : https://developer.flutterwave.com/docs/francophone
 */
export class FlutterwaveGatewayAdapter {
  private readonly secretKey = process.env.FLW_SECRET_KEY || '';
  private readonly baseUrl = process.env.FLW_API_BASE_URL || 'https://api.flutterwave.com/v3';

  public isConfigured(): boolean {
    return Boolean(this.secretKey && !this.secretKey.includes('XXXXXXXX'));
  }
}
