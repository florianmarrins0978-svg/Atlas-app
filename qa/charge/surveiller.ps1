# Relève les ressources pendant un palier de charge, toutes les 2 secondes,
# jusqu'à ce que le fichier d'arrêt apparaisse.
#
# Colonnes : heure ; processeur de la machine (%) ; processeur et mémoire du
# serveur Next (tous ses processus) ; processeur de k6 ; connexions à la base
# QA par état, et celles qui attendent un verrou.
#
# Usage : powershell -File qa/charge/surveiller.ps1 <pid du serveur> <csv> <fichier d'arrêt>
param([int]$PidServeur, [string]$Csv, [string]$Arret)

function Descendants([int]$Racine) {
  $tous = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
  $liste = @($Racine)
  $i = 0
  while ($i -lt $liste.Count) {
    $liste += ($tous | Where-Object { $_.ParentProcessId -eq $liste[$i] } | ForEach-Object ProcessId)
    $i++
  }
  $liste
}

$coeurs = [Environment]::ProcessorCount
"heure;cpu_machine_pct;cpu_serveur_pct;memoire_serveur_mo;cpu_k6_pct;pg_actives;pg_inactives;pg_idle_in_tx;pg_attente_verrou" | Out-File $Csv -Encoding utf8
$pids = Descendants $PidServeur
$avant = @{}
foreach ($p in Get-Process -Id $pids -ErrorAction SilentlyContinue) { $avant[$p.Id] = $p.TotalProcessorTime.TotalMilliseconds }
$k6Avant = (Get-Process k6 -ErrorAction SilentlyContinue | Measure-Object -Property TotalProcessorTime -Sum).Sum
$t0 = Get-Date

while (-not (Test-Path $Arret)) {
  Start-Sleep -Seconds 2
  $t1 = Get-Date
  $ecart = ($t1 - $t0).TotalMilliseconds
  $procs = Get-Process -Id $pids -ErrorAction SilentlyContinue
  $cpuMs = 0; $mem = 0
  foreach ($p in $procs) {
    $maintenant = $p.TotalProcessorTime.TotalMilliseconds
    if ($avant.ContainsKey($p.Id)) { $cpuMs += $maintenant - $avant[$p.Id] }
    $avant[$p.Id] = $maintenant
    $mem += $p.WorkingSet64
  }
  $k6 = Get-Process k6 -ErrorAction SilentlyContinue
  $k6Maintenant = 0; foreach ($k in $k6) { $k6Maintenant += $k.TotalProcessorTime.TotalMilliseconds }
  $k6Pct = if ($k6Avant) { [math]::Round(($k6Maintenant - $k6Avant) / $ecart / $coeurs * 100, 1) } else { 0 }
  $k6Avant = $k6Maintenant
  $cpuMachine = [math]::Round((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average, 1)
  $pg = docker exec atlas-qa-postgres psql -U postgres -d atlas_qa -tAc "SELECT count(*) FILTER (WHERE state='active'), count(*) FILTER (WHERE state='idle'), count(*) FILTER (WHERE state LIKE 'idle in transaction%'), count(*) FILTER (WHERE wait_event_type='Lock') FROM pg_stat_activity WHERE datname='atlas_qa' AND usename='atlas_app'"
  $pg = ($pg -replace '\|', ';').Trim()
  "{0};{1};{2};{3};{4};{5}" -f $t1.ToString("HH:mm:ss"), $cpuMachine, [math]::Round($cpuMs / $ecart / $coeurs * 100, 1), [math]::Round($mem / 1MB), $k6Pct, $pg | Out-File $Csv -Append -Encoding utf8
  $t0 = $t1
}
