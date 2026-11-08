// ============================================================================
// ORVÉLIA — FLUTTERWAVE WEBHOOK HANDLER & SERVER-SIDE ORDER CONFIRMATION
// Architect & Lead Engineering: Nathan Zoua (NZ)
// Route: POST /api/webhooks/flutterwave
// ============================================================================

import {
  verifyFlutterwaveWebhookSignature,
  canTransitionPaymentState,
  FlutterwaveGatewayAdapter,
  PaymentState,
} from '../../../lib/payments/payment-engine';

export interface WebhookRequestLike {
  headers: Record<string, string | undefined>;
  body: {
    event: string;
    data: {
      id: number | string;
      tx_ref: string;
      flw_ref?: string;
      amount: number;
      currency: string;
      status: string;
    };
  };
}

export async function handleFlutterwaveWebhook(
  req: WebhookRequestLike,
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
  const signature = req.headers['verif-hash'] || null;
  const expectedSecret = process.env.FLW_WEBHOOK_SECRET_HASH;

  // 1. Vérification stricte de la signature du webhook
  const isSignatureValid = verifyFlutterwaveWebhookSignature(signature, expectedSecret);
  if (!isSignatureValid) {
    return { status: 401, body: { error: 'Signature webhook invalide (verif-hash)' } };
  }

  const { data } = req.body;
  const paymentRecord = await db.findPaymentByTxRef(data.tx_ref);
  if (!paymentRecord) {
    return { status: 404, body: { error: 'Référence de transaction inconnue' } };
  }

  // 2. Protection contre les doubles paiements (idempotence)
  if (paymentRecord.status === 'SUCCESS') {
    return { status: 200, body: { status: 'ALREADY_PROCESSED_IDEMPOTENT' } };
  }

  // 3. Re-vérification serveur-à-serveur auprès de Flutterwave
  const gateway = new FlutterwaveGatewayAdapter();
  const verification = await gateway.verifyTransactionOnServer(
    String(data.id),
    paymentRecord.amountXaf,
    paymentRecord.currency
  );

  // 4. Validation de la transition dans la machine à états
  if (!canTransitionPaymentState(paymentRecord.status, verification.nextState)) {
    return {
      status: 409,
      body: {
        error: `Transition d'état interdite: ${paymentRecord.status} -> ${verification.nextState}`,
      },
    };
  }

  // 5. Transaction atomique : mise à jour du paiement, de la commande et décrémentation du stock
  await db.updatePaymentAndOrderAtomically({
    paymentId: paymentRecord.id,
    orderId: paymentRecord.orderId,
    previousStatus: paymentRecord.status,
    newStatus: verification.nextState,
    providerTxId: verification.providerTxId,
    signatureValid: true,
  });

  return {
    status: 200,
    body: {
      status: 'WEBHOOK_COMMITTED',
      txRef: data.tx_ref,
      newState: verification.nextState,
    },
  };
}
