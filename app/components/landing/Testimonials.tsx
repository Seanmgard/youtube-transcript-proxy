'use client';

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import Image from "next/image";

// Single testimonial from Rachel Locker
const testimonial = {
  content: "QuizLab AI has been an absolute game-changer for my studies. As a student in the class of 2026, I'm constantly juggling complex medical concepts, pharmacology, and clinical skills. The AI-generated quizzes help me identify knowledge gaps and reinforce critical information in a fraction of the time it would take to create study materials manually. The ability to instantly generate relevant questions has transformed my study routine.",
  author: "Rachel",
  role: "PA Student, Class of 2026",
  // Replace with the actual path to Rachel's photo once uploaded
  avatar: "/images/rachel-locker.jpg",
};

export function Testimonials() {
  return (
    <div id="testimonials" className="bg-gray-50 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">
            Testimonial
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Hear from our users
          </p>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            See how QuizLab AI is transforming the way students learn and prepare for their exams.
          </p>
        </div>
        
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, amount: 0.2 }}
            className="flex flex-col md:flex-row gap-8 items-center rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200"
          >
            <div className="flex-shrink-0">
              <Image
                src={testimonial.avatar}
                alt={testimonial.author}
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover"
              />
            </div>
            <div className="text-center md:text-left">
              <blockquote>
                <p className="text-xl font-semibold text-gray-900">
                  "{testimonial.content}"
                </p>
                <footer className="mt-4">
                  <p className="text-md text-indigo-600">
                    {testimonial.author}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {testimonial.role}
                  </p>
                </footer>
              </blockquote>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
} 