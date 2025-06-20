'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Lightbulb, AlertCircle } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';

export default function SuggestFeaturePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Check if user is authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: 'Authentication required',
        description: 'You must be logged in to submit a feature suggestion.',
        variant: 'destructive',
      });
      router.push('/auth/sign-in?returnTo=/dashboard/suggest');
    }
  }, [user, isLoading, toast, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You must be logged in to submit a feature suggestion.',
        variant: 'destructive',
      });
      router.push('/auth/sign-in?returnTo=/dashboard/suggest');
      return;
    }
    
    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide both a title and description for your feature suggestion.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Submit the feature suggestion to our API
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        
        // Handle authentication errors specifically
        if (response.status === 401) {
          toast({
            title: 'Authentication required',
            description: 'Your session may have expired. Please sign in again.',
            variant: 'destructive',
          });
          router.push('/auth/sign-in?returnTo=/dashboard/suggest');
          return;
        }
        
        throw new Error(data.error || 'Failed to submit suggestion');
      }
      
      const data = await response.json();
      
      toast({
        title: "💡 Feature Suggestion Submitted",
        description: "Thank you for your valuable feedback! We've received your suggestion and will review it with our product team.",
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 4000,
      });
      
      // Reset form
      setTitle('');
      setDescription('');
    } catch (error: any) {
      toast({
        title: 'Error submitting suggestion',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Don't render the form if user is not authenticated
  if (!user) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold mb-2">Suggest a Feature</h1>
          <p className="text-gray-600">
            Have an idea for improving QuizLab AI? We'd love to hear it!
          </p>
        </div>
        
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-800 font-medium">
                Authentication required
              </p>
              <p className="text-sm text-amber-700 mt-1">
                You must be logged in to submit a feature suggestion. Redirecting to login page...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Suggest a Feature</h1>
        <p className="text-gray-600">
          Have an idea for improving QuizLab AI? We'd love to hear it!
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Feature Title</Label>
              <Input 
                id="title" 
                placeholder="E.g., Multiple PDF Upload" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                placeholder="Please describe your feature idea in detail..." 
                className="min-h-[150px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
            </Button>
          </form>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Lightbulb className="h-6 w-6 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold">How We Process Suggestions</h2>
          </div>
          
          <div className="space-y-4 text-gray-600">
            <p>
              We review all feature suggestions on a regular basis and prioritize them based on:
            </p>
            
            <ul className="list-disc pl-5 space-y-2">
              <li>How many users have requested similar features</li>
              <li>Alignment with our product roadmap</li>
              <li>Technical feasibility and implementation time</li>
              <li>Potential impact on user experience</li>
            </ul>
            
            <p>
              While we can't implement every suggestion, your feedback is invaluable in helping us improve QuizLab AI.
            </p>
            
            <p>
              Thank you for taking the time to share your ideas with us!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 