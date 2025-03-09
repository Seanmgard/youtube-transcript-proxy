'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'How does QuizLab AI generate quizzes?',
    answer:
      'QuizLab AI uses advanced natural language processing to analyze your uploaded PDF study materials. Our AI identifies key concepts, facts, and relationships to create relevant quiz questions that test your understanding of the material.',
  },
  {
    question: 'What types of files can I upload?',
    answer:
      'Currently, QuizLab AI supports PDF files. We\'re working on adding support for more file formats like Word documents, PowerPoint presentations, and plain text files in the near future.',
  },
  {
    question: 'How accurate are the generated quizzes?',
    answer:
      'Our AI is trained to create high-quality questions based on the content of your study materials. While the accuracy is generally very high, we recommend reviewing the generated quizzes for any specific adjustments you might want to make. The more clear and structured your study materials are, the better the quiz quality will be.',
  },
  {
    question: 'Can I edit the generated quizzes?',
    answer:
      'Yes! After a quiz is generated, you can edit, add, or remove questions as needed. You have full control over the final quiz content before you use it for studying or share it with others.',
  },
  {
    question: 'Is there a limit to how many quizzes I can create?',
    answer:
      'Free accounts can create up to 10 quizzes per month. Pro accounts have unlimited quiz creation. Check our pricing page for more details on plan features.',
  },
  {
    question: 'How can I export my quizzes?',
    answer:
      'Depending on your plan, you can export quizzes in various formats including doc, csv, or Anki flashcards. This makes it easy to study using your preferred tools and methods.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes, we take data security very seriously. Your uploaded documents and generated quizzes are stored securely and are only accessible to you. We do not share your content with third parties or use it to train our AI models without explicit permission.',
  },
  {
    question: 'Can I use QuizLab AI for my classroom or institution?',
    answer:
      'Absolutely! For educational institutions, we offer special Enterprise plans with features like bulk user management and expanded question settings. Contact our sales team for more information.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div id="faq" className="bg-white dark:bg-gray-900 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">
            FAQ
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Frequently asked questions
          </p>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Find answers to common questions about QuizLab AI.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-2xl divide-y divide-gray-200 dark:divide-gray-700">
          {faqs.map((faq, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              viewport={{ once: true, amount: 0.1 }}
              className="py-6"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="flex w-full items-start justify-between text-left"
              >
                <span className="text-lg font-semibold leading-7 text-gray-900 dark:text-white">
                  {faq.question}
                </span>
                <span className="ml-6 flex h-7 items-center">
                  <ChevronDown
                    className={`h-6 w-6 transform text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </span>
              </button>
              {openIndex === index && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-2 pr-12"
                >
                  <p className="text-base leading-7 text-gray-600 dark:text-gray-300">
                    {faq.answer}
                  </p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
} 