# Connecting QuizLabAI to quizlabai.com Domain

This guide provides step-by-step instructions for connecting your QuizLabAI application to your quizlabai.com domain registered with Porkbun.

## Prerequisites

- A Porkbun account with the quizlabai.com domain registered
- A Vercel account (free tier is sufficient)
- Your QuizLabAI codebase (which you already have)

## Step 1: Deploy Your Application to Vercel

1. Create a Vercel account at https://vercel.com if you don't already have one
2. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```
3. Login to Vercel from your terminal:
   ```bash
   vercel login
   ```
4. Navigate to your project directory and deploy:
   ```bash
   cd /path/to/QuizLabAI
   vercel
   ```
5. Follow the prompts to link your project to your Vercel account
6. Once the initial deployment is complete, deploy to production:
   ```bash
   vercel --prod
   ```

## Step 2: Configure Your Domain in Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your QuizLabAI project
3. Go to "Settings" > "Domains"
4. Add your domain: `quizlabai.com`
5. Also add the www subdomain: `www.quizlabai.com`
6. Vercel will provide you with DNS records that you need to add to Porkbun

## Step 3: Configure DNS in Porkbun

1. Log in to your Porkbun account
2. Go to "Domain Management" and select quizlabai.com
3. Click on "DNS Records"
4. Add the following records (using the values provided by Vercel):

### For the apex domain (quizlabai.com):
- Type: A
- Host: @
- Value: 76.76.21.21 (Vercel's IP address)
- TTL: 600 seconds

### For the www subdomain:
- Type: CNAME
- Host: www
- Value: cname.vercel-dns.com.
- TTL: 600 seconds

### For email verification (optional but recommended):
- Type: TXT
- Host: @
- Value: The verification string provided by Vercel
- TTL: 600 seconds

## Step 4: Configure SSL Certificate

Vercel will automatically provision and manage SSL certificates for your domain. Once the DNS propagation is complete (which can take up to 48 hours, but usually much less), Vercel will issue an SSL certificate for your domain.

## Step 5: Update Environment Variables

1. In your Vercel project settings, go to "Environment Variables"
2. Ensure the following variables are set:
   - `NEXT_PUBLIC_SITE_URL`: https://quizlabai.com
   - All other environment variables from your .env.local file

## Step 6: Configure Supabase Auth Redirect URLs

1. Log in to your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Go to "Authentication" > "URL Configuration"
4. Add the following URLs to the "Redirect URLs" section:
   - https://quizlabai.com/auth/callback
   - https://www.quizlabai.com/auth/callback

## Step 7: Update Stripe Webhook Endpoints (if using Stripe)

1. Log in to your Stripe dashboard: https://dashboard.stripe.com
2. Go to "Developers" > "Webhooks"
3. Update your webhook endpoint to: https://quizlabai.com/api/stripe/webhook
4. Ensure the webhook is configured to listen for the appropriate events

## Step 8: Test Your Domain

1. Visit https://quizlabai.com in your browser
2. Test all functionality, including:
   - User registration and login
   - Quiz creation and management
   - Payment processing (if applicable)
   - Any other critical features

## Troubleshooting

### DNS Propagation Issues
- DNS changes can take up to 48 hours to propagate globally
- Use https://dnschecker.org to check if your DNS records have propagated

### SSL Certificate Issues
- If your SSL certificate isn't working, verify your DNS settings
- Ensure there are no conflicting DNS records

### Authentication Issues
- If users can't log in, check your Supabase redirect URLs
- Ensure your environment variables are correctly set in Vercel

### 404 Errors
- If you're getting 404 errors, check your Vercel deployment logs
- Ensure your build completed successfully

## Maintenance

### Renewing Your Domain
- Porkbun will notify you when your domain is up for renewal
- Set up auto-renewal to avoid service interruptions

### Updating SSL Certificates
- Vercel automatically renews SSL certificates
- No manual action is required

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Porkbun DNS Management Guide](https://porkbun.com/products/domains)
- [Supabase Authentication Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment) 