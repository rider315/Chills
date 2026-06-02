import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../utils/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export default function Pricing() {
  const { user, login } = useAuth(); // Assuming login or updateUser is exposed to refresh auth context
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await loadRazorpayScript();
      if (!res) {
        toast.error('Failed to load Razorpay SDK. Are you online?');
        setLoading(false);
        return;
      }

      // Create subscription on backend
      const data = await post('/api/subscriptions/create');
      
      const options = {
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: 'Chills AI',
        description: 'Premium Monthly Subscription',
        handler: function (response) {
          toast.success('Payment successful! Your account will be upgraded shortly.');
          // Ideally you fetch the user's updated profile from backend here
          // to reflect the premium tier immediately in the UI.
          setTimeout(() => {
            window.location.reload(); // Quick way to force context refresh
          }, 2000);
        },
        prefill: {
          name: user.name || '',
          email: user.email,
        },
        theme: {
          color: '#3B82F6', // neo-blue
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      toast.error(err.message || 'Failed to initialize checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fadeIn h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-border pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black mb-2">
            <span className="bg-neo-yellow px-2 inline-block -rotate-1 border-2 border-border shadow-neosm">Pricing</span> 💎
          </h1>
          <p className="text-xl font-bold opacity-80 mt-4">Upgrade to Premium and unlock unlimited cold emails.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 justify-center items-center mt-10">
        
        {/* Free Tier */}
        <div className="card-neo flex flex-col p-8 w-full max-w-sm bg-bw border-4 opacity-80 hover:opacity-100 transition-opacity">
          <h3 className="text-2xl font-black uppercase tracking-widest text-neo-blue mb-2">Starter</h3>
          <div className="text-5xl font-black mb-6">₹0<span className="text-xl font-bold opacity-60">/mo</span></div>
          
          <ul className="flex flex-col gap-4 mb-8 font-medium">
            <li className="flex items-center gap-2">✅ 10 AI-Generated Emails</li>
            <li className="flex items-center gap-2">✅ Basic Resume Parsing</li>
            <li className="flex items-center gap-2">✅ Web Dashboard</li>
            <li className="flex items-center gap-2 opacity-50">❌ Unlimited Emails</li>
            <li className="flex items-center gap-2 opacity-50">❌ Bulk Sending</li>
          </ul>

          <button className="btn-neo bg-gray-200 text-gray-500 cursor-not-allowed mt-auto" disabled>
            {user?.tier === 'free' ? 'Current Plan' : 'Free Tier'}
          </button>
        </div>

        {/* Premium Tier — Limited Offer */}
        <div className="card-neo flex flex-col p-8 w-full max-w-sm bg-bw border-4 shadow-neolg scale-105 relative overflow-hidden">
          {/* Offer ribbon */}
          <div className="absolute top-4 -right-10 bg-neo-red text-bw text-xs font-black uppercase tracking-wider px-10 py-1.5 rotate-45 border-2 border-border shadow-neosm">
            80% OFF
          </div>

          <div className="bg-neo-yellow text-text text-xs font-black uppercase tracking-widest px-3 py-1 self-start rounded-full border-2 border-border mb-4 -mt-4 -ml-4 shadow-neosm animate-pulse">
            🔥 Launch Offer
          </div>
          <h3 className="text-2xl font-black uppercase tracking-widest text-neo-purple mb-2">Premium</h3>
          
          {/* Price with strikethrough */}
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-2xl font-bold line-through opacity-40">₹499</span>
            <span className="text-5xl font-black text-neo-purple">₹99</span>
            <span className="text-xl font-bold opacity-60">/mo</span>
          </div>
          <p className="text-sm font-bold text-neo-red mb-6 flex items-center gap-1">
            ⏳ Limited period offer — price goes back to ₹499 soon!
          </p>
          
          <ul className="flex flex-col gap-4 mb-8 font-bold">
            <li className="flex items-center gap-2">🌟 Unlimited AI Emails</li>
            <li className="flex items-center gap-2">🌟 Bulk Email Generation</li>
            <li className="flex items-center gap-2">🌟 One-Click Bulk Sending</li>
            <li className="flex items-center gap-2">🌟 Priority Processing</li>
            <li className="flex items-center gap-2">🌟 Early Access to Features</li>
          </ul>

          <button 
            className="btn-neo btn-neo-green mt-auto py-4 text-xl" 
            onClick={handleSubscribe} 
            disabled={loading || user?.tier === 'premium'}
          >
            {loading ? 'Loading...' : user?.tier === 'premium' ? 'Active Subscription' : 'Get it for ₹99 🚀'}
          </button>
          <p className="text-center text-xs font-bold opacity-50 mt-2">Cancel anytime · No questions asked</p>
        </div>

      </div>
    </div>
  );
}
