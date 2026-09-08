import { spawn } from "node:child_process";
import os from "node:os";
import type {
  CropOcrExtractResultV3,
  CropOcrProviderV3,
  CropOcrRequestV3,
  CropScaleV3,
} from "./types";
import { ParticipantOcrExperimentV3Error } from "./identity";

function psSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function psEncodedCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function assertSafeCropRequest(request: CropOcrRequestV3): CropOcrRequestV3 {
  const { crop, scale } = request;
  if (
    !Number.isInteger(crop.x) ||
    !Number.isInteger(crop.y) ||
    !Number.isInteger(crop.width) ||
    !Number.isInteger(crop.height) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width < 1 ||
    crop.height < 1
  ) {
    throw new ParticipantOcrExperimentV3Error("INVALID_CROP_BOX");
  }
  if (scale !== 3 && scale !== 4 && scale !== 5) {
    throw new ParticipantOcrExperimentV3Error("INVALID_CROP_SCALE");
  }
  if (typeof request.imagePath !== "string" || request.imagePath.trim() === "") {
    throw new ParticipantOcrExperimentV3Error("INVALID_IMAGE_PATH");
  }
  return request;
}

function buildRecognizeCropScript(request: CropOcrRequestV3): string {
  const spec = assertSafeCropRequest(request);
  const scale: CropScaleV3 = spec.scale;
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
  try {
    [void]$task.Wait()
  } catch {
    $inner = $_.Exception.InnerException
    if ($inner -and $inner.InnerException) { throw $inner.InnerException }
    if ($inner) { throw $inner }
    throw
  }
  return $task.Result
}
function Await-WinRtAction($AsyncAction) {
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
  } | Select-Object -First 1
  if (-not $asTask) { throw 'AsTask IAsyncAction not found' }
  $task = $asTask.Invoke($null, @($AsyncAction))
  try {
    [void]$task.Wait()
  } catch {
    $inner = $_.Exception.InnerException
    if ($inner -and $inner.InnerException) { throw $inner.InnerException }
    if ($inner) { throw $inner }
    throw
  }
}
try {
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapEncoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapPixelFormat, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapAlphaMode, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapTransform, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapBounds, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapInterpolationMode, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
  $ImagePath = ${psSingleQuote(spec.imagePath)}
  $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
  $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $source = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  if ($source.BitmapPixelFormat -ne [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8 -or $source.BitmapAlphaMode -ne [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied) {
    $source = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($source, [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)
  }
  $pixelWidth = [int]$source.PixelWidth
  $pixelHeight = [int]$source.PixelHeight
  $x = [Math]::Max(0, [Math]::Min($pixelWidth - 1, ${spec.crop.x}))
  $y = [Math]::Max(0, [Math]::Min($pixelHeight - 1, ${spec.crop.y}))
  $width = [Math]::Max(1, [Math]::Min($pixelWidth - $x, ${spec.crop.width}))
  $height = [Math]::Max(1, [Math]::Min($pixelHeight - $y, ${spec.crop.height}))
  $scale = [int]${scale}
  $bounds = New-Object Windows.Graphics.Imaging.BitmapBounds
  $bounds.X = [uint32]$x
  $bounds.Y = [uint32]$y
  $bounds.Width = [uint32]$width
  $bounds.Height = [uint32]$height
  $mem = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $encoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::PngEncoderId, $mem)) ([Windows.Graphics.Imaging.BitmapEncoder])
  $encoder.SetSoftwareBitmap($source)
  $encoder.BitmapTransform.Bounds = $bounds
  Await-WinRtAction ($encoder.FlushAsync())
  $mem.Seek(0)
  $cropDecoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($mem)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRt ($cropDecoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  if ($bitmap.BitmapPixelFormat -ne [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8 -or $bitmap.BitmapAlphaMode -ne [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied) {
    $bitmap = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($bitmap, [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)
  }
  $mem2 = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $up = Await-WinRt ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::PngEncoderId, $mem2)) ([Windows.Graphics.Imaging.BitmapEncoder])
  $up.SetSoftwareBitmap($bitmap)
  $up.BitmapTransform.ScaledWidth = [uint32]($bitmap.PixelWidth * $scale)
  $up.BitmapTransform.ScaledHeight = [uint32]($bitmap.PixelHeight * $scale)
  $up.BitmapTransform.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Linear
  Await-WinRtAction ($up.FlushAsync())
  $mem2.Seek(0)
  $upDecoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($mem2)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRt ($upDecoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  if ($bitmap.BitmapPixelFormat -ne [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8 -or $bitmap.BitmapAlphaMode -ne [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied) {
    $bitmap = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($bitmap, [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)
  }
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language 'ko'))
  if (-not $engine) { throw 'TryCreateFromLanguage ko failed' }
  $result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $rawLines = @()
  foreach ($line in @($result.Lines)) {
    $rawLines += @{
      text = [string]$line.Text
    }
  }
  $payload = @{
    ok = $true
    language = 'ko'
    scale = $scale
    interpolation = 'Linear'
    providerVersion = ('Windows.Media.Ocr crop-v3 ' + $engine.RecognizerLanguage.LanguageTag + '; OS ' + [System.Environment]::OSVersion.Version.ToString())
    rawText = [string]$result.Text
    rawLines = $rawLines
  }
  $json = $payload | ConvertTo-Json -Compress -Depth 8
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
  [Console]::Write($json)
} catch {
  $inner = $_.Exception
  $parts = @([string]$inner.Message)
  while ($inner.InnerException) {
    $inner = $inner.InnerException
    $parts += [string]$inner.Message
  }
  $payload = @{
    ok = $false
    error = ($parts -join ' | ')
  }
  $json = $payload | ConvertTo-Json -Compress
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
  [Console]::Write($json)
  exit 1
}
`;
}

type CropOcrJson = {
  ok?: boolean;
  error?: string;
  rawText?: string;
  rawLines?: Array<{ text?: string }>;
};

function asLineArray(value: CropOcrJson["rawLines"]): NonNullable<CropOcrJson["rawLines"]> {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return [value as NonNullable<CropOcrJson["rawLines"]>[number]];
  }
  return [];
}

function parseExtractJson(stdout: string): CropOcrExtractResultV3 {
  const parsed = JSON.parse(stdout) as CropOcrJson;
  if (parsed.ok !== true) {
    throw new ParticipantOcrExperimentV3Error(
      parsed.error || "WINDOWS_MEDIA_CROP_OCR_FAILED",
    );
  }
  return {
    rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
    rawLines: asLineArray(parsed.rawLines).map((line) => ({
      text: typeof line.text === "string" ? line.text : "",
    })),
  };
}

export function createWindowsCropOcrProviderV3(): CropOcrProviderV3 {
  return {
    async extractCrop(request) {
      const encoded = psEncodedCommand(buildRecognizeCropScript(request));
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
          reject(new ParticipantOcrExperimentV3Error("WINDOWS_MEDIA_CROP_OCR_TIMEOUT"));
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
            reject(
              new ParticipantOcrExperimentV3Error(
                err.trim() || `WINDOWS_MEDIA_CROP_OCR_EXIT_${code}`,
              ),
            );
            return;
          }
          resolve(out);
        });
      });
      return parseExtractJson(stdout);
    },
  };
}

export function cropOcrProviderVersionV3(): string {
  return `Windows.Media.Ocr crop-v3 Linear; OS ${os.release()}`;
}
