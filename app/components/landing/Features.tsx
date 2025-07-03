'use client';

import { motion } from "framer-motion";
import { FileText, Brain, BarChart3, Zap, Clock, Award } from "lucide-react";

const features = [
  {
    name: "Easy PDF Upload",
    description: "Simply upload your study materials in PDF format and let our AI do the rest.",
    icon: FileText,
    color: "bg-blue-100",
    textColor: "text-blue-600",
  },
  {
    name: "AI-Powered Generation",
    description: "Our advanced AI analyzes your content and creates relevant, challenging questions.",
    icon: Brain,
    color: "bg-purple-100",
    textColor: "text-purple-600",
  },
  {
    name: "Detailed Analytics",
    description: "Track your progress and identify areas for improvement with comprehensive analytics.",
    icon: BarChart3,
    color: "bg-green-100",
    textColor: "text-green-600",
  },
  {
    name: "Lightning Fast",
    description: "Generate quizzes in seconds, not minutes, so you can focus on learning.",
    icon: Zap,
    color: "bg-yellow-100",
    textColor: "text-yellow-600",
  },
  {
    name: "Time-Saving",
    description: "Save hours of manual quiz creation with our automated system.",
    icon: Clock,
    color: "bg-red-100",
    textColor: "text-red-600",
  },
  {
    name: "Multiple Export Formats",
    description: "Export your quizzes in various formats including DOC, CSV, and Anki flashcards.",
    icon: Award,
    color: "bg-indigo-100",
    textColor: "text-indigo-600",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function Features() {
  return (
    <div id="features" className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">
            Powerful Features
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to enhance your learning
          </p>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            Our platform offers a comprehensive set of tools designed to make studying more efficient and effective.
          </p>
        </div>
        <motion.div 
          className="mx-auto mt-10 sm:mt-12 lg:mt-16 lg:max-w-none"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-8 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <motion.div 
                key={feature.name} 
                className="relative pl-16"
                variants={item}
              >
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className={`absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg ${feature.color}`}>
                    <feature.icon className={`h-6 w-6 ${feature.textColor}`} aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  {feature.description}
                </dd>
              </motion.div>
            ))}
          </dl>
        </motion.div>
      </div>
    </div>
  );
} 