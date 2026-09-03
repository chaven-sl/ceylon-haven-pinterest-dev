/**
 * Mock Pinterest Service
 * Returns mock pin IDs and URLs for testing.
 * This is NOT for production use.
 * Real Pinterest API calls should never be made.
 */

export interface MockPinCreationRequest {
  imageUrl: string;
  boardName: string;
  title: string;
  description: string;
  destinationUrl: string;
}

export interface MockPinCreationResponse {
  success: boolean;
  mockPinId: string;
  mockPinUrl: string;
  message: string;
  timestamp: string;
  warning: string;
}

/**
 * Mock Pinterest pin creation.
 * Returns a fake pin ID and URL.
 * Never makes a real Pinterest API call.
 *
 * @param _request The pin creation request (unused in mock)
 * @returns Mock response with fake pin ID
 */
export async function mockCreatePin(
  _request: MockPinCreationRequest,
): Promise<MockPinCreationResponse> {
  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 500 + 100));

  // Generate a fake pin ID based on inputs
  const timestamp = Date.now();
  const fakePinId = `mock_pin_${timestamp}_${Math.random().toString(36).substring(7)}`;
  const fakePinUrl = `https://example.invalid/pin/${fakePinId}`;

  return {
    success: true,
    mockPinId: fakePinId,
    mockPinUrl: fakePinUrl,
    message: `Mock pin created successfully: ${fakePinId}`,
    timestamp: new Date().toISOString(),
    warning:
      'THIS IS A MOCK RESPONSE. No real Pinterest pin was created. ' +
      'This is for testing Phase 2 only.',
  };
}

/**
 * Mock Pin structure for testing.
 */
export interface MockPin {
  id: string;
  url: string;
  boardName: string;
  title: string;
  description: string;
  destinationUrl: string;
  createdAt: string;
}

/**
 * In-memory store of mock pins created during testing.
 * Useful for validating test scenarios.
 */
let mockPinStore: MockPin[] = [];

/**
 * Create a mock pin and store it.
 * Used for testing the full pipeline.
 *
 * @param request The pin creation request
 * @returns Created mock pin
 */
export function createAndStoreMockPin(request: MockPinCreationRequest): MockPin {
  const timestamp = Date.now();
  const mockPin: MockPin = {
    id: `mock_pin_${timestamp}_${Math.random().toString(36).substring(7)}`,
    url: `https://example.invalid/pin/${timestamp}`,
    boardName: request.boardName,
    title: request.title,
    description: request.description,
    destinationUrl: request.destinationUrl,
    createdAt: new Date().toISOString(),
  };

  mockPinStore.push(mockPin);
  return mockPin;
}

/**
 * Get all stored mock pins.
 * @returns Array of created mock pins
 */
export function getStoredMockPins(): MockPin[] {
  return [...mockPinStore];
}

/**
 * Clear the mock pin store.
 * Useful for test cleanup.
 */
export function clearMockPinStore(): void {
  mockPinStore = [];
}

/**
 * Get count of stored mock pins.
 * @returns Number of mock pins in store
 */
export function getMockPinCount(): number {
  return mockPinStore.length;
}
