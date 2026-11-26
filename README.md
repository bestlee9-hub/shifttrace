# Shifttrace

Shifttrace turns fictional equipment logs into a shift handoff. It separates the first abnormal signal from follow-on alarms, shows the original source lines, and leaves unconfirmed causes open. Review all output against the input. This prototype does not control equipment or establish a diagnosis.

## Quick start: no account or configuration

Install Node.js 22.12 or newer. From the directory containing `package.json`:

```sh
npm ci
npm run dev
```

Open the loopback address printed by Vite. Leave **Analysis mode** set to **Local sample · no AI**, and select **Analyze log**. The built-in fictional sample should show two separate incidents. Use **Download handoff** to save the result as text. This mode is deterministic and makes no AI request; other input receives simple keyword-based flags.

Run `npm test` for the automated checks and `npm run build` for production output in `dist/`.

## Firebase hybrid mode

Register a Web app in your Firebase project, enable Firebase AI Logic with the Gemini Developer API, and set up Firebase App Check. Copy `.env.example` to `.env.local` and fill in the Firebase **Web app** configuration values. Do not use a Gemini API key, a service-account credential or any real equipment data.

### Local development

1. Follow [Firebase’s localhost App Check guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started#step_4_configure_the_app_check_debug_provider_for_local_development). Keep App Check enforced and set `VITE_LOCAL_APPCHECK_DEBUG=true` in your local environment file. Leave the reCAPTCHA site key blank for this local workflow.
2. Start or restart `npm run dev`. In the same Chrome profile, open the exact loopback URL Vite prints with `?appcheck=setup` appended. The SDK generates a debug token in DevTools. Register it privately under **App Check → Apps → your Web app → Manage debug tokens**. Never put that token in source, environment variables, a public build, screenshots or shared logs.
3. Return to the same origin without the setup query, choose **Firebase hybrid**, and analyze the built-in fictional sample. Keep the same browser profile, scheme, hostname and port to reuse its stored debug token.

### Hosted use

In a clean production build, omit the local debug opt-in and use the actual hosted domain’s [reCAPTCHA Enterprise App Check web configuration](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider). Fill in the site key and run `npm run build`; serve only `dist/` from HTTPS. The local debug branch requires Vite development mode and a loopback origin. Vite also reads local environment files at build time, so do not build the hosted release from a private test configuration.

### What to verify

Firebase AI Logic uses `PREFER_ON_DEVICE`. Shifttrace asks Chrome for English text output with English text and image input capability; the log sent by this app is text. If local inference is unavailable or the request is incompatible, the SDK can use Gemini 3.5 Flash-Lite in the cloud. A local request that has already been selected is not guaranteed to retry in the cloud if it stalls. **Firebase hybrid can send the input to Google, so use fictional data only.**

- **Cloud:** On a configured environment where Chrome's matching local model is not ready, select **Analyze log**. A valid handoff labeled **Cloud** confirms the Firebase SDK route for that request.
- **On-device:** In supported desktop Chrome, select **Prepare model** and wait for **On-device model ready**. A 100% download indicator is not readiness. Then analyze the same fictional sample. A fresh, valid handoff labeled **On-device** confirms the SDK route, not the exact installed model version.
- **Verification status:** The built-in sample produced two incidents in a live localhost **Cloud** run. Live **On-device** inference and the exact Chrome model version are not yet verified. Automated tests do not replace either live route check.

The built-in fictional example is available through **Load sample**. A second short example is in [examples/clamp-feedback.log](examples/clamp-feedback.log): a close request does not prove the clamp actually moved, a later interlock timeout is not the first abnormal signal, and the post-restart camera alert is a separate cycle. The app validates line identifiers but cannot determine whether a model correctly interpreted the event.

## License

[Apache License 2.0](LICENSE).
