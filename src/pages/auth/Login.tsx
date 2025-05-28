import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear errors when user types
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('Successfully logged in');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
      setErrors({
        auth: error.message || 'Invalid credentials',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
      <p className="text-gray-600 mb-6">Sign in to your account to continue</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          id="email"
          placeholder="your@email.com"
          value={formData.email}
          onChange={handleChange}
          leftIcon={<Mail size={16} />}
          error={errors.email}
          required
        />
        
        <Input
          label="Password"
          type="password"
          name="password"
          id="password"
          placeholder="••••••••"
          value={formData.password}
          onChange={handleChange}
          leftIcon={<Lock size={16} />}
          error={errors.password}
          required
        />
        
        {errors.auth && (
          <div className="text-error-500 text-sm">{errors.auth}</div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-primary-500 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
              Remember me
            </label>
          </div>
          
          <div className="text-sm">
            <a href="#" className="font-medium text-primary-500 hover:text-primary-600">
              Forgot password?
            </a>
          </div>
        </div>
        
        <Button
          type="submit"
          className="w-full mt-6"
          isLoading={isLoading}
        >
          Sign In
        </Button>
      </form>
      
      <p className="mt-6 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-primary-500 hover:text-primary-600">
          Sign up now
        </Link>
      </p>
    </div>
  );
};

export default Login;