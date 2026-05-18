import Stripe from 'stripe';

// Lazy-initialize Stripe to avoid errors at module load time
let stripe = null;

function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

/**
 * Creates a Stripe PaymentIntent
 * @param {Object} payload - Payment intent payload
 * @param {number} payload.amount - Amount in smallest currency unit (e.g., cents for USD)
 * @param {string} [payload.currency='usd'] - Three-letter ISO currency code
 * @param {object} [payload.metadata] - Optional metadata to attach to the PaymentIntent
 * @returns {Promise<{clientSecret: string, paymentId: string, amount: number, currency: string, provider: string}>}
 * @throws {Error} If payload.amount is missing or invalid
 * @throws {Stripe.errors.StripeError} If Stripe API call fails
 */
export async function createPaymentIntent(payload) {
  // Validate amount - must be a positive integer
  if (payload.amount === undefined || payload.amount === null) {
    throw new Error('amount is required');
  }

  if (!Number.isInteger(payload.amount) || payload.amount <= 0) {
    throw new Error('amount must be a positive integer (smallest currency unit, e.g., cents)');
  }

  // Default currency to 'usd' if not provided
  const currency = payload.currency ?? 'usd';

  // Validate currency format (3-letter ISO code)
  if (typeof currency !== 'string' || currency.length !== 3) {
    throw new Error('currency must be a valid 3-letter ISO currency code');
  }

  try {
    // Get Stripe instance (lazy-initialized)
    const stripe = getStripe();

    // Create PaymentIntent via Stripe API
    const paymentIntent = await stripe.paymentIntents.create({
      amount: payload.amount,
      currency: currency,
      metadata: payload.metadata || {},
    });

    // Return the client secret and payment details
    return {
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      provider: 'stripe',
    };
  } catch (error) {
    // Preserve Stripe error message
    if (error.type?.startsWith('Stripe')) {
      throw error;
    }
    // Re-throw unexpected errors
    throw error;
  }
}
