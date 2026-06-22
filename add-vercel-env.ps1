$vars = @{
  "VITE_FIREBASE_API_KEY"             = "AIzaSyC0jDKdgmCCqWVa2peEDpblyQEWvRYYBeA"
  "VITE_FIREBASE_AUTH_DOMAIN"         = "dg-repo-sohan.firebaseapp.com"
  "VITE_FIREBASE_PROJECT_ID"          = "dg-repo-sohan"
  "VITE_FIREBASE_STORAGE_BUCKET"      = "dg-repo-sohan.firebasestorage.app"
  "VITE_FIREBASE_MESSAGING_SENDER_ID" = "272250394119"
  "VITE_FIREBASE_APP_ID"              = "1:272250394119:web:085aee47f6d0aa15bffca2"
  "VITE_GEMINI_API_KEY"               = "AIzaSyAniNTFwZCXpegfgHURpZMNJz79wcKNpYI"
}

foreach ($key in $vars.Keys) {
  $value = $vars[$key]
  Write-Host "Adding $key ..."
  $value | vercel env add $key production --force 2>&1
}

Write-Host "All env vars added!"
vercel env ls 2>&1
