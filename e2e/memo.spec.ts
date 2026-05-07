import { test, expect } from "@playwright/test";

test.describe("MemoEditor inline check insertion (mobile WebKit)", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/test-memo", { timeout: 90_000 });
    await page.waitForSelector('[data-testid="editor-wrapper"] .tiptap', {
      timeout: 60_000,
    });
  });

  test("focusing the editor first, then typing prose", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("hello");
    await expect(editor).toContainText("hello");
    const memo = await page
      .locator('[data-testid="serialized"]')
      .textContent();
    expect(memo).toContain("hello");
  });

  test("add inline check, then typed text lands INSIDE the chip label", async ({
    page,
  }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("今日は");

    // Tap "+ 項目を追加"
    await page.locator('[data-testid="add-item"]').tap();

    // Allow ProseMirror to settle
    await page.waitForTimeout(150);

    await page.keyboard.type("1章を読む");

    // Inspect serialized memo for `[ ]1章を読む[/]` pattern
    const memo = await page
      .locator('[data-testid="serialized"]')
      .textContent();
    console.log("Serialized memo:", memo);
    expect(memo).toContain("[ ]1章を読む[/]");

    // Inspect DOM: text should be inside .inline-check-label
    const labelText = await page.locator(".inline-check-label").innerText();
    console.log("Label text:", JSON.stringify(labelText));
    expect(labelText.replace(/​/g, "")).toBe("1章を読む");
  });

  test("tapping + twice yields exactly 2 chips (not 3)", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    const addBtn = page.locator('[data-testid="add-item"]');
    await addBtn.tap();
    await page.waitForTimeout(120);
    await page.keyboard.type("aaa");
    await addBtn.tap();
    await page.waitForTimeout(120);
    await page.keyboard.type("bbb");

    const memo = await page
      .locator('[data-testid="serialized"]')
      .textContent();
    console.log("Two-tap memo:", memo);
    // Expect exactly two chips: aaa then bbb
    const chipCount = (memo?.match(/\[ \]/g) || []).length;
    expect(chipCount).toBe(2);
    expect(memo).toContain("[ ]aaa[/]");
    expect(memo).toContain("[ ]bbb[/]");
  });

  test("type after escaping the chip with arrow right", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.locator('[data-testid="add-item"]').tap();
    await page.waitForTimeout(100);
    await page.keyboard.type("foo");
    // Single ArrowRight should escape the chip
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("。");

    const memo = await page
      .locator('[data-testid="serialized"]')
      .textContent();
    console.log("After-escape memo:", memo);
    // Expected: foo inside the chip, 。 outside (after the chip)
    expect(memo).toContain("[ ]foo[/]。");
  });
});
