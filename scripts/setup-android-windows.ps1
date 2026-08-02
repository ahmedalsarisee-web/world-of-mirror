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

function Resolve-NodeExecutable {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command -and (Test-Path $command.Source)) {
    return $command.Source
  }

  $candidatePaths = @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\node\node.exe")
  )

  if ($env:NVM_SYMLINK) {
    $candidatePaths = @(Join-Path $env:NVM_SYMLINK "node.exe") + $candidatePaths
  }

  foreach ($candidate in $candidatePaths) {
    if ($candidate -and (Test-Path $candidate)) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "Node.js was not found. Install Node.js or add it to PATH before building Android release."
}

function Configure-NodeForGradle {
  param(
    [string]$AndroidDir
  )

  $nodeExe = Resolve-NodeExecutable
  $nodeDir = Split-Path $nodeExe -Parent
  $nodeWrapper = Join-Path $AndroidDir "node.cmd"

  $wrapperContent = "@`"$nodeExe`" %*`r`n"
  Set-Content -Path $nodeWrapper -Value $wrapperContent -Encoding ASCII

  $env:PATH = "$AndroidDir;$nodeDir;$env:PATH"
  $env:NODE_BINARY = $nodeExe

  return @{
    NodeExe = $nodeExe
    NodeDir = $nodeDir
    NodeWrapper = $nodeWrapper
  }
}

function Update-LocalPropertiesNodeDir {
  param(
    [string]$LocalPropertiesPath,
    [string]$NodeDir
  )

  $escapedNodeDir = ($NodeDir -replace '\\', '/').Replace(':', '\:')
  $lines = @()
  if (Test-Path $LocalPropertiesPath) {
    $lines = @(Get-Content $LocalPropertiesPath)
    $lines = @($lines | Where-Object { $_ -notmatch '^\s*node\.dir\s*=' })
  }

  $lines += "node.dir=$escapedNodeDir"
  Set-Content -Path $LocalPropertiesPath -Value $lines -Encoding ASCII
}

function Update-GradleUserProperties {
  param(
    [string]$GradleHome,
    [string]$RealSdkPath
  )

  $gradlePropsPath = Join-Path $GradleHome "gradle.properties"
  $buildToolsRoot = Join-Path $RealSdkPath "build-tools"
  if (-not (Test-Path $buildToolsRoot)) {
    Write-Warning "Android build-tools folder not found; skipping aapt2 override."
    return
  }

  $buildToolsVersion = Get-ChildItem $buildToolsRoot -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty Name
  $aapt2Path = Join-Path $buildToolsRoot "$buildToolsVersion\aapt2.exe"
  if (-not (Test-Path $aapt2Path)) {
    Write-Warning "aapt2.exe not found at $aapt2Path; skipping aapt2 override."
    return
  }

  $escapedAapt2 = ($aapt2Path -replace '\\', '/').Replace(':', '\:')
  $lines = @()
  if (Test-Path $gradlePropsPath) {
    $lines = @(Get-Content $gradlePropsPath)
    $lines = @($lines | Where-Object {
      $_ -notmatch '^\s*android\.aapt2FromMavenOverride\s*=' -and
      $_ -notmatch '^\s*android\.enableParallelResourceProcessing\s*='
    })
  }

  $lines += "android.aapt2FromMavenOverride=$escapedAapt2"
  $lines += "android.enableParallelResourceProcessing=false"

  Set-Content -Path $gradlePropsPath -Value $lines -Encoding ASCII
  Write-Host "Configured aapt2 override in $gradlePropsPath"
  Write-Host "  android.aapt2FromMavenOverride=$escapedAapt2"
}

Update-GradleUserProperties -GradleHome $gradleHome -RealSdkPath $realSdk

$nodeConfig = Configure-NodeForGradle -AndroidDir $androidDir
Update-LocalPropertiesNodeDir -LocalPropertiesPath $localProperties -NodeDir $nodeConfig.NodeDir
Write-Host "Configured Node.js for Gradle:"
Write-Host "  NODE_BINARY=$($nodeConfig.NodeExe)"
Write-Host "  node wrapper=$($nodeConfig.NodeWrapper)"

Write-Host ""
Write-Host "Android build paths configured:"
Write-Host "  GRADLE_USER_HOME=$gradleHome"
Write-Host "  ANDROID_HOME=$($env:ANDROID_HOME)"
Write-Host "  NODE_BINARY=$($env:NODE_BINARY)"
Write-Host ""
Write-Host "Next: npm run android:release"
