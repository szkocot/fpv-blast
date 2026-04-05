import { test, expect } from '@playwright/test';

const BASE = 'https://localhost:5175/';

function mockForecastPayload() {
  const time = Array.from({ length: 24 }, (_, index) => `2026-04-05T${String(index).padStart(2, '0')}:00`);
  const wind10 = Array.from({ length: 24 }, (_, index) => 12 + (index % 4));
  const wind80 = Array.from({ length: 24 }, (_, index) => 18 + (index % 4));

  return {
    hourly: {
      time,
      wind_speed_10m: wind10,
      wind_speed_80m: wind80,
      wind_speed_120m: wind80.map((value) => value + 3),
      wind_speed_180m: wind80.map((value) => value + 6),
      wind_direction_10m: Array.from({ length: 24 }, () => 180),
      wind_direction_80m: Array.from({ length: 24 }, () => 210),
      temperature_2m: Array.from({ length: 24 }, () => 17),
      weather_code: Array.from({ length: 24 }, () => 1),
      wind_gusts_10m: wind10.map((value) => value + 4),
    },
  };
}

test('wind map keeps auto browsing temporary and refetches on committed mode changes', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 52.23, longitude: 21.01 });

  const mainFetchCalls: string[] = [];

  await page.route('**/v1/forecast**', async (route) => {
    const url = route.request().url();
    if (url.includes('wind_speed_120m')) {
      mainFetchCalls.push(url);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockForecastPayload()),
    });
  });

  await page.route('**/reverse-geocode-client**', async (route) => {
    const url = new URL(route.request().url());
    const lat = Number(url.searchParams.get('latitude'));
    const city = lat > 51 ? 'Warsaw' : 'Krakow';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ city, countryName: 'Poland' }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('droneblast-settings', JSON.stringify({
      thresholdKmh: 25,
      unit: 'kmh',
      appearance: 'auto',
      refetchRadiusKm: 5,
      language: 'en',
      tempUnit: 'celsius',
      locationMode: 'auto',
      customLocation: { lat: 50.06, lon: 19.94, name: 'Krakow, Poland' },
    }));
  });

  await page.goto(BASE);
  await expect(page.getByText('Warsaw, Poland').first()).toBeVisible({ timeout: 10_000 });

  const afterInitialLoad = mainFetchCalls.length;

  await page.getByRole('button', { name: /map/i }).click();
  await page.waitForTimeout(500);
  expect(mainFetchCalls.length).toBe(afterInitialLoad);

  const beforeCustomCommit = mainFetchCalls.length;
  await page.locator('.mode-toggle button').nth(1).evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole('button', { name: /use this spot/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /use this spot/i }).click();

  await expect(page.getByText('Warsaw, Poland').first()).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => mainFetchCalls.length).toBeGreaterThan(beforeCustomCommit);

  await page.getByRole('button', { name: /map/i }).click();
  const beforeAutoCommit = mainFetchCalls.length;
  await page.locator('.mode-toggle button').nth(0).evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole('button', { name: /use gps/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /use gps/i }).click();

  await expect(page.getByText('Warsaw, Poland').first()).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => mainFetchCalls.length).toBeGreaterThan(beforeAutoCommit);
});
