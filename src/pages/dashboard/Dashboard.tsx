import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import Card, { CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { 
  Zap, 
  Home, 
  Palette, 
  MessageSquare, 
  TrendingUp, 
  Users, 
  BarChart3, 
  Eye,
  Plus,
  Crown,
  Lock,
  Check,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  adDesigns: number;
  smsMessages: number;
}

interface UserSubscription {
  tier: {
    name: string;
    features: string[];
  };
  status: string;
  current_period_end: string;
}

interface UsageLimits {
  sms_count: number;
  api_calls_count: number;
  reset_date: string;
}

interface UserProfile {
  business_name: string;
}

const Dashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    adDesigns: 0,
    smsMessages: 0,
  });
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: '',
  });
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch profile info
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('business_name')
          .eq('id', user?.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile error:', profileError);
          // Continue with other fetches even if this one fails
        } else if (profileData) {
          setProfile(profileData);
        }

        // Fetch subscription info
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .select(`
            status,
            current_period_end,
            tier_id (
              name,
              features
            )
          `)
          .eq('user_id', user?.id)
          .maybeSingle();

        if (subscriptionError) {
          console.error('Subscription error:', subscriptionError);
          // Continue with other fetches even if this one fails
        } else if (subscriptionData) {
          setSubscription({
            tier: {
              name: subscriptionData.tier_id?.name || 'Free',
              features: subscriptionData.tier_id?.features || []
            },
            status: subscriptionData.status || 'active',
            current_period_end: subscriptionData.current_period_end || new Date().toISOString()
          });
        }

        // Fetch usage limits
        const { data: limitsData, error: limitsError } = await supabase
          .from('user_usage_limits')
          .select('*')
          .eq('user_id', user?.id)
          .maybeSingle();

        if (limitsError) {
          console.error('Usage limits error:', limitsError);
          // Continue with other fetches even if this one fails
        } else if (limitsData) {
          setUsageLimits(limitsData);
        }

        // Fetch ad designs count
        const { count: adCount, error: adError } = await supabase
          .from('ad_designs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user?.id);

        if (adError) {
          console.error('Ad designs count error:', adError);
        } else {
          setStats(prev => ({
            ...prev,
            adDesigns: adCount || 0
          }));
        }

        // Set default values if we couldn't fetch real data
        if (!profile) {
          setProfile({ business_name: 'Your Business' });
        }
        
        if (!subscription) {
          setSubscription({
            tier: {
              name: 'Free',
              features: []
            },
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          });
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load some dashboard data');
        
        // Set default values for a better user experience even when errors occur
        if (!profile) {
          setProfile({ business_name: 'Your Business' });
        }
        
        if (!subscription) {
          setSubscription({
            tier: {
              name: 'Free',
              features: []
            },
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      fetchDashboardData();
    }
  }, [user]);
  
  const isPro = subscription?.tier.name === 'Pro';

  const handleUpgrade = async () => {
    setShowUpgradeModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpgrading(true);

    try {
      // Validate form
      if (!paymentForm.cardNumber || !paymentForm.expiry || !paymentForm.cvc || !paymentForm.name) {
        throw new Error('Please fill in all payment details');
      }

      // Get the Pro tier ID
      const { data: tierData, error: tierError } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', 'Pro')
        .single();

      if (tierError) throw tierError;

      // Update the subscription
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          tier_id: tierData.id,
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      // Update local state
      setSubscription(prev => prev ? {
        ...prev,
        tier: {
          name: 'Pro',
          features: [
            "Unlimited ad spaces",
            "1000 SMS credits/month",
            "Priority support",
            "Custom branding",
            "Advanced analytics",
            "API access"
          ]
        }
      } : null);

      toast.success('Successfully upgraded to Pro!');
      setShowUpgradeModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to process payment');
    } finally {
      setIsUpgrading(false);
    }
  };
  
  // Feature cards for the dashboard
  const features = [
    {
      title: 'Ad Builder',
      description: 'Design beautiful ads with AI-powered assistance',
      icon: <Palette size={24} className="text-accent-500" />,
      stat: stats.adDesigns,
      statLabel: 'Ad designs',
      linkTo: '/ad-builder',
      color: 'bg-accent-50 border-accent-200',
      limit: isPro ? '∞' : '1',
      current: stats.adDesigns
    },
    {
      title: 'SMS Manager',
      description: 'Create and schedule SMS campaigns',
      icon: <MessageSquare size={24} className="text-secondary-500" />,
      stat: stats.smsMessages,
      statLabel: 'Messages sent',
      linkTo: '/sms-manager',
      color: 'bg-secondary-50 border-secondary-200',
      limit: isPro ? '1000' : '0',
      current: stats.smsMessages,
      proOnly: !isPro
    },
  ];
  
  // Analytics cards
  const analytics = [
    {
      title: 'Visitors',
      value: '2,543',
      change: '+12.5%',
      isPositive: true,
      icon: <Eye size={20} />,
    },
    {
      title: 'Engagement',
      value: '45.8%',
      change: '+3.2%',
      isPositive: true,
      icon: <TrendingUp size={20} />,
    },
    {
      title: 'Audience',
      value: '1,204',
      change: '+28.4%',
      isPositive: true,
      icon: <Users size={20} />,
    },
    {
      title: 'Conversions',
      value: '3.8%',
      change: '-0.5%',
      isPositive: false,
      icon: <BarChart3 size={20} />,
    },
  ];
  
  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {profile?.business_name}</h1>
          <p className="text-gray-600 mt-1">
            Here's what's happening with your marketing today.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-4">
          {!isPro && (
            <Button 
              variant="outline"
              onClick={handleUpgrade}
              leftIcon={<Crown size={16} className="text-primary-500" />}
              isLoading={isUpgrading}
            >
              Upgrade to Pro
            </Button>
          )}
          <Button 
            variant="primary" 
            rightIcon={<Plus size={16} />}
          >
            New Campaign
          </Button>
        </div>
      </div>
      
      {/* Subscription status */}
      {subscription && (
        <Card className={isPro ? 'bg-primary-50 border-primary-200' : 'bg-gray-50'}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              {isPro ? (
                <Crown size={24} className="text-primary-500" />
              ) : (
                <Lock size={24} className="text-gray-400" />
              )}
              <div>
                <h3 className="font-semibold">
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </h3>
                <p className="text-sm text-gray-600">
                  {isPro 
                    ? `Your subscription renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : 'Upgrade to unlock all features'}
                </p>
              </div>
            </div>
            {usageLimits && (
              <div className="text-sm text-gray-600">
                Next reset: {new Date(usageLimits.reset_date).toLocaleDateString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature) => (
          <Card key={feature.title} className={`border ${feature.color} transition-all hover:shadow-md`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                {feature.icon}
                <div className="text-right">
                  <span className="text-2xl font-bold">{feature.stat}</span>
                  <span className="text-sm text-gray-500 ml-1">/ {feature.limit}</span>
                </div>
              </div>
              <CardTitle className="mt-3">{feature.title}</CardTitle>
              <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">{feature.statLabel}</span>
                <Link to={feature.linkTo}>
                  <Button 
                    variant={feature.proOnly ? "outline" : "primary"} 
                    size="sm"
                    leftIcon={feature.proOnly ? <Lock size={14} /> : undefined}
                  >
                    {feature.proOnly ? 'Pro Feature' : 'Manage'}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Analytics section */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Analytics Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {analytics.map((item) => (
            <Card key={item.title} className="bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{item.title}</p>
                  <p className="text-2xl font-bold mt-1">{item.value}</p>
                </div>
                <div className={`p-3 rounded-full ${
                  item.title === 'Visitors' ? 'bg-blue-100 text-blue-600' :
                  item.title === 'Engagement' ? 'bg-green-100 text-green-600' :
                  item.title === 'Audience' ? 'bg-purple-100 text-purple-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {item.icon}
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-sm ${item.isPositive ? 'text-success-500' : 'text-error-500'}`}>
                  {item.change}
                </span>
                <span className="text-sm text-gray-500 ml-1">vs last month</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      {/* Recent activity */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <Card>
          <CardContent>
            <div className="space-y-4">
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-accent-100 text-accent-500 mr-3">
                    <Palette size={16} />
                  </div>
                  <div>
                    <p className="font-medium">New Ad Design Created</p>
                    <p className="text-sm text-gray-500">Summer Sale Campaign</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-gray-500">2 hours ago</p>
                  </div>
                </div>
              </div>
              <div className="pb-4">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-secondary-100 text-secondary-500 mr-3">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <p className="font-medium">SMS Campaign Sent</p>
                    <p className="text-sm text-gray-500">Weekly Newsletter</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-gray-500">3 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Modal */}
      <Modal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade to Pro"
        size="lg"
      >
        <div className="space-y-6">
          <div className="text-center">
            <Crown size={40} className="text-primary-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Unlock Premium Features</h2>
            <p className="text-gray-600 mt-2">
              Get access to all premium features and take your business to the next level
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Pro Plan Includes:</h3>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check size={20} className="text-success-500 mr-2" />
                  <span>Unlimited ad spaces</span>
                </li>
                <li className="flex items-center">
                  <Check size={20} className="text-success-500 mr-2" />
                  <span>1000 SMS credits/month</span>
                </li>
                <li className="flex items-center">
                  <Check size={20} className="text-success-500 mr-2" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center">
                  <Check size={20} className="text-success-500 mr-2" />
                  <span>Custom branding</span>
                </li>
                <li className="flex items-center">
                  <Check size={20} className="text-success-500 mr-2" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-center">
                  <Check size={20} className="text-success-500 mr-2" />
                  <span>API access</span>
                </li>
              </ul>

              <div className="mt-6">
                <div className="text-3xl font-bold">$29<span className="text-lg text-gray-500">/month</span></div>
                <p className="text-sm text-gray-500">Cancel anytime • 30-day money-back guarantee</p>
              </div>
            </div>

            <div>
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <Input
                  label="Card Number"
                  type="text"
                  value={paymentForm.cardNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, cardNumber: e.target.value })}
                  placeholder="1234 5678 9012 3456"
                  leftIcon={<CreditCard size={16} />}
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Expiry Date"
                    type="text"
                    value={paymentForm.expiry}
                    onChange={(e) => setPaymentForm({ ...paymentForm, expiry: e.target.value })}
                    placeholder="MM/YY"
                    required
                  />

                  <Input
                    label="CVC"
                    type="text"
                    value={paymentForm.cvc}
                    onChange={(e) => setPaymentForm({ ...paymentForm, cvc: e.target.value })}
                    placeholder="123"
                    required
                  />
                </div>

                <Input
                  label="Name on Card"
                  type="text"
                  value={paymentForm.name}
                  onChange={(e) => setPaymentForm({ ...paymentForm, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />

                <Button
                  type="submit"
                  className="w-full mt-6"
                  isLoading={isUpgrading}
                >
                  Upgrade Now
                </Button>
              </form>

              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">
                  By upgrading, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;