$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot "android"

function Remove-IfExists($path) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path
    Write-Host "Removed $path"
  }
}

Write-Host "Safe Android clean (do NOT use gradlew clean)"
Remove-IfExists (Join-Path $androidDir "app\.cxx")
Remove-IfExists (Join-Path $androidDir "app\build")
Remove-IfExists (Join-Path $androidDir "build")
Remove-IfExists (Join-Path $androidDir ".gradle\noVersion")
Write-Host "Done. Now run: npm run android:release"
