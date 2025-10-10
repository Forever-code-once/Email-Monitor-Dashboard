import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let city = '';
  let state = '';
  
  try {
    const requestData = await request.json();
    city = requestData.city;
    state = requestData.state;

    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      );
    }

    // Special handling for La Grange/LaGrange variations
    const normalizedCity = city.trim();
    const normalizedState = state.trim().toUpperCase();
    
    // Handle common La Grange variations
    if (normalizedCity.toLowerCase().includes('la grange') || 
        normalizedCity.toLowerCase().includes('lagrange')) {
      
      // State priority logic - if state is GA, use LaGrange, GA
      if (normalizedState === 'GA') {
        return NextResponse.json({
          verifiedCity: 'LaGrange',
          verifiedState: 'GA',
          confidence: 0.95,
          corrected: true,
          originalInput: `${city}, ${state}`,
        });
      }
      // If state is KY, use La Grange, KY
      else if (normalizedState === 'KY') {
        return NextResponse.json({
          verifiedCity: 'La Grange',
          verifiedState: 'KY',
          confidence: 0.95,
          corrected: true,
          originalInput: `${city}, ${state}`,
        });
      }
      // For other states, try to determine the correct spelling
      else {
        // Default to La Grange for most states
        return NextResponse.json({
          verifiedCity: 'La Grange',
          verifiedState: normalizedState,
          confidence: 0.8,
          corrected: true,
          originalInput: `${city}, ${state}`,
        });
      }
    }

    // Handle other common city name variations
    const cityVariations: { [key: string]: string } = {
      'st marys': 'St. Marys',
      'st mary\'s': 'St. Marys',
      'st. marys': 'St. Marys',
      'st. mary\'s': 'St. Marys',
      'saint marys': 'St. Marys',
      'saint mary\'s': 'St. Marys',
    };

    const lowerCity = normalizedCity.toLowerCase();
    for (const [variation, correct] of Object.entries(cityVariations)) {
      if (lowerCity.includes(variation)) {
        return NextResponse.json({
          verifiedCity: correct,
          verifiedState: normalizedState,
          confidence: 0.9,
          corrected: true,
          originalInput: `${city}, ${state}`,
        });
      }
    }

    // For other cities, use GPT for verification
    const prompt = `You are a US geography expert. Given a city and state, provide the correct standardized spelling and format.

Input: "${city}, ${state}"

Please respond with ONLY a JSON object in this exact format:
{
  "verifiedCity": "Correct City Name",
  "verifiedState": "XX",
  "confidence": 0.95,
  "corrected": true/false,
  "originalInput": "${city}, ${state}"
}

Rules:
1. Use standard US postal abbreviations for states (2 letters)
2. Use proper capitalization and punctuation
3. Handle common variations like "St." vs "Saint"
4. If the city/state combination is invalid, still provide the best guess
5. Confidence should be 0.0-1.0 based on certainty`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const result = JSON.parse(content);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Place name verification error:', error);
    
    // Fallback response
    return NextResponse.json({
      verifiedCity: city || 'Unknown',
      verifiedState: state || 'Unknown',
      confidence: 0,
      corrected: false,
      originalInput: `${city || 'Unknown'}, ${state || 'Unknown'}`,
    });
  }
}
