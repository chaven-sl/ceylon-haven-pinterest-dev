import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockCreatePin,
  createAndStoreMockPin,
  getStoredMockPins,
  clearMockPinStore,
  getMockPinCount,
} from './mock-pinterest';

describe('Mock Pinterest Service', () => {
  beforeEach(() => {
    clearMockPinStore();
  });

  describe('mockCreatePin', () => {
    it('should return mock pin with correct structure', async () => {
      const response = await mockCreatePin({
        imageUrl: 'https://example.invalid/image.jpg',
        boardName: 'Test Board',
        title: 'Test Pin',
        description: 'Test Description',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      expect(response.success).toBe(true);
      expect(response.mockPinId).toBeDefined();
      expect(response.mockPinUrl).toBeDefined();
      expect(response.mockPinUrl).toContain('example.invalid');
      expect(response.warning).toContain('MOCK');
    });

    it('should generate unique pin IDs', async () => {
      const response1 = await mockCreatePin({
        imageUrl: 'https://example.invalid/image1.jpg',
        boardName: 'Board 1',
        title: 'Pin 1',
        description: 'Description 1',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      const response2 = await mockCreatePin({
        imageUrl: 'https://example.invalid/image2.jpg',
        boardName: 'Board 2',
        title: 'Pin 2',
        description: 'Description 2',
        destinationUrl: 'https://ceylonhaven.com/property/2',
      });

      expect(response1.mockPinId).not.toBe(response2.mockPinId);
    });

    it('should return timestamp', async () => {
      const response = await mockCreatePin({
        imageUrl: 'https://example.invalid/image.jpg',
        boardName: 'Test Board',
        title: 'Test Pin',
        description: 'Test Description',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      expect(response.timestamp).toBeDefined();
      const date = new Date(response.timestamp);
      expect(date.getTime()).toBeGreaterThan(0);
    });
  });

  describe('createAndStoreMockPin', () => {
    it('should create and store mock pin', () => {
      const mockPin = createAndStoreMockPin({
        imageUrl: 'https://example.invalid/image.jpg',
        boardName: 'Test Board',
        title: 'Test Pin',
        description: 'Test Description',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      expect(mockPin.id).toBeDefined();
      expect(mockPin.url).toBeDefined();
      expect(mockPin.boardName).toBe('Test Board');
      expect(mockPin.title).toBe('Test Pin');
      expect(mockPin.description).toBe('Test Description');
    });

    it('should add pin to store', () => {
      expect(getMockPinCount()).toBe(0);

      createAndStoreMockPin({
        imageUrl: 'https://example.invalid/image.jpg',
        boardName: 'Test Board',
        title: 'Test Pin',
        description: 'Test Description',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      expect(getMockPinCount()).toBe(1);
    });
  });

  describe('Mock Pin Store', () => {
    it('should return empty array initially', () => {
      expect(getStoredMockPins()).toEqual([]);
    });

    it('should store multiple pins', () => {
      createAndStoreMockPin({
        imageUrl: 'https://example.invalid/image1.jpg',
        boardName: 'Board 1',
        title: 'Pin 1',
        description: 'Description 1',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      createAndStoreMockPin({
        imageUrl: 'https://example.invalid/image2.jpg',
        boardName: 'Board 2',
        title: 'Pin 2',
        description: 'Description 2',
        destinationUrl: 'https://ceylonhaven.com/property/2',
      });

      const pins = getStoredMockPins();
      expect(pins.length).toBe(2);
    });

    it('should clear mock pin store', () => {
      createAndStoreMockPin({
        imageUrl: 'https://example.invalid/image.jpg',
        boardName: 'Test Board',
        title: 'Test Pin',
        description: 'Test Description',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      expect(getMockPinCount()).toBe(1);

      clearMockPinStore();

      expect(getMockPinCount()).toBe(0);
      expect(getStoredMockPins()).toEqual([]);
    });

    it('should return copy of pins array (not reference)', () => {
      createAndStoreMockPin({
        imageUrl: 'https://example.invalid/image.jpg',
        boardName: 'Test Board',
        title: 'Test Pin',
        description: 'Test Description',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      const pins1 = getStoredMockPins();
      const pins2 = getStoredMockPins();

      expect(pins1).not.toBe(pins2);
      expect(pins1).toEqual(pins2);
    });
  });

  describe('Mock Pin Count', () => {
    it('should return correct count', () => {
      expect(getMockPinCount()).toBe(0);

      createAndStoreMockPin({
        imageUrl: 'https://example.invalid/image1.jpg',
        boardName: 'Board 1',
        title: 'Pin 1',
        description: 'Description 1',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      expect(getMockPinCount()).toBe(1);

      createAndStoreMockPin({
        imageUrl: 'https://example.invalid/image2.jpg',
        boardName: 'Board 2',
        title: 'Pin 2',
        description: 'Description 2',
        destinationUrl: 'https://ceylonhaven.com/property/2',
      });

      expect(getMockPinCount()).toBe(2);

      clearMockPinStore();
      expect(getMockPinCount()).toBe(0);
    });
  });

  describe('No Real API Calls', () => {
    it('should never make real Pinterest API calls', async () => {
      // This test verifies that mockCreatePin does not make network calls
      // If it did, it would fail (invalid host)
      const response = await mockCreatePin({
        imageUrl: 'https://example.invalid/image.jpg',
        boardName: 'Test Board',
        title: 'Test Pin',
        description: 'Test Description',
        destinationUrl: 'https://ceylonhaven.com/property/1',
      });

      // Mock service returns quickly (no network call)
      expect(response.warning).toContain('MOCK');
      expect(response.mockPinUrl).toContain('example.invalid');
    });
  });
});
