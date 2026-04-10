import { test, expect } from '@playwright/test';

// Clear IndexedDB before each test to prevent data accumulation across runs
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('TaskGraphDB');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve(); // Resolve even if blocked — will clear on reload
    });
  });
  // Reload so the app re-initialises with fresh mock data
  await page.reload();
});

test.describe('Task Graph Planner E2E', () => {
  test('Canvas loads and Dagre tree logic executes resolving mock nodes', async ({ page }) => {
    // Ensure Header Loaded
    await expect(page.getByRole('heading', { name: 'Task Graph Planner' })).toBeVisible();

    // Verify React Flow elements exist (ensuring canvas maps mock elements)
    const reactFlowWrap = page.locator('.react-flow');
    await expect(reactFlowWrap).toBeVisible();

    // Verify all 4 mock elements generated successfully — wait for them to render after DB init
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 8000 });
    expect(await nodes.count()).toBeGreaterThanOrEqual(4);
  });

  test('Node Panel interaction logic', async ({ page }) => {
    // Target the epic node by its data-testid (avoids strict-mode multi-match)
    const epicNode = page.locator('[data-testid="node-card-epic"]').first();
    await expect(epicNode).toBeVisible({ timeout: 8000 });

    // Click to open the edit panel
    await epicNode.click({ force: true });

    // Ensure slide out panel resolves
    const panelHeader = page.getByRole('heading', { name: /Edit/i });
    await expect(panelHeader).toBeVisible();

    // Change the Size dropdown
    const select = page.getByRole('combobox').first();
    await select.selectOption('large');

    // Blur by clicking the panel header
    await panelHeader.click();

    // Open Sandbox
    await page.getByRole('button', { name: /Sandbox/i }).click();

    // PromptSandbox was rewritten in B3 — assert on the visible copy button instead of the old description string
    await expect(page.getByTestId('sandbox-copy-button')).toBeVisible();
  });

  test('List View topological toggling', async ({ page }) => {
    // Transition to Leaf View
    await page.getByRole('button', { name: /Leaf Task List/i }).click();

    await expect(page.getByText('Leaf Task Execution List')).toBeVisible();
    // Validate topological ordering output
    await expect(page.getByText('Ready to Agent').first()).toBeVisible();
  });

  test('Model selector expands and shows available models', async ({ page }) => {
    // Click an epic node to open the panel
    const anyNode = page.locator('.react-flow__node').first();
    await expect(anyNode).toBeVisible({ timeout: 8000 });
    await anyNode.click({ force: true });

    // Panel should be open — click Model selector toggle
    const modelToggle = page.getByText(/Model:/i);
    await expect(modelToggle).toBeVisible();
    await modelToggle.click();

    // The model list or offline warning should appear
    const modelListOrWarning = page.locator('text=/FITS|TOO LARGE|Backend offline/i');
    await expect(modelListOrWarning.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Phase A tests ────────────────────────────────────────────────────────

  test('readiness badge appears on canvas nodes', async ({ page }) => {
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 8000 });

    const badge = page.getByTestId('readiness-badge').first();
    await expect(badge).toBeVisible();

    const text = await badge.textContent();
    expect(['Draft', 'Refine', 'Ready'].some(label => text?.includes(label))).toBe(true);
  });

  test('node review — Review Task returns a gap report in the edit panel', async ({ page }) => {
    await page.route('**/llm/review', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          passed: false,
          readiness: 'red',
          issues: [{
            field: 'objective',
            severity: 'blocking',
            problem: 'Objective too short',
            suggestion: 'Write a full sentence',
          }],
        }),
      });
    });

    const anyNode = page.locator('.react-flow__node').first();
    await expect(anyNode).toBeVisible({ timeout: 8000 });
    await anyNode.click({ force: true });
    await expect(page.getByRole('heading', { name: /Edit/i })).toBeVisible();

    const reviewBtn = page.getByTestId('review-task-button');
    await reviewBtn.scrollIntoViewIfNeeded();
    await reviewBtn.click();

    const report = page.getByTestId('review-report');
    await expect(report).toBeVisible({ timeout: 10000 });
    await expect(report.getByText('objective')).toBeVisible();
    await expect(report.getByText('Objective too short')).toBeVisible();
  });

  test('node regen — Regenerate applies proposed changes to a node', async ({ page }) => {
    await page.route('**/llm/regen', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ objective: 'Updated objective from regen' }),
      });
    });

    const anyNode = page.locator('.react-flow__node').first();
    await expect(anyNode).toBeVisible({ timeout: 8000 });
    await anyNode.click({ force: true });
    await expect(page.getByRole('heading', { name: /Edit/i })).toBeVisible();

    const regenBtn = page.getByTestId('regen-button');
    await regenBtn.scrollIntoViewIfNeeded();
    await regenBtn.click();

    const instructionArea = page.getByTestId('regen-instruction');
    await expect(instructionArea).toBeVisible();
    await instructionArea.fill('make the objective more specific');

    await page.getByTestId('regen-generate-button').click();

    const preview = page.getByTestId('regen-preview');
    await expect(preview).toBeVisible({ timeout: 10000 });
    await expect(preview.getByText('Updated objective from regen')).toBeVisible();

    await page.getByTestId('regen-apply-button').click();
    await expect(instructionArea).toBeHidden();
  });

  // ─── Phase B tests ────────────────────────────────────────────────────────

  test('prompt sandbox — renders a prompt for a leaf task', async ({ page }) => {
    const leafNode = page.locator('[data-testid="node-card-leaf_task"]').first();
    await expect(leafNode).toBeVisible({ timeout: 8000 });
    await leafNode.click({ force: true });
    await expect(page.getByRole('heading', { name: /Edit/i })).toBeVisible();

    await page.getByRole('button', { name: /Sandbox/i }).click();

    const sandboxPrompt = page.getByTestId('sandbox-prompt');
    await expect(sandboxPrompt).toBeVisible({ timeout: 5000 });
    await expect(sandboxPrompt).toContainText('## Task:');
    await expect(page.getByTestId('sandbox-copy-button')).toBeVisible();
  });
});
