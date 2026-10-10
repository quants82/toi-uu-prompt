import { test, expect } from "@playwright/test";
import { KEY_STORAGE_PREFIX } from "../../lib/credentials";
import { HISTORY_KEY } from "../../lib/storage";

test("remember keys: opt-in, reload, provider isolation, disabling and deleting", async ({ page }) => {
  await page.goto("/");
  const remember = page.getByRole("checkbox", { name: /Nhớ khóa API/ });
  await expect(remember).not.toBeChecked();
  await page.getByLabel("Khóa API", { exact: true }).fill("OPENAI-TEST-KEY");
  expect(await page.evaluate(prefix => localStorage.getItem(prefix + "openai"), KEY_STORAGE_PREFIX)).toBeNull();
  await remember.check();
  expect(await page.evaluate(prefix => localStorage.getItem(prefix + "openai"), KEY_STORAGE_PREFIX)).toBe("OPENAI-TEST-KEY");
  await page.getByRole("button", { name: "Google Gemini", exact: true }).click();
  await expect(remember).not.toBeChecked(); await expect(page.locator("#api-key")).toHaveValue("");
  await page.locator("#api-key").fill("GEMINI-TEST-KEY"); await remember.check();
  await page.reload();
  await expect(page.locator("#api-key")).toHaveValue("OPENAI-TEST-KEY"); await expect(remember).toBeChecked();
  await page.getByRole("button", { name: "Google Gemini", exact: true }).click();
  await expect(page.locator("#api-key")).toHaveValue("GEMINI-TEST-KEY"); await remember.uncheck();
  await expect(page.locator("#api-key")).toHaveValue("GEMINI-TEST-KEY");
  expect(await page.evaluate(prefix => localStorage.getItem(prefix + "gemini"), KEY_STORAGE_PREFIX)).toBeNull();
  await page.reload(); await page.getByRole("button", { name: "Google Gemini", exact: true }).click();
  await expect(page.locator("#api-key")).toHaveValue("");
  await page.getByRole("button", { name: "OpenAI", exact: true }).click();
  await page.getByRole("button", { name: "Xóa khóa API", exact: true }).click();
  await expect(page.locator("#api-key")).toHaveValue(""); await expect(remember).not.toBeChecked();
  expect(await page.evaluate(prefix => localStorage.getItem(prefix + "openai"), KEY_STORAGE_PREFIX)).toBeNull();
});

test("model choices and custom teacher role are sent to the selected provider; history excludes saved credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Môn học / lĩnh vực").fill("Vật lí");
  await expect(page.locator(".role-preview")).toContainText("giáo viên giỏi bộ môn Vật lí");
  await page.getByLabel("Vai trò của AI khi thực hiện prompt").selectOption("custom");
  await page.getByLabel("Vai trò tùy chỉnh").fill("Bạn là giáo viên giỏi bộ môn Vật lí có kinh nghiệm dạy học hòa nhập");
  await page.getByLabel("Loại công việc").selectOption("worksheet");
  await expect(page.getByLabel("Vai trò tùy chỉnh")).toHaveValue(/hòa nhập/);
  await page.getByRole("button", { name: "Dùng ví dụ", exact: true }).click();
  await page.locator("#api-key").fill("OPENAI-TEST-KEY");
  await page.getByRole("checkbox", { name: /Nhớ khóa API/ }).check();
  await page.route("**/api/models", async route => {
    expect(route.request().headers()["x-provider-key"]).toBe("OPENAI-TEST-KEY");
    expect(route.request().postDataJSON()).toEqual({ provider: "openai" });
    await route.fulfill({ json: { models: ["gpt-6.1-sol", "gpt-6.2-example"] } });
  });
  await page.getByRole("button", { name: "Tải danh sách mô hình từ API" }).click();
  await expect(page.locator(".model-note")).toContainText("Đã tải 2");
  await page.locator("#model").selectOption("gpt-6.2-example");
  await page.getByRole("button", { name: "Google Gemini", exact: true }).click();
  await page.locator("#model").selectOption("gemini-3.5-flash-lite");
  await page.getByRole("button", { name: "OpenAI", exact: true }).click();
  await expect(page.locator("#model")).toHaveValue("gpt-6.2-example");
  await page.locator("#model").selectOption("custom");
  await page.getByLabel("Mã mô hình khác").fill("gpt-4.1");
  await page.route("**/api/optimize", async route => {
    const body = route.request().postDataJSON();
    expect(body.provider).toBe("openai"); expect(body.model).toBe("gpt-4.1");
    expect(body.draft.fields.roleMode).toBe("custom"); expect(body.draft.fields.role).toContain("hòa nhập");
    expect(route.request().postData()).not.toContain("OPENAI-TEST-KEY");
    await route.fulfill({ json: { status: "ready", summary: "Đã tối ưu", questions: [], optimizedPrompt: "Vai trò: Bạn là giáo viên giỏi bộ môn Vật lí. Tạo phiếu học tập theo tài liệu.", improvements: [] } });
  });
  await page.getByRole("button", { name: "Tối ưu prompt với AI" }).click();
  await expect(page.getByRole("button", { name: "Word", exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), HISTORY_KEY)).not.toContain("OPENAI-TEST-KEY");
  await page.reload(); await page.getByRole("button", { name: /Lịch sử/ }).click();
  await page.locator(".history-item > button").first().click();
  await expect(page.locator("#model")).toHaveValue("gpt-4.1");
  await expect(page.getByLabel("Vai trò tùy chỉnh")).toHaveValue(/hòa nhập/);
});

test("mobile connection controls and failed model listing remain usable", async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto("/");
  await page.locator("#api-key").fill("OPENAI-TEST-KEY");
  await page.route("**/api/models", route => route.fulfill({ status: 401, json: { error: "Khóa API chưa được cấp quyền." } }));
  await page.getByRole("button", { name: "Tải danh sách mô hình từ API" }).click();
  await expect(page.locator(".model-note")).toContainText("chưa được cấp quyền");
  await expect(page.locator("#model")).toBeEnabled(); await page.locator("#model").selectOption("custom");
  await page.getByLabel("Mã mô hình khác").fill("gpt-4.1-mini");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/mobile-features.png",fullPage:true});
});