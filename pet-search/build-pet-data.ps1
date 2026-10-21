# 從「魔力寶貝寵物相關\寵物能力比較表.csv」產生 pet-data.js，給寵物圖鑑頁用
# CSV 改完重跑一次：powershell -ExecutionPolicy Bypass -File build-pet-data.ps1
$src = Join-Path $PSScriptRoot '..\..\魔力寶貝寵物相關\寵物能力比較表.csv'
$dst = Join-Path $PSScriptRoot 'pet-data.js'

$csv = [IO.File]::ReadAllText((Resolve-Path $src), [Text.Encoding]::UTF8).TrimEnd()
# 資料包在 String.raw 樣板字串裡，出現反引號或 ${ 會讓 JS 壞掉
if ($csv -match '`|\$\{') { throw 'CSV 裡有反引號或 ${，請先拿掉再產生' }

$out = "// 由 build-pet-data.ps1 從「寵物能力比較表.csv」產生，不要手改`r`n" +
       "window.PET_CSV = String.raw``" + "`r`n" + $csv + "`r`n``;`r`n"
[IO.File]::WriteAllText($dst, $out, (New-Object Text.UTF8Encoding $false))
$rows = ($csv -split "`r?`n").Count - 1
"pet-data.js 已產生，$rows 筆"
