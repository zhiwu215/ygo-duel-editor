param (
    [string]$YgoproCoreDir = "",
    [string]$OutputDir = "$PSScriptRoot\..\resources\engine\bin\x64"
)

$ErrorActionPreference = "Stop"

if (-not $YgoproCoreDir -or -not (Test-Path $YgoproCoreDir)) {
    $searchCandidates = @(
        $YgoproCoreDir,
        "D:\Codes\ygopro-core",
        (Join-Path $PSScriptRoot "..\..\ygopro-core"),
        (Join-Path $PSScriptRoot "..\.deps\ygopro-core")
    )
    $found = $searchCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if ($found) {
        $YgoproCoreDir = $found
    } else {
        $depsDir = Join-Path $PSScriptRoot "..\.deps"
        if (-not (Test-Path $depsDir)) {
            New-Item -ItemType Directory -Path $depsDir -Force | Out-Null
        }
        $YgoproCoreDir = Join-Path $depsDir "ygopro-core"
        Write-Host "Cloning Fluorohydride/ygopro-core from GitHub..."
        git clone --depth 1 https://github.com/Fluorohydride/ygopro-core.git $YgoproCoreDir
    }
}

$toolsDir = Join-Path $YgoproCoreDir ".tools"
if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
}

$premakeExe = Join-Path $toolsDir "premake5.exe"
if (-not (Test-Path $premakeExe)) {
    Write-Host "Downloading premake-5.0.0-beta8..."
    $premakeZip = Join-Path $toolsDir "premake5.zip"
    $premakeUrl = "https://github.com/premake/premake-core/releases/download/v5.0.0-beta8/premake-5.0.0-beta8-windows.zip"
    curl.exe -L -o $premakeZip $premakeUrl
    tar.exe -xf $premakeZip -C $toolsDir
    Remove-Item $premakeZip -Force -ErrorAction SilentlyContinue
}

$luaDir = Join-Path $YgoproCoreDir "lua"
if (-not (Test-Path (Join-Path $luaDir "src\lua.h"))) {
    $fallbackLua = "D:\Codes\mdpro3\MDPro3-master\Tools\YGO Classes\lua"
    if (Test-Path (Join-Path $fallbackLua "src\lua.h")) {
        Write-Host "Copying Lua from $fallbackLua..."
        Copy-Item -Path $fallbackLua -Destination $luaDir -Recurse -Force
    } else {
        Write-Host "Downloading lua-5.4.8..."
        $luaTar = Join-Path $toolsDir "lua-5.4.8.tar.gz"
        curl.exe -L -o $luaTar "https://www.lua.org/ftp/lua-5.4.8.tar.gz"
        tar.exe -xzf $luaTar -C $toolsDir
        Move-Item (Join-Path $toolsDir "lua-5.4.8") $luaDir -Force
        Remove-Item $luaTar -Force -ErrorAction SilentlyContinue
    }
}

Copy-Item (Join-Path $YgoproCoreDir "premake\lua.lua") (Join-Path $luaDir "premake5.lua") -Force
Copy-Item (Join-Path $YgoproCoreDir "premake\dll.lua") (Join-Path $YgoproCoreDir "dll.lua") -Force

Push-Location $YgoproCoreDir
try {
    Write-Host "Generating VS2022 project with premake..."
    & $premakeExe vs2022 --file=dll.lua

    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (-not (Test-Path $vswhere)) {
        throw "vswhere.exe not found"
    }

    $msbuild = & $vswhere -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe | Select-Object -First 1
    if (-not $msbuild -or -not (Test-Path $msbuild)) {
        throw "MSBuild.exe not found"
    }

    Write-Host "Compiling ocgcore.dll (x64 Release) with MSBuild..."
    & $msbuild "build\ocgcoredll.sln" /m /t:Build /p:"Configuration=Release;Platform=x64;PlatformToolset=v145"

    $builtDll = Join-Path $YgoproCoreDir "build\bin\x64\Release\ocgcore.dll"
    if (-not (Test-Path $builtDll)) {
        throw "Build failed: ocgcore.dll not found at $builtDll"
    }

    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }

    $targetDll = Join-Path $OutputDir "ocgcore.dll"
    Copy-Item $builtDll $targetDll -Force
    Write-Host "Successfully built and copied ocgcore.dll to $targetDll"
} finally {
    Pop-Location
}
