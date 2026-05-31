# Stremio Streamed Addon

## Android TV Usage

If you are using this addon on your Android TV, you will need the [Browser 1](https://play.google.com/store/apps/details?id=com.internet.tvbrowser&hl=en) app to effectively play the streams shared by this addon.

## Self-Hosted Only

A deployed version of this addon is not available. You will need to deploy your own, which only requires a free Cloudflare account and a github account. *Note: Make sure to have your gtihub repo private to avoid any issues*

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/st-barts/stremio-streamed-addon)

1. Click the deploy button above
2. Copy the `workers.dev` URL from the deployment
3. In Stremio, add the addon using the URL: `{YOUR_WORKERS_DEV_URL}/manifest.json`
