import { test, expect } from "@playwright/test";

type RequiredEnvVar = "E2E_USERNAME" | "E2E_PASSWORD";

function getEnv(name: RequiredEnvVar): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByTestId("login-page")).toBeVisible();
  });

  test("logs in with valid credentials and redirects to recipes", async ({ page }) => {
    const email = getEnv("E2E_USERNAME");
    const password = getEnv("E2E_PASSWORD");

    console.log("🔍 Test 1 - Valid credentials:");
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);

    await page.getByTestId("email-input").fill(email);
    await page.getByTestId("password-input").fill(password);

    await page.getByTestId("login-submit-button").click();
    const waitForRecipes = (timeout: number) => page.waitForURL("**/recipes", { timeout });

    const totalTimeout = 30_000;
    const attemptTimeout = 5_000;
    const deadline = Date.now() + totalTimeout;
    let lastError: unknown;

    while (Date.now() < deadline) {
      const remaining = Math.max(0, deadline - Date.now());
      const timeout = Math.min(attemptTimeout, remaining || attemptTimeout);

      try {
        await waitForRecipes(timeout);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;

        if (Date.now() >= deadline) {
          break;
        }

        await page.getByTestId("email-input").fill(email);
        await page.getByTestId("password-input").fill(password);
        await page.getByTestId("login-submit-button").click();
      }
    }

    if (lastError) {
      throw lastError;
    }

    await expect(page).toHaveURL(/\/recipes/);
    await expect(page.getByTestId("recipe-preview-spread")).toBeVisible();
  });

  test("shows an error when the password is incorrect", async ({ page }) => {
    const email = getEnv("E2E_USERNAME");

    console.log("🔍 Test 2 - Invalid password:");
    console.log(`  Email: ${email}`);

    await page.getByTestId("email-input").fill(email);
    await page.getByTestId("password-input").fill(`${Date.now()}-wrong`);

    await page.getByTestId("login-submit-button").click();

    const alert = page.getByTestId("login-error-alert");
    const totalTimeout = 30_000;
    const attemptTimeout = 5_000;
    const deadline = Date.now() + totalTimeout;
    let lastError: unknown;

    while (Date.now() < deadline) {
      const remaining = Math.max(0, deadline - Date.now());
      const timeout = Math.min(attemptTimeout, remaining || attemptTimeout);

      try {
        await expect(alert).toBeVisible({ timeout });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;

        if (Date.now() >= deadline) {
          break;
        }

        await page.getByTestId("email-input").fill(email);
        await page.getByTestId("password-input").fill(`${Date.now()}-wrong`);
        await page.getByTestId("login-submit-button").click();
      }
    }

    if (lastError) {
      throw lastError;
    }

    await expect(alert).toContainText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
