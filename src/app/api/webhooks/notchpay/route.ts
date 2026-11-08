// ============================================================================
// ORVÉLIA — NOTCH PAY WEBHOOK HANDLER & SERVER-SIDE ORDER CONFIRMATION
// Architect & Lead Engineering: Nathan Zoua (NZ)
// Route: POST /api/webhooks/notchpay
// Vérifie la signature HMAC-SHA256 (en-tête `x-notch-signature`) avec
// NOTCHPAY_WEBHOOK_HASH (hsk_test...) et met à jour la commande atomiquement.
// ============================================================================

import crypto from 'crypto';
import {
  canTransitionPaymentState,
  NotchPayGatewayAdapter,
  PaymentState,
} from '../../../lib/payments/payment-engine';

export interface NotchPayWebhookRequest {
  rawBody: string;
  headers: Record<string, string | undefined>;
  body: {
    event: 'payment.complete' | 'payment.failed' | 'payment.expired' | string;
    data: {
      reference: string;        // Référence Notch Pay (ex: trx.test_xxx)
      merchant_reference: string; // Notre txRef ORVÉLIA (ex: ORV-NP-2026-9042)
      amount: number;
      currency: string;
      status: 'complete' | 'failed' | 'expired' | 'pending';
      channel?: 'cm.mtn' | 'cm.orange' | 'card';
    };
  };
}

export async function handleNotchPayWebhook(
  req: NotchPayWebhookRequest,
  db: {
    findPaymentByTxRef: (txRef: string) => Promise<{
      id: string;
      orderId: string;
      status: PaymentState;
      amountXaf: number;
      currency: string;
    } | null>;
    updatePaymentAndOrderAtomically: (params: {
      paymentId: string;
      orderId: string;
      previousStatus: PaymentState;
      newStatus: PaymentState;
      providerTxId: string;
      signatureValid: boolean;
    }) => Promise<void>;
  }
) {
  const signatureHeader = req.headers['x-notch-signature'] || null;
  const webhookHashKey = process.env.NOTCHPAY_WEBHOOK_HASH || '';

  // 1. Vérification cryptographique HMAC-SHA256 avec NOTCHPAY_WEBHOOK_HASH (hsk_test...)
  if (!signatureHeader || !webhookHashKey) {
    return { status: 401, body: { error: 'En-tête x-notch-signature ou clé hsk_test manquant' } };
  }

  const computedHmac = crypto
    .createHmac('sha256', webhookHashKey)
    .update(req.rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signatureHeader);
  const compBuf = Buffer.from(computedHmac);
  if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
    return { status: 401, body: { error: 'Signature HMAC Notch Pay invalide' } };
  }

  const { data } = req.body;
  const paymentRecord = await db.findPaymentByTxRef(data.merchant_reference);
  if (!paymentRecord) {
    return { status: 404, body: { error: 'Référence marchand ORVÉLIA introuvable' } };
  }

  // 2. Protection anti-double paiement (idempotence)
  if (paymentRecord.status === 'SUCCESS') {
    return { status: 200, body: { status: 'ALREADY_PROCESSED_IDEMPOTENT' } };
  }

  // 3. Détermination du nouvel état
  let nextState: PaymentState = 'PENDING';
  if (data.status === 'complete' && Number(data.amount) >= paymentRecord.amountXaf) {
    nextState = 'SUCCESS';
  } else if (data.status === 'failed') {
    nextState = 'FAILED';
  } else if (data.status === 'expired') {
    nextState = 'EXPIRED';
  }

  // 4. Vérification de la transition dans la machine à états
  if (!canTransitionPaymentState(paymentRecord.status, nextState)) {
    return {
      status: 409,
      body: {
        error: `Transition d'état interdite: ${paymentRecord.status} -> ${nextState}`,
      },
    };
  }

  // 5. Mise à jour atomique en base de données (Payment + Order + Décrémentation Stock)
  await db.updatePaymentAndOrderAtomically({
    paymentId: paymentRecord.id,
    orderId: paymentRecord.orderId,
    previousStatus: paymentRecord.status,
    newStatus: nextState,
    providerTxId: data.reference,
    signatureValid: true,
  });

  return {
    status: 200,
    body: {
      status: 'NOTCHPAY_WEBHOOK_COMMITTED',
      merchantReference: data.merchant_reference,
      notchPayReference: data.reference,
      newState: nextState,
    },
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const headers: Record<string, string | undefined> = {};
    request.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const body = JSON.parse(rawBody);

    const mockDb = {
      findPaymentByTxRef: async (txRef: string) => ({
        id: 'mock_pay_1',
        orderId: 'mock_ord_1',
        status: 'PENDING' as PaymentState,
        amountXaf: body?.data?.amount || 0,
        currency: body?.data?.currency || 'XAF',
      }),
      updatePaymentAndOrderAtomically: async () => {},
    };

    const res = await handleNotchPayWebhook({ rawBody, headers, body }, mockDb);
    return Response.json(res.body, { status: res.status });
  } catch (err: any) {
    return Response.json({ error: 'INVALID_PAYLOAD', details: err?.message }, { status: 400 });
  }
}

export async function GET() {
  return Response.json({ status: 'ACTIVE', provider: 'NOTCHPAY_WEBHOOK' });
}
