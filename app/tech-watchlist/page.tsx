'use client';
import { useEffect, useMemo, useState } from 'react';
const INITIAL: Record<string, Record<string, string[]>> = {
    HubSpot: { 'CRM setup & migration': ['crm setup', 'migration', 'pipeline', 'custom properties', 'data hygiene'], 'Automation & workflows': ['workflow', 'automation', 'lead scoring', 'lead routing'], 'API & integrations': ['api', 'webhook', 'integration', 'sync'], 'Email & lead generation': ['email marketing', 'lead generation', 'sequence', 'nurtur', 'campaign'], 'Reporting & analytics': ['reporting', 'dashboard', 'attribution', 'analytics'], 'CMS & landing pages': ['landing page', 'cms', 'hubspot website'] },
    n8n: { 'AI agents': ['ai agent', 'llm', 'openai', 'rag'], 'API integration': ['api', 'webhook', 'http request'], 'CRM automation': ['crm', 'hubspot', 'salesforce'], 'Lead generation': ['lead generation', 'outreach', 'enrichment'], 'Document processing': ['document', 'pdf', 'ocr'] },
    GoHighLevel: { 'Funnels & websites': ['funnel', 'landing page', 'website'], 'CRM & workflows': ['crm', 'workflow', 'automation'], 'AI voice agents': ['voice agent', 'voice ai', 'retell', 'vapi'], 'Snapshots & SaaS': ['snapshot', 'saas', 'sub-account'] },
    'Make.com': { 'API & webhooks': ['api', 'webhook'], 'Data synchronization': ['sync', 'data mapping'], 'CRM automation': ['crm', 'hubspot'], 'AI workflows': ['ai', 'openai', 'llm'] },
    'Wix Studio': { 'Responsive design': ['responsive', 'design', 'redesign'], 'Velo development': ['velo', 'custom code', 'javascript'], 'CMS': ['cms', 'dynamic page', 'collection'], 'E-commerce': ['ecommerce', 'e-commerce', 'store'], 'Integrations': ['api', 'integration'] },
    Webflow: { 'Design & development': ['design', 'figma', 'development'], 'CMS': ['cms', 'collection'], 'Animations': ['animation', 'interaction', 'gsap'], 'Custom code & integration': ['custom code', 'api', 'integration', 'memberstack'], 'Finsweet': ['finsweet'] },
    Shopify: { 'Theme & Liquid': ['theme', 'liquid'], 'Store design': ['store design', 'redesign', 'figma'], 'Apps & integrations': ['app integration', 'api', 'webhook'], 'CRO': ['conversion', 'cro', 'optimization'] },
    WordPress: { 'Elementor': ['elementor'], 'WooCommerce': ['woocommerce'], 'Plugins & custom development': ['plugin', 'php', 'custom code'], 'Migration & performance': ['migration', 'speed', 'performance'] },
    Squarespace: { 'Design': ['design', 'redesign'], 'E-commerce': ['commerce', 'store'], 'Custom code': ['custom code', 'css', 'javascript'] },
    Zapier: { 'CRM integration': ['crm', 'hubspot'], 'Workflow automation': ['workflow', 'automation', 'zap'], 'API & webhooks': ['api', 'webhook'] },
    'AI Agents': { 'RAG & knowledge bases': ['rag', 'knowledge base', 'vector'], 'Voice agents': ['voice', 'retell', 'vapi'], 'Chatbots': ['chatbot', 'assistant'], 'Tool integration': ['mcp', 'tool calling', 'api'], 'Business automation': ['automation', 'workflow'] },
    MCP: { 'Server development': ['mcp server', 'model context protocol'], 'Tool integration': ['tool', 'integration', 'api'], 'AI agents': ['agent', 'llm'] },
    Lovable: { 'MVP development': ['mvp', 'prototype'], 'Supabase': ['supabase', 'database'], 'Bug fixing': ['bug', 'fix', 'debug'], 'Deployment': ['deploy', 'vercel'] },
    Framer: { 'Design & Figma': ['design', 'figma'], 'CMS': ['cms'], 'Animation': ['animation', 'interaction'], 'Custom components': ['component', 'code'] },
    Bubble: { 'SaaS & MVP': ['saas', 'mvp'], 'Database & workflows': ['database', 'workflow'], 'API integration': ['api', 'integration'] },
};
type Job = {
    id?: string;
    ciphertext?: string;
    url?: string;
    title?: string;
    description?: string;
    publishedDateTime?: string;
    createdDateTime?: string;
    totalApplicants?: number;
    amount?: Money;
    hourlyBudgetMin?: Money;
    hourlyBudgetMax?: Money;
    client?: {
        verificationStatus?: string;
        totalSpent?: Money;
    };
};
type Money = {
    displayValue?: string;
    currency?: string;
};
type Entry = {
    job: Job;
    stacks: string[];
    firstSeen: string;
};
type Store = {
    stacks: string[];
    entries: Record<string, Entry>;
    lastRun: Record<string, string>;
};

// ==========================================
// CONFIGURATION
// ==========================================

const KEY = 'phoenix-tech-watchlist-v1';

const EMPTY: Store = {
    stacks: Object.keys(INITIAL),
    entries: {},
    lastRun: {}
};

const aliases: Record<string, string[]> = {
    GoHighLevel: [
        'gohighlevel',
        'go high level',
        'ghl'
    ],
    MCP: [
        'mcp',
        'model context protocol'
    ],
    'AI Agents': [
        'ai agent',
        'ai agents',
        'agentic ai'
    ],
    'Wix Studio': [
        'wix studio',
        'wix velo',
        'velo'
    ]
};


// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Match keyword using regular expression

function matches(text: string, phrase: string) {
    return new RegExp(
        '\\b' +
        phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '\\b',
        'i'
    ).test(text);
}


// Check whether a job is relevant to a technology

function relevant(j: Job, s: string) {
    return (aliases[s] || [s]).some(a =>
        matches(`${j.title || ''} ${j.description || ''}`, a)
    );
}


// Generate unique job identifier

function keyOf(j: Job) {
    return (
        j.ciphertext ||
        j.id ||
        j.url ||
        `${j.title}|${j.publishedDateTime || j.createdDateTime}|${j.description}`
    );
}


// Convert monetary value into a number

function numeric(m?: Money) {
    if (
        !m?.displayValue ||
        (m.currency && m.currency.toUpperCase() !== 'USD')
    ) {
        return null;
    }

    const n = Number(
        m.displayValue.replace(/[^0-9.]/g, '')
    );

    return Number.isFinite(n) && n > 0 ? n : null;
}


// Calculate median value

function median(a: number[]) {
    if (!a.length) {
        return null;
    }

    const b = [...a].sort((x, y) => x - y);

    return (
        b[Math.floor((b.length - 1) / 2)] +
        b[Math.ceil((b.length - 1) / 2)]
    ) / 2;
}


// Extract jobs from different API response structures

function unpack(raw: any): Job[] {
    const candidates = [
        raw,
        raw.jobs,
        raw.results,
        raw.items,
        raw.nodes,
        raw.edges,
        raw.data,
        raw.data?.jobs,
        raw.data?.results,
        raw.data?.items,
        raw.data?.edges,
        raw.jobs?.edges,
        raw.jobs?.nodes,
        raw.data?.jobs?.edges,
        raw.data?.jobs?.nodes,
        raw.data?.nodes
    ];

    const arr = candidates.find(Array.isArray);

    if (!arr) {
        throw new Error(
            'Unknown API response shape. Update unpack() to match your route.'
        );
    }

    return arr.map((x: any) => x.node || x);
}


// ==========================================
// SHARED BUTTON STYLING
// ==========================================

const btn =
    'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50';


// ==========================================
// MAIN COMPONENT
// ==========================================

export default function TechWatchlist() {

    // ==========================================
    // STATE MANAGEMENT
    // ==========================================

    const [store, setStore] = useState<Store>(EMPTY);
    const [ready, setReady] = useState(false);
    const [days, setDays] = useState(30);
    const [selected, setSelected] = useState('HubSpot');
    const [newStack, setNewStack] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [sort, setSort] = useState('jobs');
    const [errors, setErrors] = useState<string[]>([]);


    // ==========================================
    // LOAD LOCAL STORAGE
    // ==========================================

    useEffect(() => {
        try {
            const raw = localStorage.getItem(KEY);

            if (raw) {
                setStore(JSON.parse(raw));
            }
        } catch {
            setStatus('Could not load local history.');
        }

        setReady(true);
    }, []);


    // ==========================================
    // SAVE DATA TO LOCAL STORAGE
    // ==========================================

    useEffect(() => {
        if (ready) {
            try {
                localStorage.setItem(
                    KEY,
                    JSON.stringify(store)
                );
            } catch {
                setStatus(
                    'Browser storage is full. Export your data before clearing it.'
                );
            }
        }
    }, [store, ready]);


    // ==========================================
    // DATE RANGE CONFIGURATION
    // ==========================================

    const now = Date.now();

    const duration = days * 86400000;


    // ==========================================
    // TECHNOLOGY PERFORMANCE CALCULATIONS
    // ==========================================

    const rows = useMemo(() =>
        store.stacks.map(stack => {

            // Retrieve all jobs for the technology

            const all = Object.values(store.entries).filter(e =>
                e.stacks.includes(stack)
            );


            // Extract job publication date

            const time = (e: Entry) =>
                Date.parse(
                    e.job.publishedDateTime ||
                    e.job.createdDateTime ||
                    ''
                );


            // Jobs within the current period

            const current = all.filter(e =>
                time(e) >= now - duration &&
                time(e) <= now
            );


            // Jobs within the previous period

            const previous = all.filter(e =>
                time(e) >= now - 2 * duration &&
                time(e) < now - duration
            );


            // Calculate median hourly budget

            const rate = median(
                current.flatMap(e => {
                    const a = numeric(e.job.hourlyBudgetMin);
                    const b = numeric(e.job.hourlyBudgetMax);

                    return a !== null && b !== null
                        ? [(a + b) / 2]
                        : a !== null
                            ? [a]
                            : b !== null
                                ? [b]
                                : [];
                })
            );


            // Calculate median fixed-price budget

            const fixed = median(
                current.flatMap(e => {
                    const v = numeric(e.job.amount);

                    return v === null ? [] : [v];
                })
            );


            // Calculate median number of applicants

            const applicants = median(
                current.flatMap(e =>
                    typeof e.job.totalApplicants === 'number'
                        ? [e.job.totalApplicants]
                        : []
                )
            );


            // Return technology performance data

            return {
                stack,
                current,
                previous: previous.length,

                growth: previous.length
                    ? (
                        (current.length - previous.length) /
                        previous.length
                    ) * 100
                    : null,

                rate,
                fixed,
                applicants
            };
        }),
        [store, now, duration]
    );


    // ==========================================
    // SORT TECHNOLOGY PERFORMANCE
    // ==========================================

    const ordered = [...rows].sort((a, b) =>
        sort === 'growth'
            ? (b.growth ?? -Infinity) - (a.growth ?? -Infinity)

            : sort === 'rate'
                ? (b.rate ?? -1) - (a.rate ?? -1)

                : sort === 'competition'
                    ? (a.applicants ?? Infinity) -
                      (b.applicants ?? Infinity)

                    : b.current.length - a.current.length
    );


    // ==========================================
    // SELECTED TECHNOLOGY
    // ==========================================

    const active = rows.find(r =>
        r.stack === selected
    );


    // ==========================================
    // SKILL PRIORITY CLASSIFICATION
    // ==========================================

    const skills = Object.entries(INITIAL[selected] || {})
        .map(([name, terms]) => ({
            name,

            jobs: (active?.current || []).filter(e =>
                terms.some(t =>
                    `${e.job.title || ''} ${e.job.description || ''}`
                        .toLowerCase()
                        .includes(t.toLowerCase())
                )
            )
        }))
        .sort((a, b) =>
            b.jobs.length - a.jobs.length
        );


    // ==========================================
    // SCAN TECHNOLOGIES
    // ==========================================

    async function scan(stacks: string[]) {

        setBusy(true);
        setErrors([]);

        const failures: string[] = [];

        try {

            // Scan each technology individually

            for (const stack of stacks) {

                setStatus(`Searching ${stack}…`);

                try {

                    // Configure API query parameters

                    const q = new URLSearchParams({
                        first: '50',
                        q: stack,
                        skills: stack,
                        after: '0',
                        countries: '',
                        paymentVerified: 'all',
                        applicants: 'all',
                        previousClient: 'false',
                        postedDays: String(days)
                    });


                    // Fetch jobs from Upwork API route

                    const res = await fetch(
                        '/api/upwork/jobs?' + q,
                        {
                            cache: 'no-store'
                        }
                    );


                    // Validate API response

                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }


                    // Extract jobs from response

                    const jobs = unpack(await res.json());


                    // Filter relevant jobs

                    const found = jobs.filter(j =>
                        relevant(j, stack)
                    );


                    // Update stored job history

                    setStore(old => {

                        const entries = {
                            ...old.entries
                        };

                        for (const job of found) {

                            const id = keyOf(job);

                            const prev = entries[id];

                            entries[id] = {
                                job,

                                stacks: Array.from(
                                    new Set([
                                        ...(prev?.stacks || []),
                                        stack
                                    ])
                                ),

                                firstSeen:
                                    prev?.firstSeen ||
                                    new Date().toISOString()
                            };
                        }


                        // Update last scan timestamp

                        return {
                            ...old,
                            entries,

                            lastRun: {
                                ...old.lastRun,
                                [stack]: new Date().toISOString()
                            }
                        };
                    });


                    // Check API pagination limit

                    if (jobs.length >= 100) {
                        failures.push(
                            `${stack}: page limit reached; more jobs may exist.`
                        );
                    }

                } catch (e) {

                    // Handle individual technology scan errors

                    failures.push(
                        `${stack}: ${
                            e instanceof Error
                                ? e.message
                                : String(e)
                        }`
                    );
                }
            }

        } finally {

            // Reset scanning status

            setErrors(failures);

            setStatus('Scan finished. Results are based on retrieved jobs only.');

            setBusy(false);
        }
    }


    // ==========================================
    // ADD NEW TECHNOLOGY
    // ==========================================

    function add() {

        const s = newStack.trim();
        // Prevent empty or duplicate technologies
        if (
            !s ||
            store.stacks.some(x =>
                x.toLowerCase() === s.toLowerCase()
            )
        ) {
            return;
        }


        // Add technology to watchlist

        setStore(old => ({
            ...old,

            stacks: [
                ...old.stacks,
                s
            ]
        }));


        // Select the newly added technology
        setSelected(s);
        setNewStack('');
    }


    // ==========================================
    // EXPORT JOB HISTORY
    // ==========================================

    function exportData() {

        // Convert stored data into JSON file

        const blob = new Blob(
            [JSON.stringify(store, null, 2)],
            {
                type: 'application/json'
            }
        );
        // Generate temporary download URL
        const url = URL.createObjectURL(blob);
        // Create download anchor
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tech-watchlist-history.json';
        a.click();
        // Release temporary URL
        URL.revokeObjectURL(url);
    }


    // ==========================================
    // CALCULATE TOTAL UNIQUE JOBS
    // ==========================================

    const unique = new Set(
        rows.flatMap(r =>
            r.current.map(e =>
                keyOf(e.job)
            )
        )
    ).size;


    // ==========================================
    // JSX RETURN BLOCK STARTS HERE
    // ==========================================
    return (
                <main className="min-h-screen bg-[#0f173b] px-4 pb-7 pt-32 text-slate-900 md:px-7 md:pt-24">

                  {/* ==========================================
                      PAGE HEADER
                  ========================================== */}

                  <header className="mb-6 flex flex-wrap items-center justify-between gap-4 text-white">
                    <div>
                      <p className="text-sm font-bold tracking-widest text-[#76dc40]">
                        PHOENIX MARKET INTELLIGENCE
                      </p>

                      <h1 className="mt-2 text-3xl font-bold">
                        Tech Stack Watchlist
                      </h1>

                      <p className="mt-1 text-sm text-slate-300">
                        Track freelance demand, budgets and skill priorities.
                      </p>
                    </div>

                    <a
                      href="/upwork-jobs"
                      className="rounded-lg border border-slate-500 px-4 py-2 text-sm"
                    >
                      ← Job Monitoring
                    </a>
                  </header>


                  {/* ==========================================
                      FILTERS AND ACTION BUTTONS
                  ========================================== */}

                  <section className="mb-4 rounded-xl bg-white p-4">
                    <div className="flex flex-wrap items-center gap-3">

                      {/* Date Range */}

                      <select
                        value={days}
                        onChange={e => setDays(Number(e.target.value))}
                        className="rounded-lg border p-2"
                      >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                      </select>

                      {/* Scan All Technologies */}

                      <button
                        className={`${btn} bg-blue-600 text-white`}
                        disabled={!ready || busy}
                        onClick={() => scan(store.stacks)}
                      >
                        {busy ? 'Scanning…' : 'Scan all technologies'}
                      </button>

                      {/* Scan Selected Technology */}

                      <button
                        className={`${btn} border`}
                        disabled={!ready || busy}
                        onClick={() => scan([selected])}
                      >
                        Scan selected
                      </button>

                      {/* Export History */}

                      <button
                        onClick={exportData}
                        className={`${btn} border border-green-600 text-green-700`}
                      >
                        Export history
                      </button>

                      {/* Add New Technology */}

                      <div className="ml-auto flex gap-2">
                        <input
                          value={newStack}
                          onChange={e => setNewStack(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              add();
                            }
                          }}
                          placeholder="Add technology"
                          className="min-w-0 rounded-lg border p-2"
                        />

                        <button
                          onClick={add}
                          className={`${btn} bg-green-600 text-white`}
                        >
                          + Add
                        </button>
                      </div>
                    </div>


                    {/* Technology Selection Buttons */}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {store.stacks.map(s => (
                        <button
                          key={s}
                          onClick={() => setSelected(s)}
                          className={`rounded-full border px-3 py-1 text-sm ${
                            selected === s
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-50'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>


                    {/* Scan Status */}

                    <p className="mt-3 text-xs text-slate-500">
                      {status ||
                        'Scan to collect live job data. History is stored in this browser.'}
                    </p>


                    {/* Error Messages */}

                    {errors.map(e => (
                      <p
                        key={e}
                        className="mt-1 text-xs text-amber-700"
                      >
                        {e}
                      </p>
                    ))}
                  </section>


                  {/* ==========================================
                      SUMMARY STATISTICS
                  ========================================== */}

                  <section className="mb-4 grid gap-3 sm:grid-cols-3">
                    {[
                      [
                        'Technologies tracked',
                        store.stacks.length
                      ],
                      [
                        'Unique jobs in period',
                        unique
                      ],
                      [
                        'Technologies with jobs',
                        rows.filter(r => r.current.length > 0).length
                      ]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl bg-white p-5"
                      >
                        <p className="text-sm text-slate-500">
                          {label}
                        </p>

                        <p className="mt-2 text-3xl font-bold text-[#0f173b]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </section>


                  {/* ==========================================
                      TECHNOLOGY PERFORMANCE TABLE
                  ========================================== */}

                  <section className="mb-4 rounded-xl bg-white p-4">

                    {/* Section Header and Sorting */}

                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold">
                        Technology performance
                      </h2>

                      <select
                        className="rounded-lg border p-2 text-sm"
                        value={sort}
                        onChange={e => setSort(e.target.value)}
                      >
                        <option value="jobs">Job volume</option>
                        <option value="growth">Observed growth</option>
                        <option value="rate">Hourly budget</option>
                        <option value="competition">Low competition</option>
                      </select>
                    </div>


                    {/* Performance Table */}

                    <div className="overflow-x-auto">
                      <table className="w-full whitespace-nowrap text-left text-sm">

                        {/* Table Header */}

                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            {[
                              'Technology',
                              'Jobs',
                              'Previous period',
                              'Growth',
                              'Average $/hr',
                              'Average fixed $',
                              'Average applicants',
                              'Last scan'
                            ].map(h => (
                              <th
                                key={h}
                                className="p-3"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>


                        {/* Table Body */}

                        <tbody>
                          {ordered.map(r => (
                            <tr
                              key={r.stack}
                              onClick={() => setSelected(r.stack)}
                              className={`cursor-pointer border-b hover:bg-blue-50 ${
                                selected === r.stack ? 'bg-blue-50' : ''
                              }`}
                            >

                              {/* Technology Name */}

                              <td className="p-3 font-semibold text-blue-700">
                                <button onClick={() => setSelected(r.stack)}>
                                  {r.stack}
                                </button>
                              </td>

                              {/* Current Jobs */}

                              <td className="p-3">
                                {r.current.length}
                              </td>

                              {/* Previous Period Jobs */}

                              <td className="p-3">
                                {r.previous}
                              </td>

                              {/* Growth Percentage */}

                              <td
                                className={`p-3 ${
                                  r.growth !== null && r.growth < 0
                                    ? 'text-red-600'
                                    : 'text-green-700'
                                }`}
                              >
                                {r.growth === null
                                  ? '—'
                                  : `${r.growth.toFixed(1)}%`}
                              </td>

                              {/* Median Hourly Rate */}

                              <td className="p-3">
                                {r.rate?.toFixed(0) ?? '—'}
                              </td>

                              {/* Median Fixed Budget */}

                              <td className="p-3">
                                {r.fixed?.toFixed(0) ?? '—'}
                              </td>

                              {/* Median Applicants */}

                              <td className="p-3">
                                {r.applicants ?? '—'}
                              </td>

                              {/* Last Scan Date */}
                              <td className="p-3 text-xs">
                              {store.lastRun[r.stack]
                                ? new Date(store.lastRun[r.stack])
                                    .toLocaleString('en-GB', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                      hour12: true
                                    })
                                    .toUpperCase()
                                : 'Not scanned'}
                            </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>


                    {/* Table Disclaimer */}

                    <p className="mt-3 text-xs text-slate-500">
                      *Observed counts only; growth is unreliable until both periods
                      have consistent coverage. Budgets are advertised USD values,
                      not earnings. Applicants are not age-adjusted.
                    </p>
                  </section>


                  {/* ==========================================
                      TECHNOLOGY SKILL PRIORITIES
                  ========================================== */}

                  <section className="rounded-xl bg-white p-5">

                    {/* Selected Technology Header */}

                    <h2 className="text-xl font-bold">
                      {selected} — Skill priorities
                    </h2>

                    <p className="mb-5 text-sm text-slate-500">
                      Keyword-based classification of {active?.current.length || 0}{' '}
                      retrieved jobs. Jobs may count in multiple topics.
                    </p>


                    {/* Skill Categories */}

                    {skills.length ? (
                      skills.map((s, i) => (
                        <div
                          key={s.name}
                          className="mb-4"
                        >

                          {/* Skill Name and Job Count */}

                          <div className="mb-1 flex justify-between text-sm">
                            <span className="font-medium">
                              {i + 1}. {s.name}
                            </span>

                            <span>
                              {s.jobs.length} jobs
                            </span>
                          </div>


                          {/* Skill Demand Progress Bar */}

                          <div className="h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-green-500"
                              style={{
                                width: `${
                                  active?.current.length
                                    ? (s.jobs.length / active.current.length) * 100
                                    : 0
                                }%`
                              }}
                            />
                          </div>


                          {/* Matching Jobs */}

                          <details className="mt-1 text-xs text-slate-600">
                            <summary className="cursor-pointer">
                              View matching jobs
                            </summary>

                            {s.jobs.map(e => (
                              <div
                                key={keyOf(e.job)}
                                className="py-1"
                              >
                                {e.job.title || 'Untitled job'}
                              </div>
                            ))}
                          </details>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No skill taxonomy configured for this technology.
                        Add categories to INITIAL in the page code.
                      </p>
                    )}


                    {/* ==========================================
                        RETRIEVED JOBS
                    ========================================== */}

                    <h3 className="mt-6 font-bold">
                      Retrieved jobs
                    </h3>

                    <div className="mt-2 max-h-80 overflow-auto">
                      {active?.current.map(e => (
                        <div
                          key={keyOf(e.job)}
                          className="border-b py-3"
                        >

                          {/* Job Title */}

                          <p className="text-sm font-medium">
                            {e.job.title || 'Untitled job'}
                          </p>

                          {/* Job Description */}

                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {e.job.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                </main>
              );
}
