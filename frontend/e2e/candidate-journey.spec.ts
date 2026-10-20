import { expect, test } from "@playwright/test";

test("landing page routes candidates and recruiters to the correct login flow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Build a stronger resume. Make hiring clearer." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Candidate Portal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recruiter Workspace" })).toBeVisible();

  await page.getByRole("link", { name: "Recruiter sign in" }).click();
  await expect(page).toHaveURL(/\/auth\?portal=recruiter$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("Need recruiter access? Ask your HireMind administrator to provision your account.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create a candidate account" })).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("link", { name: "Create candidate account" }).first().click();
  await expect(page).toHaveURL(/\/auth\?portal=candidate&mode=register$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();
});

test("candidate can register, edit a resume, preview, export PDF, and refresh directly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth");
  await page.getByRole("button", { name: "Create a candidate account" }).click();
  const suffix = `${Date.now()}@example.test`;
  await page.getByLabel("Full name").fill("E2E Candidate");
  await page.getByLabel("Email", { exact: true }).fill(`e2e-${suffix}`);
  await page.getByLabel("Password", { exact: true }).fill("A-Long-E2E-Passphrase-123!");
  await page.getByRole("button", { name: "Create a candidate account" }).click();

  await expect(page).toHaveURL(/\/candidate$/);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Resume builder", exact: true }).click();
  await expect(page).toHaveURL(/\/candidate\/resume-builder$/);
  await page.getByLabel("Full Name").fill("E2E Candidate");
  await page.getByPlaceholder("jane@example.com").fill(`e2e-${suffix}`);
  await expect(page.locator("#resume-preview-surface")).toContainText("E2E Candidate");
  const profilePhotoData = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.fillStyle = "#5548e8";
    context.fillRect(0, 0, 160, 160);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Upload Photo (Optional)").setInputFiles({
    name: "profile.png", mimeType: "image/png", buffer: Buffer.from(profilePhotoData, "base64")
  });
  await expect(page.getByRole("dialog", { name: "Crop Photo" })).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByAltText("E2E Candidate profile photo")).toBeVisible();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator(".resume-builder-app")).toHaveClass(/dark/);

  await page.locator("select").filter({ has: page.locator('option[value="Minimal"]') }).selectOption("Minimal");
  await page.locator("select").filter({ has: page.locator('option[value="emerald"]') }).selectOption("emerald");
  await page.locator("select").filter({ has: page.locator('option[value="Serif"]') }).selectOption("Serif");
  const font = page.locator("select").filter({ has: page.locator('option[value="merriweather"]') });
  await font.selectOption("merriweather");
  await page.getByRole("button", { name: "Save a copy" }).click();
  await expect(page.getByText("Resume saved in this browser.")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/i);

  await page.reload();
  await expect(page).toHaveURL(/\/candidate\/resume-builder$/);
  await expect(page.locator("#resume-preview-surface")).toContainText("E2E Candidate");
  await expect(page.locator(".resume-builder-app")).toHaveClass(/dark/);
  await expect(page.locator("select").filter({ has: page.locator('option[value="emerald"]') })).toHaveValue("emerald");
  await expect(page.locator("select").filter({ has: page.locator('option[value="merriweather"]') })).toHaveValue("merriweather");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("complementary", { name: "candidate navigation" }).getByRole("link", { name: "Saved resumes" }).click();
  await expect(page.getByText("E2E Candidate").first()).toBeVisible();
  await page.getByRole("button", { name: "Use in builder" }).click();
  await expect(page).toHaveURL(/\/candidate\/resume-builder$/);
  await expect(page.locator("select").filter({ has: page.locator('option[value="emerald"]') })).toHaveValue("emerald");
  expect(errors).toEqual([]);
  const horizontalOverflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    elements: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => ({ tag: element.tagName, className: String(element.className).slice(0, 100), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) }))
      .filter((element) => element.right > window.innerWidth + 1)
      .slice(0, 8)
  }));
  expect(horizontalOverflow.document <= horizontalOverflow.viewport, JSON.stringify(horizontalOverflow)).toBe(true);
});

test("login displays a useful error when the API cannot be reached", async ({ page }) => {
  await page.route("**/api/v1/auth/login", (route) => route.abort());
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill("candidate@example.test");
  await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot reach HireMind API");
});
