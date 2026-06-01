import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { post } from '../utils/api';
import { useToast } from '../components/Toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await post('/api/auth/login', { email, password });
      login(res.token, res.user);
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card-neo bg-bw border-4 p-8 w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-5xl font-black mb-2 tracking-tighter">
            <span className="bg-neo-blue text-bw px-2 inline-block -rotate-2 border-2 border-border shadow-neosm">Chills</span> ❄️
          </h1>
          <p className="font-bold opacity-70 mt-2 text-sm uppercase tracking-widest">Sign in to your account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-1">
            <label className="font-black uppercase tracking-widest text-xs opacity-70">Email</label>
            <input
              type="email"
              className="input-neo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-black uppercase tracking-widest text-xs opacity-70">Password</label>
            <input
              type="password"
              className="input-neo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-neo btn-neo-green w-full mt-4 text-lg py-3" disabled={loading}>
            {loading ? 'Logging in...' : 'Sign In 🚀'}
          </button>
        </form>

        <p className="text-center font-bold text-sm mt-4">
          Don't have an account? <Link to="/register" className="text-neo-blue hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
