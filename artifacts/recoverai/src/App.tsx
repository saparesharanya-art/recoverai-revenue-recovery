import { useState, type ElementType, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  FileClock,
  Filter,
  Gauge,
  History,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  StopCircle,
  UserRound,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  getGetAuditQueryKey,
  getGetAnalyticsQueryKey,
  getGetCustomersQueryKey,
  getGetCustomerQueryKey,
  getGetDashboardQueryKey,
  getGetPaymentQueryKey,
  getGetPaymentsQueryKey,
  getGetRecoveryCasesQueryKey,
  getGetSettingsQueryKey,
  useAnalyzeRecovery,
  useApproveRecoveryAction,
  useCreateRecoveryAction,
  useExecuteRecoveryAction,
  useGetAnalytics,
  useGetAudit,
  useGetCustomer,
  useGetCustomers,
  useGetDashboard,
  useGetPayment,
  useGetPayments,
  useGetRecoveryCases,
  useGetSettings,
  useRejectRecoveryAction,
  useRunRecoveryScan,
  useStopRecovery,
  useUpdateSettings,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/payments', label: 'Payments', icon: CreditCard },
      { href: '/recovery', label: 'Recovery', icon: Sparkles },
      { href: '/human-review', label: 'Human review', icon: UserRound },
    ],
  },
  {
    label: 'Understand',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/audit', label: 'Audit trail', icon: History },
    ],
  },
];

const money = (value = 0, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const dateTime = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const percent = (value = 0) => `${Math.round(value)}%`;
const toneFor = (value = '') => {
  const v = value.toLowerCase();
  if (v.includes('recover') || v.includes('success') || v.includes('pass') || v.includes('approved') || v === 'low') return 'positive';
  if (v.includes('fail') || v.includes('block') || v.includes('reject') || v.includes('high')) return 'negative';
  if (v.includes('review') || v.includes('pending') || v.includes('schedule') || v.includes('medium')) return 'warning';
  return 'neutral';
};

function StatusPill({ value, icon = false }: { value?: string | null; icon?: boolean }) {
  const label = value || 'Unknown';
  const tone = toneFor(label);
  return (
    <span className={`status-pill ${tone}`} data-testid={`status-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      {icon && (tone === 'positive' ? <CheckCircle2 size={12} /> : tone === 'negative' ? <XCircle size={12} /> : <Clock3 size={12} />)}
      {label.replace(/_/g, ' ')}
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="stack" data-testid="loading-state">
      <Skeleton className="h-24 w-full" />
      {Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  );
}

function QueryState({ loading, error, retry, children }: { loading: boolean; error: boolean; retry: () => void; children: ReactNode }) {
  if (loading) return <LoadingState />;
  if (error) return <div className="empty-state" data-testid="error-state"><AlertCircle size={20} /><strong>Could not load this view</strong><span>The workspace is safe. Try the request again.</span><button className="button secondary" onClick={retry} data-testid="button-retry">Retry</button></div>;
  return <>{children}</>;
}

function Logo() {
  return <Link href="/dashboard" className="brand" data-testid="link-brand"><span className="brand-mark"><span /></span><span>recover<span className="brand-accent">ai</span></span></Link>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const reviewQueue = useGetRecoveryCases({ status: 'pending' }, { query: { queryKey: getGetRecoveryCasesQueryKey({ status: 'pending' }) } });
  const current = location === '/' ? '/dashboard' : location;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top"><Logo /><button className="icon-button mobile-only" onClick={() => setOpen(false)} data-testid="button-close-menu"><X size={18} /></button></div>
        <div className="merchant-switcher"><span className="merchant-avatar">S</span><span><strong>Solace Goods</strong><small>Merchant workspace</small></span><ChevronRight size={14} /></div>
        <nav className="nav">
          {navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => {
            const active = current === item.href || (item.href !== '/dashboard' && current.startsWith(item.href));
             return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`nav-item ${active ? 'active' : ''}`} data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}><item.icon size={17} /><span>{item.label}</span>{item.href === '/human-review' && reviewQueue.data && reviewQueue.data.length > 0 && <span className="nav-count">{reviewQueue.data.length}</span>}</Link>;
          })}</div>)}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/settings" className={`nav-item ${current.startsWith('/settings') ? 'active' : ''}`} data-testid="link-settings"><Settings size={17} /><span>Settings</span></Link>
          <div className="sidebar-status"><span className="pulse" /><span>Demo environment</span><span className="font-mono">v0.8</span></div>
        </div>
      </aside>
      {open && <button className="mobile-scrim" onClick={() => setOpen(false)} data-testid="button-dismiss-menu" aria-label="Close menu" />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setOpen(true)} data-testid="button-open-menu"><Menu size={19} /></button>
          <div className="breadcrumb"><span>Solace Goods</span><ChevronRight size={13} /><strong>{current === '/dashboard' ? 'Overview' : current.split('/')[1]?.replace('-', ' ')}</strong></div>
          <div className="topbar-actions"><span className="scan-state"><span className="pulse" /> Scan healthy</span><button className="icon-button" data-testid="button-notifications" aria-label="Notifications"><Bell size={17} /></button><div className="user-chip"><span className="user-avatar">AM</span><span className="desktop-only">Aarav Mehta</span><ChevronRight size={13} /></div></div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow || 'Workspace'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</div>;
}

function MetricCard({ label, value, delta, note, icon: Icon, accent = 'teal' }: { label: string; value: string; delta?: number; note?: string; icon: ElementType; accent?: string }) {
  return <div className={`metric-card ${accent}`} data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} /></span></div><div className="metric-value">{value}</div>{delta !== undefined ? <div className={`metric-delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(delta).toFixed(1)}% <span>vs last period</span></div> : <div className="metric-note">{note}</div>}</div>;
}

function SimpleBars({ points, valueKey = 'value', color = 'teal' }: { points: Array<Record<string, any>>; valueKey?: string; color?: string }) {
  const max = Math.max(...points.map(p => Number(p[valueKey] || 0)), 1);
  return <div className="bar-chart">{points.map((point, index) => <div className="bar-group" key={`${point.label}-${index}`}><div className={`bar ${color}`} style={{ height: `${Math.max(8, (Number(point[valueKey] || 0) / max) * 100)}%` }} title={`${point.label}: ${point[valueKey]}`} /><span>{point.label}</span></div>)}</div>;
}

function DashboardPage() {
  const query = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const data = query.data;
  const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
  return <Shell><PageHeader eyebrow={todayLabel} title="Good morning, Aarav." description="Here’s where recovery stands across Solace Goods today." action={<Link href="/recovery" className="button primary" data-testid="link-run-recovery"><Play size={15} /> Run recovery scan</Link>} />
    <QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>
      {data && <><div className="metrics-grid">
        <MetricCard label="Revenue at risk" value={money(data.metrics.revenueAtRisk)} delta={data.metrics.recoveredDelta ? -Math.abs(data.metrics.recoveredDelta) : undefined} note="Across open failures" icon={Gauge} accent="orange" />
        <MetricCard label="Revenue recovered" value={money(data.metrics.revenueRecovered)} delta={data.metrics.recoveredDelta} icon={CheckCircle2} accent="teal" />
        <MetricCard label="Recovery rate" value={percent(data.metrics.recoveryRate)} delta={data.metrics.rateDelta} icon={Zap} accent="blue" />
        <MetricCard label="Failed payments" value={String(data.metrics.failedPayments)} note={`${data.metrics.pendingReviews} waiting for review`} icon={CreditCard} accent="red" />
      </div>
      <div className="dashboard-grid"><section className="card-surface panel trend-panel"><div className="panel-heading"><div><h2>Recovery performance</h2><p>At-risk volume versus recovered revenue</p></div><button className="select-button" data-testid="button-trend-period">Last 7 days <ChevronRight size={13} /></button></div><div className="legend"><span><i className="legend-dot orange" />At risk</span><span><i className="legend-dot teal" />Recovered</span></div><SimpleBars points={data.trend as Array<Record<string, any>>} valueKey="atRisk" color="orange" /><div className="chart-recovered"><SimpleBars points={data.trend as Array<Record<string, any>>} valueKey="recovered" color="teal" /></div></section>
        <section className="card-surface panel"><div className="panel-heading"><div><h2>Needs attention</h2><p>Decisions that need a merchant</p></div><Link href="/human-review" className="text-link" data-testid="link-see-all-review">View queue <ChevronRight size={13} /></Link></div><div className="attention-list"><AttentionRow icon={UserRound} title="Human review queue" value={String(data.metrics.pendingReviews)} detail="cases waiting" href="/human-review" /><AttentionRow icon={ShieldCheck} title="AI actions today" value={String(data.metrics.aiActions)} detail="within guardrails" href="/audit" /><AttentionRow icon={FileClock} title="Failed payments" value={String(data.metrics.failedPayments)} detail="open opportunities" href="/payments" /></div></section></div>
      <div className="dashboard-grid lower"><section className="card-surface panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>What RecoverAI changed and why</p></div><Link href="/audit" className="text-link" data-testid="link-view-audit">View audit <ChevronRight size={13} /></Link></div><ActivityList items={data.recentActivity?.slice(0, 5) || []} /></section>
        <section className="card-surface panel breakdown"><div className="panel-heading"><div><h2>Recovery outcomes</h2><p>By outcome this period</p></div></div>{data.outcomeBreakdown?.map((item, index) => <div className="breakdown-row" key={`${item.label}-${index}`}><span><i className={`legend-dot ${index === 0 ? 'teal' : index === 1 ? 'blue' : 'orange'}`} />{item.label}</span><strong>{item.count}</strong><span className="breakdown-value">{money(item.value)}</span></div>)}</section></div></>}
    </QueryState>
  </Shell>;
}

function AttentionRow({ icon: Icon, title, value, detail, href }: { icon: ElementType; title: string; value: string; detail: string; href: string }) {
  return <Link href={href} className="attention-row" data-testid={`link-attention-${title.toLowerCase().replace(/\s+/g, '-')}`}><span className="attention-icon"><Icon size={16} /></span><span className="attention-copy"><strong>{title}</strong><small>{detail}</small></span><strong className="attention-value">{value}</strong><ChevronRight size={14} /></Link>;
}

function ActivityList({ items }: { items: Array<any> }) {
  if (!items.length) return <div className="empty-state compact"><FileClock size={19} /><strong>No activity yet</strong><span>New recovery decisions will appear here.</span></div>;
  return <div className="activity-list">{items.map(item => <div className="activity-row" key={item.id} data-testid={`activity-${item.id}`}><span className={`activity-dot ${toneFor(item.result)}`} /><span className="activity-copy"><strong>{item.action}</strong><span>{item.customerName}{item.reason ? ` · ${item.reason}` : ''}</span></span><span className="activity-time">{dateTime(item.timestamp)}</span></div>)}</div>;
}

function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const params = { search: search || undefined, status: status === 'all' ? undefined : status, limit: 100 };
  const query = useGetPayments(params, { query: { queryKey: getGetPaymentsQueryKey(params) } });
  return <Shell><PageHeader eyebrow="Collections" title="Payments" description="Every failed payment, ranked by what can still be recovered." action={<Link href="/recovery" className="button secondary" data-testid="link-payments-recovery"><Sparkles size={15} /> Recovery workspace</Link>} /><div className="card-surface table-card"><div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search payment, customer, email..." data-testid="input-search-payments" /></div><div className="toolbar-right"><div className="filter-select"><Filter size={14} /><select value={status} onChange={event => setStatus(event.target.value)} data-testid="select-payment-status"><option value="all">All statuses</option><option value="failed">Failed</option><option value="recovered">Recovered</option><option value="in_review">In review</option></select></div><span className="result-count">{query.data?.length || 0} records</span></div></div><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{query.data && (query.data.length ? <PaymentTable payments={query.data} /> : <div className="empty-state"><CreditCard size={22} /><strong>No matching payments</strong><span>Try a different customer, payment ID, or status.</span><button className="button secondary" onClick={() => { setSearch(''); setStatus('all'); }} data-testid="button-clear-payment-filters">Clear filters</button></div>)}</QueryState></div></Shell>;
}

function PaymentTable({ payments }: { payments: Array<any> }) {
  return <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Customer</th><th>Amount</th><th>Failure reason</th><th>Recovery chance</th><th>Status</th><th /></tr></thead><tbody>{payments.map(payment => <tr key={payment.id} data-testid={`row-payment-${payment.id}`}><td><Link href={`/payments/${payment.id}`} className="table-primary" data-testid={`link-payment-${payment.id}`}>{payment.paymentId}</Link><span className="table-secondary">{dateTime(payment.failedAt)}</span></td><td><div className="person-cell"><span className="initial-avatar" style={{ background: payment.avatarColor || '#d8e6df' }}>{payment.customerName?.slice(0, 1)}</span><span><strong>{payment.customerName}</strong><small>{payment.customerEmail}</small></span></div></td><td><strong>{money(payment.amount, payment.currency)}</strong><span className="table-secondary">LTV {money(payment.lifetimeValue, payment.currency)}</span></td><td><span className="failure-reason">{payment.failureReason}</span><span className="table-secondary">{payment.attempts} attempt{payment.attempts === 1 ? '' : 's'}</span></td><td><div className="probability"><span>{percent(payment.recoveryProbability)}</span><div className="progress-track"><i style={{ width: `${payment.recoveryProbability}%` }} /></div></div></td><td><StatusPill value={payment.status} icon /></td><td><Link href={`/payments/${payment.id}`} className="row-action" data-testid={`link-payment-detail-${payment.id}`}><ChevronRight size={16} /></Link></td></tr>)}</tbody></table></div>;
}

function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const query = useGetPayment(id, { query: { queryKey: getGetPaymentQueryKey(id), enabled: !!id } });
  const analyze = useAnalyzeRecovery();
  const createAction = useCreateRecoveryAction();
  const stop = useStopRecovery();
  const [feedback, setFeedback] = useState('');
  const invalidate = useQueryClient();
  const payment = query.data;
  const runAnalyze = () => analyze.mutate({ data: { paymentId: id } }, { onSuccess: () => { setFeedback('Fresh AI assessment ready'); invalidate.invalidateQueries({ queryKey: getGetPaymentQueryKey(id) }); } });
  const runAction = (type: string) => createAction.mutate({ data: { paymentId: id, type, reason: 'Merchant initiated from payment detail' } }, { onSuccess: () => { setFeedback(`${type.replace(/_/g, ' ')} action created`); invalidate.invalidateQueries({ queryKey: getGetPaymentQueryKey(id) }); } });
  return <Shell><Link href="/payments" className="back-link" data-testid="link-back-payments"><ArrowLeft size={15} /> Payments</Link><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{payment && <><PageHeader eyebrow={`Payment ${payment.paymentId}`} title={money(payment.amount, payment.currency)} description={`${payment.customerName} · failed ${dateTime(payment.failedAt)}`} action={<div className="button-row"><button className="button secondary" onClick={runAnalyze} disabled={analyze.isPending} data-testid="button-analyze-payment"><Sparkles size={15} />{analyze.isPending ? 'Analyzing…' : 'Re-analyze'}</button><button className="button danger-outline" onClick={() => stop.mutate({ id }, { onSuccess: () => { setFeedback('Recovery stopped safely'); invalidate.invalidateQueries({ queryKey: getGetPaymentQueryKey(id) }); } })} disabled={stop.isPending} data-testid="button-stop-recovery"><StopCircle size={15} /> Stop recovery</button></div>} />{feedback && <div className="inline-feedback"><CheckCircle2 size={15} />{feedback}</div>}<div className="detail-layout"><div className="detail-main"><section className="card-surface panel"><div className="panel-heading"><div><h2>Payment context</h2><p>Signals used in the recovery decision</p></div><StatusPill value={payment.riskLevel} icon /></div><div className="signal-grid"><Signal label="Customer" value={payment.customerName} /><Signal label="Failure reason" value={payment.failureReason} /><Signal label="Attempts" value={`${payment.attempts} total`} /><Signal label="Lifetime value" value={money(payment.lifetimeValue, payment.currency)} /><Signal label="Successful payments" value={String(payment.successfulPayments)} /><Signal label="Last action" value={dateTime(payment.lastActionAt)} /></div></section><section className="card-surface panel"><div className="panel-heading"><div><h2>Recovery timeline</h2><p>Chronological record of this payment</p></div></div><div className="timeline">{payment.timeline?.map((event, index) => <div className="timeline-item" key={`${event.timestamp}-${index}`}><span className={`timeline-dot ${toneFor(event.tone)}`} /><div><div className="timeline-meta">{dateTime(event.timestamp)} · {event.actor}</div><strong>{event.title}</strong><p>{event.description}</p></div></div>)}</div></section></div><div className="detail-side"><section className="card-surface panel ai-card"><div className="ai-label"><Sparkles size={15} /> RecoverAI decision</div>{payment.aiDecision ? <><div className="ai-probability"><strong>{percent(payment.aiDecision.recoveryProbability)}</strong><span>recovery probability</span></div><div className="recommendation"><span>Recommended action</span><strong>{payment.aiDecision.recommendedAction.replace(/_/g, ' ')}</strong></div><p className="reasoning">“{payment.aiDecision.reasoning}”</p><div className="confidence-row"><span>Confidence</span><strong>{percent(payment.aiDecision.confidence)}</strong></div><div className="progress-track"><i style={{ width: `${payment.aiDecision.confidence}%` }} /></div><div className="model-note"><ShieldCheck size={14} /> {payment.aiDecision.model} · explainable decision</div></> : <div className="empty-state compact"><Sparkles size={18} /><strong>No decision yet</strong><span>Run the AI assessment to see a recommendation.</span><button className="button primary full" onClick={runAnalyze} data-testid="button-analyze-empty">Analyze payment</button></div>}</section><section className="card-surface panel"><div className="panel-heading"><div><h2>Safety checks</h2><p>Guardrails before any action</p></div></div>{payment.safetyChecks?.map((check, index) => <div className="check-row" key={`${check.rule}-${index}`}><span className={`check-icon ${check.passed ? 'passed' : 'failed'}`}>{check.passed ? <Check size={13} /> : <X size={13} />}</span><span><strong>{check.rule}</strong><small>{check.detail}</small></span></div>)}<div className="button-row stacked-mobile"><button className="button secondary" onClick={() => runAction(payment.recommendedAction)} disabled={createAction.isPending} data-testid="button-create-recovery-action"><Zap size={15} /> Create recommended action</button></div></section></div></div></>}</QueryState></Shell>;
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div className="signal"><span>{label}</span><strong>{value}</strong></div>;
}

function RecoveryPage() {
  const cases = useGetRecoveryCases(undefined, { query: { queryKey: getGetRecoveryCasesQueryKey() } });
  const scan = useRunRecoveryScan();
  const [result, setResult] = useState<any>(null);
  const runScan = () => scan.mutate(undefined, { onSuccess: data => { setResult(data); cases.refetch(); } });
  return <Shell><PageHeader eyebrow="Autopilot" title="Recovery workspace" description="A safe queue of decisions RecoverAI can explain, execute, or hand off." action={<button className="button primary" onClick={runScan} disabled={scan.isPending} data-testid="button-run-scan"><RefreshCw size={15} className={scan.isPending ? 'spin' : ''} />{scan.isPending ? 'Scanning…' : 'Run recovery scan'}</button>} />{result && <div className="scan-result"><div><span className="eyebrow">Scan complete</span><strong>{result.scanned} payments assessed</strong><span>{result.executed} action{result.executed === 1 ? '' : 's'} executed · {result.sentToReview} sent to review</span></div><div className="scan-stats"><span><strong>{money(result.recoveredRevenue)}</strong> recovered</span><span><strong>{result.blocked}</strong> blocked by guardrails</span></div><button className="icon-button" onClick={() => setResult(null)} data-testid="button-dismiss-scan"><X size={16} /></button></div>}<div className="recovery-overview"><div className="card-surface recovery-hero"><div className="recovery-orbit"><Sparkles size={25} /></div><div><div className="eyebrow">Decision engine</div><h2>Precision recovery, not blind retries.</h2><p>Every action is checked against amount, probability, retry history, and merchant rules before it moves.</p><div className="guardrail-summary"><span><ShieldCheck size={14} /> Guardrails active</span><span><Zap size={14} /> Demo-safe execution</span></div></div></div><div className="card-surface panel scan-stat-panel"><div className="panel-heading"><div><h2>Today’s scan</h2><p>Latest recovery run</p></div><span className="live-tag"><span className="pulse" /> Live</span></div><div className="big-stat">{result ? result.analyzed : '—'}<small>payments analyzed</small></div><div className="stat-line"><span>Executed safely</span><strong>{result?.executed ?? '—'}</strong></div><div className="stat-line"><span>Needs a decision</span><strong>{result?.sentToReview ?? cases.data?.length ?? '—'}</strong></div></div></div><section className="card-surface table-card"><div className="table-toolbar"><div><h2>Open recovery cases</h2><p className="toolbar-subtitle">The cases most likely to benefit from a considered next step.</p></div><StatusPill value={`${cases.data?.length || 0} open`} /></div><QueryState loading={cases.isLoading} error={cases.isError} retry={() => cases.refetch()}>{cases.data && (cases.data.length ? <RecoveryTable cases={cases.data} /> : <div className="empty-state"><CheckCircle2 size={22} /><strong>Nothing waiting</strong><span>The agent has no cases requiring attention.</span></div>)}</QueryState></section></Shell>;
}

function RecoveryTable({ cases }: { cases: Array<any> }) {
  return <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Amount</th><th>Why now</th><th>Recommendation</th><th>Confidence</th><th>Status</th><th /></tr></thead><tbody>{cases.map(item => <tr key={item.id} data-testid={`row-recovery-${item.id}`}><td><Link href={`/payments/${item.paymentId}`} className="table-primary" data-testid={`link-recovery-payment-${item.id}`}>{item.customerName}</Link><span className="table-secondary">Case #{item.id} · {dateTime(item.createdAt)}</span></td><td><strong>{money(item.amount, item.currency)}</strong><span className="table-secondary">{item.previousAttempts} previous attempts</span></td><td><span className="failure-reason">{item.reason}</span></td><td><span className="recommendation-text">{item.recommendation.replace(/_/g, ' ')}</span><span className="table-secondary">{item.nextStep}</span></td><td><div className="probability"><span>{percent(item.confidence)}</span><div className="progress-track"><i style={{ width: `${item.confidence}%` }} /></div></div></td><td><StatusPill value={item.status} icon /></td><td><Link href={`/payments/${item.paymentId}`} className="row-action" data-testid={`link-recovery-detail-${item.id}`}><ChevronRight size={16} /></Link></td></tr>)}</tbody></table></div>;
}

function HumanReviewPage() {
  const query = useGetRecoveryCases({ status: 'pending' }, { query: { queryKey: getGetRecoveryCasesQueryKey({ status: 'pending' }) } });
  const approve = useApproveRecoveryAction();
  const reject = useRejectRecoveryAction();
  const execute = useExecuteRecoveryAction();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const action = (kind: 'approve' | 'reject' | 'execute', id: number) => {
    const mutation = kind === 'approve' ? approve : kind === 'reject' ? reject : execute;
    mutation.mutate({ id }, { onSuccess: () => { setMessage(`Case #${id} ${kind}d`); qc.invalidateQueries({ queryKey: getGetRecoveryCasesQueryKey({ status: 'pending' }) }); } });
  };
  return <Shell><PageHeader eyebrow="Merchant decisions" title="Human review" description="A small, deliberate queue for the moments automation should not decide alone." action={<div className="review-cap"><span className="pulse" /> 4 decisions open</div>} />{message && <div className="inline-feedback"><CheckCircle2 size={15} />{message}</div>}<div className="review-banner"><ShieldCheck size={18} /><span><strong>Automation paused here.</strong> These cases crossed your approval threshold or need context only you have.</span></div><section className="review-grid"><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{query.data?.map(item => <article className="card-surface review-card" key={item.id} data-testid={`card-review-${item.id}`}><div className="review-card-top"><span className="case-id">CASE #{item.id}</span><StatusPill value={item.status} icon /></div><div className="review-customer"><span className="initial-avatar large">{item.customerName.slice(0, 1)}</span><div><h2>{item.customerName}</h2><span>Payment #{item.paymentId} · {dateTime(item.createdAt)}</span></div></div><div className="review-amount">{money(item.amount, item.currency)}<span>at risk</span></div><div className="review-reason"><span>Why it’s here</span><strong>{item.reason}</strong></div><div className="review-recommendation"><Sparkles size={14} /><span><strong>{item.recommendation.replace(/_/g, ' ')}</strong><small>{item.nextStep}</small></span><b>{percent(item.confidence)}</b></div><div className="review-actions"><button className="button secondary" onClick={() => action('reject', item.id)} disabled={reject.isPending} data-testid={`button-reject-${item.id}`}><X size={15} /> Reject</button><button className="button primary" onClick={() => action('approve', item.id)} disabled={approve.isPending} data-testid={`button-approve-${item.id}`}><Check size={15} /> Approve</button></div></article>)}</QueryState></section></Shell>;
}

function AnalyticsPage() {
  const query = useGetAnalytics({ query: { queryKey: getGetAnalyticsQueryKey() } });
  const data = query.data;
  return <Shell><PageHeader eyebrow="Measure the work" title="Analytics" description="See exactly what the agent recovered, what it skipped, and where humans made the difference." action={<button className="button secondary" data-testid="button-export-analytics"><FileClock size={15} /> Export report</button>} /><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{data && <><div className="metrics-grid analytics-metrics"><MetricCard label="Revenue recovered" value={money(data.metrics.revenueRecovered)} icon={CheckCircle2} accent="teal" /><MetricCard label="Recovery rate" value={percent(data.metrics.recoveryRate)} icon={Gauge} accent="blue" /><MetricCard label="Average recovery" value={money(data.metrics.averageRecoveryAmount)} icon={CreditCard} accent="orange" /><MetricCard label="Successful retries" value={String(data.metrics.successfulRetries)} note={`${data.metrics.failedRetries} unsuccessful`} icon={RefreshCw} accent="red" /></div><div className="analytics-grid"><section className="card-surface panel"><div className="panel-heading"><div><h2>Recovery funnel</h2><p>From failure to recovered revenue</p></div></div><div className="funnel">{data.funnel?.map((point, index) => <div className="funnel-row" key={`${point.label}-${index}`}><span>{point.label}</span><div className="funnel-track"><i style={{ width: `${point.percent}%` }} /></div><strong>{point.count}</strong><span>{money(point.amount)}</span></div>)}</div></section><section className="card-surface panel"><div className="panel-heading"><div><h2>Revenue by action</h2><p>Which interventions pay back</p></div></div><SimpleBars points={data.revenueByAction as Array<Record<string, any>>} valueKey="value" color="teal" /><div className="breakdown-list">{data.revenueByAction?.map((item, index) => <div className="breakdown-row" key={`${item.label}-${index}`}><span>{item.label}</span><strong>{money(item.value)}</strong><span className="table-secondary">{item.count} cases</span></div>)}</div></section></div><div className="analytics-grid"><AnalyticsBreakdown title="AI vs human outcomes" items={data.aiVsHuman || []} /><AnalyticsBreakdown title="Retry outcomes" items={data.retryOutcomes || []} /></div></>}</QueryState></Shell>;
}

function AnalyticsBreakdown({ title, items }: { title: string; items: Array<any> }) {
  const max = Math.max(...items.map(item => item.value), 1);
  return <section className="card-surface panel"><div className="panel-heading"><div><h2>{title}</h2><p>Outcome distribution</p></div></div><div className="outcome-list">{items.map(item => <div className="outcome-row" key={item.label}><div className="outcome-heading"><span>{item.label}</span><strong>{money(item.value)}</strong></div><div className="progress-track"><i style={{ width: `${(item.value / max) * 100}%` }} /></div><small>{item.count} outcomes</small></div>)}</div></section>;
}

function AuditPage() {
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const params = { search: search || undefined, eventType: eventType || undefined, limit: 100 };
  const query = useGetAudit(params, { query: { queryKey: getGetAuditQueryKey(params) } });
  return <Shell><PageHeader eyebrow="Control plane" title="Audit trail" description="A complete record of every decision, action, and guardrail." /><div className="card-surface table-card"><div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer, action, reason..." data-testid="input-search-audit" /></div><div className="toolbar-right"><div className="filter-select"><Filter size={14} /><select value={eventType} onChange={event => setEventType(event.target.value)} data-testid="select-audit-type"><option value="">All events</option><option value="recovery">Recovery</option><option value="payment">Payment</option><option value="settings">Settings</option></select></div><span className="result-count">{query.data?.length || 0} events</span></div></div><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{query.data && (query.data.length ? <div className="audit-list">{query.data.map(event => <div className="audit-row" key={event.id} data-testid={`row-audit-${event.id}`}><div className={`audit-icon ${toneFor(event.result)}`}>{event.result?.toLowerCase().includes('success') ? <Check size={15} /> : <FileClock size={15} />}</div><div className="audit-main"><div><strong>{event.action}</strong><StatusPill value={event.result} /></div><span>{event.customerName}{event.paymentId ? ` · Payment #${event.paymentId}` : ''}</span><small>{event.reason}</small></div><div className="audit-meta"><strong>{event.actor}</strong><span>{dateTime(event.timestamp)}</span></div><button className="row-action" data-testid={`button-audit-more-${event.id}`} aria-label="View audit event"><MoreHorizontal size={17} /></button></div>)}</div> : <div className="empty-state"><History size={22} /><strong>No audit events found</strong><span>Try widening the search.</span></div>)}</QueryState></div></Shell>;
}

function CustomersPage() {
  const [search, setSearch] = useState('');
  const params = { search: search || undefined, limit: 100 };
  const query = useGetCustomers(params, { query: { queryKey: getGetCustomersQueryKey(params) } });
  return <Shell><PageHeader eyebrow="Relationships" title="Customers" description="Understand the payment history behind every recovery opportunity." /><div className="card-surface table-card"><div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customers or email..." data-testid="input-search-customers" /></div><span className="result-count">{query.data?.length || 0} customers</span></div><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{query.data && (query.data.length ? <div className="customer-grid">{query.data.map(customer => <Link href={`/customers/${customer.id}`} className="customer-card" key={customer.id} data-testid={`card-customer-${customer.id}`}><div className="customer-card-top"><span className="initial-avatar large" style={{ background: customer.avatarColor || '#d8e6df' }}>{customer.name.slice(0, 1)}</span><StatusPill value={customer.status} /></div><h2>{customer.name}</h2><p>{customer.email}</p><div className="customer-card-stats"><span><small>LTV</small><strong>{money(customer.lifetimeValue)}</strong></span><span><small>Payments</small><strong>{customer.successfulPayments}</strong></span><span><small>Failed</small><strong className={customer.failedPayments ? 'text-danger' : ''}>{customer.failedPayments}</strong></span></div><div className="customer-card-foot"><span>Last payment {dateTime(customer.lastPaymentAt)}</span><ChevronRight size={15} /></div></Link>)}</div> : <div className="empty-state"><Users size={22} /><strong>No customers found</strong><span>Try a different name or email.</span></div>)}</QueryState></div></Shell>;
}

function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const query = useGetCustomer(id, { query: { queryKey: getGetCustomerQueryKey(id), enabled: !!id } });
  const customer = query.data;
  return <Shell><Link href="/customers" className="back-link" data-testid="link-back-customers"><ArrowLeft size={15} /> Customers</Link><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{customer && <><PageHeader eyebrow="Customer profile" title={customer.name} description={customer.email} action={<StatusPill value={customer.status} icon />} /><div className="customer-detail-grid"><section className="card-surface panel"><div className="customer-profile-head"><span className="initial-avatar xl" style={{ background: customer.avatarColor || '#d8e6df' }}>{customer.name.slice(0, 1)}</span><div><h2>{customer.name}</h2><span>{customer.email}</span></div></div><div className="profile-stats"><Signal label="Lifetime value" value={money(customer.lifetimeValue)} /><Signal label="Successful payments" value={String(customer.successfulPayments)} /><Signal label="Failed payments" value={String(customer.failedPayments)} /><Signal label="Last payment" value={dateTime(customer.lastPaymentAt)} /></div><div className="customer-health"><div className="panel-heading"><div><h2>Payment health</h2><p>Successful versus failed history</p></div><strong>{customer.successfulPayments + customer.failedPayments ? percent((customer.successfulPayments / (customer.successfulPayments + customer.failedPayments)) * 100) : '—'}</strong></div><div className="health-track"><i style={{ width: `${(customer.successfulPayments / Math.max(1, customer.successfulPayments + customer.failedPayments)) * 100}%` }} /></div></div></section><section className="card-surface panel"><div className="panel-heading"><div><h2>Payment history</h2><p>Recent payment activity</p></div><Link href="/payments" className="text-link" data-testid="link-customer-payments">All payments <ChevronRight size={13} /></Link></div><PaymentTable payments={customer.payments || []} /></section><section className="card-surface panel customer-history"><div className="panel-heading"><div><h2>Recovery history</h2><p>Previous interventions and outcomes</p></div></div><ActivityList items={customer.recoveryHistory || []} /></section></div></>}</QueryState></Shell>;
}

function SettingsPage() {
  const query = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const update = useUpdateSettings();
  const settings = query.data;
  const [form, setForm] = useState<any>(null);
  const values = form || settings;
  const save = () => values && update.mutate({ data: { maxAutomatedRetries: Number(values.maxAutomatedRetries), maxAutomatedAmount: Number(values.maxAutomatedAmount), minRecoveryProbability: Number(values.minRecoveryProbability), humanApprovalThreshold: Number(values.humanApprovalThreshold), automaticRecoveryEnabled: Boolean(values.automaticRecoveryEnabled), demoMode: Boolean(values.demoMode) } }, { onSuccess: () => { setForm(null); query.refetch(); } });
  return <Shell><PageHeader eyebrow="Merchant control" title="Settings" description="Set the boundaries RecoverAI must respect before it can act." action={<div className="button-row"><button className="button secondary" onClick={() => setForm(null)} data-testid="button-reset-settings">Reset</button><button className="button primary" onClick={save} disabled={update.isPending || !values} data-testid="button-save-settings">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>} /><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{values && <div className="settings-grid"><section className="card-surface panel settings-main"><div className="settings-section"><div className="settings-title"><ShieldCheck size={18} /><div><h2>Safety boundaries</h2><p>Conservative defaults keep actions explainable and reversible.</p></div></div><div className="settings-fields"><SettingInput label="Maximum automated retries" detail="How many retry attempts the agent may make." value={values.maxAutomatedRetries} onChange={v => setForm({ ...values, maxAutomatedRetries: v })} suffix="attempts" testId="input-max-retries" /><SettingInput label="Maximum automated amount" detail="Actions above this amount require review." value={values.maxAutomatedAmount} onChange={v => setForm({ ...values, maxAutomatedAmount: v })} prefix="₹" testId="input-max-amount" /><SettingInput label="Minimum recovery probability" detail="Skip actions below this likelihood of success." value={values.minRecoveryProbability} onChange={v => setForm({ ...values, minRecoveryProbability: v })} suffix="%" testId="input-min-probability" /><SettingInput label="Human approval threshold" detail="Send payments above this amount to review." value={values.humanApprovalThreshold} onChange={v => setForm({ ...values, humanApprovalThreshold: v })} prefix="₹" testId="input-human-threshold" /></div></div><div className="settings-section"><div className="settings-title"><Zap size={18} /><div><h2>Recovery mode</h2><p>Decide whether eligible actions can run without a merchant click.</p></div></div><ToggleRow label="Automatic recovery" detail="Allow safe, eligible actions to execute during a scan." checked={values.automaticRecoveryEnabled} onChange={v => setForm({ ...values, automaticRecoveryEnabled: v })} testId="toggle-automatic-recovery" /><ToggleRow label="Demo mode" detail="Use deterministic sandbox actions. No live customer notifications." checked={values.demoMode} onChange={v => setForm({ ...values, demoMode: v })} testId="toggle-demo-mode" /></div></section><aside className="settings-side"><section className="card-surface panel readiness-card"><div className="readiness-icon"><CheckCircle2 size={19} /></div><div className="eyebrow">Integration readiness</div><h2>Ready for safe demo runs</h2><p>RecoverAI is connected to the merchant workspace. Live credentials are not required in demo mode.</p><div className="readiness-row"><span><span className="pulse" /> Razorpay connection</span><StatusPill value={settings?.razorpayConfigured ? 'Connected' : 'Not configured'} icon /></div></section><section className="card-surface panel"><div className="panel-heading"><div><h2>Change log</h2><p>Settings are auditable</p></div><LockKeyhole size={16} /></div><div className="change-line"><span>Last updated</span><strong>Today, 09:42</strong></div><div className="change-line"><span>Updated by</span><strong>Aarav Mehta</strong></div><div className="change-line"><span>Mode</span><strong>Deterministic demo</strong></div></section></aside></div>}</QueryState></Shell>;
}

function SettingInput({ label, detail, value, onChange, prefix, suffix, testId }: { label: string; detail: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string; testId: string }) {
  return <label className="setting-input"><span><strong>{label}</strong><small>{detail}</small></span><span className="input-affix">{prefix && <i>{prefix}</i>}<input type="number" value={value} onChange={event => onChange(Number(event.target.value))} data-testid={testId} />{suffix && <i>{suffix}</i>}</span></label>;
}

function ToggleRow({ label, detail, checked, onChange, testId }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void; testId: string }) {
  return <div className="toggle-row"><span><strong>{label}</strong><small>{detail}</small></span><button type="button" className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} data-testid={testId} role="switch" aria-checked={checked}><span /></button></div>;
}

function LaunchPage() {
  const [, setLocation] = useLocation();
  return <div className="launch-page"><div className="launch-grid" /><div className="launch-card"><Logo /><div className="launch-kicker"><span className="pulse" /> Merchant recovery workspace</div><h1>Recover revenue.<br /><em>Keep control.</em></h1><p>RecoverAI turns failed payments into safe, explainable next steps — so you can move quickly without handing over the keys.</p><button className="button primary launch-button" onClick={() => setLocation('/dashboard')} data-testid="button-enter-workspace">Enter workspace <ArrowUpRight size={16} /></button><div className="launch-foot"><span><ShieldCheck size={14} /> Demo-safe by default</span><span><LockKeyhole size={14} /> Your controls stay yours</span></div></div><div className="launch-side"><div className="mini-window"><div className="mini-window-head"><span className="mini-dots"><i /><i /><i /></span><span>recoverai / live</span><span className="pulse" /></div><div className="mini-title">Today’s recovery<br /><strong>₹84,320</strong></div><div className="mini-bars"><i style={{ height: '38%' }} /><i style={{ height: '54%' }} /><i style={{ height: '46%' }} /><i style={{ height: '72%' }} /><i style={{ height: '66%' }} /><i style={{ height: '88%' }} /></div><div className="mini-line"><span>Recovery rate</span><strong>72.4%</strong></div></div><div className="launch-note"><Sparkles size={16} /><span>Every action comes with a reason, a guardrail check, and a clear stop.</span></div></div></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={LaunchPage} /><Route path="/dashboard" component={DashboardPage} /><Route path="/payments" component={PaymentsPage} /><Route path="/payments/:id" component={PaymentDetailPage} /><Route path="/recovery" component={RecoveryPage} /><Route path="/human-review" component={HumanReviewPage} /><Route path="/analytics" component={AnalyticsPage} /><Route path="/audit" component={AuditPage} /><Route path="/customers" component={CustomersPage} /><Route path="/customers/:id" component={CustomerDetailPage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;