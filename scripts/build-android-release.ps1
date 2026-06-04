$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot "android"

function Import-DotEnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return $false
  }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith('#')) {
      return
    }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) {
      return
    }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
  return $true
}

$envFile = Join-Path $projectRoot ".env"
if (-not (Import-DotEnvFile $envFile)) {
  Write-Warning ".env not found. Copy .env.example to .env and add Firebase keys before building a release APK."
} else {
  $requiredKeys = @(
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID'
  )
  $missing = @($requiredKeys | Where-Object { -not [Environment]::GetEnvironmentVariable($_, 'Process') })
  if ($missing.Count -gt 0) {
    throw "Release build aborted: missing Firebase env keys in .env: $($missing -join ', ')"
  }
  Write-Host "Loaded Firebase config from .env for release bundle."
}
$nodeDir = "C:\Program Files\nodejs"
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$gradleHome = "C:\gradle-home"

if (Test-Path "$nodeDir\node.exe") {
  $env:PATH = "$nodeDir;$env:PATH"
  $env:NODE_BINARY = "$nodeDir\node.exe"
}

if (Test-Path "$javaHome\bin\java.exe") {
  $env:JAVA_HOME = $javaHome
  $env:PATH = "$javaHome\bin;$env:PATH"
}

& (Join-Path $PSScriptRoot "setup-android-windows.ps1")

New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
$env:GRADLE_USER_HOME = $gradleHome
# ANDROID_HOME / ANDROID_SDK_ROOT are set by setup-android-windows.ps1

function Remove-IfExists($path) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path
    Write-Host "Removed $path"
  }
}

Write-Host "Safe clean (never use gradlew clean)..."
Remove-IfExists (Join-Path $androidDir "app\.cxx")
Remove-IfExists (Join-Path $androidDir "app\build")
Remove-IfExists (Join-Path $androidDir "build")
Remove-IfExists (Join-Path $androidDir ".gradle\noVersion")

$nativeModulePaths = @(
  "expo-modules-core",
  "react-native-screens",
  "react-native-gesture-handler",
  "react-native-reanimated",
  "react-native-worklets"
)
foreach ($module in $nativeModulePaths) {
  Remove-IfExists (Join-Path $projectRoot "node_modules\$module\android\.cxx")
}

$splashLogo = Join-Path $androidDir "app\src\main\res\drawable-mdpi\splashscreen_logo.png"
if (-not (Test-Path $splashLogo)) {
  Write-Host "Missing splashscreen_logo drawables - generating brand assets..."
  & node (Join-Path $projectRoot "scripts\generate-brand-assets.mjs")
  if ($LASTEXITCODE -ne 0) {
    throw "Brand asset generation failed with exit code $LASTEXITCODE"
  }
}

Push-Location $androidDir
try {
  Write-Host "Stopping old Gradle daemons..."
  & .\gradlew.bat --stop | Out-Null

  Write-Host "Generating native codegen..."
  & .\gradlew.bat generateCodegenArtifactsFromSchema --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "Codegen failed with exit code $LASTEXITCODE"
  }

  Write-Host "Building release APK..."
  & .\gradlew.bat assembleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle build failed with exit code $LASTEXITCODE"
  }

  $apk = Get-ChildItem -Path (Join-Path $androidDir "app\build\outputs\apk\release") -Filter "*.apk" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $apk) {
    throw "Release APK was not found under android/app/build/outputs/apk/release"
  }

  $outputDir = Join-Path $projectRoot "dist"
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  $outputApk = Join-Path $outputDir "world-of-mirror-release.apk"
  Copy-Item $apk.FullName $outputApk -Force

  Write-Host ""
  Write-Host "Release APK ready for testers:"
  Write-Host $outputApk
}
finally {
  Pop-Location
}
