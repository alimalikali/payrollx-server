const app = require('../../src/app');

describe('app rate limiting', () => {
  it('does not apply an additional auth limiter to the entire auth router', () => {
    const authLimiterLayer = app._router.stack.find(
      (layer) => layer.regexp && layer.regexp.toString() === '/^\\/api\\/v1\\/auth\\/?(?=\\/|$)/i'
    );

    expect(authLimiterLayer).toBeUndefined();
  });
});
