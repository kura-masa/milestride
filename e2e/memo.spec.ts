import { test, expect } from "@playwright/test";

test.describe("MemoEditor — Android/Chromium bug reproduction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test-memo");
    await page.waitForSelector('[data-testid="editor-wrapper"] .tiptap');
  });

  test("enter inside chip should NOT clear the chip text", async ({ page }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.locator('[data-testid="add-item"]').tap();
    await page.waitForTimeout(150);
    await page.keyboard.type("foo");
    await page.keyboard.press("Enter");
    // After Enter, caret should be after the chip — chip text "foo" must remain
    const memo = await page
      .locator('[data-testid="serialized"]')
      .textContent();
    console.log("After Enter memo:", memo);
    expect(memo).toContain("[ ]foo[/]");
  });

  test("backspace immediately after the chip removes one char of label, not the whole chip", async ({
    page,
  }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.locator('[data-testid="add-item"]').tap();
    await page.waitForTimeout(150);
    await page.keyboard.type("abc");
    // Cursor is inside chip after "abc". Press backspace once.
    await page.keyboard.press("Backspace");
    const memo = await page
      .locator('[data-testid="serialized"]')
      .textContent();
    console.log("After Backspace memo:", memo);
    expect(memo).toContain("[ ]ab[/]");
  });

  test("backspace at start of empty chip removes the chip", async ({
    page,
  }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.locator('[data-testid="add-item"]').tap();
    await page.waitForTimeout(150);
    // Empty chip; pressing Backspace at start should remove the chip
    await page.keyboard.press("Backspace");
    const memo = await page
      .locator('[data-testid="serialized"]')
      .textContent();
    console.log("Empty-chip-backspace memo:", memo);
    expect(memo).not.toContain("[ ]");
  });

  test("backspace right after chip closing should not delete chip when prose follows", async ({
    page,
  }) => {
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("hello");
    await page.locator('[data-testid="add-item"]').tap();
    await page.waitForTimeout(150);
    await page.keyboard.type("foo");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("bar");
    // memo: hello[ ]foo[/]bar  (cursor at end)
    await page.keyboard.press("Backspace");
    const memo = await page
      .locator('[data-testid="serialized"]')
      .textContent();
    console.log("backspace-after-chip memo:", memo);
    expect(memo).toContain("[ ]foo[/]");
    expect(memo).toContain("ba");
    expect(memo).not.toContain("bar");
  });
});
