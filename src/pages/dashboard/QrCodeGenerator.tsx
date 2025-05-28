import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import Card, { CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import QrCode from '../../components/ui/QrCode';
import { QrCode as QrIcon, Link, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface QrCodeData {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

const QrCodeGenerator = () => {
  const { user } = useAuthStore();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [qrCodes, setQrCodes] = useState<QrCodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchQrCodes();
  }, []);

  const fetchQrCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('qr_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQrCodes(data || []);
    } catch (error) {
      console.error('Error fetching QR codes:', error);
      toast.error('Failed to load QR codes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!url || !name) {
      toast.error('Please provide both name and URL');
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase
        .from('qr_codes')
        .insert([{ name, url, user_id: user?.id }])
        .select()
        .single();

      if (error) throw error;

      setQrCodes([data, ...qrCodes]);
      toast.success('QR code created successfully');
      setUrl('');
      setName('');
    } catch (error: any) {
      console.error('Error generating QR code:', error);
      toast.error(error.message || 'Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('qr_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setQrCodes(qrCodes.filter(code => code.id !== id));
      toast.success('QR code deleted');
    } catch (error) {
      console.error('Error deleting QR code:', error);
      toast.error('Failed to delete QR code');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">QR Code Generator</h1>
        <Button onClick={() => setUrl('')} leftIcon={<Plus size={16} />}>
          Create New
        </Button>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Create New QR Code</CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Input
              label="QR Code Name"
              type="text"
              placeholder="Enter a name for your QR code"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<QrIcon size={16} />}
            />
            
            <Input
              label="Destination URL"
              type="url"
              placeholder="Enter the URL to encode"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              leftIcon={<Link size={16} />}
            />
            
            <Button
              onClick={handleGenerate}
              disabled={!url || !name || isGenerating}
              className="w-full"
              isLoading={isGenerating}
            >
              Generate QR Code
            </Button>
          </CardContent>
        </Card>
        
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center justify-center">
            {url ? (
              <QrCode 
                value={url}
                size={256}
                level="H"
                includeMargin
                className="text-center"
              />
            ) : (
              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center w-full max-w-sm">
                <p className="text-gray-500 text-center px-4">
                  Enter a URL to generate a QR code
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Code List */}
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-6">Your QR Codes</h2>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading QR codes...</p>
          </div>
        ) : qrCodes.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-600">No QR codes yet. Create your first one above!</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {qrCodes.map((code) => (
              <Card key={code.id} className="p-6">
                <CardContent>
                  <div className="mb-4">
                    <h3 className="font-semibold">{code.name}</h3>
                    <p className="text-sm text-gray-600 truncate">{code.url}</p>
                  </div>
                  
                  <QrCode
                    value={code.url}
                    size={200}
                    level="H"
                    includeMargin
                    className="mb-4"
                  />
                  
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-500">
                      Created: {new Date(code.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      className="text-error-500 hover:bg-error-50"
                      onClick={() => handleDelete(code.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QrCodeGenerator;