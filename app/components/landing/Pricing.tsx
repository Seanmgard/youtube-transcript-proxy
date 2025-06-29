'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type FrequencyType = 'monthly' | 'annually';

const tiers = [
  {
    name: 'Free',
    id: 'tier-free',
    price: { monthly: '$0', annually: '$0' },
    description: 'Perfect for students just getting started with quiz generation.',
    features: [
      '10 PDF uploads per month',
      'Up to 10 questions per quiz',
      'Basic analytics',
      'Export to doc',
      'Community support',
    ],
    cta: 'Get Started',
    mostPopular: false,
    availableOn: ['monthly'],
  },
  {
    name: 'Pro',
    id: 'tier-pro',
    price: { monthly: '$4', annually: '$40' },
    description: 'Less than your daily coffee ☕ - unlock unlimited learning potential for serious students and educators.',
    features: [
      'Unlimited PDF uploads',
      'Up to 50 questions per quiz',
      'Advanced analytics',
      'Export to doc, csv, and Anki',
      'Priority support',
      'Custom question types',
      'Flashcard learning portal',
    ],
    cta: 'Start Free Trial',
    mostPopular: true,
    availableOn: ['monthly', 'annually'],
  },
];

export function Pricing() {
  const [frequency, setFrequency] = useState<FrequencyType>('monthly');

  // Filter tiers based on current frequency
  const visibleTiers = tiers.filter(tier => 
    tier.availableOn.includes(frequency)
  );

  return (
    <div id="pricing" className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">
            Pricing
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple, transparent pricing
          </p>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            Choose the plan that's right for you and start generating quizzes today.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="grid grid-cols-2 gap-x-1 rounded-full p-1 text-center text-xs font-semibold leading-5 bg-gray-100">
            <button
              type="button"
              className={`rounded-full px-4 py-2 ${
                frequency === 'monthly'
                  ? 'bg-white shadow'
                  : 'text-gray-500'
              }`}
              onClick={() => setFrequency('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 ${
                frequency === 'annually'
                  ? 'bg-white shadow'
                  : 'text-gray-500'
              }`}
              onClick={() => setFrequency('annually')}
            >
              Annually <span className="text-indigo-600">(Save 15%)</span>
            </button>
          </div>
        </div>

        <div className="flex justify-center mt-16">
          <div className={`${frequency === 'monthly' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl' : 'flex justify-center max-w-md'}`}>
            {visibleTiers.map((tier, tierIdx) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: tierIdx * 0.1 }}
                viewport={{ once: true, amount: 0.2 }}
                className={`relative flex flex-col rounded-2xl ${
                  tier.mostPopular
                    ? 'z-10 bg-white shadow-xl ring-1 ring-gray-900/10 lg:scale-105'
                    : 'bg-gray-50 lg:mt-8'
                } p-8 w-full`}
              >
                {tier.mostPopular ? (
                  <div className="absolute -top-4 right-8 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white">
                    Most popular
                  </div>
                ) : null}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold leading-8 text-gray-900">
                    {tier.name}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    {tier.description}
                  </p>
                  <p className="mt-6 flex items-baseline gap-x-1">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">
                      {tier.price[frequency]}
                    </span>
                    {tier.price[frequency] !== 'Custom' && (
                      <span className="text-sm font-semibold leading-6 text-gray-600">
                        {frequency === 'monthly' ? '/month' : '/year'}
                      </span>
                    )}
                  </p>
                  <Link
                    href="/auth/sign-up"
                    className={`mt-6 block w-full rounded-md py-2 px-3 text-center text-sm font-semibold leading-6 ${
                      tier.mostPopular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                        : 'bg-white text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300'
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
                <div className="mt-2 flex flex-1 flex-col justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      What's included:
                    </p>
                    <ul className="mt-6 space-y-3 text-sm leading-6 text-gray-600">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex gap-x-3">
                          <Check
                            className="h-5 w-5 flex-none text-indigo-600"
                            aria-hidden="true"
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 