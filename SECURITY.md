# Security Policy

YQhub is a local desktop application that calls third-party video generation APIs with user-provided credentials. Treat the repository as public source code, not as a place for accounts, generated installers, or private operating notes.

## Public Repository Rules

- Do not commit `.env`, `.env.*`, real `ak-...` API Keys, account screenshots, local Electron store files, logs, or user media.
- Do not commit generated directories such as `node_modules/`, `dist/`, `dist-electron/`, `release/`, or packaged installer files.
- Do not publish unsigned installers from automatic push workflows.
- Publish installers only through an intentional release channel such as GitHub Releases, a private delivery link, or a managed download location.
- Keep third-party API notes clearly marked as either current implementation notes or historical reference.

## Credentials

The app stores API Keys on the user's own machine. In Electron builds, keys are written through Electron `safeStorage` and the renderer receives only masked account metadata.

Tests use fixed fake `ak-...` values so validation logic can run without real credentials. These values are not usable API Keys.

## Reporting Issues

If you find a real secret, private user file, or unsafe release artifact in this repository, do not open a public issue with the secret included. Contact the repository owner directly and include only the file path, commit, and a short description of the exposure.
