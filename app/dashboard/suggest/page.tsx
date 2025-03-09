'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Lightbulb } from 'lucide-react';

export default function SuggestFeaturePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClientComponentClient();
      setSupabase(client);
    };
    
    initSupabase();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide both a title and description for your feature suggestion.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!supabase) {
      toast({
        title: 'Connection error',
        description: 'Unable to connect to the server. Please try again later.',
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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit suggestion');
      }
      
      toast({
        title: 'Suggestion submitted',
        description: 'Thank you for your feedback! We\'ll review your suggestion.',
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
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Suggest a Feature</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Have an idea for improving QuizLab AI? We'd love to hear it!
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
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
        
        <div className="bg-white rounded-lg shadow-md dark:bg-gray-800 p-6">
          <div className="flex items-center mb-4">
            <Lightbulb className="h-6 w-6 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold">How We Process Suggestions</h2>
          </div>
          
          <div className="space-y-4 text-gray-600 dark:text-gray-300">
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