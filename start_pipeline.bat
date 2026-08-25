@echo off
echo ========================================================
echo Starting UniClean Data Intelligence Platform
echo ========================================================

echo [1/3] Starting SearXNG container (if Docker is installed)...
start /B docker compose -f backend\searXNG\docker-compose.yml up -d

echo [2/3] Starting FastAPI Backend on port 8000...
start cmd /k "cd backend\api && uvicorn main:app --reload --port 8000"

echo [3/3] Starting Next.js Frontend on port 3000...
start cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo All services launched!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000/docs
echo SearXNG: http://localhost:8080
echo ========================================================
