# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: graph.spec.ts >> Task Graph Planner E2E >> Node Panel interaction logic
- Location: e2e\graph.spec.ts:19:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Phase 1 - Data & Canvas')
Expected: visible
Error: strict mode violation: getByText('Phase 1 - Data & Canvas') resolved to 2 elements:
    1) <div class="text-sm font-semibold truncate w-36 overflow-hidden">Phase 1 - Data & Canvas</div> aka getByTestId('rf__node-1d59b1cb-6081-4d9e-b88c-4b55a883e8e3')
    2) <div class="text-sm font-semibold truncate w-36 overflow-hidden">Phase 1 - Data & Canvas</div> aka getByTestId('rf__node-4e6e9ef5-8987-48aa-aafd-ba70ac8b5bd0')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Phase 1 - Data & Canvas')

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
            - button "Edge from 1d59b1cb-6081-4d9e-b88c-4b55a883e8e3 to f55dfe0a-f0c1-4dbe-a647-a2c8e8b7117c"
            - button "Edge from 012763f0-4ade-4392-bccd-44555c01bef4 to 1d59b1cb-6081-4d9e-b88c-4b55a883e8e3"
            - button "Edge from f55dfe0a-f0c1-4dbe-a647-a2c8e8b7117c to fd7a0ef3-9bfc-4195-96d7-4df16c53e654"
            - button "Edge from 4e6e9ef5-8987-48aa-aafd-ba70ac8b5bd0 to 1011d63a-319f-462b-904e-0dcc3fe01522"
            - button "Edge from dd4d3156-7731-418a-ad76-b4253686400d to 4e6e9ef5-8987-48aa-aafd-ba70ac8b5bd0"
            - button "Edge from 1011d63a-319f-462b-904e-0dcc3fe01522 to 7f448dc0-f8c4-4c60-b3dc-c021fc755759"
        - generic:
          - button "Decompose Further project Task Graph Planner Delivery" [ref=e16]:
            - generic [ref=e17]:
              - generic [ref=e19]: Decompose Further
              - generic [ref=e21]:
                - generic [ref=e23]: project
                - generic [ref=e24]: Task Graph Planner Delivery
          - button "STALE task Dexie Implementation" [ref=e26]:
            - generic [ref=e27]:
              - generic [ref=e29]: STALE
              - generic [ref=e31]:
                - generic [ref=e33]: task
                - generic [ref=e34]: Dexie Implementation
          - button "epic Phase 1 - Data & Canvas" [ref=e36]:
            - generic [ref=e39]:
              - generic [ref=e41]: epic
              - generic [ref=e42]: Phase 1 - Data & Canvas
          - button "epic Phase 1 - Data & Canvas" [ref=e44]:
            - generic [ref=e47]:
              - generic [ref=e49]: epic
              - generic [ref=e50]: Phase 1 - Data & Canvas
          - button "leaf task Implement putNode wrap" [ref=e52]:
            - generic [ref=e55]:
              - generic [ref=e57]: leaf task
              - generic [ref=e58]: Implement putNode wrap
          - button "Decompose Further project Task Graph Planner Delivery" [ref=e60]:
            - generic [ref=e61]:
              - generic [ref=e63]: Decompose Further
              - generic [ref=e65]:
                - generic [ref=e67]: project
                - generic [ref=e68]: Task Graph Planner Delivery
          - button "STALE task Dexie Implementation" [ref=e70]:
            - generic [ref=e71]:
              - generic [ref=e73]: STALE
              - generic [ref=e75]:
                - generic [ref=e77]: task
                - generic [ref=e78]: Dexie Implementation
          - button "leaf task Implement putNode wrap" [ref=e80]:
            - generic [ref=e83]:
              - generic [ref=e85]: leaf task
              - generic [ref=e86]: Implement putNode wrap
    - generic [ref=e88]:
      - button "zoom in" [ref=e89] [cursor=pointer]:
        - img [ref=e90]
      - button "zoom out" [ref=e92] [cursor=pointer]:
        - img [ref=e93]
      - button "fit view" [ref=e95] [cursor=pointer]:
        - img [ref=e96]
      - button "toggle interactivity" [ref=e98] [cursor=pointer]:
        - img [ref=e99]
    - img "React Flow mini map" [ref=e102]
    - img [ref=e111]
    - link "React Flow attribution" [ref=e114] [cursor=pointer]:
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
  23 |     const epicNodeText = page.getByText('Phase 1 - Data & Canvas');
> 24 |     await expect(epicNodeText).toBeVisible();
     |                                ^ Error: expect(locator).toBeVisible() failed
  25 |     
  26 |     // Click exactly on the text to bypass any absolute wrapper overlays
  27 |     await epicNodeText.click({ force: true });
  28 |     
  29 |     // Ensure slide out panel resolves natively mapping specific Radix boundaries/React states
  30 |     const panelHeader = page.getByRole('heading', { name: /Edit epic/i });
  31 |     await expect(panelHeader).toBeVisible();
  32 |     
  33 |     // Type inside Size
  34 |     const select = page.getByRole('combobox').first(); // There are two comboboxes (Size, Risk)
  35 |     await select.selectOption('large');
  36 | 
  37 |     // Blur triggers save automatically by clicking the panel header directly
  38 |     await panelHeader.click();
  39 |     
  40 |     // Open Sandbox validation ensuring local validation blocks payload missing requirements explicitly
  41 |     await page.getByRole('button', { name: /Sandbox/i }).click();
  42 | 
  43 |     // Assert sandbox triggers missing component blocking natively
  44 |     await expect(page.getByText('Preview §11.5 Golden Prompt rendering')).toBeVisible();
  45 |   });
  46 |   
  47 |   test('List View topological toggling', async ({ page }) => {
  48 |     await page.goto('/');
  49 |     
  50 |     // Transition to Leaf View
  51 |     await page.getByRole('button', { name: /Leaf Task List/i }).click();
  52 |     
  53 |     await expect(page.getByText('Leaf Task Execution List')).toBeVisible();
  54 |     // Validate Khan's alg output
  55 |     await expect(page.getByText('Ready to Agent').first()).toBeVisible();
  56 |   });
  57 | });
  58 | 
```