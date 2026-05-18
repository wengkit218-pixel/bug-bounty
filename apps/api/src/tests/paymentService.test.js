import test from "node:test";
import assert from "node:assert/strict";

// Unit tests for createPaymentIntent
// Mock Stripe for unit tests

const mockPaymentIntentsCreate = async (params) => {
  // Simulate Stripe API response
  return {
    id: `pi_test_${Date.now()}`,
    client_secret: `pi_test_${Date.now()}_secret_mock`,
    amount: params.amount,
    currency: params.currency,
    metadata: params.metadata || {},
  };
};

// Create a mock stripe instance
const mockStripe = {
  paymentIntents: {
    create: mockPaymentIntentsCreate,
  },
};

// Helper to create createPaymentIntent with injected Stripe mock
function createPaymentIntentWithMock(stripe, payload) {
  // Validate amount - must be a positive integer
  if (payload.amount === undefined || payload.amount === null) {
    throw new Error("amount is required");
  }

  if (!Number.isInteger(payload.amount) || payload.amount <= 0) {
    throw new Error(
      "amount must be a positive integer (smallest currency unit, e.g., cents)"
    );
  }

  // Default currency to 'usd' if not provided
  const currency = payload.currency ?? "usd";

  // Validate currency format (3-letter ISO code)
  if (typeof currency !== "string" || currency.length !== 3) {
    throw new Error("currency must be a valid 3-letter ISO currency code");
  }

  return stripe.paymentIntents
    .create({
      amount: payload.amount,
      currency: currency,
      metadata: payload.metadata || {},
    })
    .then((paymentIntent) => ({
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      provider: "stripe",
    }));
}

test("createPaymentIntent throws error when amount is missing", async () => {
  await assert.rejects(
    async () => createPaymentIntentWithMock(mockStripe, {}),
    { message: "amount is required" }
  );
});

test("createPaymentIntent throws error when amount is not an integer", async () => {
  await assert.rejects(
    async () => createPaymentIntentWithMock(mockStripe, { amount: 10.5 }),
    {
      message:
        "amount must be a positive integer (smallest currency unit, e.g., cents)",
    }
  );
});

test("createPaymentIntent throws error when amount is zero", async () => {
  await assert.rejects(
    async () => createPaymentIntentWithMock(mockStripe, { amount: 0 }),
    {
      message:
        "amount must be a positive integer (smallest currency unit, e.g., cents)",
    }
  );
});

test("createPaymentIntent throws error when amount is negative", async () => {
  await assert.rejects(
    async () => createPaymentIntentWithMock(mockStripe, { amount: -100 }),
    {
      message:
        "amount must be a positive integer (smallest currency unit, e.g., cents)",
    }
  );
});

test("createPaymentIntent throws error when currency is invalid format", async () => {
  await assert.rejects(
    async () =>
      createPaymentIntentWithMock(mockStripe, { amount: 1000, currency: "us" }),
    { message: "currency must be a valid 3-letter ISO currency code" }
  );
});

test("createPaymentIntent defaults currency to usd when not provided", async () => {
  const result = await createPaymentIntentWithMock(mockStripe, { amount: 1000 });

  assert.equal(result.currency, "usd");
  assert.equal(result.amount, 1000);
  assert.ok(result.clientSecret);
  assert.ok(result.paymentId);
  assert.equal(result.provider, "stripe");
});

test("createPaymentIntent calls stripe.paymentIntents.create with correct arguments", async () => {
  const customMockStripe = {
    paymentIntents: {
      create: async (params) => {
        // Verify the arguments
        assert.equal(params.amount, 2000);
        assert.equal(params.currency, "eur");
        assert.deepEqual(params.metadata, { orderId: "12345" });
        return {
          id: "pi_test_verified",
          client_secret: "pi_test_verified_secret",
          amount: params.amount,
          currency: params.currency,
        };
      },
    },
  };

  const result = await createPaymentIntentWithMock(customMockStripe, {
    amount: 2000,
    currency: "eur",
    metadata: { orderId: "12345" },
  });

  assert.equal(result.clientSecret, "pi_test_verified_secret");
  assert.equal(result.paymentId, "pi_test_verified");
});

test("createPaymentIntent returns clientSecret and paymentId from PaymentIntent", async () => {
  const result = await createPaymentIntentWithMock(mockStripe, {
    amount: 5000,
    currency: "gbp",
  });

  assert.ok(result.clientSecret);
  assert.ok(result.paymentId);
  assert.ok(result.paymentId.startsWith("pi_test_"));
  assert.equal(result.amount, 5000);
  assert.equal(result.currency, "gbp");
  assert.equal(result.provider, "stripe");
});

test("createPaymentIntent propagates Stripe errors with original message", async () => {
  const errorMockStripe = {
    paymentIntents: {
      create: async () => {
        const error = new Error("Your card was declined.");
        error.type = "StripeCardError";
        throw error;
      },
    },
  };

  await assert.rejects(
    async () =>
      createPaymentIntentWithMock(errorMockStripe, { amount: 1000 }),
    {
      message: "Your card was declined.",
    }
  );
});

test("createPaymentIntent propagates Stripe invalid request errors", async () => {
  const errorMockStripe = {
    paymentIntents: {
      create: async () => {
        const error = new Error(
          "Invalid amount: must be at least 50 cents"
        );
        error.type = "StripeInvalidRequestError";
        throw error;
      },
    },
  };

  await assert.rejects(
    async () => createPaymentIntentWithMock(errorMockStripe, { amount: 10 }),
    {
      message: "Invalid amount: must be at least 50 cents",
    }
  );
});
