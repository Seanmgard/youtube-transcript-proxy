'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CTA() {
  return (
    <div className="bg-indigo-600">
      <div className="px-6 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Transform your study materials today.
            <br />
            Start creating quizzes in seconds.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="mx-auto mt-4 max-w-xl text-lg leading-8 text-indigo-100"
          >
            Join thousands of students and educators who are revolutionizing their learning experience with QuizLab AI.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="mt-8 flex items-center justify-center gap-x-6"
          >
            <Link
              href="/auth/sign-up"
              className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get started for free
            </Link>
            <Link href="#features" className="text-sm font-semibold leading-6 text-white">
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
} 