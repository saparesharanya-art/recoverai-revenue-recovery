import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
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
  getGetNotificationsQueryKey,
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
  useGetNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
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

function Popover({ children, className = '', onDismiss }: { children: ReactNode; className?: string; onDismiss?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onDismiss?.();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss?.();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);
  return <div ref={ref} className={`popover ${className}`}>{children}</div>;
}

function NotificationMenu({ onNavigate, onDismiss }: { onNavigate: (href: string) => void; onDismiss: () => void }) {
  const query = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey() } });
  const mark = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const qc = useQueryClient();
  const notifications = query.data ?? [];
  const unread = notifications.filter(item => !item.isRead).length;
  const refresh = () => qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
  return <Popover className="notification-popover" onDismiss={onDismiss}>
    <div className="popover-heading"><div><strong>Notifications</strong><small>{unread ? `${unread} unread` : 'All caught up'}</small></div><button className="text-button" onClick={() => markAll.mutate(undefined, { onSuccess: refresh })} disabled={markAll.isPending || !unread} data-testid="button-mark-all-read">{markAll.isPending ? 'Updating…' : 'Mark all as read'}</button></div>
    <div className="notification-list">
      {query.isLoading && <div className="popover-empty">Loading notifications…</div>}
      {query.isError && <div className="popover-empty error-copy">Could not load notifications. Try again.</div>}
      {!query.isLoading && !query.isError && notifications.length === 0 && <div className="popover-empty">No notifications yet.</div>}
      {notifications.map(item => <button className={`notification-row ${item.isRead ? 'read' : ''}`} key={item.id} onClick={() => { if (!item.isRead) mark.mutate({ id: item.id }, { onSuccess: refresh }); if (item.href) onNavigate(item.href); onDismiss(); }} data-testid={`notification-${item.id}`}>
        <span className={`notification-dot ${toneFor(item.type)}`} />
        <span className="notification-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{dateTime(item.timestamp)}</small></span>
        {!item.isRead && <i className="unread-dot" aria-label="Unread" />}
      </button>)}
    </div>
  </Popover>;
}

function ProfileMenu({ onNavigate, onDismiss, onSignOut }: { onNavigate: (href: string) => void; onDismiss: () => void; onSignOut: () => void }) {
  return <Popover className="profile-popover" onDismiss={onDismiss}>
    <div className="profile-menu-head"><span className="user-avatar">AM</span><div><strong>Aarav Mehta</strong><span>Merchant administrator</span></div></div>
    <div className="profile-workspace"><span className="merchant-avatar small">S</span><span><strong>Solace Goods</strong><small>Merchant workspace</small></span></div>
    <div className="popover-divider" />
    <button className="popover-action" onClick={() => onNavigate('/settings?section=profile')} data-testid="button-profile"><UserRound size={15} /> Profile</button>
    <button className="popover-action" onClick={() => onNavigate('/settings')} data-testid="button-profile-settings"><Settings size={15} /> Settings</button>
    <div className="profile-demo"><span className="pulse" /> Demo mode active</div>
    <button className="popover-action danger-action" onClick={onSignOut} data-testid="button-sign-out"><ArrowLeft size={15} /> Sign out</button>
  </Popover>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [popover, setPopover] = useState<'notifications' | 'profile' | null>(null);
  const reviewQueue = useGetRecoveryCases({ status: 'pending' }, { query: { queryKey: getGetRecoveryCasesQueryKey({ status: 'pending' }) } });
  const notificationQuery = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey() } });
  const unreadNotifications = notificationQuery.data?.filter(item => !item.isRead).length ?? 0;
  const current = location === '/' ? '/dashboard' : location;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top"><Logo /><button className="icon-button mobile-only" onClick={() => setOpen(false)} data-testid="button-close-menu"><X size={18} /></button></div>
        <div className="merchant-switcher" aria-disabled="true" title="This demo has one merchant workspace"><span className="merchant-avatar">S</span><span><strong>Solace Goods</strong><small>Single demo workspace</small></span></div>
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
          <div className="topbar-actions"><span className="scan-state"><span className="pulse" /> Scan healthy</span><div className="popover-anchor"><button className={`icon-button ${popover === 'notifications' ? 'selected' : ''}`} onClick={() => setPopover(popover === 'notifications' ? null : 'notifications')} data-testid="button-notifications" aria-label="Notifications" aria-expanded={popover === 'notifications'}><Bell size={17} />{unreadNotifications > 0 && <span className="notification-badge" aria-label={`${unreadNotifications} unread notifications`}>{unreadNotifications}</span>}</button>{popover === 'notifications' && <NotificationMenu onNavigate={href => setLocation(href)} onDismiss={() => setPopover(null)} />}</div><div className="popover-anchor"><button className="user-chip" onClick={() => setPopover(popover === 'profile' ? null : 'profile')} aria-expanded={popover === 'profile'} data-testid="button-profile-menu"><span className="user-avatar">AM</span><span className="desktop-only">Aarav Mehta</span><ChevronRight size={13} /></button>{popover === 'profile' && <ProfileMenu onNavigate={href => { setPopover(null); if (href) setLocation(href); }} onDismiss={() => setPopover(null)} onSignOut={() => { setPopover(null); setLocation('/'); }} />}</div></div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow || 'Workspace'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</div>;
}

function MetricCard({ label, value, delta, note, icon: Icon, accent = 'teal', href }: { label: string; value: string; delta?: number; note?: string; icon: ElementType; accent?: string; href?: string }) {
  const content = <div className={`metric-card ${accent}`} data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} /></span></div><div className="metric-value">{value}</div>{delta !== undefined ? <div className={`metric-delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(delta).toFixed(1)}% <span>vs last period</span></div> : <div className="metric-note">{note}</div>}</div>;
  return href ? <Link href={href} className="metric-card-link">{content}</Link> : content;
}

function SimpleBars({ points, valueKey = 'value', color = 'teal' }: { points: Array<Record<string, any>>; valueKey?: string; color?: string }) {
  const max = Math.max(...points.map(p => Number(p[valueKey] || 0)), 1);
  return <div className="bar-chart">{points.map((point, index) => <div className="bar-group" key={`${point.label}-${index}`}><div className={`bar ${color}`} style={{ height: `${Math.max(8, (Number(point[valueKey] || 0) / max) * 100)}%` }} title={`${point.label}: ${point[valueKey]}`} /><span>{point.label}</span></div>)}</div>;
}

function DashboardPage() {
  const [trendPeriod, setTrendPeriod] = useState('Last 7 days');
  const [trendOpen, setTrendOpen] = useState(false);
  const dashboardRange = trendPeriod === 'Last 30 days' ? '30d' : trendPeriod === 'Last 90 days' ? '90d' : '7d';
  const query = useGetDashboard({ range: dashboardRange }, { query: { queryKey: getGetDashboardQueryKey({ range: dashboardRange }) } });
  const scan = useRunRecoveryScan();
  const qc = useQueryClient();
  const [scanMessage, setScanMessage] = useState('');
  const data = query.data;
  const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
  const runScan = () => scan.mutate(undefined, {
    onSuccess: result => {
      setScanMessage(`${result.executed} action${result.executed === 1 ? '' : 's'} executed; ${result.sentToReview} sent to human review.`);
      qc.invalidateQueries({ queryKey: getGetDashboardQueryKey({ range: '7d' }) });
      qc.invalidateQueries({ queryKey: getGetPaymentsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecoveryCasesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAuditQueryKey() });
      qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    },
    onError: error => setScanMessage(`Recovery scan failed: ${error instanceof Error ? error.message : 'Please try again.'}`),
  });
  return <Shell><PageHeader eyebrow={todayLabel} title="Good morning, Aarav." description="Here’s where recovery stands across Solace Goods today." action={<button className="button primary" onClick={runScan} disabled={scan.isPending} data-testid="button-dashboard-run-scan"><Play size={15} /> {scan.isPending ? 'Scanning…' : 'Run recovery scan'}</button>} />
    {scanMessage && <div className={`inline-feedback ${scan.isError ? 'error-feedback' : ''}`}><CheckCircle2 size={15} />{scanMessage}</div>}
    <QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>
      {data && <><div className="metrics-grid">
        <MetricCard label="Revenue at risk" value={money(data.metrics.revenueAtRisk)} delta={data.metrics.recoveredDelta ? -Math.abs(data.metrics.recoveredDelta) : undefined} note="Across open failures" icon={Gauge} accent="orange" href="/payments?status=at_risk" />
        <MetricCard label="Revenue recovered" value={money(data.metrics.revenueRecovered)} delta={data.metrics.recoveredDelta} icon={CheckCircle2} accent="teal" href="/payments?status=recovered" />
        <MetricCard label="Recovery rate" value={percent(data.metrics.recoveryRate)} delta={data.metrics.rateDelta} icon={Zap} accent="blue" href="/analytics" />
        <MetricCard label="Failed payments" value={String(data.metrics.failedPayments)} note={`${data.metrics.pendingReviews} waiting for review`} icon={CreditCard} accent="red" href="/payments?status=failed" />
      </div>
      <div className="dashboard-grid"><section className="card-surface panel trend-panel"><div className="panel-heading"><div><h2>Recovery performance</h2><p>At-risk volume versus recovered revenue</p></div><div className="popover-anchor"><button className="select-button" onClick={() => setTrendOpen(value => !value)} aria-expanded={trendOpen} data-testid="button-trend-period">{trendPeriod} <ChevronRight size={13} /></button>{trendOpen && <Popover className="period-popover" onDismiss={() => setTrendOpen(false)}><button onClick={() => { setTrendPeriod('Last 7 days'); setTrendOpen(false); }} data-testid="button-period-7">Last 7 days</button><button onClick={() => { setTrendPeriod('Last 30 days'); setTrendOpen(false); }} data-testid="button-period-30">Last 30 days</button><button onClick={() => { setTrendPeriod('Last 90 days'); setTrendOpen(false); }} data-testid="button-period-90">Last 90 days</button></Popover>}</div></div><div className="legend"><span><i className="legend-dot orange" />At risk</span><span><i className="legend-dot teal" />Recovered</span></div><SimpleBars points={data.trend as Array<Record<string, any>>} valueKey="atRisk" color="orange" /><div className="chart-recovered"><SimpleBars points={data.trend as Array<Record<string, any>>} valueKey="recovered" color="teal" /></div></section>
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
  return <div className="activity-list">{items.map(item => <Link href={item.paymentId ? `/payments/${item.paymentId}` : '/audit'} className="activity-row" key={item.id} data-testid={`activity-${item.id}`}><span className={`activity-dot ${toneFor(item.result)}`} /><span className="activity-copy"><strong>{item.action}</strong><span>{item.customerName}{item.reason ? ` · ${item.reason}` : ''}</span></span><span className="activity-time">{dateTime(item.timestamp)}</span><ChevronRight size={13} /></Link>)}</div>;
}

function PaymentsPage() {
  const [location] = useLocation();
  const initialParams = new URLSearchParams(location.split('?')[1] ?? '');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => initialParams.get('status') ?? 'all');
  const params = { search: search || undefined, status: status === 'all' ? undefined : status, limit: 100 };
  const query = useGetPayments(params, { query: { queryKey: getGetPaymentsQueryKey(params) } });
  return <Shell><PageHeader eyebrow="Collections" title="Payments" description="Every failed payment, ranked by what can still be recovered." action={<Link href="/recovery" className="button secondary" data-testid="link-payments-recovery"><Sparkles size={15} /> Recovery workspace</Link>} /><div className="card-surface table-card"><div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search payment, customer, email..." aria-label="Search payments" data-testid="input-search-payments" /></div><div className="toolbar-right"><div className="filter-select"><Filter size={14} /><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter payments by status" data-testid="select-payment-status"><option value="all">All statuses</option><option value="at_risk">At risk</option><option value="failed">Failed</option><option value="recovered">Recovered</option><option value="in_review">In review</option></select></div><span className="result-count">{query.data?.length || 0} records</span></div></div><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{query.data && (query.data.length ? <PaymentTable payments={query.data} /> : <div className="empty-state"><CreditCard size={22} /><strong>No matching payments</strong><span>Try a different customer, payment ID, or status.</span><button className="button secondary" onClick={() => { setSearch(''); setStatus('all'); }} data-testid="button-clear-payment-filters">Clear filters</button></div>)}</QueryState></div></Shell>;
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
  const runAnalyze = () => analyze.mutate({ data: { paymentId: id } }, { onSuccess: () => { setFeedback('Fresh AI assessment ready'); invalidate.invalidateQueries({ queryKey: getGetPaymentQueryKey(id) }); }, onError: error => setFeedback(`Analysis failed: ${error instanceof Error ? error.message : 'Please try again.'}`) });
  const runAction = (type: string) => createAction.mutate({ data: { paymentId: id, type, reason: 'Merchant initiated from payment detail' } }, { onSuccess: () => { setFeedback(`${type.replace(/_/g, ' ')} action created`); invalidate.invalidateQueries({ queryKey: getGetPaymentQueryKey(id) }); }, onError: error => setFeedback(`Could not create action: ${error instanceof Error ? error.message : 'Please try again.'}`) });
  return <Shell><Link href="/payments" className="back-link" data-testid="link-back-payments"><ArrowLeft size={15} /> Payments</Link><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{payment && <><PageHeader eyebrow={`Payment ${payment.paymentId}`} title={money(payment.amount, payment.currency)} description={`${payment.customerName} · failed ${dateTime(payment.failedAt)}`} action={<div className="button-row"><button className="button secondary" onClick={runAnalyze} disabled={analyze.isPending} data-testid="button-analyze-payment"><Sparkles size={15} />{analyze.isPending ? 'Analyzing…' : 'Re-analyze'}</button><button className="button danger-outline" onClick={() => stop.mutate({ id }, { onSuccess: () => { setFeedback('Recovery stopped safely'); invalidate.invalidateQueries({ queryKey: getGetPaymentQueryKey(id) }); }, onError: error => setFeedback(`Could not stop recovery: ${error instanceof Error ? error.message : 'Please try again.'}`) })} disabled={stop.isPending} data-testid="button-stop-recovery"><StopCircle size={15} /> {stop.isPending ? 'Stopping…' : 'Stop recovery'}</button></div>} />{feedback && <div className="inline-feedback"><CheckCircle2 size={15} />{feedback}</div>}<div className="detail-layout"><div className="detail-main"><section className="card-surface panel"><div className="panel-heading"><div><h2>Payment context</h2><p>Signals used in the recovery decision</p></div><StatusPill value={payment.riskLevel} icon /></div><div className="signal-grid"><Signal label="Customer" value={payment.customerName} /><Signal label="Failure reason" value={payment.failureReason} /><Signal label="Attempts" value={`${payment.attempts} total`} /><Signal label="Lifetime value" value={money(payment.lifetimeValue, payment.currency)} /><Signal label="Successful payments" value={String(payment.successfulPayments)} /><Signal label="Last action" value={dateTime(payment.lastActionAt)} /></div></section><section className="card-surface panel"><div className="panel-heading"><div><h2>Recovery timeline</h2><p>Chronological record of this payment</p></div></div><div className="timeline">{payment.timeline?.map((event, index) => <div className="timeline-item" key={`${event.timestamp}-${index}`}><span className={`timeline-dot ${toneFor(event.tone)}`} /><div><div className="timeline-meta">{dateTime(event.timestamp)} · {event.actor}</div><strong>{event.title}</strong><p>{event.description}</p></div></div>)}</div></section></div><div className="detail-side"><section className="card-surface panel ai-card"><div className="ai-label"><Sparkles size={15} /> RecoverAI decision</div>{payment.aiDecision ? <><div className="ai-probability"><strong>{percent(payment.aiDecision.recoveryProbability)}</strong><span>recovery probability</span></div><div className="recommendation"><span>Recommended action</span><strong>{payment.aiDecision.recommendedAction.replace(/_/g, ' ')}</strong></div><p className="reasoning">“{payment.aiDecision.reasoning}”</p><div className="confidence-row"><span>Confidence</span><strong>{percent(payment.aiDecision.confidence)}</strong></div><div className="progress-track"><i style={{ width: `${payment.aiDecision.confidence}%` }} /></div><div className="model-note"><ShieldCheck size={14} /> {payment.aiDecision.model} · explainable decision</div></> : <div className="empty-state compact"><Sparkles size={18} /><strong>No decision yet</strong><span>Run the AI assessment to see a recommendation.</span><button className="button primary full" onClick={runAnalyze} data-testid="button-analyze-empty">Analyze payment</button></div>}</section><section className="card-surface panel"><div className="panel-heading"><div><h2>Safety checks</h2><p>Guardrails before any action</p></div></div>{payment.safetyChecks?.map((check, index) => <div className="check-row" key={`${check.rule}-${index}`}><span className={`check-icon ${check.passed ? 'passed' : 'failed'}`}>{check.passed ? <Check size={13} /> : <X size={13} />}</span><span><strong>{check.rule}</strong><small>{check.detail}</small></span></div>)}<div className="button-row stacked-mobile"><button className="button secondary" onClick={() => runAction(payment.recommendedAction)} disabled={createAction.isPending} data-testid="button-create-recovery-action"><Zap size={15} /> {createAction.isPending ? 'Creating…' : 'Create recommended action'}</button></div></section></div></div></>}</QueryState></Shell>;
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div className="signal"><span>{label}</span><strong>{value}</strong></div>;
}

function RecoveryPage() {
  const [caseStatus, setCaseStatus] = useState('pending');
  const caseParams = caseStatus === 'all' ? undefined : { status: caseStatus };
  const cases = useGetRecoveryCases(caseParams, { query: { queryKey: getGetRecoveryCasesQueryKey(caseParams) } });
  const scan = useRunRecoveryScan();
  const qc = useQueryClient();
  const [result, setResult] = useState<any>(null);
  const [scanError, setScanError] = useState('');
  const runScan = () => scan.mutate(undefined, {
    onSuccess: data => {
      setResult(data);
      setScanError('');
      cases.refetch();
      qc.invalidateQueries({ queryKey: getGetDashboardQueryKey({ range: '7d' }) });
      qc.invalidateQueries({ queryKey: getGetPaymentsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAuditQueryKey() });
      qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    },
    onError: error => setScanError(error instanceof Error ? error.message : 'Recovery scan failed. Please try again.'),
  });
  return <Shell><PageHeader eyebrow="Autopilot" title="Recovery workspace" description="A safe queue of decisions RecoverAI can explain, execute, or hand off." action={<button className="button primary" onClick={runScan} disabled={scan.isPending} data-testid="button-run-scan"><RefreshCw size={15} className={scan.isPending ? 'spin' : ''} />{scan.isPending ? 'Scanning…' : 'Run recovery scan'}</button>} />{scanError && <div className="inline-feedback error-feedback"><AlertCircle size={15} />{scanError}</div>}{result && <div className="scan-result"><div><span className="eyebrow">Scan complete</span><strong>{result.scanned} payments assessed</strong><span>{result.executed} action{result.executed === 1 ? '' : 's'} executed · {result.sentToReview} sent to review</span></div><div className="scan-stats"><span><strong>{money(result.recoveredRevenue)}</strong> recovered</span><span><strong>{result.blocked}</strong> blocked by guardrails</span></div><button className="icon-button" onClick={() => setResult(null)} aria-label="Dismiss scan result" data-testid="button-dismiss-scan"><X size={16} /></button></div>}<div className="recovery-overview"><div className="card-surface recovery-hero"><div className="recovery-orbit"><Sparkles size={25} /></div><div><div className="eyebrow">Decision engine</div><h2>Precision recovery, not blind retries.</h2><p>Every action is checked against amount, probability, retry history, and merchant rules before it moves.</p><div className="guardrail-summary"><span><ShieldCheck size={14} /> Guardrails active</span><span><Zap size={14} /> Demo-safe execution</span></div></div></div><div className="card-surface panel scan-stat-panel"><div className="panel-heading"><div><h2>Today’s scan</h2><p>Latest recovery run</p></div><span className="live-tag"><span className="pulse" /> Live</span></div><div className="big-stat">{result ? result.analyzed : '—'}<small>payments analyzed</small></div><div className="stat-line"><span>Executed safely</span><strong>{result?.executed ?? '—'}</strong></div><div className="stat-line"><span>Needs a decision</span><strong>{result?.sentToReview ?? cases.data?.length ?? '—'}</strong></div></div></div><section className="card-surface table-card"><div className="table-toolbar"><div><h2>Open recovery cases</h2><p className="toolbar-subtitle">The cases most likely to benefit from a considered next step.</p></div><div className="toolbar-right"><div className="filter-select"><Filter size={14} /><select value={caseStatus} onChange={event => setCaseStatus(event.target.value)} aria-label="Filter recovery cases by status" data-testid="select-recovery-status"><option value="pending">Open cases</option><option value="all">All cases</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></div><StatusPill value={`${cases.data?.length || 0} shown`} /></div></div><QueryState loading={cases.isLoading} error={cases.isError} retry={() => cases.refetch()}>{cases.data && (cases.data.length ? <RecoveryTable cases={cases.data} /> : <div className="empty-state"><CheckCircle2 size={22} /><strong>Nothing waiting</strong><span>The agent has no cases requiring attention.</span></div>)}</QueryState></section></Shell>;
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
  const [error, setError] = useState('');
  const action = (kind: 'approve' | 'reject' | 'execute', id: number) => {
    const mutation = kind === 'approve' ? approve : kind === 'reject' ? reject : execute;
    setError('');
    mutation.mutate({ id }, { onSuccess: () => { setMessage(`Case #${id} ${kind === 'approve' ? 'approved' : kind === 'reject' ? 'rejected' : 'executed'}`); qc.invalidateQueries({ queryKey: getGetRecoveryCasesQueryKey({ status: 'pending' }) }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetPaymentsQueryKey() }); }, onError: error => setError(error instanceof Error ? error.message : `Could not ${kind} case #${id}.`) });
  };
  return <Shell><PageHeader eyebrow="Merchant decisions" title="Human review" description="A small, deliberate queue for the moments automation should not decide alone." action={<div className="review-cap"><span className="pulse" /> {query.data?.length ?? 0} decisions open</div>} />{message && <div className="inline-feedback"><CheckCircle2 size={15} />{message}</div>}{error && <div className="inline-feedback error-feedback"><AlertCircle size={15} />{error}</div>}<div className="review-banner"><ShieldCheck size={18} /><span><strong>Automation paused here.</strong> These cases crossed your approval threshold or need context only you have.</span></div><section className="review-grid"><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{query.data?.map(item => <article className="card-surface review-card" key={item.id} data-testid={`card-review-${item.id}`}><div className="review-card-top"><span className="case-id">CASE #{item.id}</span><StatusPill value={item.status} icon /></div><div className="review-customer"><span className="initial-avatar large">{item.customerName.slice(0, 1)}</span><div><h2>{item.customerName}</h2><span>Payment #{item.paymentId} · {dateTime(item.createdAt)}</span></div></div><div className="review-amount">{money(item.amount, item.currency)}<span>at risk</span></div><div className="review-reason"><span>Why it’s here</span><strong>{item.reason}</strong></div><div className="review-recommendation"><Sparkles size={14} /><span><strong>{item.recommendation.replace(/_/g, ' ')}</strong><small>{item.nextStep}</small></span><b>{percent(item.confidence)}</b></div><div className="review-actions"><Link className="button secondary" href={`/payments/${item.paymentId}`} data-testid={`link-review-payment-${item.id}`}>View payment</Link><button className="button secondary" onClick={() => action('reject', item.id)} disabled={reject.isPending} data-testid={`button-reject-${item.id}`}><X size={15} /> Reject</button><button className="button primary" onClick={() => action('approve', item.id)} disabled={approve.isPending} data-testid={`button-approve-${item.id}`}><Check size={15} /> Approve</button></div></article>)}</QueryState></section></Shell>;
}

function AnalyticsPage() {
  const [range, setRange] = useState('30d');
  const query = useGetAnalytics({ range }, { query: { queryKey: getGetAnalyticsQueryKey({ range }) } });
  const data = query.data;
  const downloadReport = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Range', range],
      ['Revenue at risk', data.metrics.revenueAtRisk],
      ['Revenue recovered', data.metrics.revenueRecovered],
      ['Recovery rate', data.metrics.recoveryRate],
      ['Average recovery amount', data.metrics.averageRecoveryAmount],
      ['Successful retries', data.metrics.successfulRetries],
      ['Failed retries', data.metrics.failedRetries],
      ...data.revenueByAction.map(item => [`Revenue by action: ${item.label}`, item.value]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `recoverai-analytics-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <Shell><PageHeader eyebrow="Measure the work" title="Analytics" description="See exactly what the agent recovered, what it skipped, and where humans made the difference." action={<div className="button-row"><div className="filter-select"><Filter size={14} /><select value={range} onChange={event => setRange(event.target.value)} aria-label="Analytics date range" data-testid="select-analytics-range"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select></div><button className="button secondary" onClick={downloadReport} disabled={!data} data-testid="button-export-analytics"><FileClock size={15} /> Export report</button></div>} /><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{data && <><div className="metrics-grid analytics-metrics"><MetricCard label="Revenue recovered" value={money(data.metrics.revenueRecovered)} icon={CheckCircle2} accent="teal" /><MetricCard label="Recovery rate" value={percent(data.metrics.recoveryRate)} icon={Gauge} accent="blue" /><MetricCard label="Average recovery" value={money(data.metrics.averageRecoveryAmount)} icon={CreditCard} accent="orange" /><MetricCard label="Successful retries" value={String(data.metrics.successfulRetries)} note={`${data.metrics.failedRetries} unsuccessful`} icon={RefreshCw} accent="red" /></div><div className="analytics-grid"><section className="card-surface panel"><div className="panel-heading"><div><h2>Recovery funnel</h2><p>From failure to recovered revenue</p></div></div><div className="funnel">{data.funnel?.map((point, index) => <div className="funnel-row" key={`${point.label}-${index}`}><span>{point.label}</span><div className="funnel-track"><i style={{ width: `${point.percent}%` }} /></div><strong>{point.count}</strong><span>{money(point.amount)}</span></div>)}</div></section><section className="card-surface panel"><div className="panel-heading"><div><h2>Revenue by action</h2><p>Which interventions pay back</p></div></div><SimpleBars points={data.revenueByAction as Array<Record<string, any>>} valueKey="value" color="teal" /><div className="breakdown-list">{data.revenueByAction?.map((item, index) => <div className="breakdown-row" key={`${item.label}-${index}`}><span>{item.label}</span><strong>{money(item.value)}</strong><span className="table-secondary">{item.count} cases</span></div>)}</div></section></div><div className="analytics-grid"><AnalyticsBreakdown title="AI vs human outcomes" items={data.aiVsHuman || []} /><AnalyticsBreakdown title="Retry outcomes" items={data.retryOutcomes || []} /></div></>}</QueryState></Shell>;
}

function AnalyticsBreakdown({ title, items }: { title: string; items: Array<any> }) {
  const max = Math.max(...items.map(item => item.value), 1);
  return <section className="card-surface panel"><div className="panel-heading"><div><h2>{title}</h2><p>Outcome distribution</p></div></div><div className="outcome-list">{items.map(item => <div className="outcome-row" key={item.label}><div className="outcome-heading"><span>{item.label}</span><strong>{money(item.value)}</strong></div><div className="progress-track"><i style={{ width: `${(item.value / max) * 100}%` }} /></div><small>{item.count} outcomes</small></div>)}</div></section>;
}

function AuditPage() {
  const [location, setLocation] = useLocation();
  const initialSearch = new URLSearchParams(location.split('?')[1] ?? '').get('search') ?? '';
  const [search, setSearch] = useState(initialSearch);
  const [eventType, setEventType] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const params = { search: search || undefined, eventType: eventType || undefined, limit: 100 };
  const query = useGetAudit(params, { query: { queryKey: getGetAuditQueryKey(params) } });
  return <Shell><PageHeader eyebrow="Control plane" title="Audit trail" description="A complete record of every decision, action, and guardrail." /><div className="card-surface table-card"><div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer, action, reason..." aria-label="Search audit trail" data-testid="input-search-audit" /></div><div className="toolbar-right"><div className="filter-select"><Filter size={14} /><select value={eventType} onChange={event => setEventType(event.target.value)} aria-label="Filter audit events" data-testid="select-audit-type"><option value="">All events</option><option value="recovery">Recovery</option><option value="payment">Payment</option><option value="settings">Settings</option></select></div><span className="result-count">{query.data?.length || 0} events</span></div></div><QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{query.data && (query.data.length ? <div className="audit-list">{query.data.map(event => <div className="audit-row" key={event.id} data-testid={`row-audit-${event.id}`}><div className={`audit-icon ${toneFor(event.result)}`}>{event.result?.toLowerCase().includes('success') ? <Check size={15} /> : <FileClock size={15} />}</div><div className="audit-main"><div><strong>{event.action}</strong><StatusPill value={event.result} /></div><span>{event.customerName}{event.paymentId ? ` · Payment #${event.paymentId}` : ''}</span><small>{event.reason}</small></div><div className="audit-meta"><strong>{event.actor}</strong><span>{dateTime(event.timestamp)}</span></div><button className="row-action" onClick={() => setSelectedEvent(event)} data-testid={`button-audit-more-${event.id}`} aria-label={`View details for audit event ${event.id}`}><MoreHorizontal size={17} /></button></div>)}</div> : <div className="empty-state"><History size={22} /><strong>No audit events found</strong><span>Try widening the search.</span></div>)}</QueryState></div>{selectedEvent && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedEvent(null)}><section className="audit-modal card-surface panel" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title" onClick={event => event.stopPropagation()}><div className="panel-heading"><div><div className="eyebrow">Event #{selectedEvent.id}</div><h2 id="audit-modal-title">{selectedEvent.action}</h2></div><button className="icon-button" onClick={() => setSelectedEvent(null)} aria-label="Close audit event details"><X size={17} /></button></div><div className="audit-detail-grid"><Signal label="Result" value={selectedEvent.result} /><Signal label="Actor" value={selectedEvent.actor} /><Signal label="Customer" value={selectedEvent.customerName} /><Signal label="Timestamp" value={dateTime(selectedEvent.timestamp)} /></div><p className="modal-reason">{selectedEvent.reason}</p>{selectedEvent.paymentId && <button className="button secondary" onClick={() => { setSelectedEvent(null); setLocation(`/payments/${selectedEvent.paymentId}`); }} data-testid="button-audit-open-payment">Open payment</button>}<pre className="metadata-block">{JSON.stringify(selectedEvent.metadata ?? {}, null, 2)}</pre></section></div>}</Shell>;
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
  const [location] = useLocation();
  const query = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const update = useUpdateSettings();
  const qc = useQueryClient();
  const settings = query.data;
  const [form, setForm] = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const values = form || settings;
  const save = () => {
    if (!values) return;
    setError('');
    update.mutate({ data: { maxAutomatedRetries: Number(values.maxAutomatedRetries), maxAutomatedAmount: Number(values.maxAutomatedAmount), minRecoveryProbability: Number(values.minRecoveryProbability), humanApprovalThreshold: Number(values.humanApprovalThreshold), automaticRecoveryEnabled: Boolean(values.automaticRecoveryEnabled), demoMode: Boolean(values.demoMode) } }, {
      onSuccess: () => {
        setForm(null);
        setFeedback('Safety settings saved and recorded in the audit trail.');
        query.refetch();
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
      onError: error => setError(error instanceof Error ? error.message : 'Could not save settings. Please try again.'),
    });
  };
  const profileView = new URLSearchParams(location.split('?')[1] ?? '').get('section') === 'profile';
  return <Shell><PageHeader eyebrow="Merchant control" title="Settings" description="Set the boundaries RecoverAI must respect before it can act." action={<div className="button-row"><button className="button secondary" onClick={() => { setForm(null); setFeedback('Changes reset to the saved settings.'); }} data-testid="button-reset-settings">Reset</button><button className="button primary" onClick={save} disabled={update.isPending || !values} data-testid="button-save-settings">{update.isPending ? 'Saving…' : 'Save changes'}</button></div>} />{feedback && <div className="inline-feedback"><CheckCircle2 size={15} />{feedback}</div>}{error && <div className="inline-feedback error-feedback"><AlertCircle size={15} />{error}</div>}{profileView && <section className="card-surface panel profile-view"><div className="profile-menu-head"><span className="user-avatar">AM</span><div><strong>Aarav Mehta</strong><span>Merchant administrator</span></div></div><div className="profile-detail-grid"><Signal label="Workspace" value="Solace Goods" /><Signal label="Role" value="Merchant administrator" /><Signal label="Environment" value="Demo mode" /><Signal label="Processor" value="Razorpay Test Mode (simulated)" /></div></section>}<QueryState loading={query.isLoading} error={query.isError} retry={() => query.refetch()}>{values && <div className="settings-grid"><section className="card-surface panel settings-main"><div className="settings-section"><div className="settings-title"><ShieldCheck size={18} /><div><h2>Safety boundaries</h2><p>Conservative defaults keep actions explainable and reversible.</p></div></div><div className="settings-fields"><SettingInput label="Maximum automated retries" detail="How many retry attempts the agent may make." value={values.maxAutomatedRetries} onChange={v => setForm({ ...values, maxAutomatedRetries: v })} suffix="attempts" testId="input-max-retries" /><SettingInput label="Maximum automated amount" detail="Actions above this amount require review." value={values.maxAutomatedAmount} onChange={v => setForm({ ...values, maxAutomatedAmount: v })} prefix="₹" testId="input-max-amount" /><SettingInput label="Minimum recovery probability" detail="Skip actions below this likelihood of success." value={values.minRecoveryProbability} onChange={v => setForm({ ...values, minRecoveryProbability: v })} suffix="%" testId="input-min-probability" /><SettingInput label="Human approval threshold" detail="Send payments above this amount to review." value={values.humanApprovalThreshold} onChange={v => setForm({ ...values, humanApprovalThreshold: v })} prefix="₹" testId="input-human-threshold" /></div></div><div className="settings-section"><div className="settings-title"><Zap size={18} /><div><h2>Recovery mode</h2><p>Decide whether eligible actions can run without a merchant click.</p></div></div><ToggleRow label="Automatic recovery" detail="Allow safe, eligible actions to execute during a scan." checked={values.automaticRecoveryEnabled} onChange={v => setForm({ ...values, automaticRecoveryEnabled: v })} testId="toggle-automatic-recovery" /><ToggleRow label="Demo mode" detail="Use deterministic sandbox actions. No live customer notifications." checked={values.demoMode} onChange={v => setForm({ ...values, demoMode: v })} testId="toggle-demo-mode" /></div></section><aside className="settings-side"><section className="card-surface panel readiness-card"><div className="readiness-icon"><CheckCircle2 size={19} /></div><div className="eyebrow">Integration readiness</div><h2>Ready for safe demo runs</h2><p>RecoverAI is connected to the merchant workspace. Live credentials are not required in demo mode.</p><div className="readiness-row"><span><span className="pulse" /> Razorpay connection</span><StatusPill value={settings?.razorpayConfigured ? 'Connected' : 'Not configured'} icon /></div></section><section className="card-surface panel"><div className="panel-heading"><div><h2>Change log</h2><p>Settings are auditable</p></div><LockKeyhole size={16} /></div><div className="change-line"><span>Last updated</span><strong>{feedback ? 'Just now' : 'Today'}</strong></div><div className="change-line"><span>Updated by</span><strong>Aarav Mehta</strong></div><div className="change-line"><span>Mode</span><strong>{settings?.demoMode ? 'Deterministic demo' : 'Manual recovery'}</strong></div></section></aside></div>}</QueryState></Shell>;
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