/**
 * Test data generators for project testing
 */

export interface ProjectTestData {
  name: string;
  description?: string;
  keywords?: string[];
  citations?: string[];
  is_public?: boolean;
}

/**
 * Generate test project data
 * @param overrides Optional properties to override defaults
 * @returns Project test data object
 */
export function generateProjectData(overrides?: Partial<ProjectTestData>): ProjectTestData {
  const timestamp = Date.now();

  return {
    name: `Test Project ${timestamp}`,
    description: 'Test project description',
    keywords: ['test', 'e2e', 'canvas'],
    citations: ['Test Citation 1', 'Test Citation 2'],
    is_public: false,
    ...overrides,
  };
}

/**
 * Generate project with specific metadata for testing
 * @returns Project with predefined metadata
 */
export function generateProjectWithMetadata(): ProjectTestData {
  return {
    name: 'Metadata Test Project',
    description: 'Project for testing metadata storage',
    keywords: ['cell', 'biology', 'membrane'],
    citations: [
      'Smith et al. (2023). Cell Biology Research.',
      'Jones & Brown (2022). Molecular Dynamics.',
    ],
    is_public: false,
  };
}
