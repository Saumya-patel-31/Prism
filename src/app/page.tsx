import Link from "next/link";
import {
  ArrowRight, Shield, Layers, Gauge, FlaskConical, Terminal,
  KeyRound, Search, FileText, Cpu,
} from "lucide-react";
import "./landing.css";

/* ── Signature: the dispersion instrument ──────────────────────────────
   One prompt enters; five labeled signals leave. The bands are the real
   stages of the retrieval pipeline, so the drawing carries information
   rather than decorating the page.                                     */
const BANDS = [
  { y: 88, color: "oklch(0.62 0.2 300)", label: "route" },
  { y: 132, color: "oklch(0.65 0.16 260)", label: "embed" },
  { y: 176, color: "oklch(0.7 0.13 200)", label: "search" },
  { y: 220, color: "oklch(0.72 0.14 150)", label: "fuse" },
  { y: 264, color: "oklch(0.78 0.14 85)", label: "cite" },
];

function DispersionInstrument() {
  return (
    <div className="lp-prism">
      <svg viewBox="0 0 640 340" role="img" xmlns="http://www.w3.org/2000/svg">
        <title>
          A prompt enters a prism and disperses into five pipeline stages:
          route, embed, search, fuse, and cite.
        </title>

        {/* Incoming beam — the prompt */}
        <path className="lp-beam" pathLength={1} d="M 12 170 L 216 170" />
        <text className="lp-band-label" x="12" y="156" style={{ opacity: 1 }}>
          prompt
        </text>

        {/* The prism */}
        <path
          className="lp-prism-body"
          d="M 248 78 L 300 232 L 196 232 Z"
        />

        {/* Dispersed signals */}
        {BANDS.map((b, i) => (
          <g key={b.label}>
            <path
              className={`lp-band lp-band-${i + 1}`}
              pathLength={1}
              stroke={b.color}
              d={`M 281 175 L 446 ${b.y} L 500 ${b.y}`}
            />
            <circle cx="500" cy={b.y} r="3" fill={b.color} className={`lp-band-label lp-label-${i + 1}`} />
            <text
              className={`lp-band-label lp-label-${i + 1}`}
              x="514"
              y={b.y + 4}
            >
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const PIPELINE = [
  {
    step: "01",
    title: "Chunk",
    body: "Documents split on paragraph boundaries at ~400 tokens with 60 tokens of overlap, so a sentence never loses its context.",
  },
  {
    step: "02",
    title: "Embed",
    body: "Each chunk is embedded locally through Ollama and stored alongside its text in SQLite. No embedding API, no egress.",
  },
  {
    step: "03",
    title: "Search twice",
    body: "Dense vector search finds meaning; BM25 finds exact tokens like error codes and function names. Neither alone is enough.",
  },
  {
    step: "04",
    title: "Fuse",
    body: "Reciprocal Rank Fusion merges both rankings without score calibration, then MMR drops near-duplicate passages.",
  },
  {
    step: "05",
    title: "Cite",
    body: "The model answers from the retrieved context and every claim carries a source you can expand and check.",
  },
];

const FEATURES = [
  { icon: Layers, title: "Knowledge collections", body: "Group documents into named corpora and attach a whole collection to a conversation." },
  { icon: Gauge, title: "Model benchmark", body: "Stream one prompt through six models at once. Compare tokens per second, latency, and output side by side." },
  { icon: Search, title: "Search everything", body: "One shortcut spans sessions, messages, documents, prompts, and collections." },
  { icon: Terminal, title: "Programmatic API", body: "A bearer-token endpoint with SSE streaming, so Prism works from your editor or scripts." },
  { icon: FileText, title: "Prompt library", body: "Save reusable prompts with variable substitution and insert them mid-conversation." },
  { icon: Cpu, title: "Automatic routing", body: "Each prompt is classified and sent to the model that handles it best, with manual override." },
];

const SECURITY = [
  ["scrypt password hashing", "Per-user salt, timing-safe comparison."],
  ["Signed session cookies", "HMAC-SHA256, HttpOnly, SameSite, Secure in production."],
  ["Instant session revocation", "Changing a password invalidates every other session."],
  ["Login rate limiting", "Sliding window, ten attempts per username per fifteen minutes."],
  ["Hashed API keys", "Stored as SHA-256; the plaintext key is shown exactly once."],
  ["Enforced secrets", "The server refuses to boot in production without a real AUTH_SECRET."],
];

export default function LandingPage() {
  return (
    <div className="min-h-full overflow-y-auto">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center gap-3">
          <Shield className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
          <span className="font-semibold tracking-tight">Prism</span>
          <span className="lp-eyebrow hidden sm:inline !text-[10px] border border-[var(--color-border)] rounded px-1.5 py-0.5">
            local
          </span>
          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            <a
              href="#pipeline"
              className="hidden sm:inline-block text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors px-3 py-1.5 rounded-md cursor-pointer"
            >
              How it works
            </a>
            <a
              href="#security"
              className="hidden sm:inline-block text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors px-3 py-1.5 rounded-md cursor-pointer"
            >
              Security
            </a>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-[var(--color-primary)] text-white px-3.5 py-1.5 rounded-md hover:opacity-90 transition-opacity cursor-pointer"
            >
              Open Prism
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative border-b border-[var(--color-border)]">
        <div className="lp-grid-backdrop absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-12 lg:gap-10 items-center">
          <div>
            <p className="lp-eyebrow lp-enter lp-enter-1 mb-5">Nothing leaves this machine</p>
            <h1 className="lp-display lp-enter lp-enter-2 text-[2.75rem] sm:text-6xl lg:text-[4.15rem] text-[var(--color-foreground)] mb-6">
              Run AI locally,
              <br />
              with retrieval
              <br />
              you can measure.
            </h1>
            <p className="lp-enter lp-enter-3 text-base sm:text-lg text-[var(--color-muted-foreground)] leading-relaxed max-w-lg mb-8">
              Prism is a self-hosted hub for local language models. Ask questions
              about your own documents, get answers with citations you can verify,
              and prove the retrieval works with a built-in evaluation suite.
            </p>
            <div className="lp-enter lp-enter-4 flex flex-wrap items-center gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white text-sm font-medium px-5 py-2.5 rounded-md hover:opacity-90 transition-opacity cursor-pointer"
              >
                Get started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 border border-[var(--color-border)] text-sm font-medium px-5 py-2.5 rounded-md text-[var(--color-foreground)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-secondary)] transition-colors cursor-pointer"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="lg:pl-4">
            <DispersionInstrument />
            <p className="lp-eyebrow mt-4 text-center lg:text-left">
              One prompt · five signals · zero network calls
            </p>
          </div>
        </div>
      </section>

      {/* ── Pipeline ────────────────────────────────────────── */}
      <section id="pipeline" className="border-b border-[var(--color-border)] scroll-mt-14">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="lp-eyebrow mb-4">The retrieval pipeline</p>
          <h2 className="lp-display text-3xl sm:text-4xl mb-4 max-w-2xl">
            Most local AI tools stop at the chat box.
          </h2>
          <p className="text-[var(--color-muted-foreground)] max-w-2xl leading-relaxed mb-12">
            Answering questions about your own files is a retrieval problem, not a
            prompting problem. Prism runs the full pipeline on your machine and shows
            its work at every stage.
          </p>

          <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-px bg-[var(--color-border)] rounded-lg overflow-hidden border border-[var(--color-border)]">
            {PIPELINE.map(({ step, title, body }) => (
              <li key={step} className="bg-[var(--color-card)] p-5 flex flex-col">
                <span className="font-mono text-xs text-[var(--color-primary)] mb-3">{step}</span>
                <h3 className="font-medium text-[var(--color-foreground)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Evals proof ─────────────────────────────────────── */}
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="lp-eyebrow mb-4">Measured, not claimed</p>
            <h2 className="lp-display text-3xl sm:text-4xl mb-5">
              Retrieval quality you can put a number on.
            </h2>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-4">
              Prism samples chunks across your corpus and asks a local model to write a
              question that only that chunk answers. The source chunk becomes the
              ground-truth label, so you get a real test set without labelling anything
              by hand.
            </p>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Run the suite and every retrieval change is a measurement rather than a
              guess — generated, scored, and stored locally.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              <FlaskConical className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span className="text-xs font-medium">Evaluation report</span>
            </div>
            <dl className="divide-y divide-[var(--color-border)]">
              {[
                ["Hit@1", "How often the right source ranks first"],
                ["Hit@K", "How often it appears in the top K"],
                ["MRR", "Mean reciprocal rank of the first correct hit"],
                ["Latency", "Retrieval time per query, in milliseconds"],
              ].map(([metric, desc]) => (
                <div key={metric} className="px-4 py-3 flex items-baseline gap-4">
                  <dt className="font-mono text-sm text-[var(--color-foreground)] w-20 shrink-0">
                    {metric}
                  </dt>
                  <dd className="text-sm text-[var(--color-muted-foreground)]">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="lp-eyebrow mb-4">The rest of the workspace</p>
          <h2 className="lp-display text-3xl sm:text-4xl mb-12 max-w-2xl">
            Everything a local model needs to be useful daily.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5 hover:border-[var(--color-primary)]/40 transition-colors"
              >
                <Icon className="w-4 h-4 text-[var(--color-primary)] mb-3" />
                <h3 className="font-medium mb-1.5">{title}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ────────────────────────────────────────── */}
      <section id="security" className="border-b border-[var(--color-border)] scroll-mt-14">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="lp-eyebrow mb-4">Security model</p>
          <h2 className="lp-display text-3xl sm:text-4xl mb-4 max-w-2xl">
            Local-first is the starting point, not the excuse.
          </h2>
          <p className="text-[var(--color-muted-foreground)] max-w-2xl leading-relaxed mb-12">
            Running on your own hardware removes the biggest risk. Everything else still
            has to be built properly.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
            {SECURITY.map(([title, body]) => (
              <div key={title} className="border-l-2 border-[var(--color-primary)]/40 pl-4">
                <h3 className="text-sm font-medium mb-1">{title}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24 text-center">
          <div className="spectrum-line max-w-xs mx-auto mb-10" aria-hidden="true" />
          <h2 className="lp-display text-3xl sm:text-5xl mb-5">
            Your documents never leave.
          </h2>
          <p className="text-[var(--color-muted-foreground)] max-w-md mx-auto leading-relaxed mb-8">
            Install Ollama, pull a model, and run Prism. The whole stack is one
            Node process and a SQLite file.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white text-sm font-medium px-5 py-2.5 rounded-md hover:opacity-90 transition-opacity cursor-pointer"
            >
              Open Prism
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 border border-[var(--color-border)] text-sm font-medium px-5 py-2.5 rounded-md hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-secondary)] transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Create an API key
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span className="font-medium text-[var(--color-foreground)]">Prism</span>
          </div>
          <p className="sm:ml-auto">
            Runs on Ollama · Stores in SQLite · Sends nothing anywhere
          </p>
        </div>
      </footer>
    </div>
  );
}
