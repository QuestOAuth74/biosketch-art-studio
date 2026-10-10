# I/O Stress Test

Automated stress test to verify Supabase I/O timeout fixes are working correctly in production.

## What This Test Does

Simulates **heavy production load** to verify connection pool optimizations:

1. **Spawns 20 concurrent users** making various database queries
2. **Spawns 5 admin users** polling for notifications every 60 seconds
3. **Spawns 5 heavy workers** loading multiple icon categories simultaneously
4. **Runs for 60 seconds** measuring performance and errors
5. **Reports pass/fail** based on I/O timeouts, error rates, and response times

## Prerequisites

Ensure environment variables are set in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Running the Test

### Against Production Database:

```bash
npm run test:stress
```

### Against Test Database:

Create `.env.stress` with test database credentials, then:

```bash
# Load test env and run
cp .env.stress .env.local
npm run test:stress
cp .env.local.backup .env.local  # restore
```

## Test Configuration

Edit `tests/stress/io-stress-test.ts` to adjust:

```typescript
const TEST_CONFIG = {
  CONCURRENT_USERS: 20,        // Number of regular users
  ADMIN_USERS: 5,              // Number of admins polling
  DURATION_SECONDS: 60,        // Test duration
  ADMIN_POLL_INTERVAL_MS: 60000,  // Admin poll frequency
  USER_QUERY_INTERVAL_MS: 5000,   // User query frequency
  MAX_RESPONSE_TIME_MS: 2000,     // Max acceptable response
  MAX_ERROR_RATE_PERCENT: 1,      // Max error rate (1%)
};
```

## Interpreting Results

### ✅ PASS Criteria:

```
Request Statistics:
  Total Requests:      1250
  Successful:          1248 ✅
  Failed:              2 ✅
  I/O Timeouts:        0 ✅
  Error Rate:          0.16% ✅

Response Times:
  Average:             145ms ✅
  Min:                 12ms
  Max:                 890ms ✅

✅ STRESS TEST PASSED - I/O issue is RESOLVED
```

**Pass conditions:**
- 0 I/O timeouts
- Error rate ≤ 1%
- Average response time ≤ 2000ms

### ❌ FAIL Example:

```
Request Statistics:
  Total Requests:      850
  Successful:          780 ✅
  Failed:              70 ❌
  I/O Timeouts:        35 ❌
  Error Rate:          8.24% ❌

Response Times:
  Average:             3450ms ⚠️
  Min:                 120ms
  Max:                 12000ms ❌

❌ STRESS TEST FAILED - I/O issues still present

   - 35 I/O timeout(s) detected
   - Error rate 8.24% exceeds 1% threshold
   - Average response time 3450ms exceeds 2000ms threshold
```

**Failure indicates:**
- Connection pool exhaustion
- Database performance issues
- Optimizations not deployed correctly

## What the Test Simulates

### Admin User Behavior:
```typescript
// Every 60 seconds, admins run 5 COUNT queries in parallel
await Promise.all([
  count('canvas_projects', 'pending'),
  count('testimonials', 'not approved'),
  count('icon_submissions', 'pending'),
  count('contact_messages', 'unread'),
  count('tool_feedback', 'unviewed')
]);
```

### Regular User Behavior:
```typescript
// Random queries every 5-8 seconds:
- Load icons by category (20 items)
- Load all categories
- Load community templates (50 items)
- Search icons by text
```

### Heavy Worker Behavior:
```typescript
// Every 2 seconds, load 3 categories simultaneously:
await Promise.all([
  loadIcons('chemistry'),
  loadIcons('biology'),
  loadIcons('physics')
]);
```

## Monitoring During Test

### Watch Supabase Dashboard:

1. Go to: Supabase Dashboard → Database → Connection Pool
2. Watch connection count during test
3. Should stay well under limit (< 50 on free tier)

### Watch Console Output:

```
[Progress] Requests: 250 | Success: 248 | Failed: 2
[Progress] Requests: 500 | Success: 495 | Failed: 5
[Progress] Requests: 750 | Success: 742 | Failed: 8
```

## Before/After Comparison

### Before Fixes:
```
Expected Results (before optimization):
  Total Requests:      ~600 (many timed out)
  Failed:              150-200 ❌
  I/O Timeouts:        50-100 ❌
  Error Rate:          25-33% ❌
  Avg Response:        5000-8000ms ❌
```

### After Fixes:
```
Expected Results (after optimization):
  Total Requests:      1200-1500
  Failed:              0-15 ✅
  I/O Timeouts:        0 ✅
  Error Rate:          0-1% ✅
  Avg Response:        100-500ms ✅
```

## Troubleshooting

### Test Fails with "Missing environment variables"
```bash
# Check .env.local exists and contains:
cat .env.local | grep SUPABASE
```

### High Error Rate but No I/O Timeouts
- Check RLS policies (may be blocking queries)
- Check indexes are applied: `supabase db push`
- Review error messages in test output

### I/O Timeouts Still Occurring
- Verify code changes deployed
- Check AdminNotificationBell using polling (not realtime)
- Check connection count in Supabase Dashboard
- May need to upgrade Supabase plan

### Test Takes Too Long
- Reduce `DURATION_SECONDS` to 30
- Reduce `CONCURRENT_USERS` to 10
- Increase `USER_QUERY_INTERVAL_MS` to 10000

## Continuous Monitoring

Run this test:
- ✅ After deploying performance fixes
- ✅ Weekly to ensure no regression
- ✅ Before major releases
- ✅ When adding new features that query database

## Related Files

- Performance fixes: `src/components/admin/AdminNotificationBell.tsx`
- Database indexes: `supabase/migrations/20251217000000_add_performance_indexes.sql`
- Connection config: `src/integrations/supabase/client.ts`

---

**Exit codes:**
- `0` = Test passed
- `1` = Test failed or error occurred
