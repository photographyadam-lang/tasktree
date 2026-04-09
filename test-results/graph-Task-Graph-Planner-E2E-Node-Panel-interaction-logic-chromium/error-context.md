# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: graph.spec.ts >> Task Graph Planner E2E >> Node Panel interaction logic
- Location: e2e\graph.spec.ts:19:3

# Error details

```
Error: locator.click: Error: strict mode violation: getByText('Phase 1 - Data & Canvas').first().locator('xpath=ancestor::div[contains(@class, "react-flow__node")]') resolved to 2 elements:
    1) <div class="react-flow__nodes">…</div> aka getByText('projectTask Graph Planner DeliveryepicPhase 1 - Data & CanvasepicPhase 1 - Data')
    2) <div tabindex="0" role="button" aria-describedby="react-flow__node-desc-1" data-id="27e67931-3f20-4338-bee6-05cb92254401" data-testid="rf__node-27e67931-3f20-4338-bee6-05cb92254401" class="react-flow__node react-flow__node-taskGraphNode nopan selectable">…</div> aka getByTestId('rf__node-27e67931-3f20-4338-bee6-05cb92254401')

Call log:
  - waiting for getByText('Phase 1 - Data & Canvas').first().locator('xpath=ancestor::div[contains(@class, "react-flow__node")]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - heading "Task Graph Planner" [level=1] [ref=e5]: Task Graph Planner
    - generic [ref=e7]:
      - button "Export JSON" [ref=e8]
      - button "Export MD" [ref=e9]
      - button "Leaf Task List" [ref=e10]
  - generic [ref=e13]:
    - generic [ref=e15]:
      - generic:
        - img:
          - generic:
            - button "Edge from 53659eea-e37d-400c-b86b-d886b0738ad1 to c87aeb1b-02d8-4f2c-914a-096507ceaa3d"
            - button "Edge from b84f1096-23cc-445e-afe7-b40d6cb3f061 to 2d0f35bd-0003-4707-b829-24ac5b5b9273"
            - button "Edge from 27e67931-3f20-4338-bee6-05cb92254401 to 75d041ec-02ba-4937-a5e5-1081e0509a88"
            - button "Edge from 1c580741-c3fe-4d1f-b140-cd2b791ed628 to 27e67931-3f20-4338-bee6-05cb92254401"
            - button "Edge from 2d0f35bd-0003-4707-b829-24ac5b5b9273 to 53659eea-e37d-400c-b86b-d886b0738ad1"
            - button "Edge from 75d041ec-02ba-4937-a5e5-1081e0509a88 to 43587097-e82a-4f47-8eab-898c9fc929b2"
        - generic:
          - button "project Task Graph Planner Delivery" [ref=e16]:
            - generic [ref=e19]:
              - generic [ref=e21]: project
              - generic [ref=e22]: Task Graph Planner Delivery
          - button "epic Phase 1 - Data & Canvas" [ref=e24]:
            - generic [ref=e27]:
              - generic [ref=e29]: epic
              - generic [ref=e30]: Phase 1 - Data & Canvas
          - button "epic Phase 1 - Data & Canvas" [ref=e32]:
            - generic [ref=e35]:
              - generic [ref=e37]: epic
              - generic [ref=e38]: Phase 1 - Data & Canvas
          - button "leaf task Implement putNode wrap" [ref=e40]:
            - generic [ref=e43]:
              - generic [ref=e45]: leaf task
              - generic [ref=e46]: Implement putNode wrap
          - button "task STALE Dexie Implementation" [ref=e48]:
            - generic [ref=e51]:
              - generic [ref=e52]:
                - generic [ref=e53]: task
                - generic [ref=e54]: STALE
              - generic [ref=e55]: Dexie Implementation
          - button "task STALE Dexie Implementation" [ref=e57]:
            - generic [ref=e60]:
              - generic [ref=e61]:
                - generic [ref=e62]: task
                - generic [ref=e63]: STALE
              - generic [ref=e64]: Dexie Implementation
          - button "project Task Graph Planner Delivery" [ref=e66]:
            - generic [ref=e69]:
              - generic [ref=e71]: project
              - generic [ref=e72]: Task Graph Planner Delivery
          - button "leaf task Implement putNode wrap" [ref=e74]:
            - generic [ref=e77]:
              - generic [ref=e79]: leaf task
              - generic [ref=e80]: Implement putNode wrap
    - generic [ref=e82]:
      - button "zoom in" [ref=e83] [cursor=pointer]:
        - img [ref=e84]
      - button "zoom out" [ref=e86] [cursor=pointer]:
        - img [ref=e87]
      - button "fit view" [ref=e89] [cursor=pointer]:
        - img [ref=e90]
      - button "toggle interactivity" [ref=e92] [cursor=pointer]:
        - img [ref=e93]
    - img "React Flow mini map" [ref=e96]
    - img [ref=e105]
    - link "React Flow attribution" [ref=e108] [cursor=pointer]:
      - /url: https://reactflow.dev
      - text: React Flow
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Task Graph Planner E2E', () => {
  4  |   test('Canvas loads and Dagre tree logic executes resolving mock nodes', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     
  7  |     // Ensure Header Loaded
  8  |     await expect(page.getByRole('heading', { name: 'Task Graph Planner' })).toBeVisible();
  9  | 
  10 |     // Verify React Flow elements exist (ensuring canvas maps mock elements)
  11 |     const reactFlowWrap = page.locator('.react-flow');
  12 |     await expect(reactFlowWrap).toBeVisible();
  13 | 
  14 |     // Verify all 4 mock elements generated successfully
  15 |     const nodes = page.locator('.react-flow__node');
  16 |     expect(await nodes.count()).toBeGreaterThanOrEqual(4);
  17 |   });
  18 | 
  19 |   test('Node Panel interaction logic', async ({ page }) => {
  20 |     await page.goto('/');
  21 |     
  22 |     // Explicitly target the Epic node via inner title mapping
  23 |     const epicNodeText = page.getByText('Phase 1 - Data & Canvas').first();
  24 |     await expect(epicNodeText).toBeVisible();
  25 |     
  26 |     // Double click the exact bounding container representing the React Flow node wrapper dynamically mapped
> 27 |     await epicNodeText.locator('xpath=ancestor::div[contains(@class, "react-flow__node")]').click();
     |                                                                                             ^ Error: locator.click: Error: strict mode violation: getByText('Phase 1 - Data & Canvas').first().locator('xpath=ancestor::div[contains(@class, "react-flow__node")]') resolved to 2 elements:
  28 |     
  29 |     // Ensure slide out panel resolves natively mapping specific Radix boundaries/React states
  30 |     await expect(page.getByText('Edit epic')).toBeVisible();
  31 |     
  32 |     // Type inside Size
  33 |     const select = page.getByRole('combobox').first(); // There are two comboboxes (Size, Risk)
  34 |     await select.selectOption('large');
  35 | 
  36 |     // Blur triggers save automatically
  37 |     await page.getByText('Edit epic').click();
  38 |     
  39 |     // Open Sandbox validation ensuring local validation blocks payload missing requirements explicitly
  40 |     await page.getByRole('button', { name: /Sandbox/i }).click();
  41 | 
  42 |     // Assert sandbox triggers missing component blocking natively
  43 |     await expect(page.getByText('Preview §11.5 Golden Prompt rendering')).toBeVisible();
  44 |   });
  45 |   
  46 |   test('List View topological toggling', async ({ page }) => {
  47 |     await page.goto('/');
  48 |     
  49 |     // Transition to Leaf View
  50 |     await page.getByRole('button', { name: /Leaf Task List/i }).click();
  51 |     
  52 |     await expect(page.getByText('Leaf Task Execution List')).toBeVisible();
  53 |     // Validate Khan's alg output
  54 |     await expect(page.getByText('Ready to Agent').first()).toBeVisible();
  55 |   });
  56 | });
  57 | 
```