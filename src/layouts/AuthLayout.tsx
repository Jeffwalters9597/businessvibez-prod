import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Zap } from 'lucide-react';

const AuthLayout = () => {
  const { user } = useAuthStore();
  
  // If user is already logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center p-8 bg-white">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center mb-8">
            <div className="bg-primary-500 text-white p-2 rounded-md mr-3">
              <Zap size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Business Vibez</h1>
          </div>
          
          <Outlet />
        </div>
      </div>
      
      {/* Right side - Image and text */}
      <div className="hidden md:flex md:w-1/2 bg-primary-500 p-12 flex-col justify-between">
        <div className="text-white">
          <h2 className="text-3xl font-bold mb-2">Amplify Your Business Presence</h2>
          <p className="text-primary-100">The all-in-one marketing solution for modern businesses.</p>
        </div>
        
        <div className="space-y-8">
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-2">QR Code Generator</h3>
            <p className="text-primary-100">Create custom QR codes for your promotions, menus, and more.</p>
          </div>
          
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-2">Visual Ad Builder</h3>
            <p className="text-primary-100">Design professional ads with AI-powered copy suggestions.</p>
          </div>
          
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-2">SMS Campaign Manager</h3>
            <p className="text-primary-100">Reach your customers directly with targeted SMS campaigns.</p>
          </div>
        </div>
        
        <p className="text-primary-100 text-sm">© 2025 Business Vibez Marketing. All rights reserved.</p>
      </div>
    </div>
  );
};

export default AuthLayout;