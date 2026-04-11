# Task Graph Builder - User Guide

This guide covers the basic operations for running the application, managing source control, and executing tests.

## 1. Starting the Application

The project consists of both a typical Vite frontend and a Python backend. We have provided a startup script to easily launch both services simultaneously.

### Using `start.bat`
To start both the frontend and backend servers automatically:

1. Open a Command Prompt or Terminal in the root directory: `C:\Users\adam\OneDrive\Documents\projects\task graph builder`
2. Run the `start.bat` file by executing the following command:
   ```cmd
   .\start.bat
   ```
   *Alternatively, you can just double-click the `start.bat` file from your File Explorer.*

**What this does:**
- It opens two new terminal windows.
- **Window 1 (Backend):** Activates the Python virtual environment and starts the FastAPI/Uvicorn backend server on port `8000`.
- **Window 2 (Frontend):** Runs `npm run dev` to start the Vite frontend development server.

### Accessing the Web Front End
Once the servers have started, open your web browser and navigate to:
**http://localhost:5173** (or the port Vite outputs in the console).

---

## 2. Updating Git with Changes

To save your work and push your changes to the remote repository, follow these steps in your terminal (at the project root):

1. **Stage your changes:** Add all modified and new files to the staging area.
   ```bash
   git add .
   ```

2. **Commit your changes:** Save the changes with a descriptive message.
   ```bash
   git commit -m "Your descriptive commit message here"
   ```

3. **Push to the remote repository:** Upload your committed changes to the cloud (e.g., GitHub).
   ```bash
   git push
   ```

---

## 3. Running Tests

The project has multiple testing suites configured in `package.json`. You can run them using `npm` commands in your terminal.

### Unit Tests (Vitest)
To run the standard unit tests once:
```bash
npm run test
```

### Unit Tests with UI (Vitest)
To open a visual testing dashboard in your browser to view test results and coverage:
```bash
npm run test:ui
```

### End-to-End Tests (Playwright)
To run full end-to-end browser tests:
```bash
npm run test:e2e
```
*Note: Make sure your application servers are running before executing E2E tests, as they simulate real user behavior in the browser.*
