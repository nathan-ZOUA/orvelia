// ============================================================================
// ORVÉLIA — BACKEND PAYMENT INITIATION ROUTE (READS KEYS STRICTLY FROM .ENV)
// Architect & Lead Engineering: Nathan Zoua (NZ)
// Route: POST /api/checkout/initiate
// Aucune clé API dans le frontend : le serveur lit process.env.NOTCHPAY_PUBLIC_KEY
// et process.env.NOTCHPAY_SECRET_KEY depuis votre fichier .env.local.
// ============================================================================

import { NotchPayGatewayAdapter, CinetPayGatewayAdapter, CamPayGatewayAdapter } from '../../../lib/payments/payment-engine';

export interface InitiateCheckoutRequest {
  orderId: string;
  txRef: string;
  provider: 'NOTCHPAY' | 'CINETPAY' | 'CAMPAY' | 'FLUTTERWAVE';
  channel: 'cm.mtn' | 'cm.orange' | 'card';
  amountServerCalculatedXaf: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}

export async function handleCheckoutInitiate(req: InitiateCheckoutRequest) {
  if (req.provider === 'NOTCHPAY') {
    const adapter = new NotchPayGatewayAdapter();
    if (!adapter.isConfigured()) {
      return {
        status: 503,
        body: {
          error: 'NOTCHPAY_KEYS_MISSING_IN_BACKEND_ENV',
          message: 'Veuillez renseigner NOTCHPAY_PUBLIC_KEY, NOTCHPAY_SECRET_KEY et NOTCHPAY_WEBHOOK_HASH dans votre fichier serveur .env.local.',
        },
      };
    }

    if (req.channel === 'cm.mtn' || req.channel === 'cm.orange') {
      const result = await adapter.initiateDirectMobileMoneyCharge({
        txRef: req.txRef,
        amountXaf: req.amountServerCalculatedXaf,
        email: req.customer.email,
        phone: req.customer.phone,
        channel: req.channel,
      });
      return { status: 200, body: result };
    }
  }

  if (req.provider === 'CINETPAY') {
    const adapter = new CinetPayGatewayAdapter();
    if (!adapter.isConfigured()) {
      return {
        status: 503,
        body: { error: 'CINETPAY_KEYS_MISSING_IN_BACKEND_ENV' },
      };
    }
    const result = await adapter.initiatePayment({
      txRef: req.txRef,
      amountXaf: req.amountServerCalculatedXaf,
      description: `Commande ORVÉLIA ${req.orderId}`,
      customerName: req.customer.name,
      customerEmail: req.customer.email,
      customerPhone: req.customer.phone,
    });
    return { status: 200, body: result };
  }

  if (req.provider === 'CAMPAY') {
    const adapter = new CamPayGatewayAdapter();
    if (!adapter.isConfigured()) {
      return {
        status: 503,
        body: { error: 'CAMPAY_KEYS_MISSING_IN_BACKEND_ENV' },
      };
    }
    const result = await adapter.collectMobileMoney({
      txRef: req.txRef,
      amountXaf: req.amountServerCalculatedXaf,
      phone237: req.customer.phone,
      description: `Commande ORVÉLIA ${req.orderId}`,
    });
    return { status: 200, body: result };
  }

  return {
    status: 200,
    body: {
      status: 'PENDING',
      txRef: req.txRef,
      message: 'Transaction initialisée côté serveur via process.env.',
    },
  };
}
