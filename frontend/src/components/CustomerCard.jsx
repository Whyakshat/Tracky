import React, { useState } from 'react';
import { Phone, MapPin, Calendar, CreditCard, Edit, LogIn, Trash2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export default function CustomerCard({ 
  customer, 
  onEdit, 
  onDelete, 
  onSelectLogs, 
  onSelectPayments 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    id, name, phone, address, subscription_type, plan_type,
    plan_start_date, next_delivery_date, plan_duration,
    amount_paid, plan_amount, active,
    delivered_count, skipped_count, extra_count,
    pending_meals, pending_payment, payment_status
  } = customer;

  // Retrieve user settings dynamically to render custom labels/currency
  const userStr = localStorage.getItem('tracky_user');
  const user = userStr ? JSON.parse(userStr) : { currency: '₹', tracking_label: 'Meal' };
  const curr = user.currency;
  const label = user.tracking_label;

  const totalLogged = delivered_count + skipped_count;
  const progressPercent = Math.min(100, Math.round((totalLogged / plan_duration) * 100)) || 0;

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'Paid':
        return 'bg-accent-delivered/10 text-accent-delivered border-accent-delivered/30';
      case 'Partial':
        return 'bg-accent-money/10 text-accent-money border-accent-money/30';
      default:
        return 'bg-accent-skipped/10 text-accent-skipped border-accent-skipped/30';
    }
  };

  return (
    <div className={`bg-dark-card border rounded-xl shadow-md relative transition-all duration-300 group ${
      active ? 'border-dark-border hover:border-slate-700' : 'border-slate-900/50 opacity-70 hover:opacity-90'
    }`}>
      
      {/* Left indicator line */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-slate-950 via-dark-border to-slate-950 group-hover:from-accent-delivered group-hover:to-accent-money transition-all duration-300 z-10"></div>

      {/* Main Row */}
      <div 
        className="p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer relative z-0"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* 1. Name & Contact */}
        <div className="flex-1 min-w-[180px] pl-2 w-full md:w-auto border-b border-slate-800 md:border-b-0 pb-2 md:pb-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-white tracking-tight group-hover:text-accent-delivered transition-colors uppercase truncate">
              {name}
            </h3>
            <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-accent-delivered' : 'bg-slate-700'}`} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            <span>{subscription_type}</span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-slate-450">{phone}</span>
          </div>
        </div>

        {/* 2. Stats Summary */}
        <div className="flex-1 flex flex-col justify-center min-w-[140px] px-2 md:px-0 w-full md:w-auto md:border-l md:border-slate-800 md:pl-4">
          <div className="flex justify-between items-center mb-1">
             <span className="text-[10px] text-slate-555 font-bold uppercase tracking-wider">Pending {label}s</span>
             <div className="flex items-center space-x-1 font-mono font-bold">
               <span className={`text-[11px] ${pending_meals === 0 ? 'text-accent-delivered' : 'text-accent-money'}`}>{pending_meals}</span>
               {pending_meals === 0 && <CheckCircle2 className="h-3 w-3 text-accent-delivered" />}
             </div>
          </div>
          <div className="flex justify-between items-center">
             <span className="text-[10px] text-slate-555 font-bold uppercase tracking-wider">Balance</span>
             <span className={`font-mono font-bold text-[11px] ${payment_status === 'Paid' ? 'text-accent-delivered' : 'text-accent-money'}`}>
                {payment_status === 'Paid' ? 'Paid' : `${curr}${pending_payment}`}
             </span>
          </div>
        </div>

        {/* 3. Progress */}
        <div className="flex-1 min-w-[120px] w-full md:w-auto px-2 md:px-4 hidden sm:block">
          <div className="flex justify-between items-center text-[9px] text-slate-550 mb-1 font-mono">
            <span>PROGRESS</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-black h-1.5 rounded-full overflow-hidden border border-dark-border">
            <div 
              className="bg-gradient-to-r from-accent-delivered to-accent-money h-full rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 4. Actions */}
        <div className="flex items-center justify-end w-full md:w-auto gap-2 pr-1 pt-1 md:pt-0">
          <button 
            onClick={(e) => { e.stopPropagation(); onSelectPayments(customer); }}
            className="p-1.5 bg-black border border-[#1c1c1e] hover:border-accent-money text-accent-money hover:bg-accent-money/5 rounded-lg transition-all active:scale-95 flex items-center gap-1 text-[9px] uppercase font-bold"
            title="Make Payment"
          >
            <CreditCard className="h-4 w-4" />
            <span className="md:hidden">Pay</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onSelectLogs(customer); }}
            className="p-1.5 bg-white text-black hover:bg-slate-200 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1 text-[9px] uppercase font-bold"
            title="Daily Logs"
          >
            <LogIn className="h-4 w-4" />
            <span className="md:hidden">Logs</span>
          </button>
          
          {/* Chevron */}
          <div className="flex items-center ml-1 md:ml-2 border-l border-slate-800 pl-1 md:pl-2 text-slate-400">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Expandable Details Section */}
      {isExpanded && (
        <div className="p-4 pt-3 border-t border-slate-800 bg-slate-900/30 flex flex-col md:flex-row justify-between gap-4">
          <div className="text-[11px] text-slate-400 space-y-2 flex-1 pl-2">
            <div className="flex items-start space-x-2">
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-500 flex-shrink-0" />
              <span>{address}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Starts: <span className="font-mono text-slate-300">{plan_start_date}</span></span>
              {next_delivery_date && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-accent-extra">Next: <span className="font-mono">{next_delivery_date}</span></span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 pr-1 md:self-end">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(customer); }}
              className="px-3 py-1.5 border border-slate-700 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Settings</span>
            </button>
            <button 
              onClick={(e) => { 
                e.stopPropagation();
                if (window.confirm(`Delete client ${name}? This will remove all database history.`)) {
                  onDelete(id);
                }
              }}
              className="px-3 py-1.5 border border-slate-800 text-slate-400 hover:text-accent-skipped rounded-lg hover:bg-slate-850 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
