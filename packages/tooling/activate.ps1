param(
    [string]$NodeBin = (Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin'),
    [string]$NpmCli = (Join-Path (Split-Path (Get-Command npm.cmd -ErrorAction Stop).Source) 'node_modules/npm/bin/npm-cli.js')
)

# Dot-source this script in each PowerShell terminal. No persistent system change.
$encaveRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$encaveNode = Join-Path $NodeBin 'node.exe'
if (!(Test-Path -LiteralPath $encaveNode) -or !(Test-Path -LiteralPath $NpmCli)) {
    throw 'Provide -NodeBin for Node 24 and -NpmCli for the installed npm CLI.'
}
$encaveMajor = & $encaveNode -p 'process.versions.node.split(".")[0]'
if ($LASTEXITCODE -ne 0 -or $encaveMajor -ne '24') { throw 'Node 24 is required.' }
$env:ENCAVE_NODE_EXE = $encaveNode
$env:ENCAVE_NPM_CLI = $NpmCli
$env:Path = (Join-Path $encaveRoot '.venv/Scripts') + ';' + $NodeBin + ';' + $env:Path
function global:npm { & $env:ENCAVE_NODE_EXE $env:ENCAVE_NPM_CLI @args }
Write-Output ('Node ' + (& $encaveNode --version) + ' / npm ' + (npm --version))
