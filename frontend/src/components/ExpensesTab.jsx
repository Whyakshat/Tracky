import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, AlertCircle, Tag } from 'lucide-react';
import { API_URL } from '../config';

export default function ExpensesTab({ stats, onUpdate }) {
  // Retrieve settings
  const userStr = localStorage.getItem('tracky_user');
  const user = userStr ? JSON.parse(userStr) : { currency: '₹', tracking_label: 'Meal' };
  const curr = user.currency;
  const token = localStorage.getItem('tracky_token');

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Ingredients');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = ['Ingredients', 'Packaging', 'Delivery', 'Rent/Bills', 'Marketing', 'Other'];

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_URL}/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load expenses');
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      console.error(err);
      setError('Could not fetch expenses. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const expAmount = parseFloat(amount);

    if (!title.trim() || isNaN(expAmount) || expAmount <= 0 || !expenseDate) {
      setError('Please provide a valid title, date, and amount greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const res = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          amount: expAmount,
          expense_date: expenseDate,
          category,
          notes
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to record expense');
      }

      // Reset form
      setTitle('');
      setAmount('');
      setNotes('');
      setCategory('Ingredients');

      await fetchExpenses();
      onUpdate(); // Update global stats
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense record?')) return;
    
    try {
      setError('');
      const res = await fetch(`${API_URL}/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete expense');
      
      await fetchExpenses();
      onUpdate();
    } catch (err) {
      setError(err.message);
    }
  };

  // Filtered Expenses list
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' ? true : exp.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Ingredients':
        return 'text-amber-400 bg-amber-950/40 border-amber-900/30';
      case 'Packaging':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30';
      case 'Delivery':
        return 'text-cyan-400 bg-cyan-950/40 border-cyan-900/30';
      case 'Rent/Bills':
        return 'text-purple-400 bg-purple-950/40 border-purple-900/30';
      case 'Marketing':
        return 'text-pink-400 bg-pink-950/40 border-pink-900/30';
      default:
        return 'text-slate-400 bg-slate-800/40 border-slate-700/30';
    }
  };

  const inputClass = "w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-550 focus:outline-none focus:border-slate-700 transition-all text-xs";
  const labelClass = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. Add Expense Panel */}
      <div className="lg:col-span-1 bg-dark-card border border-[#1c1c1e] p-5 rounded-2xl shadow-xl h-fit">
        <h2 className="text-sm font-bold text-white tracking-tight mb-4 uppercase">LOG OVERHEAD EXPENSE</h2>
        
        {error && (
          <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-xl text-xs flex items-center space-x-2 font-semibold mb-4">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAddExpense} className="space-y-4">
          
          {/* Title */}
          <div>
            <label className={labelClass}>Expense Item / Title</label>
            <input 
              type="text"
              placeholder="e.g. Vegetables, Rent..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount ({curr})</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">{curr}</span>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`${inputClass} pl-7 font-mono`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Date</label>
              <input 
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className={labelClass}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes / Invoice details</label>
            <textarea
              placeholder="Store location, payment mode, bill no..."
              value={notes}
              rows="2"
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-white text-black hover:bg-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>{submitting ? 'RECORDING...' : 'RECORD EXPENSE'}</span>
          </button>

        </form>
      </div>

      {/* 2. Expenses Table & List */}
      <div className="lg:col-span-2 bg-dark-card border border-[#1c1c1e] p-5 rounded-2xl shadow-xl flex flex-col min-h-[450px]">
        
        {/* Title, Search, and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-4 mb-4">
          <h2 className="text-sm font-bold text-white tracking-tight uppercase font-sans">EXPENSES JOURNAL</h2>
          
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input 
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-black border border-slate-850 pl-8 pr-3 py-1.5 rounded-lg text-xs w-[130px] sm:w-[160px] focus:outline-none focus:border-slate-700 transition-all text-white placeholder-slate-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-black border border-slate-850 px-2 py-1.5 rounded-lg text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Expenses List */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-xs">Loading journal entries...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-850 rounded-2xl text-xs text-slate-500 flex-1 flex flex-col justify-center items-center">
            <Tag className="h-8 w-8 text-slate-700 mb-2" />
            <p className="font-semibold uppercase tracking-wider text-[10px]">No expenses found</p>
            <p className="text-[10px] text-slate-550 mt-0.5">Use the logging tool on the left to record expenses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-2">Date</th>
                  <th className="py-2.5 px-2">Item</th>
                  <th className="py-2.5 px-2">Category</th>
                  <th className="py-2.5 px-2">Notes</th>
                  <th className="py-2.5 px-2 text-right">Amount</th>
                  <th className="py-2.5 px-2 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 font-sans">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-900/10 transition-colors">
                    
                    {/* Date */}
                    <td className="py-3 px-2 font-mono text-slate-400">
                      {exp.expense_date}
                    </td>

                    {/* Title */}
                    <td className="py-3 px-2 font-semibold text-white uppercase tracking-tight">
                      {exp.title}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider ${getCategoryColor(exp.category)}`}>
                        {exp.category}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-2 text-slate-500 italic max-w-[150px] truncate" title={exp.notes}>
                      {exp.notes || '—'}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-2 text-right font-mono font-bold text-accent-skipped">
                      {curr}{exp.amount}
                    </td>

                    {/* Delete Icon */}
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 text-slate-500 hover:text-accent-skipped rounded hover:bg-slate-850 transition-colors"
                        title="Delete expense entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
      
    </div>
  );
}
