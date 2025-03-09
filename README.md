# QuizLabAI

QuizLabAI is an intelligent quiz generation platform that transforms learning materials into interactive quizzes using AI. Upload your PDF study materials and get customized quizzes to enhance your learning experience.

## Features

- **AI-Powered Quiz Generation**: Upload PDFs and generate quizzes automatically
- **Multiple Question Types**: Support for multiple-choice and open-ended questions
- **Learning Progress Tracking**: Track your mastery of topics over time
- **Export Options**: Export quizzes to various formats (DOC, CSV, Anki)
- **Exam Mode**: Create custom exams from multiple quizzes
- **Subscription Plans**: Free and premium plans with different features

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL (via Supabase)
- **Payments**: Stripe
- **AI**: OpenAI API

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- Stripe account (for payments)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/QuizLabAI.git
   cd QuizLabAI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following variables:
   ```
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   
   # Stripe
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   STRIPE_PREMIUM_PLAN_PRICE_ID=your_premium_plan_price_id
   STRIPE_PREMIUM_ANNUAL_PLAN_PRICE_ID=your_premium_annual_plan_price_id
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

The project can be deployed on Vercel or any other Next.js-compatible hosting platform.

### Domain Setup

To connect your custom domain (e.g., quizlabai.com) to your deployed application:

1. **Deploy to Vercel**:
   ```bash
   npm run deploy
   ```
   This will run the deployment helper script that guides you through the process.

2. **Configure DNS in Porkbun**:
   - Add an A record for the apex domain (quizlabai.com) pointing to Vercel's IP (76.76.21.21)
   - Add a CNAME record for the www subdomain (www.quizlabai.com) pointing to cname.vercel-dns.com

3. **Update Environment Variables**:
   - Set `NEXT_PUBLIC_SITE_URL` to your domain (https://quizlabai.com)
   - Update Supabase redirect URLs to include your domain

For detailed instructions, refer to the [DOMAIN_SETUP_GUIDE.md](DOMAIN_SETUP_GUIDE.md) file.

## License

[MIT](LICENSE)
