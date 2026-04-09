@echo off
echo Starting Unified Task Graph Planner...
start cmd /k "cd backend && call venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"
start cmd /k "npm run dev"
echo Services are launching in separate windows!
