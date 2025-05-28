import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { Home } from 'lucide-react';

const NotFound = () => {
  const { user } = useAuthStore();
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-500">404</h1>
        <h2 className="text-3xl font-bold mt-4 mb-2">Page not found</h2>
        <p className="text-gray-600 max-w-md mx-auto mb-8">
          We couldn't find the page you're looking for. The page might have been moved or doesn't exist.
        </p>
        
        <Link to={user ? '/' : '/login'}>
          <Button leftIcon={<Home size={16} />}>
            Back to {user ? 'Dashboard' : 'Login'}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;