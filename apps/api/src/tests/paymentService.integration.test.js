import test from "node:test";
import assert from "node:assert/strict";

// Integration test for Stripe PaymentIntent creation
// Only runs when STRIPE_SECRET_KEY is set and RUN_INTEGRATION_TESTS=true
// Usage: RUN_INTEGRATION_TESTS=true STRIPE_SECRET_KEY=sk_test_... node --test src/tests/paymentService.integration.test.js

const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === "true";
const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;

// Skip all tests if conditions not met
const options = { skip: !shouldRunIntegrationTests || !hasStripeKey };

test(
  "createPaymentIntent creates a real test-mode PaymentIntent with Stripe API",
  options,
  async () => {
    // Dynamic import to ensure Stripe is loaded with real key
    const { createPaymentIntent } = await import(
      "../services/paymentService.js"
    );

    // Create a PaymentIntent for $10.00 (1000 cents)
    const result = await createPaymentIntent({
      amount: 1000,
      currency: "usd",
      metadata: {
        test_mode: "true",
        integration_test: "paymentService",
      },
    });

    // Verify response structure
    assert.ok(result.clientSecret, "Should return clientSecret");
    assert.ok(
      result.clientSecret.includes("pi_"),
      "clientSecret should contain pi_"
    );
    assert.ok(result.paymentId, "Should return paymentId");
    assert.ok(
      result.paymentId.startsWith("pi_"),
      "paymentId should start with pi_"
    );
    assert.strictEqual(result.amount, 1000, "Should return correct amount");
    assert.strictEqual(
      result.currency,
      "usd",
      "Should return correct currency"
    );
    assert.strictEqual(
      result.provider,
      "stripe",
      "Should return stripe as provider"
    );
  }
);

test(
  "createPaymentIntent creates PaymentIntent with different currency",
  options,
  async () => {
    const { createPaymentIntent } = await import(
      "../services/paymentService.js"
    );

    const result = await createPaymentIntent({
      amount: 1500, // €15.00
      currency: "eur",
    });

    assert.strictEqual(result.currency, "eur");
    assert.strictEqual(result.amount, 1500);
    assert.ok(result.clientSecret);
  }
);

test(
  "createPaymentIntent handles minimum amount validation from Stripe API",
  options,
  async () => {
    const { createPaymentIntent } = await import(
      "../services/paymentService.js"
    );

    // Stripe requires minimum 50 cents for USD
    // This should succeed as it meets the minimum
    const result = await createPaymentIntent({
      amount: 50,
      currency: "usd",
    });

    assert.strictEqual(result.amount, 50);
    assert.ok(result.clientSecret);
  }
);

test(
  "createPaymentIntent propagates Stripe API errors correctly",
  options,
  async () => {
    const { createPaymentIntent } = await import(
      "../services/paymentService.js"
    );

    // Attempt to create PaymentIntent with invalid amount (too small for Stripe)
    // Note: Stripe minimum is 50 cents for USD, so this should fail
    await assert.rejects(
      async () => createPaymentIntent({ amount: 1, currency: "usd" }),
      (err) => {
        assert.ok(
          err.type?.startsWith("Stripe"),
          "Should be a Stripe error"
        );
        return true;
      }
    );
  }
);
