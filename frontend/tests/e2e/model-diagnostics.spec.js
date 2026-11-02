import { test, expect } from '@playwright/test'
import process from 'node:process'

const API = 'http://127.0.0.1:18000/predict/t0-verified'
const requireDiagnostic = () => test.skip(!process.env.TRENDIT_TEST_DIAGNOSTICS_ID, 'Full diagnostics are an explicit offline job, not a retraining step on every CI run.')

test('REAL diagnostic: five seeds and video bootstrap match API; slider changes validation display only', async ({ page, request }) => {
  requireDiagnostic()
  const response = await request.get(`${API}/diagnostics`)
  expect(response.status()).toBe(200)
  const body = await response.json()
  await page.goto('/analysis/model')
  await expect(page.getByTestId('seed-comparison').locator('tbody tr')).toHaveCount(5)
  await expect(page.getByTestId('seed-auc-summary')).toContainText(body.test_seed_summary.auc.mean.toFixed(4))
  await expect(page.getByTestId('bootstrap-auc')).toContainText(body.bootstrap.intervals.embedding_mlp.auc.lower.toFixed(4))
  await page.getByLabel('Validation 탐색 임계값').focus()
  await page.getByLabel('Validation 탐색 임계값').press('End')
  const point = body.validation_threshold_curve.find(row => row.threshold === .95)
  await expect(page.getByTestId('validation-threshold-point')).toContainText(point.precision.toFixed(4))
  await expect(page.getByTestId('validation-threshold-point')).toContainText(point.recall.toFixed(4))
  await expect(page.getByTestId('model-comparison')).toContainText('0.44')
})

test('Diagnostic unavailable: primary evaluation remains usable and no interval is invented', async ({ page }) => {
  await page.route('**/predict/t0-verified/diagnostics', route => route.fulfill({ status: 503, json: { detail: 'unavailable' } }))
  await page.goto('/analysis/model')
  await expect(page.getByTestId('model-diagnostics')).toContainText('추가 진단')
  await expect(page.getByTestId('selected-model')).toBeVisible()
  await expect(page.getByRole('button', { name: '추가 진단 다시 불러오기' })).toBeVisible()
  await expect(page.getByTestId('seed-comparison')).toHaveCount(0)
  await expect(page.getByTestId('bootstrap-auc')).toHaveCount(0)
})

test('REAL diagnostic fixture with wrong baseline is rejected instead of being mixed with current model', async ({ page, request }) => {
  requireDiagnostic()
  const body = await (await request.get(`${API}/diagnostics`)).json()
  body.base_run_id = 'another-run'
  await page.route('**/predict/t0-verified/diagnostics', route => route.fulfill({ json: body }))
  await page.goto('/analysis/model')
  await expect(page.getByTestId('model-diagnostics')).toContainText('일치하지 않습니다')
  await expect(page.getByTestId('seed-comparison')).toHaveCount(0)
})
