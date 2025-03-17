import Link from 'next/link';

export default function TermsPage() {
  console.log('Rendering TermsPage');
  return (
    <div className="container mx-auto px-4 py-24 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      
      <div className="prose prose-lg dark:prose-invert">
        <p className="text-lg mb-6">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introduction</h2>
        <p>
          Welcome to QuizLab AI. These Terms of Service govern your use of our website and services.
          These terms constitute a legally binding agreement between you and Sean Gardner Consulting LLC (doing business as QuizLab AI) concerning your access to and use of the the https://quizlabai.com website and any related services (collectively, the "Service").
          By accessing or using QuizLab AI, you agree to be bound by these Terms.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">2. Definitions</h2>
        <p>
          <strong>"Service"</strong> refers to the QuizLab AI website and all services provided therein.<br />
          <strong>"User"</strong> refers to individuals who access or use the Service.<br />
          <strong>"Content"</strong> refers to text, images, and other materials that appear on the Service.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">3. Account Registration</h2>
        <p>
          To use certain features of the Service, you may be required to register for an account. 
          You agree to provide accurate information and to keep this information updated.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">4. Subscription and Payments</h2>
        <p>
          QuizLab AI offers subscription plans with different features. Payment terms and conditions 
          are specified during the subscription process. All payments are processed securely through Stripe.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">5. Refund Policy</h2>
        <p>
          We offer a 30-day money-back guarantee on all premium subscription charges. If you are not satisfied with our service, 
          you may request a refund for any charges that occurred within the last 30 days. To request a refund:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Contact us through our support channels</li>
          <li>Provide your account email and reason for the refund</li>
          <li>Allow up to 5-7 business days for the refund to be processed</li>
        </ul>
        <p className="mb-4">
          Please note:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Refund eligibility is limited to charges that occurred within the last 30 days</li>
          <li>For subscription renewals, only the most recent payment may be eligible for refund</li>
          <li>Refunds will be processed to the original payment method used for the purchase</li>
          <li>We reserve the right to deny refund requests that we determine are not made in good faith</li>
          <li>Upon refund, your account will be downgraded to the free tier</li>
          <li>If you've previously received a refund, additional refund requests may be subject to review</li>
        </ul>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">6. User Conduct</h2>
        <p>
          You agree not to use the Service for any illegal purposes or in violation of any applicable laws.
          You are solely responsible for your conduct and any content you submit, post, or display on the Service.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">7. Intellectual Property</h2>
        <p>
          The Service and its original content, features, and functionality are owned by QuizLab AI 
          and are protected by international copyright, trademark, and other intellectual property laws.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">8. Termination</h2>
        <p>
          We may terminate or suspend your account and access to the Service immediately, without prior notice, 
          for conduct that we determine violates these Terms or is harmful to other users, us, or third parties.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">9. Limitation of Liability</h2>
        <p>
          In no event shall QuizLab AI be liable for any indirect, incidental, special, consequential, or punitive damages, 
          including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">10. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. We will provide notice of significant changes 
          by posting the new Terms on the Service and updating the "Last updated" date.
        </p>
        
        <h2 className="text-2xl font-semibold mt-8 mb-4">11. Contact Us</h2>
        <p>
          If you have any questions about these Terms, please contact us at <Link href="/contact" className="text-primary hover:underline">our contact page</Link>.
        </p>
      </div>
    </div>
  );
} 