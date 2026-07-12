import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, CreditCard, 
  LayoutDashboard, CalendarDays, Tag, Settings, 
  AlertCircle, RefreshCw, CheckCircle2, XCircle
} from 'lucide-react';
import { API_URL } from './config';
import StatsBar from './components/StatsBar';
import CustomerCard from './components/CustomerCard';
import CustomerForm from './components/CustomerForm';
import MealLogManager from './components/MealLogManager';
import PaymentModal from './components/PaymentModal';
import ExpensesTab from './components/ExpensesTab';
import SettingsTab from './components/SettingsTab';
import LoginScreen from './components/LoginScreen';
import TrackyLogo from './components/TrackyLogo';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('tracky_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('tracky_user')) || null);

  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({
    active_customers: 0,
    pending_payments: 0,
    pending_meals: 0,
    collected_this_month: 0,
    expenses_this_month: 0,
    net_revenue: 0
  });
  
  // Tabs: 'dashboard' | 'daily' | 'payments' | 'expenses' | 'settings'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  // Search, Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [subTypeFilter, setSubTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');

  // Modals / Overlays
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedLogsCustomer, setSelectedLogsCustomer] = useState(null);
  const [selectedPaymentsCustomer, setSelectedPaymentsCustomer] = useState(null);

  // Daily log quick-update states
  const [dailyLogDate, setDailyLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickNotes, setQuickNotes] = useState({});

  // Fetch all Scoped Data
  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      
      // Load customers
      const custRes = await fetch(`${API_URL}/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (custRes.status === 401) {
        handleLogout();
        return;
      }
      
      if (!custRes.ok) throw new Error('Failed to load customers');
      const custData = await custRes.json();
      setCustomers(custData);

      // Load stats
      const statsRes = await fetch(`${API_URL}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!statsRes.ok) throw new Error('Failed to load stats');
      const statsData = await statsRes.json();
      setStats(statsData);

    } catch (err) {
      console.error(err);
      setError('Unable to sync with database. Is the backend server running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // Auth Handlers
  const handleLoginSuccess = (newToken, newUser) => {
    localStorage.setItem('tracky_token', newToken);
    localStorage.setItem('tracky_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('tracky_token');
    localStorage.removeItem('tracky_user');
    setToken('');
    setUser(null);
    setCustomers([]);
  };

  const handleUpdateSettings = (updatedUser) => {
    localStorage.setItem('tracky_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    fetchData(); // reload based on settings (e.g. stats currency changes)
  };

  // Scoped Customer CRUD
  const handleSaveCustomer = async (formData) => {
    try {
      let url = `${API_URL}/customers`;
      let method = 'POST';
      const isEditing = !!editingCustomer;

      if (isEditing) {
        url = `${API_URL}/customers/${editingCustomer.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save customer');
      }

      setShowFormModal(false);
      setEditingCustomer(null);
      await fetchData();
      showToast(
        isEditing 
          ? `✅ "${formData.name}"'s plan was updated successfully!` 
          : `✅ "${formData.name}" was added successfully!`,
        'success'
      );
    } catch (err) {
      showToast(`❌ Error: ${err.message}`, 'error');
    }
  };

  const handleDeleteCustomer = async (id) => {
    const customerName = customers.find(c => c.id === id)?.name || 'Customer';
    try {
      const res = await fetch(`${API_URL}/customers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete customer');
      await fetchData();
      showToast(`🗑️ "${customerName}" was deleted successfully.`, 'success');
    } catch (err) {
      showToast(`❌ Error: ${err.message}`, 'error');
    }
  };

  const handleQuickLog = async (customerId, status) => {
    try {
      const note = quickNotes[customerId] || '';
      const res = await fetch(`${API_URL}/customers/${customerId}/logs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          log_date: dailyLogDate,
          status,
          note
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to log status');
      }

      setQuickNotes(prev => ({ ...prev, [customerId]: '' }));
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // If not authenticated, render Login/Signup Screen
  if (!token || !user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const label = user.tracking_label;
  const curr = user.currency;

  // Filter unique plan packages
  const uniqueSubTypes = Array.from(
    new Set(customers.map(c => c.subscription_type))
  ).filter(Boolean);

  // Filter & Sort list
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phone.includes(searchTerm) || 
                          c.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ? true : 
                          statusFilter === 'active' ? c.active : !c.active;
                          
    const matchesPayment = paymentFilter === 'all' ? true : 
                           c.payment_status === paymentFilter;
                           
    const matchesSub = subTypeFilter === 'all' ? true : 
                       c.subscription_type === subTypeFilter;

    return matchesSearch && matchesStatus && matchesPayment && matchesSub;
  }).sort((a, b) => {
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    if (sortBy === 'meals-desc') return b.pending_meals - a.pending_meals;
    if (sortBy === 'payment-desc') return b.pending_payment - a.pending_payment;
    return 0;
  });

  const runningTotalCollected = customers.reduce((sum, c) => sum + c.amount_paid, 0);
  const runningTotalPending = customers.reduce((sum, c) => sum + Math.max(0, c.pending_payment), 0);

  return (
    <div className="min-h-screen bg-dark-bg text-[#d1d1d6] font-sans selection:bg-white selection:text-black antialiased">
      
      {/* Navbar Header (Apple-minimal style) */}
      <header className="border-b border-dark-border bg-dark-card/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3 self-start md:self-center">
            <TrackyLogo textClassName="text-lg" color="text-white" />
            <div className="h-6 w-[1px] bg-slate-800 hidden sm:block"></div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-300 uppercase flex items-center gap-2">
                {user.business_name}
              </h1>
              <p className="text-[8px] text-slate-500 font-bold tracking-wider uppercase mt-0.5">
                {label}s • {curr}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex bg-black border border-[#1c1c1e] p-1 rounded-xl w-full md:w-auto overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'daily'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Logs</span>
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'payments'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Payments</span>
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'expenses'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>Expenses</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>
          </nav>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {error && (
          <div className="p-4 bg-rose-950/20 border border-rose-900/30 text-rose-450 rounded-2xl flex items-center justify-between mb-8 shadow-md">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
            <button 
              onClick={fetchData}
              className="p-1.5 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-lg text-slate-300 transition-all flex items-center gap-1.5 text-xs font-bold uppercase"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Dynamic statistics bar */}
        <StatsBar stats={stats} />

        {/* -------------------- TAB CONTENT: DASHBOARD -------------------- */}
        {activeTab === 'dashboard' && (
          <div className="tab-content">
            
            {/* Search and Filters panel */}
            <div className="bg-[#0d0d0f] border border-[#1c1c1e] p-5 rounded-2xl mb-8 shadow-lg space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Search bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                  <input 
                    type="text"
                    placeholder={`Search client name, phone, or address...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black border border-[#1c1c1e] pl-10 pr-4 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:border-slate-650 transition-all placeholder-slate-500"
                  />
                </div>

                {/* Add Customer Trigger */}
                <button 
                  onClick={() => {
                    setEditingCustomer(null);
                    setShowFormModal(true);
                  }}
                  className="px-6 py-2.5 bg-white text-black hover:bg-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-97"
                >
                  <Plus className="h-4 w-4" />
                  <span>ADD CUSTOMER</span>
                </button>
              </div>

              {/* Filters list */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-900 text-xs">
                
                {/* Active Filter */}
                <div className="flex items-center space-x-2 bg-black px-3 py-1.5 rounded-lg border border-[#1c1c1e]">
                  <span className="text-slate-500 font-bold uppercase text-[9px]">Status:</span>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-slate-200 font-semibold focus:outline-none"
                  >
                    <option value="all">All Profiles</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>

                {/* Payment status filter */}
                <div className="flex items-center space-x-2 bg-black px-3 py-1.5 rounded-lg border border-[#1c1c1e]">
                  <span className="text-slate-500 font-bold uppercase text-[9px]">Billing:</span>
                  <select 
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="bg-transparent text-slate-200 font-semibold focus:outline-none"
                  >
                    <option value="all">All Balances</option>
                    <option value="Paid">Fully Paid</option>
                    <option value="Partial">Partial Dues</option>
                    <option value="Unpaid">Unpaid Plans</option>
                  </select>
                </div>

                {/* Subscription Type Filter */}
                <div className="flex items-center space-x-2 bg-black px-3 py-1.5 rounded-lg border border-[#1c1c1e]">
                  <span className="text-slate-500 font-bold uppercase text-[9px]">Packages:</span>
                  <select 
                    value={subTypeFilter}
                    onChange={(e) => setSubTypeFilter(e.target.value)}
                    className="bg-transparent text-slate-200 font-semibold focus:outline-none max-w-[150px]"
                  >
                    <option value="all">All Packages</option>
                    {uniqueSubTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Sorting */}
                <div className="flex items-center space-x-2 bg-black px-3 py-1.5 rounded-lg border border-[#1c1c1e] md:ml-auto">
                  <span className="text-slate-500 font-bold uppercase text-[9px]">Sort By:</span>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent text-slate-200 font-semibold focus:outline-none"
                  >
                    <option value="name-asc">Client Name (A-Z)</option>
                    <option value="name-desc">Client Name (Z-A)</option>
                    <option value="meals-desc">Remaining {label}s</option>
                    <option value="payment-desc">Outstanding Balance</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Customers grid list */}
            {loading ? (
              <div className="text-center py-20">
                <RefreshCw className="h-8 w-8 text-white animate-spin mx-auto mb-4" />
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Syncing Workspace...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-dark-border rounded-3xl bg-dark-card/30">
                <TrackyLogo textClassName="text-xl" color="text-slate-700" className="mb-4" />
                <h3 className="text-base font-bold text-white uppercase tracking-tight">No client profiles found</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">
                  Adjust your filter selectors or click the button above to register your first {label} subscriber.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCustomers.map(customer => (
                  <CustomerCard 
                    key={customer.id}
                    customer={customer}
                    onEdit={(c) => {
                      setEditingCustomer(c);
                      setShowFormModal(true);
                    }}
                    onDelete={handleDeleteCustomer}
                    onSelectLogs={(c) => setSelectedLogsCustomer(c)}
                    onSelectPayments={(c) => setSelectedPaymentsCustomer(c)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------- TAB CONTENT: DAILY LOGS CHECKLIST -------------------- */}
        {activeTab === 'daily' && (
          <div className="tab-content bg-[#0d0d0f] border border-[#1c1c1e] rounded-3xl p-6 shadow-xl">
            
            {/* Headline and Date selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-5 mb-5 gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight uppercase">DAILY DELIVERY LOGS</h2>
                <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5 font-bold">
                  Mark active {label} allocations for any date
                </p>
              </div>

              {/* Date selection input */}
              <div className="flex items-center space-x-2 bg-black border border-[#1c1c1e] px-3.5 py-2 rounded-xl">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <input 
                  type="date" 
                  value={dailyLogDate}
                  onChange={(e) => setDailyLogDate(e.target.value)}
                  className="bg-transparent text-xs text-white font-mono font-bold focus:outline-none"
                />
              </div>
            </div>

            {/* Customers table checklist */}
            {customers.filter(c => c.active).length === 0 ? (
              <div className="text-center py-20 text-slate-550 text-xs font-semibold uppercase tracking-wider">
                No active client subscriptions to log.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1c1c1e] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-2">Customer</th>
                      <th className="py-3 px-2">Plan Details</th>
                      <th className="py-3 px-2">Delivery Note</th>
                      <th className="py-3 px-2 text-right">Quick Mark Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {customers.filter(c => c.active).map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-900/10 transition-colors">
                        
                        {/* Customer profile info */}
                        <td className="py-4 px-2">
                          <p className="font-bold text-xs text-white uppercase">{cust.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{cust.phone}</p>
                        </td>

                        {/* Plan and remaining meals */}
                        <td className="py-4 px-2">
                          <span className="px-2.5 py-1 rounded-lg bg-black text-[9px] border border-[#1c1c1e] font-bold text-slate-400 uppercase">
                            {cust.plan_type}
                          </span>
                          <span className="ml-3 font-mono text-slate-450 text-xs">
                            {cust.pending_meals} {label}s left
                          </span>
                        </td>

                        {/* Internal notes input */}
                        <td className="py-4 px-2">
                          <input 
                            type="text" 
                            placeholder="Add brief note..."
                            value={quickNotes[cust.id] || ''}
                            onChange={(e) => setQuickNotes({ ...quickNotes, [cust.id]: e.target.value })}
                            className="bg-black border border-[#1c1c1e] rounded-lg px-2.5 py-1.5 w-full max-w-[200px] text-xs text-white focus:outline-none focus:border-slate-700"
                          />
                        </td>

                        {/* Log actions */}
                        <td className="py-4 px-2 text-right">
                          <div className="inline-flex gap-1.5">
                            <button 
                              onClick={() => handleQuickLog(cust.id, 'delivered')}
                              className="px-3 py-1.5 bg-accent-delivered/10 border border-accent-delivered/20 hover:border-accent-delivered text-accent-delivered hover:bg-accent-delivered/20 rounded-lg font-bold tracking-wide uppercase transition-all active:scale-95 text-[10px]"
                            >
                              Delivered
                            </button>
                            <button 
                              onClick={() => handleQuickLog(cust.id, 'skipped')}
                              className="px-3 py-1.5 bg-accent-skipped/10 border border-accent-skipped/20 hover:border-accent-skipped text-accent-skipped hover:bg-accent-skipped/20 rounded-lg font-bold tracking-wide uppercase transition-all active:scale-95 text-[10px]"
                            >
                              Skipped
                            </button>
                            <button 
                              onClick={() => handleQuickLog(cust.id, 'extra')}
                              className="px-3 py-1.5 bg-accent-extra/10 border border-accent-extra/20 hover:border-accent-extra text-accent-extra hover:bg-accent-extra/20 rounded-lg font-bold tracking-wide uppercase transition-all active:scale-95 text-[10px]"
                            >
                              Extra
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* -------------------- TAB CONTENT: PAYMENTS SHEET -------------------- */}
        {activeTab === 'payments' && (
          <div className="tab-content bg-[#0d0d0f] border border-[#1c1c1e] rounded-3xl p-6 shadow-xl space-y-6">
            
            {/* Header + summary totals */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-5 gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight uppercase">PAYMENTS LEDGER</h2>
                <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5 font-bold">
                  Overview of Collections and Outstanding Balances
                </p>
              </div>

              {/* Running total statistics */}
              <div className="flex items-center space-x-4 bg-black p-3.5 rounded-2xl border border-[#1c1c1e]">
                <div className="text-xs">
                  <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Collected</span>
                  <span className="text-lg font-bold font-mono text-accent-delivered glow-delivered">{curr}{runningTotalCollected}</span>
                </div>
                <div className="h-8 w-[1px] bg-[#1c1c1e]"></div>
                <div className="text-xs">
                  <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Outstanding</span>
                  <span className="text-lg font-bold font-mono text-accent-skipped glow-skipped">{curr}{runningTotalPending}</span>
                </div>
              </div>
            </div>

            {/* Payments spreadsheet */}
            {customers.length === 0 ? (
              <div className="text-center py-20 text-slate-550 text-xs font-semibold uppercase tracking-wider">
                No active records.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1c1c1e] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-2">Customer</th>
                      <th className="py-3 px-2">Subscription Cost</th>
                      <th className="py-3 px-2">Collected So Far</th>
                      <th className="py-3 px-2">Unpaid Balance</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 font-mono text-xs">
                    {customers.map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-900/10 transition-colors">
                        
                        {/* Name */}
                        <td className="py-4 px-2 font-sans font-semibold text-white uppercase text-xs">
                          {cust.name}
                        </td>

                        {/* Total Plan Amount */}
                        <td className="py-4 px-2 text-slate-350">
                          {curr}{cust.plan_amount}
                        </td>

                        {/* Amount paid */}
                        <td className="py-4 px-2 text-accent-delivered font-bold">
                          {curr}{cust.amount_paid}
                        </td>

                        {/* Outstanding balance */}
                        <td className={`py-4 px-2 font-bold ${
                          cust.pending_payment > 0 ? 'text-accent-skipped' : 'text-slate-500'
                        }`}>
                          {curr}{cust.pending_payment}
                        </td>

                        {/* Badge status */}
                        <td className="py-4 px-2">
                          <span className={`inline-block border px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-sans ${
                            cust.payment_status === 'Paid' ? 'bg-accent-delivered/10 text-accent-delivered border-accent-delivered/20' :
                            cust.payment_status === 'Partial' ? 'bg-accent-money/10 text-accent-money border-accent-money/20' :
                            'bg-accent-skipped/10 text-accent-skipped border-accent-skipped/20'
                          }`}>
                            {cust.payment_status}
                          </span>
                        </td>

                        {/* Payments button */}
                        <td className="py-4 px-2 text-right font-sans">
                          <button
                            onClick={() => setSelectedPaymentsCustomer(cust)}
                            className="px-3.5 py-1.5 bg-black border border-[#1c1c1e] hover:border-slate-600 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95"
                          >
                            Transactions
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* -------------------- TAB CONTENT: EXPENSES -------------------- */}
        {activeTab === 'expenses' && (
          <div className="tab-content"><ExpensesTab stats={stats} onUpdate={fetchData} /></div>
        )}

        {/* -------------------- TAB CONTENT: SETTINGS -------------------- */}
        {activeTab === 'settings' && (
          <div className="tab-content"><SettingsTab 
            user={user} 
            onUpdateSettings={handleUpdateSettings} 
            onLogout={handleLogout} 
          /></div>
        )}

      </main>

      {/* -------------------- OVERLAYS / MODALS -------------------- */}

      {/* Customer Add/Edit Form */}
      {showFormModal && (
        <CustomerForm 
          customer={editingCustomer}
          onClose={() => {
            setShowFormModal(false);
            setEditingCustomer(null);
          }}
          onSave={handleSaveCustomer}
          userSettings={user}
        />
      )}

      {/* Meal Logs Timeline Overlay */}
      {selectedLogsCustomer && (
        <MealLogManager 
          customer={selectedLogsCustomer}
          onClose={() => setSelectedLogsCustomer(null)}
          onUpdate={fetchData}
          userSettings={user}
        />
      )}

      {/* Payment Entry & Logs Overlay */}
      {selectedPaymentsCustomer && (
        <PaymentModal 
          customer={selectedPaymentsCustomer}
          onClose={() => setSelectedPaymentsCustomer(null)}
          onUpdate={fetchData}
          userSettings={user}
        />
      )}

      {/* -------------------- TOAST NOTIFICATIONS -------------------- */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold pointer-events-auto
              animate-[slideInRight_0.3s_ease-out]
              ${
                toast.type === 'success'
                  ? 'bg-[#0d1f0d] border-green-800/50 text-green-300'
                  : 'bg-[#1f0d0d] border-red-800/50 text-red-300'
              }`}
          >
            {toast.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
              : <XCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
            }
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
