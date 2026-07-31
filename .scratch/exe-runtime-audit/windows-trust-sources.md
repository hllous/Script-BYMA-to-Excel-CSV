# Windows executable trust: official-source notes

## Authenticode and SignTool

- [SignTool reference](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool): `sign` digitally signs a file; signatures protect against tampering and let users verify the signer from its signing certificate. `verify` checks that the issuer is trusted, revocation status, and (optionally) policy validity. Current tooling requires `/fd` for signing and `/td` with RFC 3161 timestamps. Exit codes are `0` success, `1` failure, and `2` warnings.
- [Time-stamping Authenticode signatures](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures): Authenticode provides authorship and integrity for binaries, including `.exe` and `.dll`. Microsoft recommends SHA-256 and RFC 3161 timestamps (`/tr` plus `/td SHA256`); do not use SHA-1 as the sole algorithm for new releases.

Release-gate command shape (substitute the approved certificate selection and timestamp endpoint):

```powershell
signtool sign /fd SHA256 /tr https://<rfc3161-timestamp-url> /td SHA256 /a <app>.exe
signtool verify /pa /all /tw /v <app>.exe
```

`/pa` selects the default Authenticode verification policy; `/tw` produces a warning if the signature lacks a timestamp. Treat signing and verification failure as a failed release. Decide explicitly whether warnings are release-blocking.

## SmartScreen reputation

- [SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation): SmartScreen assesses both publisher-certificate reputation and the individual file hash. A newly built binary can show a warning even when correctly signed, until positive reputation accumulates.
- A valid OV or EV certificate shows a verified publisher but may initially be marked unrecognized. Unsigned or self-signed binaries require **Run anyway** and enterprise policy can prevent running them. EV no longer automatically bypasses SmartScreen.
- Consistently signing releases with the same publisher identity lets reputation accrue. There is no manual consumer-endpoint reputation review. Publishing through the Microsoft Store is the documented path that avoids SmartScreen download warnings because Store apps are re-signed by Microsoft.
- [Code-signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options): confirms that Artifact Signing and OV have initial reputation-building prompts, and EV has had the same behavior since 2024. It also confirms Store submission of MSI/EXE still needs Authenticode signing.

## Signing-key handling

- [Certificates and public keys](https://learn.microsoft.com/en-us/windows/win32/seccrypto/certificates-and-public-keys): signatures are made with the private key and verified with the public key; the private key's secrecy must be maintained. Microsoft describes protected disk storage and smart cards as options.
- [CNG key storage providers](https://learn.microsoft.com/en-us/windows/win32/seccertenroll/cng-key-storage-providers): the Microsoft Platform Crypto Provider uses a TPM and keeps private keys non-extractable, including against malicious software.
- [Sign packages with Azure Key Vault](https://learn.microsoft.com/en-us/windows/msix/desktop/sign-with-akv-cert): in the Azure Key Vault signing integration, the private key never leaves Key Vault. This supports a CI design that avoids placing a PFX/private key in the repository or build workspace.

Practical conclusion: Authenticode establishes identity and integrity but does not itself promise a no-warning first-run experience. The release flow needs a trusted certificate, SHA-256 signing, RFC 3161 timestamping, and verification; Store distribution is the only Microsoft-documented route that fully removes SmartScreen download warnings.
