param(
    [string]$File,
    [string]$Query
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($File) -and [string]::IsNullOrWhiteSpace($Query)) {
    throw "Pass either -File <sql-file> or -Query <sql>."
}

if (-not [string]::IsNullOrWhiteSpace($File) -and -not (Test-Path $File)) {
    throw "SQL file not found: $File"
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath)) {
    throw ".env not found at $envPath"
}

$envVars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match "^[A-Za-z0-9_]+=") {
        $parts = $_ -split "=", 2
        $envVars[$parts[0]] = $parts[1]
    }
}

$jdbcUrl = $envVars["SPRING_DATASOURCE_URL"]
$dbUser = $envVars["SPRING_DATASOURCE_USERNAME"]
$dbPass = $envVars["SPRING_DATASOURCE_PASSWORD"]

if ([string]::IsNullOrWhiteSpace($jdbcUrl) -or [string]::IsNullOrWhiteSpace($dbUser)) {
    throw "Database connection info is missing in .env"
}

if ($jdbcUrl -notmatch "^jdbc:mysql://([^:/]+)(?::(\d+))?/([^?]+)") {
    throw "Could not parse JDBC URL: $jdbcUrl"
}

$dbHost = $Matches[1]
$dbPort = if ($Matches[2]) { $Matches[2] } else { "3306" }
$dbName = $Matches[3]

# The repo .env is written for Dockerized backend access. When we invoke mysqlsh
# directly on the host machine, the local MySQL service is reachable via localhost.
if ($dbHost -eq "host.docker.internal") {
    $dbHost = "127.0.0.1"
}

$mysqlsh = "C:\Program Files\MySQL\MySQL Shell 8.0\bin\mysqlsh.exe"
if (-not (Test-Path $mysqlsh)) {
    throw "mysqlsh.exe not found at $mysqlsh"
}

$arguments = @(
    "--sql"
    "--host=$dbHost"
    "--port=$dbPort"
    "--user=$dbUser"
    "--password=$dbPass"
    "-D"
    $dbName
)

if (-not [string]::IsNullOrWhiteSpace($File)) {
    $arguments += @("-f", $File)
} else {
    $arguments += @("-e", $Query)
}

& $mysqlsh @arguments
