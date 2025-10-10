interface PlaceNameVerificationResult {
  verifiedCity: string;
  verifiedState: string;
  confidence: number;
  corrected: boolean;
  originalInput: string;
}

const verificationCache = new Map<string, PlaceNameVerificationResult>();

export async function verifyPlaceName(city: string, state: string): Promise<PlaceNameVerificationResult> {
  const cacheKey = `${city.toLowerCase()},${state.toLowerCase()}`;
  
  if (verificationCache.has(cacheKey)) {
    return verificationCache.get(cacheKey)!;
  }

  try {
    const response = await fetch('/api/verify-place-name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ city, state }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: PlaceNameVerificationResult = await response.json();
    verificationCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Place name verification failed:', error);
    // Fallback to original input
    return {
      verifiedCity: city,
      verifiedState: state,
      confidence: 0,
      corrected: false,
      originalInput: `${city}, ${state}`,
    };
  }
}
