import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { 
  Zap, 
  Home, 
  Palette, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Bell,
  User
} from 'lucide-react';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const DashboardLayout = () => {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      // If there's an error but it's just the session not found error,
      // we can still proceed with client-side logout
      if (error && (
        error.message.includes("session_not_found") || 
        error.message.includes("Session from session_id claim in JWT does not exist")
      )) {
        console.log('Session already expired or not found, proceeding with client-side logout');
      } else if (error) {
        // For any other errors, throw to be caught by catch block
        throw error;
      }
      
      // Always clear local user state and redirect
      setUser(null);
      navigate('/login');
      toast.success('Successfully signed out');
    } catch (error) {
      toast.error('Error signing out');
      console.error('Error signing out:', error);
    }
  };
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  const navItems = [
    { to: '/', icon: <Home size={20} />, label: 'Dashboard' },
    { to: '/ad-builder', icon: <Palette size={20} />, label: 'Ad Builder' },
    { to: '/sms-manager', icon: <MessageSquare size={20} />, label: 'SMS Manager' },
  ];
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo and mobile menu button */}
            <div className="flex items-center">
              <button 
                type="button" 
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
                onClick={toggleMenu}
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              
              <div className="flex items-center ml-4 md:ml-0">
                <div className="bg-primary-500 text-white p-1 rounded-md mr-2">
                  <Zap size={20} />
                </div>
                <span className="font-bold text-gray-900">Business Vibez</span>
              </div>
            </div>
            
            {/* User navigation */}
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none">
                <Bell size={20} />
              </button>
              
              <div className="relative">
                <button className="flex items-center space-x-2 p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none">
                  <div className="bg-gray-200 rounded-full p-1">
                    <User size={20} />
                  </div>
                  <span className="hidden md:block text-sm font-medium">{user?.email?.split('@')[0]}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex flex-1">
        {/* Sidebar navigation */}
        <aside className={`
          fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-gray-200 pt-16 transform transition-transform duration-300 ease-in-out
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:h-auto
        `}>
          <div className="h-full flex flex-col justify-between p-4">
            <nav className="space-y-1 mt-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `
                    flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors
                    ${isActive 
                      ? 'bg-primary-50 text-primary-500' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
                  `}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            
            <div className="space-y-2">
              <NavLink
                to="/settings"
                className="flex items-center px-4 py-3 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <Settings size={20} className="mr-3" />
                Settings
              </NavLink>
              
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <LogOut size={20} className="mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>
        
        {/* Overlay for mobile */}
        {isMenuOpen && (
          <div 
            className="fixed inset-0 z-10 bg-gray-600 bg-opacity-50 md:hidden"
            onClick={toggleMenu}
          ></div>
        )}
        
        {/* Main content */}
        <main className="flex-1 py-6 px-4 sm:px-6 md:px-8">
          <div className="container-custom mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;