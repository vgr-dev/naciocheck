# 0006. Name, brand and licence

- **Status:** accepted
- **Date:** 2026-11-06, licence refined 2026-11-18 (recorded 2026-11-18)

## Context

The name must read well in Spanish and English and must not suggest an official tool. The product's value is
trust, so a fork that adds telemetry must not be able to hide it.

## Decision

- **Name:** NacioCheck (slug `naciocheck`, site `naciocheck.vgr.cat`, gecko id `naciocheck@vgr.cat`).
  _Nacio_ = nacionalidad / nation; _check_ is a common anglicism in Spain. The gecko id can never change
  after the first AMO upload.
- **Icon and logo:** a symmetric N-check on a white badge; the logo is the icon plus "NacioCheck" in Nunito
  800 plus the tagline. Full guide in `brand/README.md`. Colours: teal `#0F766E` with accents `#14B8A6` and
  `#0D9488`; no red or yellow and no official symbols. The logotype ships as outlined paths, never a remote
  font. English tagline: "Your nationality application, up to date."
- **Licence:** GPL-3.0-or-later. Copyleft means any distributed fork, including one with telemetry, must
  publish its source. Both stores accept it; Nunito keeps its own OFL licence file. "Or later" (chosen over
  `-only` on 2026-11-18) follows the FSF default and keeps the code compatible if the GPL is revised.

## Consequences

- The product is never presented as affiliated with the Ministerio de Justicia, and status explanations are
  never presented as official.
- Every browser archive must carry the licence notices (AUD-16 in the audit).
