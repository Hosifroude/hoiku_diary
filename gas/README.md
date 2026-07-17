# Google Apps Script backend

This directory contains the current Google Apps Script backend used by ほいくにっき.

## Deployment

1. Copy `Code.gs` into the Apps Script project.
2. In Apps Script, open **Project Settings > Script properties**.
3. Add a property named `ACCESS_PASSWORD` with the synchronization password.
4. Deploy a new web-app version after every backend change.

Do not commit passwords, API keys, or other credentials to this repository.
