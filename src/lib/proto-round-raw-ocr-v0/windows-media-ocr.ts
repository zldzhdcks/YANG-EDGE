import { spawn } from "node:child_process";
import os from "node:os";
import type {
  OcrBoundingBox,
  ProtoRoundLocalOcrExtractResult,
  ProtoRoundLocalOcrLine,
  ProtoRoundLocalOcrProvider,
} from "./types";

function psSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function psEncodedCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function buildRecognizeScript(imagePath: string): string {
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
function Await-WinRt($AsyncOp, [Type]$ResultType) {
  $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
  } | Select-Object -First 1
  if (-not $asTaskGeneric) { throw 'AsTask IAsyncOperation not found' }
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $task = $asTask.Invoke($null, @($AsyncOp))
  [void]$task.Wait()
  return $task.Result
}
try {
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapPixelFormat, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapAlphaMode, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
  $ImagePath = ${psSingleQuote(imagePath)}
  $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
  $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  if ($bitmap.BitmapPixelFormat -ne [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8 -or $bitmap.BitmapAlphaMode -ne [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied) {
    $bitmap = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($bitmap, [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)
  }
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language 'ko'))
  if (-not $engine) { throw 'TryCreateFromLanguage ko failed' }
  $result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $rawLines = @()
  foreach ($line in @($result.Lines)) {
    $box = $null
    $words = @($line.Words)
    if ($words.Count -gt 0) {
      $minX = [double]::PositiveInfinity
      $minY = [double]::PositiveInfinity
      $maxX = [double]::NegativeInfinity
      $maxY = [double]::NegativeInfinity
      foreach ($w in $words) {
        $r = $w.BoundingRect
        if ($r.X -lt $minX) { $minX = $r.X }
        if ($r.Y -lt $minY) { $minY = $r.Y }
        if (($r.X + $r.Width) -gt $maxX) { $maxX = $r.X + $r.Width }
        if (($r.Y + $r.Height) -gt $maxY) { $maxY = $r.Y + $r.Height }
      }
      $box = @{
        x = $minX
        y = $minY
        width = ($maxX - $minX)
        height = ($maxY - $minY)
      }
    }
    $rawLines += @{
      text = [string]$line.Text
      boundingBox = $box
    }
  }
  $payload = @{
    ok = $true
    providerVersion = ('Windows.Media.Ocr ' + $engine.RecognizerLanguage.LanguageTag + '; OS ' + [System.Environment]::OSVersion.Version.ToString())
    languages = @($engine.RecognizerLanguage.LanguageTag)
    rawText = [string]$result.Text
    rawLines = $rawLines
  }
  $json = $payload | ConvertTo-Json -Compress -Depth 8
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
  [Console]::Write($json)
} catch {
  $payload = @{
    ok = $false
    error = [string]$_.Exception.Message
  }
  $json = $payload | ConvertTo-Json -Compress
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
  [Console]::Write($json)
  exit 1
}
`;
}

type WindowsOcrJson = {
  ok?: boolean;
  error?: string;
  providerVersion?: string;
  languages?: string[];
  rawText?: string;
  rawLines?: Array<{
    text?: string;
    boundingBox?: { x?: number; y?: number; width?: number; height?: number } | null;
  }>;
};

function asBox(value: unknown): OcrBoundingBox | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  const x = Number(rec.x);
  const y = Number(rec.y);
  const width = Number(rec.width);
  const height = Number(rec.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  return { x, y, width, height };
}

function asLineArray(value: WindowsOcrJson["rawLines"]): NonNullable<WindowsOcrJson["rawLines"]> {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value as NonNullable<WindowsOcrJson["rawLines"]>[number]];
  return [];
}

function parseExtractJson(stdout: string): ProtoRoundLocalOcrExtractResult {
  const parsed = JSON.parse(stdout) as WindowsOcrJson;
  if (parsed.ok !== true) {
    throw new Error(parsed.error || "WINDOWS_MEDIA_OCR_FAILED");
  }
  const rawLines: ProtoRoundLocalOcrLine[] = asLineArray(parsed.rawLines).map((line) => {
    const out: ProtoRoundLocalOcrLine = {
      text: typeof line.text === "string" ? line.text : "",
    };
    const box = asBox(line.boundingBox ?? null);
    if (box) out.boundingBox = box;
    return out;
  });
  return {
    rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
    rawLines,
  };
}

export function createWindowsMediaOcrProvider(input: {
  languages: string[];
  providerVersion?: string;
}): ProtoRoundLocalOcrProvider {
  const providerVersion =
    input.providerVersion ??
    `Windows.Media.Ocr ${input.languages.join(",")} ; OS ${os.release()}`;
  return {
    providerKind: "WINDOWS_MEDIA_OCR",
    providerVersion,
    languages: input.languages,
    async extract(imagePath: string) {
      const encoded = psEncodedCommand(buildRecognizeScript(imagePath));
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(
          "powershell.exe",
          ["-NoProfile", "-EncodedCommand", encoded],
          { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
        );
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("WINDOWS_MEDIA_OCR_TIMEOUT"));
        }, 60_000);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          out += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
          err += chunk;
        });
        child.on("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (!out.trim()) {
            reject(new Error(err.trim() || `WINDOWS_MEDIA_OCR_EXIT_${code}`));
            return;
          }
          resolve(out);
        });
      });
      return parseExtractJson(stdout);
    },
  };
}

export function tryCreateWindowsMediaOcrProvider(audit: {
  engineAvailable: boolean;
  koreanSupported: boolean;
  languages: string[];
  userProfileLanguage: string | null;
}): ProtoRoundLocalOcrProvider | null {
  if (!audit.engineAvailable || !audit.koreanSupported) return null;
  const languages = audit.languages.includes("ko")
    ? ["ko"]
    : audit.languages.filter((l) => l.toLowerCase().startsWith("ko"));
  if (languages.length === 0) return null;
  return createWindowsMediaOcrProvider({ languages });
}
