$ErrorActionPreference = "Stop"

$realSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$substDrive = "W:"
$substRoot = "W:\"
$gradleHome = "C:\gradle-home"
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot "android"
$localProperties = Join-Path $androidDir "local.properties"

if (-not (Test-Path $realSdk)) {
  throw "Android SDK not found at $realSdk. Install Android Studio and the SDK first."
}

New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null

function Test-SdkAtRoot([string]$root) {
  $normalized = $root.TrimEnd('\') + '\'
  $platformTools = [System.IO.Path]::Combine($normalized, "platform-tools")
  return [System.IO.Directory]::Exists($platformTools)
}

function Ensure-SubstDrive {
  if (Test-SdkAtRoot $substRoot) {
    Write-Host "SDK drive already mapped: $substDrive"
    return $true
  }

  # Clear stale W: mapping if present without platform-tools.
  try {
    subst $substDrive /D 2>$null | Out-Null
  } catch {
    # Ignore if not mapped.
  }

  Write-Host "Mapping Android SDK to ${substDrive} -> $realSdk"
  subst $substDrive $realSdk | Out-Null
  if (Test-SdkAtRoot $substRoot) {
    return $true
  }

  Write-Host "Could not map ${substDrive}; using real SDK path instead."
  return $false
}

$useSubst = Ensure-SubstDrive

if ($useSubst) {
  $sdkDirLine = "sdk.dir=W:/"
  $env:ANDROID_HOME = $substRoot
  $env:ANDROID_SDK_ROOT = $substRoot
} else {
  $sdkDirEscaped = ($realSdk -replace '\\', '/')
  $sdkDirLine = "sdk.dir=$sdkDirEscaped"
  $env:ANDROID_HOME = $realSdk
  $env:ANDROID_SDK_ROOT = $realSdk
}

Set-Content -Path $localProperties -Value $sdkDirLine -Encoding ASCII
Write-Host "Updated $localProperties"

$env:GRADLE_USER_HOME = $gradleHome

Write-Host ""
Write-Host "Android build paths configured:"
Write-Host "  GRADLE_USER_HOME=$gradleHome"
Write-Host "  ANDROID_HOME=$($env:ANDROID_HOME)"
Write-Host ""
Write-Host "Next: npm run android:release"
