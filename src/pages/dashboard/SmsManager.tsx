import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Eye, 
  Calendar, 
  Send, 
  Upload, 
  Users, 
  MessageSquare,
  Save,
  FileSpreadsheet,
  Clock,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface ContactGroup {
  id: string;
  name: string;
  count: number;
}

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
}

interface SmsCampaign {
  id: string;
  name: string;
  content: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  recipients: number;
  scheduled_date?: string;
  sent_date?: string;
  created_at: string;
}

const SmsManager = () => {
  const { user } = useAuthStore();
  const [isFreeTier, setIsFreeTier] = useState(true); // This should be determined by user's subscription
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedCampaign, setSelectedCampaign] = useState<SmsCampaign | null>(null);
  
  // Sample data
  const [contacts, setContacts] = useState<Contact[]>([
    { id: '1', name: 'John Doe', phone: '+15551234567' },
    { id: '2', name: 'Jane Smith', phone: '+15559876543' },
    { id: '3', name: 'Mike Johnson', phone: '+15552223333' },
    { id: '4', name: 'Sarah Williams', phone: '+15554445555' },
  ]);
  
  const [groups, setGroups] = useState<ContactGroup[]>([
    { id: '1', name: 'All Customers', count: 50 },
    { id: '2', name: 'VIP Customers', count: 15 },
    { id: '3', name: 'New Customers', count: 23 },
  ]);
  
  const [templates, setTemplates] = useState<SmsTemplate[]>([
    { 
      id: '1', 
      name: 'Welcome Message', 
      content: 'Welcome to {{business_name}}! Thank you for signing up. Reply STOP to opt out of future messages.' 
    },
    { 
      id: '2', 
      name: 'Special Offer', 
      content: '{{business_name}}: Use code SPECIAL20 for 20% off your next purchase! Valid until {{expiry_date}}. Reply STOP to opt out.' 
    },
    { 
      id: '3', 
      name: 'Appointment Reminder', 
      content: 'Reminder: Your appointment with {{business_name}} is scheduled for {{appointment_date}} at {{appointment_time}}. Reply C to cancel.' 
    },
  ]);
  
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([
    { 
      id: '1', 
      name: 'Weekly Newsletter', 
      content: 'Business Vibez: Check out our new summer collection! Shop now at example.com/summer. Reply STOP to opt out.',
      status: 'sent',
      recipients: 48,
      sent_date: '2025-03-15T10:30:00Z',
      created_at: '2025-03-14T14:30:00Z',
    },
    { 
      id: '2', 
      name: 'Flash Sale Alert', 
      content: 'Business Vibez: FLASH SALE! 24 hours only - 30% off everything! Shop now at example.com/flash. Reply STOP to opt out.',
      status: 'scheduled',
      recipients: 50,
      scheduled_date: '2025-03-25T09:00:00Z',
      created_at: '2025-03-20T16:45:00Z',
    },
    { 
      id: '3', 
      name: 'VIP Customer Appreciation', 
      content: 'Business Vibez: As a valued VIP customer, enjoy an exclusive 25% discount on your next purchase. Use code VIP25 at checkout!',
      status: 'draft',
      recipients: 15,
      created_at: '2025-03-22T11:20:00Z',
    },
  ]);

  if (isFreeTier) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Card className="max-w-md w-full text-center p-8">
          <CardContent className="space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold">SMS Feature Locked</h2>
            <p className="text-gray-600">
              SMS messaging is only available with our Pro plan. Upgrade now to unlock this feature and get 1000 SMS credits per month.
            </p>
            <Button 
              variant="primary"
              className="mt-4"
              onClick={() => toast.info('Upgrade functionality coming soon')}
            >
              Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {viewMode === 'list' && renderCampaignList()}
      {viewMode === 'detail' && renderCampaignDetail()}
      {viewMode === 'create' && renderCampaignCreator()}
    </div>
  );
};

export default SmsManager;