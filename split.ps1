$lines = Get-Content -Path 'ui.js' -Encoding UTF8

$coreLines = $lines[0..138] + $lines[2003..2043] + $lines[2226..2241] + $lines[2242..($lines.Count-1)]
$setupLines = $lines[139..679]
$lobbyLines = $lines[680..831] + $lines[920..1144]
$networkLines = $lines[832..919] + $lines[2044..2225]
$gameLines = $lines[1145..2002]

$coreLines | Out-File -FilePath 'js/ui/core.js' -Encoding UTF8
$setupLines | Out-File -FilePath 'js/ui/setup.js' -Encoding UTF8
$lobbyLines | Out-File -FilePath 'js/ui/lobby.js' -Encoding UTF8
$networkLines | Out-File -FilePath 'js/ui/network_handler.js' -Encoding UTF8
$gameLines | Out-File -FilePath 'js/ui/game.js' -Encoding UTF8

Write-Host "Split successful"
