'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function Contact() {
  console.log('Rendering Contact');
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
    submitted: false,
    loading: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState({ ...formState, loading: true });
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          company: formState.company,
          message: formState.message,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setFormState({
        ...formState,
        submitted: true,
        loading: false,
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to send message. Please try again later.');
      setFormState({ ...formState, loading: false });
    }
  };

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-grow bg-white pt-32 pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Contact our Enterprise team
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Learn how QuizLab AI can help your educational institution or organization.
            </p>
          </div>

          <div className="mx-auto max-w-2xl">
            {formState.submitted ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-xl bg-green-50 p-8 text-center"
              >
                <h2 className="text-xl font-semibold text-green-800 mb-4">
                  Thank you for your inquiry!
                </h2>
                <p className="text-green-700 mb-6">
                  We've received your message and will get back to you within 1-2 business days.
                </p>
                <Link href="/">
                  <Button>Return to Home</Button>
                </Link>
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                onSubmit={handleSubmit}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold leading-6 text-gray-900">
                      Name
                    </label>
                    <div className="mt-2.5">
                      <Input
                        type="text"
                        id="name"
                        value={formState.name}
                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold leading-6 text-gray-900">
                      Email
                    </label>
                    <div className="mt-2.5">
                      <Input
                        type="email"
                        id="email"
                        value={formState.email}
                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="company" className="block text-sm font-semibold leading-6 text-gray-900">
                      Company / Institution
                    </label>
                    <div className="mt-2.5">
                      <Input
                        type="text"
                        id="company"
                        value={formState.company}
                        onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="message" className="block text-sm font-semibold leading-6 text-gray-900">
                      Message
                    </label>
                    <div className="mt-2.5">
                      <Textarea
                        id="message"
                        rows={4}
                        value={formState.message}
                        onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                        required
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-10">
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={formState.loading}
                  >
                    {formState.loading ? 'Sending...' : 'Send message'}
                  </Button>
                </div>
              </motion.form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 