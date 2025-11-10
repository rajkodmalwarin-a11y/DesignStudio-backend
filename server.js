const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'https://designstudio.vercel.app',   // your live frontend URL
    'http://localhost:5173',             // for local dev (if using Vite)
    'http://localhost:3000'              // for React dev server
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// API Keys
const FAL_AI_API_KEY = process.env.FAL_AI_API_KEY;

console.log('🚀 Multi-AI Server Started');
console.log(`🔑 FAL AI: ${FAL_AI_API_KEY ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
console.log(`🌐 Pollinations.ai: ✅ ALWAYS AVAILABLE`);
console.log(`🔧 Port: ${PORT}`);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Multi-AI Server is running',
    services: {
      falAI: !!FAL_AI_API_KEY,
      pollinations: true
    },
    timestamp: new Date().toISOString()
  });
});

// Get available AI services
app.get('/api/ai-services', (req, res) => {
  res.json({
    services: [
      {
        id: 'fal-ai',
        name: 'FAL AI',
        available: !!FAL_AI_API_KEY,
        description: 'High quality, various models',
        premium: true
      },
      {
        id: 'pollinations',
        name: 'Pollinations.ai',
        available: true,
        description: 'Free & reliable alternative',
        premium: false
      }
    ]
  });
});

// Main generation endpoint
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, type = 'logo', aiService = 'fal-ai' } = req.body;

    console.log('🎨 Generation request:', { prompt, type, aiService });

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    let result;

    // Route to selected AI service
    if (aiService === 'pollinations') {
      result = await generateWithPollinations(prompt, type);
    } else if (aiService === 'fal-ai') {
      if (!FAL_AI_API_KEY) {
        return res.status(400).json({ 
          error: 'FAL AI not configured',
          message: 'Please configure FAL_AI_API_KEY in your server environment'
        });
      }
      result = await generateWithFAL(prompt, type);
    } else {
      return res.status(400).json({ error: 'Invalid AI service selected' });
    }

    res.json(result);

  } catch (error) {
    console.error('💥 Generation failed:', error);
    res.status(500).json({
      error: 'Image generation failed',
      message: error.message
    });
  }
});

// FAL AI Generation
async function generateWithFAL(prompt, type) {
  const { fal } = require('@fal-ai/client');
  fal.config({ credentials: FAL_AI_API_KEY });

  // Model selection
  const model = type === 'logo' ? 'fal-ai/recraft-v3' : 'fal-ai/flux/dev';
  
  // Prompt enhancement
  const enhancedPrompt = type === 'logo' 
    ? `${prompt}, vector logo, flat design, minimalist, clean lines, white background, professional branding`
    : `${prompt}, t-shirt design, apparel graphic, wearable art, print ready, high contrast, centered composition`;

  console.log(`🤖 Using FAL AI: ${model}`);
  console.log(`🎯 Prompt: ${enhancedPrompt}`);

  const result = await fal.subscribe(model, {
    input: {
      prompt: enhancedPrompt,
      image_size: "square_hd",
      num_inference_steps: type === 'logo' ? 20 : 28,
      num_images: 1,
      guidance_scale: 7.5,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        console.log('📝 FAL AI Progress:', update.logs.map(log => log.message).join(', '));
      }
    },
  });

  if (result && result.images && result.images[0] && result.images[0].url) {
    console.log('✅ FAL AI image generated successfully');
    
    // Convert to base64
    const imageResponse = await fetch(result.images[0].url);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch FAL AI image: ${imageResponse.status}`);
    }
    
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return {
      success: true,
      base64: dataUrl,
      service: 'fal-ai',
      model: model,
      message: 'Generated with FAL AI (Premium)'
    };
  }
  throw new Error('FAL AI generation failed - no image returned');
}

// Pollinations.ai Generation
async function generateWithPollinations(prompt, type) {
  // Enhanced prompt for better results
  const enhancedPrompt = type === 'logo' 
    ? `${prompt}, minimalist logo, vector art, simple, clean, white background, icon style`
    : `${prompt}, t-shirt design, digital art, clean, centered, bold colors, graphic design`;

  // Build Pollinations.ai URL
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=512&height=512&nofeed=true&seed=${Math.floor(Math.random() * 1000)}`;
  
  console.log(`🤖 Using Pollinations.ai`);
  console.log(`🎯 Prompt: ${enhancedPrompt}`);
  console.log(`🔗 URL: ${pollinationsUrl}`);

  // Fetch image from Pollinations.ai
  const imageResponse = await fetch(pollinationsUrl);
  
  if (!imageResponse.ok) {
    throw new Error(`Pollinations.ai failed: ${imageResponse.status}`);
  }

  // Convert to base64
  const arrayBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  console.log('✅ Pollinations.ai image generated successfully');

  return {
    success: true,
    base64: dataUrl,
    service: 'pollinations',
    model: 'stable-diffusion',
    message: 'Generated with Pollinations.ai (Free)'
  };
}

// Test endpoint for both services
app.post('/api/test-generation', async (req, res) => {
  try {
    const { aiService = 'pollinations' } = req.body;
    const testPrompt = "a simple red apple logo, minimalist";

    console.log(`🧪 Testing ${aiService} with: ${testPrompt}`);

    let result;
    if (aiService === 'pollinations') {
      result = await generateWithPollinations(testPrompt, 'logo');
    } else if (aiService === 'fal-ai' && FAL_AI_API_KEY) {
      result = await generateWithFAL(testPrompt, 'logo');
    } else {
      result = await generateWithPollinations(testPrompt, 'logo');
    }

    res.json({
      success: true,
      message: `Test generation successful with ${aiService}`,
      service: result.service,
      base64: result.base64.substring(0, 100) + '...' // Preview
    });

  } catch (error) {
    console.error('❌ Test generation failed:', error);
    res.status(500).json({
      error: 'Test generation failed',
      message: error.message
    });
  }
});

// Service status endpoint
app.get('/api/service-status', (req, res) => {
  res.json({
    falAI: {
      configured: !!FAL_AI_API_KEY,
      status: !!FAL_AI_API_KEY ? 'READY' : 'NOT_CONFIGURED'
    },
    pollinations: {
      configured: true,
      status: 'READY'
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`✅ Multi-AI Server running on http://localhost:${PORT}`);
  console.log(`🔧 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Services: http://localhost:${PORT}/api/ai-services`);
  console.log(`🔧 Status: http://localhost:${PORT}/api/service-status`);
  
  if (!FAL_AI_API_KEY) {
    console.log('\n⚠️  FAL AI is not configured - only Pollinations.ai will work');
    console.log('   Add FAL_AI_API_KEY=your_key to server/.env file');
  } else {
    console.log('🎉 Both AI services are ready!');
  }
});
// Root route
app.get('/', (req, res) => {
  res.send('✅ Multi-AI Backend is running on Render. Try /api/health or /api/ai-services');
});
