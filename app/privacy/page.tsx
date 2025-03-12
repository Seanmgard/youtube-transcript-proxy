import Link from 'next/link';

export default function PrivacyPage() {
  console.log('Rendering PrivacyPage');
  return (
    <div className="container mx-auto px-4 py-24 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="prose prose-lg dark:prose-invert">
        <p className="text-lg mb-6">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introduction</h2>
        <p>
          At QuizLab AI, we respect your privacy and are committed to protecting your personal data. 
          This Privacy Policy explains how we collect, use, and safeguard your information when you use our service.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">2. Information We Collect</h2>
        <p>
          We collect several types of information from and about users of our website, including:
        </p>
        <ul className="list-disc pl-6 mb-6">
          <li>Personal identifiers such as name and email address</li>
          <li>Account credentials</li>
          <li>Payment information (processed securely through Stripe)</li>
          <li>Usage data and analytics</li>
          <li>Content you upload to our service</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">3. How We Use Your Information</h2>
        <p>
          We use the information we collect about you for various purposes, including:
        </p>
        <ul className="list-disc pl-6 mb-6">
          <li>Providing and maintaining our service</li>
          <li>Processing your payments and subscriptions</li>
          <li>Notifying you about changes to our service</li>
          <li>Providing customer support</li>
          <li>Analyzing usage to improve our service</li>
          <li>Detecting and preventing fraudulent activity</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">4. Data Storage and Security</h2>
        <p>
          We use Supabase for secure data storage and authentication. Your data is stored securely and 
          protected using industry-standard encryption and security practices. We regularly review our 
          systems to ensure your data remains protected.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">5. Third-Party Services</h2>
        <p>
          We use third-party services such as Stripe for payment processing and may use analytics 
          services to help us understand how users interact with our service. These third parties 
          have their own privacy policies addressing how they use your information.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">6. Your Data Protection Rights</h2>
        <p>
          Depending on your location, you may have certain rights regarding your personal data, including:
        </p>
        <ul className="list-disc pl-6 mb-6">
          <li>The right to access your personal data</li>
          <li>The right to rectification of inaccurate data</li>
          <li>The right to erasure of your data</li>
          <li>The right to restrict processing of your data</li>
          <li>The right to data portability</li>
          <li>The right to object to processing of your data</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">7. Cookies and Tracking</h2>
        <p>
          We use cookies and similar tracking technologies to track activity on our service and 
          hold certain information. You can instruct your browser to refuse all cookies or to 
          indicate when a cookie is being sent.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">8. Children's Privacy</h2>
        <p>
          Our service is not intended for use by children under the age of 13. We do not knowingly 
          collect personal information from children under 13. If we become aware that we have 
          collected personal data from children without verification of parental consent, we take 
          steps to remove that information from our servers.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">9. Changes to This Privacy Policy</h2>
        <p>
          We may update our Privacy Policy from time to time. We will notify you of any changes by 
          posting the new Privacy Policy on this page and updating the "Last updated" date.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">10. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at <Link href="/contact" className="text-primary hover:underline">our contact page</Link>.
        </p>
      </div>
    </div>
  );
} 