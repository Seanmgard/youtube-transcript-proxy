'use client';

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import Image from "next/image";

// Single testimonial from Rachel Locker
const testimonial = {
  content: "QuizLab AI has been an absolute game-changer for my studies. As a student in the class of 2026, I'm constantly juggling complex medical concepts, pharmacology, and clinical skills. The AI-generated quizzes help me identify knowledge gaps and reinforce critical information in a fraction of the time it would take to create study materials manually. The ability to instantly generate relevant questions has transformed my study routine.",
  author: "Rachel Locker",
  role: "PA Student, Class of 2026",
  // Replace with the actual path to Rachel's photo once uploaded
  avatar: "/images/rachel-locker.jpg",
};

export function Testimonials() {
  return (
    <div id="testimonials" className="bg-gray-50 dark:bg-gray-800 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">
            Testimonial
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Hear from our users
          </p>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            See how QuizLab AI is transforming the way students learn and prepare for their exams.
          </p>
        </div>
        
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, amount: 0.2 }}
            className="flex flex-col md:flex-row gap-8 items-center rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"
          >
            <div className="w-full md:w-1/3 flex flex-col items-center">
              <div className="relative w-48 h-48 rounded-full overflow-hidden mb-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.author}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {testimonial.author}
                </p>
                <p className="text-md text-indigo-600 dark:text-indigo-400">
                  {testimonial.role}
                </p>
                <div className="flex justify-center items-center space-x-1 text-yellow-400 mt-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-current" />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-2/3">
              <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 italic">
                "{testimonial.content}"
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
} 