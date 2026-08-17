$ErrorActionPreference = 'Stop'

$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

Write-Host ''
Write-Host 'Inventory Scanner - Windows HTTPS setup'
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js is not installed. Install Node.js 24 or newer, then run this again.'
    Read-Host 'Press Enter to close'
    exit 1
}

$NodeMajor = [int]((node -p "process.versions.node.split('.')[0]") | Select-Object -First 1)
if ($NodeMajor -lt 24) {
    Write-Host 'This app needs Node.js 24 or newer.'
    Read-Host 'Press Enter to close'
    exit 1
}

New-Item -ItemType Directory -Force -Path data,exports,backups,certs | Out-Null

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host 'mkcert is required to make iPhone live camera scanning work over HTTPS.'
    Write-Host ''
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        $answer = Read-Host 'Chocolatey is installed. Install mkcert now? [Y/n]'
        if ([string]::IsNullOrWhiteSpace($answer) -or $answer -match '^[Yy]$') {
            choco install mkcert -y
        }
    } elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
        $answer = Read-Host 'Scoop is installed. Install mkcert now? [Y/n]'
        if ([string]::IsNullOrWhiteSpace($answer) -or $answer -match '^[Yy]$') {
            scoop bucket add extras
            scoop install mkcert
        }
    } else {
        Write-Host 'Install mkcert first using either:'
        Write-Host '  choco install mkcert'
        Write-Host 'or'
        Write-Host '  scoop bucket add extras'
        Write-Host '  scoop install mkcert'
        Write-Host ''
        Write-Host 'Then run this script again.'
        Read-Host 'Press Enter to close'
        exit 1
    }
}

# Refresh PATH in case a package manager just installed mkcert.
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host 'mkcert was installed but is not visible in this terminal yet. Close PowerShell, reopen it, and run this script again.'
    Read-Host 'Press Enter to close'
    exit 1
}

Write-Host 'Installing the local certificate authority on Windows...'
mkcert -install

$Ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -ne '127.0.0.1' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.PrefixOrigin -ne 'WellKnown'
    } |
    Select-Object -ExpandProperty IPAddress -Unique

$HostNames = @('localhost','127.0.0.1','::1')
$ComputerName = $env:COMPUTERNAME
if ($ComputerName) {
    $HostNames += $ComputerName
    $HostNames += "$ComputerName.local"
}
$HostNames += $Ips
$HostNames = $HostNames | Select-Object -Unique

Remove-Item 'certs\localhost-key.pem','certs\localhost.pem' -Force -ErrorAction SilentlyContinue

$args = @('-key-file','certs\localhost-key.pem','-cert-file','certs\localhost.pem') + $HostNames
& mkcert @args

$CAROOT = (& mkcert -CAROOT).Trim()
$Desktop = [Environment]::GetFolderPath('Desktop')
$RootCopy = Join-Path $Desktop 'Inventory Scanner Root CA.pem'
Copy-Item (Join-Path $CAROOT 'rootCA.pem') $RootCopy -Force

Write-Host ''
Write-Host 'HTTPS is ready for this computer and its current local IP address(es).'
Write-Host "Root certificate copied to: $RootCopy"
Write-Host ''
Write-Host 'IMPORTANT: Do NOT copy or share rootCA-key.pem.'
Write-Host ''
Write-Host 'On the iPhone:'
Write-Host '1. Send only "Inventory Scanner Root CA.pem" to the iPhone (AirDrop, iCloud Drive, email to yourself, etc.).'
Write-Host '2. Open it and install the configuration profile in Settings.'
Write-Host '3. Go to Settings > General > About > Certificate Trust Settings.'
Write-Host '4. Enable full trust for the mkcert/Inventory Scanner root certificate.'
Write-Host '5. Start the Inventory Scanner and open the HTTPS address shown on the computer.'
Write-Host ''
Write-Host 'Your HTTPS address should look like:'
foreach ($ip in $Ips) {
    Write-Host "  https://${ip}:3765"
}
Write-Host ''
Read-Host 'Press Enter to close'