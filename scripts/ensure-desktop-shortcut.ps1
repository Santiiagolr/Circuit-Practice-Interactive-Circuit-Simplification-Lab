param(
  [Parameter(Mandatory = $true)][string]$ProjectDirectory,
  [string]$DesktopDirectory = $env:CIRCUIT_PRACTICE_DESKTOP_DIR
)

$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path -LiteralPath $ProjectDirectory).Path
$launcherPath = Join-Path $projectPath 'CircuitPractice.exe'
$iconPath = Join-Path $projectPath 'public\branding\circuit-practice-d2.ico'
foreach ($requiredPath in @($launcherPath, $iconPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "No se encontro el archivo requerido: $requiredPath"
  }
}
if ([string]::IsNullOrWhiteSpace($DesktopDirectory)) {
  $DesktopDirectory = [Environment]::GetFolderPath('DesktopDirectory')
}
if (-not (Test-Path -LiteralPath $DesktopDirectory -PathType Container)) {
  throw "No se encontro el escritorio: $DesktopDirectory"
}

$shortcutShell = New-Object -ComObject WScript.Shell
try {
  $shortcutPaths = @(Get-ChildItem -LiteralPath $DesktopDirectory -Filter '*.lnk' | Where-Object {
    $candidate = $shortcutShell.CreateShortcut($_.FullName)
    [string]::Equals($candidate.TargetPath, $launcherPath, [StringComparison]::OrdinalIgnoreCase)
  } | Select-Object -ExpandProperty FullName)

  if ($shortcutPaths.Count -eq 0) {
    $shortcutPath = Join-Path $DesktopDirectory 'Circuit Practice.lnk'
    if (Test-Path -LiteralPath $shortcutPath) {
      $existing = $shortcutShell.CreateShortcut($shortcutPath)
      if ([IO.Path]::GetFileName($existing.TargetPath) -ne 'CircuitPractice.exe') {
        throw "El nombre Circuit Practice.lnk ya pertenece a otro programa."
      }
    }
    $shortcutPaths = @($shortcutPath)
  }

  foreach ($shortcutPath in $shortcutPaths) {
    $shortcut = $shortcutShell.CreateShortcut($shortcutPath)
    $iconLocation = "$iconPath,0"
    $description = 'Circuit Practice - Laboratorio de circuitos RLC'
    $changed = $shortcut.TargetPath -ne $launcherPath -or
      $shortcut.WorkingDirectory -ne $projectPath -or
      $shortcut.IconLocation -ne $iconLocation -or
      $shortcut.Description -ne $description
    if ($changed) {
      $shortcut.TargetPath = $launcherPath
      $shortcut.WorkingDirectory = $projectPath
      $shortcut.IconLocation = $iconLocation
      $shortcut.Description = $description
      $shortcut.Save()
      if (-not ('CircuitPracticeShortcutNotify' -as [type])) {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CircuitPracticeShortcutNotify {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  public static extern void SHChangeNotify(uint eventId, uint flags, string path, IntPtr unused);
}
'@
      }
      [CircuitPracticeShortcutNotify]::SHChangeNotify(0x2000, 0x0005, $shortcutPath, [IntPtr]::Zero)
    }
    Write-Output "Acceso directo listo: $shortcutPath"
  }
}
finally {
  [Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcutShell) | Out-Null
}
