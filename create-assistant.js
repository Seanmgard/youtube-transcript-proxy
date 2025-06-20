const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  } catch (error) {
    console.error('Error loading .env.local file:', error.message);
    console.log('Please ensure you have a .env.local file with your OPENAI_API_KEY');
    return false;
  }
  return true;
}

async function createAssistant() {
  console.log('🤖 QuizLab AI Assistant Creator\n');
  
  if (!loadEnv()) {
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env.local file');
    console.log('Please add your OpenAI API key to .env.local:');
    console.log('OPENAI_API_KEY=your_api_key_here');
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    console.log('Creating OpenAI Assistant...');
    
    const assistant = await openai.beta.assistants.create({
      name: "QuizLab AI Assistant",
      instructions: `You are an expert quiz creator and educational content analyzer. When given a document, follow these instructions:

1. ANALYZE the document content thoroughly and completely
2. CREATE high-quality quiz questions based on the specific information in the document
3. ENSURE questions test real understanding of the material, not generic knowledge
4. FORMAT your response as valid JSON with this exact structure:

{
  "title": "Quiz Title Based on Document Topic",
  "questions": [
    {
      "text": "Specific question based on document content",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "The correct option text"
    }
  ]
}

IMPORTANT REQUIREMENTS:
- Generate questions that reference specific facts, concepts, or details from the document
- Never use generic placeholder text like "Please review the document"
- Ensure all questions have clear, accurate answers based on the document content
- Vary question difficulty as requested by the user
- Support both multiple_choice and open_ended question types
- Always return valid JSON format`,
      model: "gpt-4",
      tools: [{ type: "file_search" }]
    });
    
    console.log('✅ Assistant created successfully!');
    console.log('📋 Assistant Details:');
    console.log(`   ID: ${assistant.id}`);
    console.log(`   Name: ${assistant.name}`);
    console.log(`   Model: ${assistant.model}`);
    
    // Update .env.local file
    try {
      const envPath = path.join(__dirname, '.env.local');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('OPENAI_ASSISTANT_ID=')) {
        envContent = envContent.replace(/OPENAI_ASSISTANT_ID=.*/, `OPENAI_ASSISTANT_ID=${assistant.id}`);
      } else {
        envContent += `\nOPENAI_ASSISTANT_ID=${assistant.id}`;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env.local with Assistant ID');
    } catch (error) {
      console.log('⚠️  Could not update .env.local automatically');
      console.log('Please add this to your .env.local file:');
      console.log(`OPENAI_ASSISTANT_ID=${assistant.id}`);
    }
    
    console.log('\n🎉 Setup complete! Your assistant is ready to generate quizzes.');
    
  } catch (error) {
    console.error('❌ Error creating assistant:', error.message);
    
    if (error.code === 'invalid_api_key') {
      console.log('Please check your OpenAI API key in .env.local');
    } else if (error.code === 'insufficient_quota') {
      console.log('Your OpenAI account has insufficient credits. Please add credits to your account.');
    }
  }
}

// Run the script
if (require.main === module) {
  createAssistant().catch(console.error);
}

module.exports = { createAssistant }; 