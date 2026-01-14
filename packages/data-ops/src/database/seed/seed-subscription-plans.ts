import { seedSubscriptionPlans } from './subscription-plans';

seedSubscriptionPlans()
  .then(() => {
    console.log('✓ Subscription plans seed complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ Subscription plans seed failed:', err);
    process.exit(1);
  });
