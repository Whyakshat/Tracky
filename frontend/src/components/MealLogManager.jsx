import React, { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2, ChevronRight, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';

export default function MealLogManager({ customer, onClose, onUpdate }) {
  // Retrieve settings
  const userStr = localStorage.getItem('tracky_user');
  const user = userStr ? JSON.parse(userStr) : { currency: '₹', tracking_label: 'Meal' };
  const label = user.tracking_label;
  const token = localStorage.getItem('tracky_token');

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('delivered');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/customers/${customer.id}/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load activity logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
      setError('Could not load activity log history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [customer.id]);

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!logDate || !status) return;

    try {
      setSubmitting(true);
      setError('');
      
      const res = await fetch(`${API_URL}/customers/${customer.id}/logs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ log_date: logDate, status, note })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit log entry');
      }

      setNote(''); // Reset note
      await fetchLogs(); // Refresh timeline
      onUpdate(); // Refresh main dashboard stats
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      const res = await fetch(`${API_URL}/meal-logs/${logId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete log entry');
      await fetchLogs();
      onUpdate();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusStyle = (logStatus) => {
    switch (logStatus) {
      case 'delivered':
        return 'text-accent-delivered bg-accent-delivered/10 border-accent-delivered/20';
      case 'skipped':
        return 'text-accent-skipped bg-accent-skipped/10 border-accent-skipped/20';
      case 'extra':
        return 'text-accent-extra bg-accent-extra/10 border-accent-extra/20';
      default:
        return 'text-white bg-slate-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card border border-[#1c1c1e] w-full max-w-xl rounded-3xl shadow-2xl relative flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-900">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight uppercase">
              {label.toUpperCase()} LOGS: {customer.name}
            </h2>
            <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
              {customer.subscription_type} ({customer.plan_type})
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black border border-slate-850 text-slate-400 hover:text-white transition-all"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal content */}
        <div className="overflow-y-auto p-5 space-y-6 flex-1">
          
          {error && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-xl text-xs flex items-center space-x-2 font-semibold">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Add Log Form */}
          <form onSubmit={handleSubmitLog} className="bg-black border border-[#1c1c1e] p-4 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Record {label} Status</h3>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Log Date */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                <input 
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                />
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
                >
                  <option value="delivered">Delivered</option>
                  <option value="skipped">Skipped</option>
                  <option value="extra">Extra / Guest</option>
                </select>
              </div>
            </div>

            {/* Note text field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Notes (Optional)</label>
              <input 
                type="text"
                placeholder="e.g. details, timings..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-[#0c0c0e] border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
              />
            </div>

            <button 
              type="submit"
              disabled={submitting}
              className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                status === 'delivered' ? 'bg-white text-black hover:bg-slate-200' :
                status === 'skipped' ? 'bg-accent-skipped text-white hover:bg-rose-600' :
                'bg-accent-extra text-black hover:bg-cyan-400'
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>{submitting ? 'RECORDING...' : `MARK AS ${status.toUpperCase()}`}</span>
            </button>
          </form>

          {/* Running Timeline Logs */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-405 uppercase tracking-wider">Log History</h3>
            
            {loading ? (
              <div className="text-center py-6 text-xs text-slate-500">Syncing history...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-850 rounded-2xl text-xs text-slate-500">
                No logs recorded yet. Use the form above to record logs.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-3 bg-black/40 border border-slate-900 rounded-xl text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="font-mono text-slate-450 font-semibold">{log.log_date}</div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${getStatusStyle(log.status)}`}>
                        {log.status}
                      </span>
                      {log.note && (
                        <span className="text-slate-500 italic text-[11px] truncate max-w-[150px]">
                          ({log.note})
                        </span>
                      )}
                    </div>

                    <button 
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-1 text-slate-500 hover:text-accent-skipped rounded hover:bg-slate-850 transition-colors"
                      title="Undo Log Entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
