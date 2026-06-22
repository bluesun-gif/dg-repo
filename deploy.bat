@echo off
title Firebase Deploy - DG Proposal Repo
color 0A
echo.
echo  =========================================
echo   DG Proposal Repo - Firebase Deployment
echo  =========================================
echo.
echo  Step 1: Logging in to Firebase...
echo  A browser window will open. Sign in with
echo  the Google account that owns dg-proposal-repo
echo.
firebase login
echo.
echo  Step 2: Setting project...
firebase use dg-proposal-repo
echo.
echo  Step 3: Building production app...
call npm run build
echo.
echo  Step 4: Deploying hosting + rules...
firebase deploy --only hosting,firestore:rules
echo.
echo  =========================================
echo   DONE! App live at:
echo   https://dg-proposal-repo.web.app
echo  =========================================
echo.
pause
