import { expect, test } from '@playwright/test';

test('P0-002 portal has no franchisee or regional-sharing entrance', async ({
  page,
  request,
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  const links = page.locator('a');
  const visibleEntrances = await links.evaluateAll((elements) =>
    elements.map((element) => ({
      href: element.getAttribute('href') ?? '',
      text: element.textContent ?? '',
    })),
  );
  expect(JSON.stringify(visibleEntrances)).not.toMatch(
    /franchise|jiameng|加盟商|区域代理|区域分账|加盟合同/iu,
  );

  for (const path of [
    '/franchisee/register',
    '/franchisee/admin',
    '/regional-revenue-share',
    '/franchise-contracts',
    '/jiameng/register',
  ]) {
    const forbiddenRoute = await request.get(path);
    expect(forbiddenRoute.status(), path).toBe(404);
  }
});
