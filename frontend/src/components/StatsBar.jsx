import React from 'react';
import { Users, Calendar, CreditCard, Tag, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function StatsBar({ stats }) {
  // Retrieve settings dynamically
  const userStr = localStorage.getItem('tracky_user');
  const user = userStr ? JSON.parse(userStr) : { currency: '₹', tracking_label: 'Meal' };
  const curr = user.currency;
  const label = user.tracking_label;

  const cardClass = "bg-dark-card border border-dark-border p-3.5 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden transition-all duration-350 hover:border-dark-border-focus";
  const iconContainerClass = "p-2 bg-black border border-dark-border rounded-lg text-slate-400";

  const netRevenue = stats.net_revenue || 0;
  const isProfit = netRevenue >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      
      {/* 1. Active Customers */}
      <div className={cardClass}>
        <div className="absolute top-0 left-0 h-1 w-full bg-accent-delivered"></div>
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Users</p>
          <p className="text-xl font-bold font-mono mt-1 text-white">{stats.active_customers}</p>
        </div>
        <div className={iconContainerClass}>
          <Users className="h-4.5 w-4.5" />
        </div>
      </div>

      {/* 2. Total Pending Items */}
      <div className={cardClass}>
        <div className="absolute top-0 left-0 h-1 w-full bg-accent-money"></div>
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pending {label}s</p>
          <p className="text-xl font-bold font-mono mt-1 text-accent-money">{stats.pending_meals}</p>
        </div>
        <div className={iconContainerClass}>
          <Calendar className="h-4.5 w-4.5" />
        </div>
      </div>

      {/* 3. Total Pending Payments */}
      <div className={cardClass}>
        <div className="absolute top-0 left-0 h-1 w-full bg-accent-skipped"></div>
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pending Bills</p>
          <p className="text-xl font-bold font-mono mt-1 text-slate-300">
            {curr}{stats.pending_payments}
          </p>
        </div>
        <div className={iconContainerClass}>
          <CreditCard className="h-4.5 w-4.5" />
        </div>
      </div>

      {/* 4. Collected This Month */}
      <div className={cardClass}>
        <div className="absolute top-0 left-0 h-1 w-full bg-accent-delivered"></div>
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Collected (Month)</p>
          <p className="text-xl font-bold font-mono mt-1 text-white">
            {curr}{stats.collected_this_month}
          </p>
        </div>
        <div className={iconContainerClass}>
          <CreditCard className="h-4.5 w-4.5 text-accent-delivered" />
        </div>
      </div>

      {/* 5. Expenses This Month */}
      <div className={cardClass}>
        <div className="absolute top-0 left-0 h-1 w-full bg-accent-skipped"></div>
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Expenses (Month)</p>
          <p className="text-xl font-bold font-mono mt-1 text-slate-400">
            {curr}{stats.expenses_this_month || 0}
          </p>
        </div>
        <div className={iconContainerClass}>
          <Tag className="h-4.5 w-4.5 text-accent-skipped" />
        </div>
      </div>

      {/* 6. Net Profit/Revenue */}
      <div className={cardClass}>
        <div className={`absolute top-0 left-0 h-1 w-full ${isProfit ? 'bg-accent-delivered' : 'bg-accent-skipped'}`}></div>
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Net Profit</p>
          <p className={`text-xl font-bold font-mono mt-1 ${isProfit ? 'text-accent-delivered' : 'text-accent-skipped'}`}>
            {curr}{netRevenue}
          </p>
        </div>
        <div className={`${iconContainerClass} ${isProfit ? 'text-accent-delivered' : 'text-accent-skipped'}`}>
          {isProfit ? (
            <ArrowUpRight className="h-4.5 w-4.5" />
          ) : (
            <ArrowDownRight className="h-4.5 w-4.5" />
          )}
        </div>
      </div>

    </div>
  );
}
