import React, { useState, useEffect } from 'react';
import { X, AlertCircle, IndianRupee, CreditCard } from 'lucide-react';
import { API_URL } from '../config';

export default function PaymentModal({ customer, onClose, onUpdate }) {
  // Retrieve settings
  const userStr = localStorage.getItem('tracky_user');
  const user = userStr ? JSON.parse(userStr) : { currency: '₹', tracking_label: 'Meal' };
  const curr = user.currency;
  const token = localStorage.getItem('tracky_token');

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/customers/${customer.id}/payments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load payments history');
      const data = await res.json();
      setPayments(data);
    } catch (err) {
      console.error(err);
      setError('Could not load transaction logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [customer.id]);

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    const payAmt = parseFloat(amount);
    
    if (isNaN(payAmt) || payAmt <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (payAmt > customer.pending_payment) {
      setError(`Cannot pay more than the pending amount of ${curr}${customer.pending_payment}`);
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      
      const res = await fetch(`${API_URL}/customers/${customer.id}/payments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: payAmt, payment_date: paymentDate, notes })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record payment transaction');
      }

      setAmount('');
      setNotes('');
      await fetchPayments(); // Refresh
      onUpdate(); // Trigger parent stats refresh
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card border border-[#1c1c1e] w-full max-w-xl rounded-3xl shadow-2xl relative flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-900">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight uppercase">
              RECORD PAYMENT: {customer.name}
            </h2>
            <p className="text-xs text-slate-450 font-semibold tracking-wider uppercase mt-0.5">
              Plan cost: {curr}{customer.plan_amount} | Paid: {curr}{customer.amount_paid}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black border border-slate-850 text-slate-400 hover:text-white transition-all"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form & History Body */}
        <div className="overflow-y-auto p-5 space-y-6 flex-1">
          
          {error && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-450 rounded-xl text-xs flex items-center space-x-2 font-semibold">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Pending Balance */}
          <div className="flex items-center justify-between p-4 bg-black border border-[#1c1c1e] rounded-2xl">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Remaining Balance</span>
            <span className={`text-xl font-bold font-mono ${
              customer.pending_payment <= 0 ? 'text-accent-delivered glow-delivered' : 'text-accent-money'
            }`}>
              {curr}{customer.pending_payment}
            </span>
          </div>

          {/* Add Payment Form */}
          {customer.pending_payment > 0 ? (
            <form onSubmit={handleSubmitPayment} className="bg-black border border-[#1c1c1e] p-4 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-1">Add Transaction</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Amount */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Amount Received ({curr})</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">{curr}</span>
                    <input 
                      type="number"
                      placeholder="e.g. 1500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-[#0c0c0e] border border-slate-850 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Payment Date</label>
                  <input 
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Notes (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. Cash, Online UPI..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-white text-black hover:bg-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all active:scale-98"
              >
                <span>{submitting ? 'RECORDING...' : 'CONFIRM TRANSACTION'}</span>
              </button>
            </form>
          ) : (
            <div className="p-4 bg-emerald-950/20 border border-accent-delivered/20 text-accent-delivered rounded-2xl text-center text-xs font-bold uppercase">
              🎉 Subscription Balance is fully settled!
            </div>
          )}

          {/* Payment History */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-455 uppercase tracking-wider">Payment History</h3>
            
            {loading ? (
              <div className="text-center py-6 text-xs text-slate-500">Syncing payments...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-850 rounded-2xl text-xs text-slate-500">
                No transactions logged yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {payments.map((payment) => (
                  <div 
                    key={payment.id} 
                    className="flex items-center justify-between p-3 bg-black/40 border border-slate-900 rounded-xl text-xs"
                  >
                    <div>
                      <div className="font-mono text-slate-450 font-semibold">{payment.payment_date}</div>
                      {payment.notes && (
                        <div className="text-slate-500 text-[10px] mt-0.5">{payment.notes}</div>
                      )}
                    </div>
                    <span className="font-mono font-bold text-accent-delivered">
                      +{curr}{payment.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-900 flex items-center justify-end bg-dark-card rounded-b-3xl">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-850 text-slate-450 hover:text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
