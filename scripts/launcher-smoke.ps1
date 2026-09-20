$ErrorActionPreference = 'Stop'

$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$source = Join-Path $workspace 'tools\CircuitPracticeLauncher\CircuitPracticeLauncher.cs'
$tempRoot = Join-Path $workspace 'tmp\launcher smoke'
$tempExe = Join-Path $tempRoot 'CircuitPracticeLauncher.exe'

if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) {
  throw "No se encontró el compilador C# esperado: $compiler"
}

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
& $compiler /nologo /target:exe /platform:anycpu /reference:System.Windows.Forms.dll "/out:$tempExe" $source
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el launcher.' }

function Invoke-LauncherCase {
  param([string]$ProjectDirectory, [hashtable]$ExtraEnvironment = @{})

  $previous = @{}
  $values = @{
    CIRCUIT_PRACTICE_PROJECT_DIR = $ProjectDirectory
    CIRCUIT_PRACTICE_NONINTERACTIVE = '1'
    CIRCUIT_PRACTICE_NO_BROWSER = '1'
    CIRCUIT_PRACTICE_NO_WINDOW = '1'
    CIRCUIT_PRACTICE_EXIT_AFTER_READY = '1'
  }
  foreach ($item in $ExtraEnvironment.GetEnumerator()) { $values[$item.Key] = $item.Value }
  foreach ($item in $values.GetEnumerator()) {
    $previous[$item.Key] = [Environment]::GetEnvironmentVariable($item.Key, 'Process')
    [Environment]::SetEnvironmentVariable($item.Key, $item.Value, 'Process')
  }
  try {
    $process = Start-Process -FilePath $tempExe -PassThru -WindowStyle Hidden
    if (-not $process.WaitForExit(60000)) {
      $process.Kill()
      throw 'El launcher no terminó dentro de 60 segundos.'
    }
    return @{ ExitCode = $process.ExitCode }
  }
  finally {
    foreach ($item in $previous.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable($item.Key, $item.Value, 'Process')
    }
  }
}

$missingPackage = Join-Path $tempRoot 'missing package'
New-Item -ItemType Directory -Path $missingPackage -Force | Out-Null
$result = Invoke-LauncherCase -ProjectDirectory $missingPackage
if ($result.ExitCode -ne 1) {
  throw 'El launcher no informó correctamente la ausencia de package.json.'
}

$missingModules = Join-Path $tempRoot 'missing modules'
New-Item -ItemType Directory -Path $missingModules -Force | Out-Null
Set-Content -LiteralPath (Join-Path $missingModules 'package.json') -Value '{}' -Encoding UTF8
$result = Invoke-LauncherCase -ProjectDirectory $missingModules
if ($result.ExitCode -ne 1) {
  throw 'El launcher no informó correctamente la ausencia de node_modules.'
}

$result = Invoke-LauncherCase -ProjectDirectory $workspace -ExtraEnvironment @{ CIRCUIT_PRACTICE_DISABLE_NPM_LOOKUP = '1' }
if ($result.ExitCode -ne 1) {
  throw 'El launcher no informó correctamente la ausencia de npm.'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 5173)
$listener.Start()
$portFile = Join-Path $tempRoot 'selected-port.txt'
try {
  $result = Invoke-LauncherCase -ProjectDirectory $workspace -ExtraEnvironment @{ CIRCUIT_PRACTICE_PORT_FILE = $portFile }
}
finally {
  $listener.Stop()
}
$selectedPort = [int](Get-Content -LiteralPath $portFile -Raw).Trim()
if ($result.ExitCode -ne 0 -or $selectedPort -le 5173 -or $selectedPort -gt 5199) {
  throw 'El launcher no eligió un puerto alternativo válido.'
}

$portReleased = $false
for ($attempt = 0; $attempt -lt 50 -and -not $portReleased; $attempt++) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync([System.Net.IPAddress]::Loopback, $selectedPort)
    if (-not $connection.Wait(200) -or -not $client.Connected) {
      $portReleased = $true
    }
  }
  catch {
    $portReleased = $true
  }
  finally {
    $client.Dispose()
  }
  if (-not $portReleased) { Start-Sleep -Milliseconds 100 }
}
if (-not $portReleased) {
  throw "Vite dejó un proceso huérfano escuchando en el puerto $selectedPort."
}

Write-Output 'Launcher smoke passed: spaces, missing dependencies, port fallback and process cleanup.'
