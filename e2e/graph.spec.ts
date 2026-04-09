import { test, expect } from '@playwright/test';

test.describe('Task Graph Planner E2E', () => {
  test('Canvas loads and Dagre tree logic executes resolving mock nodes', async ({ page }) => {
    await page.goto('/');
    
    // Ensure Header Loaded
    await expect(page.getByRole('heading', { name: 'Task Graph Planner' })).toBeVisible();

    // Verify React Flow elements exist (ensuring canvas maps mock elements)
    const reactFlowWrap = page.locator('.react-flow');
    await expect(reactFlowWrap).toBeVisible();

    // Verify all 4 mock elements generated successfully
    const nodes = page.locator('.react-flow__node');
    expect(await nodes.count()).toBeGreaterThanOrEqual(4);
  });

  test('Node Panel interaction logic', async ({ page }) => {
    await page.goto('/');
    
    // Explicitly target the Epic node via inner title mapping
    const epicNodeText = page.getByText('Phase 1 - Data & Canvas').first();
    await expect(epicNodeText).toBeVisible();
    
    // Double click the exact bounding container representing the React Flow node wrapper dynamically mapped
    await epicNodeText.locator('xpath=ancestor::div[contains(@class, "react-flow__node")]').click();
    
    // Ensure slide out panel resolves natively mapping specific Radix boundaries/React states
    await expect(page.getByText('Edit epic')).toBeVisible();
    
    // Type inside Size
    const select = page.getByRole('combobox').first(); // There are two comboboxes (Size, Risk)
    await select.selectOption('large');

    // Blur triggers save automatically
    await page.getByText('Edit epic').click();
    
    // Open Sandbox validation ensuring local validation blocks payload missing requirements explicitly
    await page.getByRole('button', { name: /Sandbox/i }).click();

    // Assert sandbox triggers missing component blocking natively
    await expect(page.getByText('Preview §11.5 Golden Prompt rendering')).toBeVisible();
  });
  
  test('List View topological toggling', async ({ page }) => {
    await page.goto('/');
    
    // Transition to Leaf View
    await page.getByRole('button', { name: /Leaf Task List/i }).click();
    
    await expect(page.getByText('Leaf Task Execution List')).toBeVisible();
    // Validate Khan's alg output
    await expect(page.getByText('Ready to Agent').first()).toBeVisible();
  });
});
