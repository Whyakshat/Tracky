import React, { useState, useEffect } from 'react';
import { Save, LogOut, Check, Sparkles, Building, Settings, HelpCircle } from 'lucide-react';
import { API_URL } from '../config';

export default function SettingsTab({ user, onUpdateSettings, onLogout }) {
  const [businessName, setBusinessName] = useState(user.business_name || '');
  const [trackingLabel, setTrackingLabel] = useState(user.tracking_label || 'Meal');
  const [currency, setCurrency] = useState(user.currency || '₹');
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const trackingOptions = [
    { label: 'Meal Delivery (Meals, Plates)', value: 'Meal' },
    { label: 'Tiffin Service (Tiffins, Dabbas)', value: 'Tiffin' },
    { label: 'Box Delivery (Boxes, Packages)', value: 'Box' },
    { label: 'Personal Tracking (Sessions, Classes)', value: 'Session' },
    { label: 'Generic (Items, Units)', value: 'Item' }
  ];

  const currencyOptions = [
    { label: 'Indian Rupee (₹)', value: '₹' },
    { label: 'US Dollar ($)', value: '$' },
    { label: 'Euro (€)', value: '€' },
    { label: 'British Pound (£)', value: '£' }
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    if (!businessName.trim() || !trackingLabel.trim() || !currency) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess(false);

      const token = localStorage.getItem('tracky_token');
      const res = await fetch(`${API_URL}/user/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          business_name: businessName,
          tracking_label: trackingLabel,
          currency: currency
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');

      onUpdateSettings(data.user);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-slate-900 border border-slate-800 focus:border-slate-600 rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-all text-xs";
  const labelClass = "block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Settings Card */}
      <div className="bg-dark-card border border-[#1c1c1e] rounded-3xl p-6 md:p-8 shadow-xl">
        
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-slate-800 p-2 rounded-xl text-slate-200 border border-slate-700">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight uppercase">WORKSPACE CONFIGURATION</h2>
            <p className="text-xs text-slate-400 mt-0.5">Customize names, entity tags, and local billing metrics.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-xl text-xs font-semibold mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          
          {/* Business Name */}
          <div>
            <label className={labelClass}>Workspace Title / Business Name</label>
            <input 
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Sharma Tiffins, Akshat Fitness"
              className={inputClass}
            />
            <p className="text-[10px] text-slate-500 mt-1">This will change the brand header at the top left of the screen.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tracking Item */}
            <div>
              <label className={labelClass}>What are you tracking?</label>
              <select
                value={trackingLabel}
                onChange={(e) => setTrackingLabel(e.target.value)}
                className={inputClass}
              >
                {trackingOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Currency Symbol */}
            <div>
              <label className={labelClass}>Currency Prefix</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputClass}
              >
                {currencyOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Example Preview */}
          <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl text-xs space-y-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span>Entity Translation Preview</span>
            </h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Based on your selection, Tracky will translate dashboard metrics dynamically:
            </p>
            <ul className="list-disc list-inside text-slate-350 space-y-1 font-mono text-[10px] pt-1">
              <li>"Meals Delivered" &rarr; <span className="text-white font-bold">{trackingLabel}s Delivered</span></li>
              <li>"Pending Meals" &rarr; <span className="text-white font-bold">Pending {trackingLabel}s</span></li>
              <li>"Total plan cost: ₹9000" &rarr; <span className="text-white font-bold">Total plan cost: {currency}9000</span></li>
            </ul>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-md ${
              success 
                ? 'bg-accent-delivered text-black shadow-accent-delivered/10' 
                : 'bg-white text-black hover:bg-slate-200 active:scale-98'
            }`}
          >
            {success ? (
              <>
                <Check className="h-4 w-4" />
                <span>SETTINGS SAVED!</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{saving ? 'SAVING...' : 'SAVE CONFIGURATION'}</span>
              </>
            )}
          </button>

        </form>

      </div>

      {/* Log out Card */}
      <div className="bg-[#0b0c0e] border border-slate-900 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-tight">Active Session</h3>
          <p className="text-xs text-slate-500 mt-0.5">Currently signed in as {user.email}</p>
        </div>
        
        <button
          onClick={onLogout}
          className="px-4 py-2 border border-rose-950 hover:border-accent-skipped/40 text-accent-skipped bg-accent-skipped/5 hover:bg-accent-skipped/10 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all active:scale-96"
        >
          <LogOut className="h-4 w-4" />
          <span>Log Out Workspace</span>
        </button>
      </div>

    </div>
  );
}
