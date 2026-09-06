import { spawn } from "node:child_process";
import os from "node:os";
import type { LocalOcrCapabilityAudit } from "./types";

function spawnCapture(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string; spawned: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: {
      code: number | null;
      stdout: string;
      stderr: string;
      spawned: boolean;
    }) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let child;
    try {
      child = spawn(command, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      done({
        code: null,
        stdout: "",
        stderr: err instanceof Error ? err.message : "SPAWN_FAILED",
        spawned: false,
      });
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      done({
        code: null,
        stdout,
        stderr: err.message,
        spawned: false,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      done({ code, stdout, stderr, spawned: true });
    });
  });
}

const WINDOWS_LANG_AUDIT_SCRIPT = `
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$langs = @()
foreach ($l in [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages) {
  $langs += $l.LanguageTag
}
$ko = New-Object Windows.Globalization.Language 'ko'
$koKR = New-Object Windows.Globalization.Language 'ko-KR'
$user = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$payload = @{
  engineAvailable = $true
  languages = $langs
  koreanSupported = ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($ko) -or [Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($koKR))
  userProfileLanguage = $(if ($user) { $user.RecognizerLanguage.LanguageTag } else { $null })
}
$json = $payload | ConvertTo-Json -Compress
[Console]::Write($json)
`;

function psEncodedCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function parseLangList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^List of available languages/i.test(l));
}

export async function auditLocalOcrCapabilities(): Promise<LocalOcrCapabilityAudit> {
  const windowsMediaOcr: LocalOcrCapabilityAudit["windowsMediaOcr"] = {
    engineAvailable: false,
    languages: [],
    koreanSupported: false,
    userProfileLanguage: null,
    error: null,
  };
  const tesseract: LocalOcrCapabilityAudit["tesseract"] = {
    installed: false,
    version: null,
    languages: [],
    koreanSupported: false,
    error: null,
  };

  if (process.platform === "win32") {
    const win = await spawnCapture(
      "powershell.exe",
      ["-NoProfile", "-EncodedCommand", psEncodedCommand(WINDOWS_LANG_AUDIT_SCRIPT)],
      20_000,
    );
    if (!win.spawned) {
      windowsMediaOcr.error = win.stderr || "POWERSHELL_SPAWN_FAILED";
    } else {
      try {
        const parsed = JSON.parse(win.stdout) as {
          engineAvailable?: boolean;
          languages?: string[];
          koreanSupported?: boolean;
          userProfileLanguage?: string | null;
        };
        windowsMediaOcr.engineAvailable = parsed.engineAvailable === true;
        windowsMediaOcr.languages = Array.isArray(parsed.languages)
          ? parsed.languages.map(String)
          : [];
        windowsMediaOcr.koreanSupported = parsed.koreanSupported === true;
        windowsMediaOcr.userProfileLanguage = parsed.userProfileLanguage ?? null;
      } catch {
        windowsMediaOcr.error =
          win.stderr.trim() || win.stdout.trim() || `POWERSHELL_EXIT_${win.code}`;
      }
    }
  } else {
    windowsMediaOcr.error = "NOT_WINDOWS";
  }

  const tessVer = await spawnCapture("tesseract", ["--version"], 10_000);
  if (!tessVer.spawned) {
    tesseract.error = "TESSERACT_NOT_INSTALLED";
  } else if (tessVer.code !== 0) {
    tesseract.error = tessVer.stderr.trim() || `TESSERACT_EXIT_${tessVer.code}`;
  } else {
    tesseract.installed = true;
    tesseract.version = (tessVer.stdout || tessVer.stderr).trim().split(/\r?\n/)[0] ?? null;
    const tessLangs = await spawnCapture("tesseract", ["--list-langs"], 10_000);
    tesseract.languages = parseLangList(tessLangs.stdout || tessLangs.stderr);
    tesseract.koreanSupported = tesseract.languages.some(
      (l) => l.toLowerCase() === "kor" || l.toLowerCase() === "korean",
    );
  }

  return {
    networkUsed: false,
    autoInstalled: false,
    windowsMediaOcr,
    tesseract,
  };
}

export function describeOsForOcr(): string {
  return `${os.platform()} ${os.release()}`;
}
