import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

const windows = process.platform === "win32";
const powershell = process.env.TESSERACT_TEST_POWERSHELL ?? "powershell.exe";

it.skipIf(!windows)("sanitizes endpoints and classifies proxy, DNS, TLS, timeout, and HTTP failures", () => {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
Import-Module $env:TESSERACT_PREFLIGHT_MODULE -Force
$label = Get-SafeEndpointLabel 'https://user:private-token@example.invalid/private/path?secret=private-query'
if ($label -ne 'https://example.invalid') { throw 'endpoint was not sanitized' }
$cases = [ordered]@{
  ProxyNameResolutionFailure = 'proxy'
  NameResolutionFailure = 'dns'
  TrustFailure = 'tls'
  SecureChannelFailure = 'tls'
  Timeout = 'timeout'
  ConnectFailure = 'connection'
}
foreach ($entry in $cases.GetEnumerator()) {
  $status = [System.Enum]::Parse([System.Net.WebExceptionStatus], $entry.Key)
  $exception = [System.Net.WebException]::new('secret-marker-must-not-be-returned', $status)
  $actual = Get-PreflightFailureKind -Exception $exception
  if ($actual -ne $entry.Value) { throw ($entry.Key + ' classified as ' + $actual) }
  $result = New-PreflightNetworkResult -FailureKind $actual
  if ($result.State -ne 'BLOQUEADO') { throw ($entry.Key + ' was not blocked') }
}
foreach ($status in @(200, 302)) {
  if ((New-PreflightNetworkResult -StatusCode $status).State -ne 'APROVADO') { throw 'success status misclassified' }
}
foreach ($status in @(401, 403, 407)) {
  $result = New-PreflightNetworkResult -StatusCode $status
  if ($result.State -ne 'AVISO') { throw ('HTTP ' + $status + ' misclassified') }
}
$env:NODE_USE_ENV_PROXY = '0'
__PROXY_SETUP__
if ($env:NODE_USE_ENV_PROXY -ne '0') { throw 'explicit proxy opt-out was changed' }
$env:NODE_USE_ENV_PROXY = ''
__PROXY_SETUP__
if ($env:NODE_USE_ENV_PROXY -ne '1') { throw 'proxy default was not enabled' }
if ((Get-PreflightCheckState -Category 'Rede opcional' -NetworkState 'BLOQUEADO') -ne 'AVISO') { throw 'optional endpoint blocked installation' }
if ((Get-PreflightCheckState -Category 'Rede' -NetworkState 'BLOQUEADO') -ne 'BLOQUEADO') { throw 'required endpoint warning was weakened' }
'OK preflight core'
`;
  const serviceScript = readFileSync(`${process.cwd()}\\service.ps1`, "utf8");
  const proxySetup = serviceScript.match(/if \(-not \$env:NODE_USE_ENV_PROXY\) \{ \$env:NODE_USE_ENV_PROXY = '1' \}/)?.[0];
  expect(proxySetup).toBeDefined();
  const verifiedScript = script.replaceAll("__PROXY_SETUP__", proxySetup!);
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", verifiedScript], {
    encoding: "utf8",
    timeout: 20_000,
    env: {
      ...process.env,
      TESSERACT_PREFLIGHT_MODULE: `${process.cwd()}\\scripts\\preflight-core.psm1`,
    },
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stdout).toContain("OK preflight core");
  expect(result.stdout + result.stderr).not.toContain("private-token");
  expect(result.stdout + result.stderr).not.toContain("private-query");
  expect(result.stdout + result.stderr).not.toContain("secret-marker");
}, 25_000);
