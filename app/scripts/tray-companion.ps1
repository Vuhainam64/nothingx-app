Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Draw custom 32x32 Nothing X dot-matrix icon (Black background + Red & White dots)
$bmp = New-Object System.Drawing.Bitmap(32, 32)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 19, 22))
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 246, 248))
$redBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 215, 25, 33))

$g.FillEllipse($bgBrush, 1, 1, 30, 30)
$coords = @(
  @(7, 7), @(11, 11), @(20, 20), @(24, 24),
  @(24, 7), @(20, 11), @(11, 20), @(7, 24)
)
foreach ($pt in $coords) {
  $g.FillEllipse($whiteBrush, $pt[0] - 2, $pt[1] - 2, 4, 4)
}
# Red center dot
$g.FillEllipse($redBrush, 13, 13, 6, 6)
$g.Dispose()

$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $icon
$notifyIcon.Text = "Nothing X • Tai trái 90% | Tai phải 85% | Hộp sạc 75%"
$notifyIcon.Visible = $true

function Open-NothingXWindow([string]$mode) {
  $url = if ($mode -eq "mini") { "http://localhost:1435/?mode=mini" } else { "http://localhost:1435/" }
  $size = if ($mode -eq "mini") { "--window-size=400,630" } else { "--window-size=1280,840" }
  if (Get-Command msedge -ErrorAction SilentlyContinue) {
    Start-Process msedge -ArgumentList "--app=$url", $size
  } else {
    Start-Process $url
  }
}

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$itemMini = $contextMenu.Items.Add("Mở chế độ Mini (Góc Taskbar)")
$itemMini.Add_Click({ Open-NothingXWindow "mini" })

$itemFull = $contextMenu.Items.Add("Mở Nothing X (Giao diện đầy đủ)")
$itemFull.Add_Click({ Open-NothingXWindow "full" })

$null = $contextMenu.Items.Add("-")

$itemExit = $contextMenu.Items.Add("Thoát Nothing X")
$itemExit.Add_Click({
  $notifyIcon.Visible = $false
  $notifyIcon.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

$notifyIcon.ContextMenuStrip = $contextMenu

$notifyIcon.Add_MouseClick({
  param($sender, $e)
  if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
    Open-NothingXWindow "mini"
  }
})

$notifyIcon.ShowBalloonTip(
  3000,
  "Nothing X đang chạy dưới Taskbar",
  "Nhấn vào biểu tượng Nothing X trong Show hidden icons để mở nhanh chế độ Mini.",
  [System.Windows.Forms.ToolTipIcon]::Info
)

[System.Windows.Forms.Application]::Run()
