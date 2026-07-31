# Windows EXE trust and release verification

Scope: native/packed `.exe` distributed from a GitHub Release. Sources below are Microsoft or GitHub primary documentation, checked 2026-07-31.

## What each control establishes

- **Authenticode code signing** binds the signing publisher and the exact binary contents: Windows can use it to verify authorship and integrity of `.exe` files. It gives a user a verifiable publisher identity when the certificate chains to a trusted CA; it does **not** make an executable inherently safe or remove every download/run warning. [Microsoft: Authenticode and time stamping](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures)
- **Microsoft Defender SmartScreen** is a separate reputation decision. It considers both publisher/certificate reputation and the particular file hash's reputation. A newly signed binary can still be marked unrecognized until evidence accumulates; unsigned and self-signed binaries show the same first-download warning, and an enterprise policy may prevent bypass. [Microsoft: SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- Do not buy EV solely to evade SmartScreen: Microsoft states that EV certificates no longer bypass it. Consistently signing releases with the same verified publisher identity helps the publisher signal, but it is not a guaranteed first-download bypass. The Microsoft Store is the only listed route with no SmartScreen download warning. [Microsoft: SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- A cryptographic **checksum** only establishes that the downloaded file equals the expected bytes; it does not identify the Windows publisher. GitHub's release-asset API exposes a SHA-256 `digest`, and its CLI can attest that a downloaded local artifact exactly matches a release asset. [GitHub: release-asset API](https://docs.github.com/en/rest/releases/assets) · [GitHub: verify release integrity](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verify-release-integrity)

## Signing material and storage choices

- `SignTool` can sign using a password-protected PFX (`/f ... /p ...`) or a certificate in a certificate store (`/n ...`; the default store is `My`). A signing certificate must have access to its private key; when a certificate file has no private key, `SignTool` requires a CSP and private-key container instead. [Microsoft: SignTool options](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)
- Therefore, a conventional PFX and its password are release-signing secrets: do not commit either or place either in a release. Restrict them to the signing host/CI secret store and stage them only for the signing step. This is the operational implication of Microsoft explicitly requiring protection of the PFX password. [Microsoft: signing with SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/using-signtool-to-sign-a-file)
- A hardware cryptography module can hold the private-key information while `SignTool` uses the installed certificate, CSP, and key container. [Microsoft: signing with a hardware module](https://learn.microsoft.com/en-us/windows/win32/seccrypto/using-signtool-to-sign-a-file)
- Microsoft Artifact Signing is a managed alternative: establish an Artifact Signing account, complete public identity validation, create a Public Trust certificate profile, and grant the CI identity the **Artifact Signing Certificate Profile Signer** role. Public identity validation can take 1–20 business days or longer. [Microsoft: Artifact Signing quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart) · [Microsoft: Artifact Signing roles](https://learn.microsoft.com/en-us/azure/artifact-signing/tutorial-assign-roles)

## Recommended release gate

1. Build and test the final executable. Do not alter its bytes after signing; if the build changes, sign again.
2. Sign and RFC 3161 timestamp the final `.exe` with SHA-256. Replace the placeholders with the approved certificate selection and timestamp authority:

   ```powershell
   signtool sign /fd SHA256 /tr https://<timestamp-authority> /td SHA256 /f <secure-path-to-cert.pfx> /p <secret> <app.exe>
   ```

   Microsoft recommends SHA-256 and RFC 3161 timestamps. Timestamping keeps an otherwise-valid signature verifiable after the signing certificate expires; omitting it can make the signature invalid at expiry. [Microsoft: timestamp guidance](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures)

3. Fail the release if signature validation or timestamp validation does not succeed:

   ```powershell
   signtool verify /pa /all /tw /v <app.exe>
   ```

   `/pa` selects the normal application authentication policy (instead of driver policy); `/all` verifies every signature; `/tw` turns a missing timestamp into a warning. Treat SignTool's warning exit code (`2`) as a release failure, alongside error code `1`; only `0` is success. [Microsoft: SignTool verification options and exit codes](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)

4. Calculate and publish a user-facing `SHA256SUMS.txt` alongside the exact signed asset, then upload both to the GitHub Release. GitHub also supplies the asset digest through its API. Users can independently compute `Get-FileHash <app.exe> -Algorithm SHA256` and compare it to the published digest.
5. Prefer an **immutable GitHub Release**. A user with GitHub CLI can run `gh release verify <tag>` and `gh release verify-asset <tag> <downloaded-exe>`; GitHub documents the latter as checking that the local artifact exactly matches the release asset. [GitHub: verify release integrity](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/verify-release-integrity)

## Scope boundary for the runtime audit

Signing/release verification addresses *pre-execution provenance and byte integrity*. It does not decide whether an IOL user is logged in, whether credentials are present, or which first-run screen appears. Those must be modeled as separate runtime states; however, the user-facing first-run documentation should distinguish the expected transient SmartScreen warning for a newly signed release from an invalid/unverified publisher prompt.
