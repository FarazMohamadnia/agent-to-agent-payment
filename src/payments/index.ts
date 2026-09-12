import { mockPaymentVerifier } from './MockPaymentVerifier';
import { PaymentVerifier } from './PaymentVerifier';

let activeVerifier: PaymentVerifier = mockPaymentVerifier;

export function getPaymentVerifier(): PaymentVerifier {
  return activeVerifier;
}

export function setPaymentVerifier(verifier: PaymentVerifier): void {
  activeVerifier = verifier;
}

export function resetPaymentVerifier(): void {
  mockPaymentVerifier.clear();
  activeVerifier = mockPaymentVerifier;
}
