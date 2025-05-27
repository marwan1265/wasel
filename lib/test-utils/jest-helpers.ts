// Helper types for Jest mocking in TypeScript

// This helps avoid the 'never' type issues when using jest.mocked()
declare global {
  namespace jest {
    interface Matchers<R> {
      // Add any custom matchers here if needed
    }
  }
}

// Export empty object to make this a module
export { };
