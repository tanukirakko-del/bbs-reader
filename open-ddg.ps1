# Opens the local reader UI in DuckDuckGo Browser (ASCII-only on purpose:
# Japanese text in .ps1/.bat can garble under Windows code pages).
# Every step is logged to ddg-launch.log next to this script for diagnosis.
$log = Join-Path $PSScriptRoot 'ddg-launch.log'
function Log($m) { Add-Content -Path $log -Value ((Get-Date -Format 'HH:mm:ss') + ' ' + $m) -Encoding UTF8 }
Set-Content -Path $log -Value '--- ddg launch ---' -Encoding UTF8
$url = 'http://127.0.0.1:8787/'
Start-Sleep -Seconds 1
try {
    $pkg = Get-AppxPackage | Where-Object { $_.Name -like '*DuckDuckGo*' } | Select-Object -First 1
    if (-not $pkg) {
        Log 'NG: DuckDuckGo package not found. Opening default browser instead.'
        Start-Process $url
        exit
    }
    Log ('package found: ' + $pkg.PackageFamilyName)
    $manifest = Get-AppxPackageManifest $pkg
    $apps = @($manifest.Package.Applications.Application)
    $aumid = $pkg.PackageFamilyName + '!' + $apps[0].Id
    Log ('aumid: ' + $aumid)
    Start-Process ('shell:AppsFolder\' + $aumid) -ArgumentList $url
    Log 'OK: launched DuckDuckGo with URL argument.'
} catch {
    Log ('NG: error: ' + $_.Exception.Message)
    try { Start-Process $url } catch {}
}
