# Requirements Document

## Introduction

The Git monitoring backend has been implemented but the frontend cannot access it because the Electron IPC methods are not properly exposed in the preload script. The RepoVisualizationModal is falling back to mock data because `electronAPI.invoke` is not available and the Git monitoring IPC handlers are not exposed to the renderer process.

## Requirements

### Requirement 1

**User Story:** As a developer using the repository visualization, I want to see real Git data from the monitoring backend, so that I can view actual repository status and activity.

#### Acceptance Criteria

1. WHEN the RepoVisualizationModal opens THEN the system SHALL attempt to connect to the Git monitoring backend
2. WHEN the Git monitoring backend is available THEN the system SHALL fetch real repository data instead of mock data
3. WHEN Git monitoring IPC methods are called THEN the system SHALL return actual Git repository information
4. WHEN the backend is unavailable THEN the system SHALL gracefully fall back to mock data with appropriate error handling

### Requirement 2

**User Story:** As a developer, I want the Electron preload script to expose Git monitoring methods, so that the renderer process can communicate with the main process Git backend.

#### Acceptance Criteria

1. WHEN the preload script loads THEN it SHALL expose `git:watchProject` IPC method to the renderer
2. WHEN the preload script loads THEN it SHALL expose `git:listProjectRepos` IPC method to the renderer  
3. WHEN the preload script loads THEN it SHALL expose `git:getRepoState` IPC method to the renderer
4. WHEN the preload script loads THEN it SHALL expose `git:event` listener for real-time Git events
5. WHEN IPC methods are called THEN they SHALL properly invoke the corresponding main process handlers

### Requirement 3

**User Story:** As a user of the application, I want real-time Git activity updates in the visualization, so that I can see live changes as they happen in repositories.

#### Acceptance Criteria

1. WHEN Git activity occurs in a monitored repository THEN the system SHALL emit `git:event` to the renderer process
2. WHEN the RepoVisualizationModal receives a Git event THEN it SHALL refresh the repository data automatically
3. WHEN multiple repositories are being monitored THEN events SHALL be filtered by project ID
4. WHEN the modal is closed THEN Git event listeners SHALL be properly cleaned up

### Requirement 4

**User Story:** As a developer, I want proper error handling for Git monitoring integration, so that the application remains stable when the backend is unavailable.

#### Acceptance Criteria

1. WHEN Git monitoring backend is not initialized THEN the system SHALL log appropriate error messages
2. WHEN IPC calls fail THEN the system SHALL catch errors and fall back to mock data
3. WHEN the Electron environment is not available THEN the system SHALL detect this and use mock data
4. WHEN network or file system errors occur THEN the system SHALL handle them gracefully without crashing