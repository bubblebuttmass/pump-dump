import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// No DSN configured yet (e.g. local dev, or before the Sentry project
// exists) -- skip init entirely rather than call Sentry.init('') and have
// it silently no-op in a way that's easy to mistake for "it's working."
export const sentryEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    // Native crashes + unhandled JS exceptions are the baseline; tracing is
    // left off for now since perf monitoring isn't why this was added.
    tracesSampleRate: 0,
    // Helpful in dev but noisy/unnecessary once this ships -- errors should
    // reach Sentry from real usage, not print a duplicate trace locally too.
    debug: false,
    enabled: !__DEV__,
  });
}

export { Sentry };
