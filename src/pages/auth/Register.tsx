import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Mail, Lock, User, Building, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const Register = () => {
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<'free' | 'pro'>('free');
  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      description: '14-day trial',
      features: [
        '1 QR code',
        '1 ad space',
        'SMS (Pro only)',
      ],
    },
    {
      name: 'Pro',
      price: '$29',
      description: 'For growing businesses',
      features: [
        'Unlimited QR codes',
        'Unlimited ad spaces',
        '1000 SMS credits/month',
        'Priority support',
        'Custom branding',
        'Advanced analytics',
        'API access',
      ],
    },
  ];
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
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
    
    if (!formData.fullName) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!formData.businessName) {
      newErrors.businessName = 'Business name is required';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Sign up the user with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            business_name: formData.businessName,
          },
        },
      });
      
      if (signUpError) throw signUpError;
      
      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // Create the profile using RPC to ensure proper transaction handling
      const { error: rpcError } = await supabase.rpc('create_user_profile', {
        user_id: authData.user.id,
        business_name: formData.businessName,
        subscription_tier: selectedTier
      });

      if (rpcError) throw rpcError;
      
      toast.success('Registration successful! Please check your email to verify your account.');
      navigate('/login');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed');
      setErrors({
        auth: error.message || 'Failed to create account',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose your plan</h2>
        <p className="text-sm text-gray-600 mt-1">Select a plan that works for you</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier) => (
          <div
            key={tier.name.toLowerCase()}
            className={`
              relative rounded-xl border-2 p-6 cursor-pointer transition-all
              ${selectedTier === tier.name.toLowerCase()
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
            onClick={() => setSelectedTier(tier.name.toLowerCase() as 'free' | 'pro')}
          >
            {selectedTier === tier.name.toLowerCase() && (
              <div className="absolute top-4 right-4 h-6 w-6 text-primary-500">
                <Check />
              </div>
            )}
            
            <h3 className="text-lg font-semibold">{tier.name}</h3>
            <div className="mt-2">
              <span className="text-2xl font-bold">{tier.price}</span>
              {tier.name === 'Pro' && <span className="text-sm text-gray-600">/month</span>}
            </div>
            <p className="text-sm text-gray-600 mt-2">{tier.description}</p>
            
            <ul className="mt-4 space-y-2">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center text-sm">
                  <Check size={16} className="text-primary-500 mr-2" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          placeholder="John Doe"
          leftIcon={<User size={16} />}
          error={errors.fullName}
        />
        
        <Input
          label="Business Name"
          type="text"
          name="businessName"
          value={formData.businessName}
          onChange={handleChange}
          placeholder="Acme Inc."
          leftIcon={<Building size={16} />}
          error={errors.businessName}
        />
        
        <Input
          label="Email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          leftIcon={<Mail size={16} />}
          error={errors.email}
        />
        
        <Input
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          leftIcon={<Lock size={16} />}
          error={errors.password}
        />
        
        <Input
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="••••••••"
          leftIcon={<Lock size={16} />}
          error={errors.confirmPassword}
        />
        
        {errors.auth && (
          <div className="text-error-500 text-sm">{errors.auth}</div>
        )}
        
        <div className="flex items-center">
          <input
            id="terms"
            name="terms"
            type="checkbox"
            required
            className="h-4 w-4 text-primary-500 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
            I agree to the{' '}
            <Link to="#" className="text-primary-500 hover:text-primary-600">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="#" className="text-primary-500 hover:text-primary-600">
              Privacy Policy
            </Link>
          </label>
        </div>
        
        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
        >
          Create Account
        </Button>
      </form>
      
      <p className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-500 hover:text-primary-600">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default Register;