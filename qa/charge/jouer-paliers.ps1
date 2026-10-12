# Joue les paliers de charge l'un après l'autre et s'arrête au premier qui
# décroche : taux d'erreurs > 5 % ou p95 > 3 s, sur l'ensemble des écrans.
#
# Chaque palier : 30 s de montée, 60 s de tenue, puis 30 s de repos pour que
# la file d'attente du palier précédent ne se mesure pas dans le suivant.
#
# Usage : powershell -File qa/charge/jouer-paliers.ps1 <dossier> <pid du serveur>
param([string]$Dossier, [int]$PidServeur, [string]$Paliers = "10,50,100,200,500,1000")

$k6 = "C:\Program Files\k6\k6.exe"
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$bilan = Join-Path $Dossier "bilan.csv"
"vus;requetes;p95_global_ms;erreurs_global_pct;p95_liste_ms;err_liste_pct;p95_planning_ms;err_planning_pct;p95_pdf_ms;err_pdf_pct;violations_isolation" | Out-File $bilan -Encoding utf8

function Pct($m) {
  if (-not $m) { return 0 }
  $total = $m.passes + $m.fails
  if ($total -eq 0) { return 0 }
  [math]::Round($m.passes / $total * 100, 2)
}

foreach ($vus in $Paliers.Split(",")) {
  $arret = Join-Path $Dossier "arret-$vus"
  Remove-Item $arret -ErrorAction SilentlyContinue
  $sonde = Start-Process powershell -ArgumentList "-NoProfile", "-File", (Join-Path $ici "surveiller.ps1"), $PidServeur, (Join-Path $Dossier "ressources-$vus.csv"), $arret -PassThru -WindowStyle Hidden

  $resume = Join-Path $Dossier "resume-$vus.json"
  Remove-Item $resume -ErrorAction SilentlyContinue
  $sessions = Join-Path $Dossier "sessions.json"
  $scenario = Join-Path $ici "scenario.js"
  & $k6 run -e "VUS=$vus" -e "SESSIONS=$sessions" --summary-export $resume $scenario *> (Join-Path $Dossier "k6-$vus.log")

  New-Item -ItemType File $arret | Out-Null
  $sonde.WaitForExit(15000) | Out-Null

  # Un k6 qui n'a pas tourné n'est pas un décrochage de l'appli : on s'arrête
  # en le disant, plutôt que d'écrire « 100 % d'erreurs » dans le bilan.
  if (-not (Test-Path $resume)) {
    Write-Output "ECHEC DU SCRIPT au palier $vus : k6 n'a rien produit, voir k6-$vus.log"
    break
  }

  $m = (Get-Content $resume -Raw | ConvertFrom-Json).metrics
  $e = @{}
  foreach ($f in "liste", "planning", "pdf") { $e[$f] = $m."erreurs{page:$f}" }
  $passes = 0; $total = 0
  foreach ($f in "liste", "planning", "pdf") { if ($e[$f]) { $passes += $e[$f].passes; $total += $e[$f].passes + $e[$f].fails } }
  $errGlobal = if ($total) { [math]::Round($passes / $total * 100, 2) } else { 100 }
  $p95 = [math]::Round($m.http_req_duration.'p(95)')
  $viol = if ($m.violations_isolation) { $m.violations_isolation.count } else { 0 }
  $ligne = "{0};{1};{2};{3};{4};{5};{6};{7};{8};{9};{10}" -f $vus, $m.http_reqs.count, $p95, $errGlobal,
    [math]::Round($m.'http_req_duration{page:liste}'.'p(95)'), (Pct $e["liste"]),
    [math]::Round($m.'http_req_duration{page:planning}'.'p(95)'), (Pct $e["planning"]),
    [math]::Round($m.'http_req_duration{page:pdf}'.'p(95)'), (Pct $e["pdf"]), $viol
  $ligne | Out-File $bilan -Append -Encoding utf8
  Write-Output "palier $vus : $ligne"

  if ($errGlobal -gt 5 -or $p95 -gt 3000) {
    Write-Output "DECROCHAGE au palier $vus (erreurs $errGlobal %, p95 $p95 ms) : arret."
    break
  }
  Start-Sleep -Seconds 30
}
Write-Output "FIN"
