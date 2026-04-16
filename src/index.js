import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// ── Sentry error monitoring ───────────────────────────────────
// Sign up free at sentry.io, create a React project,
// then add REACT_APP_SENTRY_DSN to your Vercel env vars
if (process.env.REACT_APP_SENTRY_DSN && process.env.NODE_ENV === "production") {
  import("@sentry/react").then(Sentry => {
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: "production",
      // Only send 20% of performance traces to stay on free tier
      tracesSampleRate: 0.2,
      // Ignore common non-actionable errors
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "Non-Error promise rejection captured",
        "Network request failed",
      ],
      beforeSend(event) {
        // Don't send errors that are just network timeouts
        if (event.exception?.values?.[0]?.type === "TypeError" &&
            event.exception?.values?.[0]?.value?.includes("fetch")) {
          return null;
        }
        return event;
      },
    });
  }).catch(() => {
    // Sentry failed to load — app still works fine
    console.warn("Sentry could not be initialized");
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
