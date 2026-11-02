import { test, expect } from '@playwright/test'

test('REAL home: observed source and verified classifier replace LIVE demo and unsupported 24h or regression claims', async ({ page, request }) => {
  const data = await (await request.get('http://127.0.0.1:18000/eda/summary')).json()
  await page.goto('/')
  await expect(page.getByTestId('home-observed-count')).toContainText(data.population.events.toLocaleString('ko-KR'))
  await expect(page.locator('.home-observations')).toContainText(data.category_summary.find(row => row.category === 'Education').events.toLocaleString('ko-KR'))
  await expect(page.getByText('LIVE', { exact: true })).toHaveCount(0)
  await expect(page.getByText('회귀 타겟', { exact: false })).toHaveCount(0)
  await expect(page.getByText('선택 영상의 24h 성장 그래프', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '최초 관측값으로 예측하기 →', exact: true })).toBeVisible()
})

test('Home observation failure is explicit and does not fill old snapshot statistics; retry recovers', async ({ page }) => {
  await page.route('**/eda/summary', route => route.fulfill({ status: 503, json: { detail: 'unavailable' } }))
  await page.goto('/')
  await expect(page.locator('.home-observations').getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('home-observed-count')).toHaveCount(0)
  await expect(page.locator('.home-stats')).not.toContainText('34,964')
  await expect(page.getByTestId('home-verified-metrics')).toContainText('embedding_mlp')
  await page.unroute('**/eda/summary')
  await page.getByRole('button', { name: '관측 자료 다시 불러오기', exact: true }).click()
  await expect(page.getByTestId('home-observed-count')).toContainText('34,964')
})
