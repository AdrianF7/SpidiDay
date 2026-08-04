param(
  [string]$SourceDirectory = (Join-Path $PSScriptRoot '..\data\source-rv1909'),
  [string]$OutputFile = (Join-Path $PSScriptRoot '..\data\verses-rv1909.js')
)

$ErrorActionPreference = 'Stop'
$positive = '(amor|paz|esper|gozo|alegr|misericord|gracia|sabidur|fortale|conf[ií]|corazón|camino|luz|bien|bend|oraci|fe\b|verdad|vida|descans|socorro|consuelo|justicia|pacien|bondad|fiel|Jehová|Dios)'
$exclude = '(matar|mató|sangre|cadáver|fornic|adulter|enemig|guerra|espada|furor|ira de|maldición|condena|infierno|Al Músico|Selah|engendró|concibió)'
$verses = [System.Collections.Generic.List[object]]::new()

foreach ($file in Get-ChildItem -LiteralPath $SourceDirectory -Filter '*.usfm' | Sort-Object Name) {
  $book = ''
  $chapter = 0
  foreach ($line in Get-Content -LiteralPath $file.FullName -Encoding UTF8) {
    if ($line -match '^\\toc1\s+(.+?)\s*$') { $book = $Matches[1].Trim(); continue }
    if ($line -match '^\\c\s+(\d+)') { $chapter = [int]$Matches[1]; continue }
    if ($line -notmatch '^\\v\s+([0-9]+[a-z]?)\s+(.+)$') { continue }
    $verseNumber = $Matches[1]
    $text = $Matches[2]
    $text = [regex]::Replace($text, '\\w\s+([^|]+)\|[^\\]*\\w\*', '$1')
    $text = [regex]::Replace($text, '\\f\s+.*?\\f\*', '')
    $text = [regex]::Replace($text, '\\x\s+.*?\\x\*', '')
    $text = [regex]::Replace($text, '\\[a-z0-9]+\*?', '')
    $text = [regex]::Replace($text, '\s+', ' ').Trim()
    if ($text.Length -lt 28 -or $text.Length -gt 165 -or $text -notmatch $positive -or $text -match $exclude) { continue }
    $themes = [System.Collections.Generic.List[string]]::new()
    if ($text -match '(amor|misericord|gracia|bondad)') { $themes.Add('amor') }
    if ($text -match '(paz|descans|consuelo)') { $themes.Add('paz') }
    if ($text -match '(esper|conf[ií]|fe\b|fiel)') { $themes.Add('confianza') }
    if ($text -match '(fortale|socorro)') { $themes.Add('fortaleza') }
    if ($text -match '(sabidur|verdad|luz|camino)') { $themes.Add('sabiduría') }
    if ($text -match '(gozo|alegr|bend)') { $themes.Add('gratitud') }
    if (-not $themes.Count) { $themes.Add('fe') }
    $reference = "$book $chapter`:$verseNumber"
    $idBase = $reference.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
    $id = ($idBase.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
    $verses.Add([pscustomobject]@{ id=$id; text=$text; reference=$reference; themes=@($themes | Select-Object -Unique) })
  }
}

$unique = @($verses | Group-Object text | ForEach-Object { $_.Group[0] })
if ($unique.Count -lt 366) { throw "Solo se encontraron $($unique.Count) versículos válidos." }
$selected = [System.Collections.Generic.List[object]]::new()
$step = $unique.Count / 366.0
for ($i=0; $i -lt 366; $i++) { $selected.Add($unique[[Math]::Floor($i * $step)]) }
if (($selected | Group-Object id | Where-Object Count -gt 1).Count) { throw 'La selección contiene identificadores duplicados.' }
$json = $selected | ConvertTo-Json -Depth 5
$header = "/* Reina-Valera 1909 · Dominio público · Fuente: https://ebible.org/details.php?id=spaRV1909 */`nwindow.RV1909_VERSES = "
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($OutputFile)) | Out-Null
[IO.File]::WriteAllText($OutputFile, $header + $json + ";`n", [Text.UTF8Encoding]::new($false))
Write-Output "Generados $($selected.Count) versículos únicos desde $($unique.Count) candidatos."
