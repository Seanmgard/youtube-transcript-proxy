'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { DatabaseIcon, Users, Settings, CreditCard, ShieldCheck } from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();

  const adminTools = [
    {
      title: 'Database Schema',
      description: 'Update the database schema to add necessary fields for new features.',
      icon: <DatabaseIcon className="h-8 w-8 text-primary" />,
      path: '/dashboard/admin/update-schema',
      buttonText: 'Update Schema'
    },
    {
      title: 'Subscription Migration',
      description: 'Create free subscription records for existing users who don\'t have one.',
      icon: <CreditCard className="h-8 w-8 text-primary" />,
      path: '/dashboard/admin/migrate-subscriptions',
      buttonText: 'Migrate Subscriptions'
    },
    {
      title: 'Ensure Subscriptions',
      description: 'Ensure all users have a valid subscription record by creating free subscriptions for any users who don\'t have one.',
      icon: <ShieldCheck className="h-8 w-8 text-primary" />,
      path: '/dashboard/admin/ensure-subscriptions',
      buttonText: 'Ensure Subscriptions'
    },
    {
      title: 'User Management',
      description: 'Manage users, roles, and permissions.',
      icon: <Users className="h-8 w-8 text-primary" />,
      path: '/dashboard/admin/users',
      buttonText: 'Manage Users',
      disabled: true
    },
    {
      title: 'System Settings',
      description: 'Configure system-wide settings and preferences.',
      icon: <Settings className="h-8 w-8 text-primary" />,
      path: '/dashboard/admin/settings',
      buttonText: 'System Settings',
      disabled: true
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-700 mb-6">
          Welcome to the admin dashboard. Here you can manage users, subscriptions, and other system settings.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {adminTools.map((tool) => (
          <Card key={tool.title} className={tool.disabled ? 'opacity-60' : ''}>
            <CardHeader className="flex flex-row items-center gap-4">
              {tool.icon}
              <div>
                <CardTitle>{tool.title}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </div>
            </CardHeader>
            <CardFooter>
              <Button 
                onClick={() => router.push(tool.path)} 
                disabled={tool.disabled}
                className="w-full"
              >
                {tool.buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Button 
          variant="outline" 
          onClick={() => router.push('/dashboard/subscription')}
        >
          Back to Subscriptions
        </Button>
      </div>
    </div>
  );
} 