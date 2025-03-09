#!/usr/bin/env node

/**
 * This script helps with deploying QuizLabAI to Vercel
 * It checks for required environment variables and provides guidance
 */

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════════════════╗
║                 QuizLabAI Deployment Helper                   ║
║                                                               ║
║  This script will help you deploy QuizLabAI to Vercel and     ║
║  connect it to your quizlabai.com domain.                     ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}`);

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'ignore' });
  console.log(`${colors.green}✓ Vercel CLI is installed${colors.reset}`);
} catch (error) {
  console.log(`${colors.red}✗ Vercel CLI is not installed${colors.reset}`);
  console.log(`${colors.yellow}Please install it with: npm install -g vercel${colors.reset}`);
  process.exit(1);
}

// Check if .env.local exists
if (!fs.existsSync('.env.local')) {
  console.log(`${colors.red}✗ .env.local file not found${colors.reset}`);
  console.log(`${colors.yellow}Please create a .env.local file with your environment variables${colors.reset}`);
  process.exit(1);
}

console.log(`${colors.green}✓ .env.local file found${colors.reset}`);

// Check if NEXT_PUBLIC_SITE_URL is set in .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
if (!envContent.includes('NEXT_PUBLIC_SITE_URL=https://quizlabai.com')) {
  console.log(`${colors.yellow}! NEXT_PUBLIC_SITE_URL is not set to https://quizlabai.com in .env.local${colors.reset}`);
  console.log(`${colors.yellow}  It's recommended to set this before deploying${colors.reset}`);
}

// Ask if user wants to proceed with deployment
rl.question(`${colors.bright}Do you want to proceed with deployment to Vercel? (y/n) ${colors.reset}`, (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log(`${colors.yellow}Deployment cancelled${colors.reset}`);
    rl.close();
    return;
  }

  console.log(`${colors.cyan}Starting deployment process...${colors.reset}`);
  
  try {
    // Run vercel command
    console.log(`${colors.cyan}Running vercel command...${colors.reset}`);
    execSync('vercel', { stdio: 'inherit' });
    
    console.log(`\n${colors.green}✓ Initial deployment completed${colors.reset}`);
    
    // Ask if user wants to deploy to production
    rl.question(`${colors.bright}Do you want to deploy to production? (y/n) ${colors.reset}`, (prodAnswer) => {
      if (prodAnswer.toLowerCase() !== 'y') {
        console.log(`${colors.yellow}Production deployment skipped${colors.reset}`);
        showNextSteps();
        rl.close();
        return;
      }
      
      try {
        // Run vercel --prod command
        console.log(`${colors.cyan}Deploying to production...${colors.reset}`);
        execSync('vercel --prod', { stdio: 'inherit' });
        
        console.log(`\n${colors.green}✓ Production deployment completed${colors.reset}`);
        showNextSteps();
      } catch (error) {
        console.log(`${colors.red}✗ Production deployment failed${colors.reset}`);
        console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
      }
      
      rl.close();
    });
  } catch (error) {
    console.log(`${colors.red}✗ Deployment failed${colors.reset}`);
    console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
    rl.close();
  }
});

function showNextSteps() {
  console.log(`\n${colors.bright}${colors.cyan}Next Steps:${colors.reset}`);
  console.log(`${colors.bright}1. Go to your Vercel dashboard and configure your domain:${colors.reset}`);
  console.log(`   - Add quizlabai.com and www.quizlabai.com to your domains`);
  console.log(`   - Get the DNS records provided by Vercel`);
  console.log(`\n${colors.bright}2. Configure DNS in Porkbun:${colors.reset}`);
  console.log(`   - Add the A record for the apex domain (quizlabai.com)`);
  console.log(`   - Add the CNAME record for the www subdomain`);
  console.log(`\n${colors.bright}3. Configure Supabase Auth Redirect URLs:${colors.reset}`);
  console.log(`   - Add https://quizlabai.com/auth/callback to your Supabase redirect URLs`);
  console.log(`\n${colors.bright}4. Update Stripe Webhook Endpoints (if using Stripe):${colors.reset}`);
  console.log(`   - Update your webhook endpoint to: https://quizlabai.com/api/stripe/webhook`);
  console.log(`\n${colors.bright}For detailed instructions, refer to the DOMAIN_SETUP_GUIDE.md file${colors.reset}`);
} 