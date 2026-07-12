import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';

export default function CustomerForm({ customer, onClose, onSave }) {
  // Retrieve settings
  const userStr = localStorage.getItem('tracky_user');
  const user = userStr ? JSON.parse(userStr) : { currency: '₹', tracking_label: 'Meal' };
  const curr = user.currency;
  const label = user.tracking_label;

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    subscription_type: '30 Day Allocation',
    plan_type: 'Standard',
    plan_start_date: new Date().toISOString().split('T')[0],
    next_delivery_date: '',
    plan_duration: 30,
    plan_amount: 5000,
    amount_paid: 0,
    notes: '',
    active: true
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        subscription_type: customer.subscription_type || '30 Day Allocation',
        plan_type: customer.plan_type || 'Standard',
        plan_start_date: customer.plan_start_date || new Date().toISOString().split('T')[0],
        next_delivery_date: customer.next_delivery_date || '',
        plan_duration: customer.plan_duration || 0,
        plan_amount: customer.plan_amount || 0,
        amount_paid: customer.amount_paid || 0,
        notes: customer.notes || '',
        active: customer.active !== undefined ? customer.active : true
      });
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
    }));
  };

  const validate = () => {
    const tempErrors = {};
    if (!formData.name.trim()) tempErrors.name = 'Name is required';
    if (!formData.phone.trim()) tempErrors.phone = 'Phone number is required';
    if (!formData.address.trim()) tempErrors.address = 'Address is required';
    if (!formData.subscription_type.trim()) tempErrors.subscription_type = 'Subscription type is required';
    if (!formData.plan_start_date) tempErrors.plan_start_date = 'Plan start date is required';
    if (formData.plan_duration <= 0) tempErrors.plan_duration = 'Duration must be greater than 0';
    if (formData.plan_amount < 0) tempErrors.plan_amount = 'Amount cannot be negative';
    if (formData.amount_paid < 0) tempErrors.amount_paid = 'Amount paid cannot be negative';
    if (formData.amount_paid > formData.plan_amount) {
      tempErrors.amount_paid = 'Amount paid cannot exceed total plan amount';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false); // In case onSave doesn't unmount the form
    }
  };

  const inputClass = "w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-all";
  const labelClass = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1";
  const errorClass = "text-[10px] text-accent-skipped mt-1 font-bold";

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-dark-card border border-[#1c1c1e] w-full max-w-2xl rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-900">
          <h2 className="text-xl font-bold text-white tracking-tight uppercase">
            {customer ? `EDIT ${label.toUpperCase()} PLAN` : `CREATE NEW ${label.toUpperCase()} PLAN`}
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black border border-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Name */}
            <div>
              <label className={labelClass}>Client Name</label>
              <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleChange}
                placeholder="e.g. Arjun Sharma"
                className={inputClass}
              />
              {errors.name && <p className={errorClass}>{errors.name}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass}>Phone / Contact</label>
              <input 
                type="text" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange}
                placeholder="e.g. +91 99887 76655"
                className={inputClass}
              />
              {errors.phone && <p className={errorClass}>{errors.phone}</p>}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className={labelClass}>Address / Delivery Location</label>
              <textarea 
                name="address" 
                rows="2"
                value={formData.address} 
                onChange={handleChange}
                placeholder="Full delivery location address details..."
                className={inputClass}
              />
              {errors.address && <p className={errorClass}>{errors.address}</p>}
            </div>

            {/* Subscription Type */}
            <div>
              <label className={labelClass}>Plan Package Name</label>
              <input 
                type="text" 
                name="subscription_type" 
                value={formData.subscription_type} 
                onChange={handleChange}
                placeholder="e.g. 30 Day Evening Plan"
                className={inputClass}
                list="sub-options"
              />
              <datalist id="sub-options">
                <option value="15 Day Plan" />
                <option value="30 Day Plan" />
                <option value="Custom Duration" />
              </datalist>
              {errors.subscription_type && <p className={errorClass}>{errors.subscription_type}</p>}
            </div>

            {/* Plan Type */}
            <div>
              <label className={labelClass}>Plan Type / Schedule</label>
              <input 
                type="text" 
                name="plan_type" 
                value={formData.plan_type} 
                onChange={handleChange}
                placeholder="e.g. Daily Dinner, Weekly Classes"
                className={inputClass}
              />
            </div>

            {/* Start Date */}
            <div>
              <label className={labelClass}>Plan Start Date</label>
              <input 
                type="date" 
                name="plan_start_date" 
                value={formData.plan_start_date} 
                onChange={handleChange}
                className={inputClass}
              />
              {errors.plan_start_date && <p className={errorClass}>{errors.plan_start_date}</p>}
            </div>

            {/* Next Delivery Date */}
            <div>
              <label className={labelClass}>Next Event / Delivery Date (Optional)</label>
              <input 
                type="date" 
                name="next_delivery_date" 
                value={formData.next_delivery_date} 
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            {/* Plan Duration */}
            <div>
              <label className={labelClass}>Total {label}s (Duration Limit)</label>
              <input 
                type="number" 
                name="plan_duration" 
                value={formData.plan_duration} 
                onChange={handleChange}
                placeholder="e.g. 30"
                className={`${inputClass} font-mono`}
              />
              {errors.plan_duration && <p className={errorClass}>{errors.plan_duration}</p>}
            </div>

            {/* Plan Amount */}
            <div>
              <label className={labelClass}>Total Plan Cost ({curr})</label>
              <input 
                type="number" 
                name="plan_amount" 
                value={formData.plan_amount} 
                onChange={handleChange}
                placeholder="e.g. 4500"
                className={`${inputClass} font-mono`}
              />
              {errors.plan_amount && <p className={errorClass}>{errors.plan_amount}</p>}
            </div>

            {/* Amount Paid */}
            <div>
              <label className={labelClass}>
                {customer ? `Total Received So Far (${curr})` : `Initial Amount Received (${curr})`}
              </label>
              <input 
                type="number" 
                name="amount_paid" 
                value={formData.amount_paid} 
                onChange={handleChange}
                className={`${inputClass} font-mono`}
              />
              {errors.amount_paid && <p className={errorClass}>{errors.amount_paid}</p>}
            </div>

            {/* Active Switch */}
            <div className="flex items-center mt-6">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-350 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white after:transition-all"></div>
                <span className="ml-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Plan Active
                </span>
              </label>
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className={labelClass}>Dietary Notes / Billing Instructions</label>
              <textarea 
                name="notes" 
                rows="2"
                value={formData.notes} 
                onChange={handleChange}
                placeholder="Special preferences, timings..."
                className={inputClass}
              />
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-slate-900 flex items-center justify-end space-x-3 bg-dark-card rounded-b-3xl">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-5 py-2 bg-white text-black hover:bg-slate-200 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 shadow-lg transition-all active:scale-97 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{isSubmitting ? 'Saving...' : 'Confirm Plan'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
