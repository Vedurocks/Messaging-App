export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-content-primary">
        Secure Comms
      </h1>
      <p className="max-w-md text-center text-content-secondary">
        Project scaffold initialized. Auth, conversations, and messaging
        routes will live under{' '}
        <code className="rounded bg-background-surface px-1.5 py-0.5 text-sm text-secondary">
          app/
        </code>
        .
      </p>
      <div className="flex gap-3">
        <button className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-background transition hover:bg-primary-hover">
          Primary action
        </button>
        <button className="rounded-xl border border-border-strong bg-background-surface px-4 py-2 text-sm font-medium text-content-primary transition hover:border-secondary">
          Secondary action
        </button>
      </div>
    </main>
  );
}
