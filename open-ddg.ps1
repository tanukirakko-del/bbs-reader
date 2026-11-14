# DuckDuckGo ブラウザで専用ブラウザの画面を開くための補助スクリプト
# DDGが見つからなければ、通常の（既定の）ブラウザで開きます
$url = 'http://127.0.0.1:8787/'
Start-Sleep -Seconds 1
try {
    $pkg = Get-AppxPackage | Where-Object { $_.Name -like '*DuckDuckGo*' } | Select-Object -First 1
    if ($pkg) {
        $manifest = Get-AppxPackageManifest $pkg
        $apps = @($manifest.Package.Applications.Application)
        $aumid = "$($pkg.PackageFamilyName)!$($apps[0].Id)"
        Start-Process "shell:AppsFolder\$aumid" -ArgumentList $url
    } else {
        Start-Process $url
    }
} catch {
    Start-Process $url
}
