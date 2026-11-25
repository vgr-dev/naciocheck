# Changelog

All notable changes to NacioCheck are listed here, in English. The format is a small subset of
[Keep a Changelog](https://keepachangelog.com/) and the versions follow semantic versioning.

## [Unreleased]

## [1.0.0] - 2026-11-25

### Added

- A reminder, captcha and result flow for checking a Spanish nationality-by-residence application: the
  extension fills in the official query form, leaves only the captcha to the person, submits once it is
  solved and reads the status the site returns.
- A full-screen alert, a notification and a badge when the status changes from the last check.
- A stored history of every check, for any number of applications, with add, edit, delete, and export and
  import as a file.
- Reminders on the days and at the time the person chooses, while the browser is open.
- A status guide that explains each status with its sources, labelled as unofficial, and says what has only
  been observed on real files.
- The status shown exactly as the official site printed it, in every language.
- Optional encryption of the identifying details with a passphrase, which is never stored.
- A share panel for each application that builds a short numbered timeline to copy, with an optional filing
  date.
- A "Report a problem" action that shows the exact text first and only opens the website with it, so nothing
  is sent without the person's say-so.
- Spanish and English interfaces that follow the browser language.
- No network requests of its own, no telemetry, no analytics and no use of `storage.sync`; the source is
  licensed GPL-3.0-or-later.
